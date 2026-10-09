-- Deploy the gateway with this migration as one coordinated release.
-- The PIN is now verified only by a service-side endpoint. Auth passwords are random.
begin;
create table workspace_private.id_secrets(user_id uuid primary key references auth.users(id),pin_hash text not null,recovery_hash text,legacy_pin boolean not null default false);
create table workspace_private.id_attempts(key text primary key,attempts integer not null default 0,started_at timestamptz not null default now(),blocked_until timestamptz);
create table workspace_private.id_audit(id bigint generated always as identity primary key,user_id uuid references auth.users(id),action text not null,created_at timestamptz not null default now());
-- Hash existing phrases and remove the plaintext atomically. Candidate codes
-- already have 192-bit entropy; preserve their SHA-256 verifier separately.
insert into workspace_private.id_secrets(user_id,pin_hash,recovery_hash,legacy_pin)
 select a.id,a.encrypted_password,case when length(trim(coalesce(u.frase_seguridad,'')))>0 then extensions.crypt(encode(sha256(convert_to(lower(trim(u.frase_seguridad)),'UTF8')),'hex'),extensions.gen_salt('bf',12)) end,true
 from auth.users a join public.usuarios u on u.id=a.id where a.email like '%@gba.com';
update public.usuarios set frase_seguridad=null where frase_seguridad is not null;
revoke update(frase_seguridad) on public.usuarios from authenticated;
-- Keep the profile column for compatibility, but it can no longer hold secrets.
alter table public.usuarios add constraint gba_no_plaintext_recovery check(frase_seguridad is null);
update auth.users set encrypted_password=extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',12)),updated_at=now() where id in(select user_id from workspace_private.id_secrets);
create function public.gba_id_gateway(p_action text,p_handle text,p_pin text,p_recovery text,p_origin text,p_device text,p_user_id uuid default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare target uuid; secret workspace_private.id_secrets; x text; n integer; blocked timestamptz; h text; code_hash text; valid boolean; v_email text; limit_at integer;
begin
 h:=lower(regexp_replace(trim(p_handle),'[[:space:]]+',' ','g'));
 if length(coalesce(h,'')) not between 3 and 64 or p_pin !~ '^[0-9]{4}$' or length(coalesce(p_recovery,''))>256 or length(coalesce(p_origin,''))>128 or length(coalesce(p_device,''))>128 or p_action not in('login','recover','prepare','register') then return jsonb_build_object('error','Datos inválidos');end if;
 select u.id,a.email into target,v_email from public.usuarios u join auth.users a on a.id=u.id where lower(regexp_replace(trim(u.nombre),'[[:space:]]+',' ','g'))=h;
 -- Acquire all limiter keys in a fixed order to avoid concurrent bypass/deadlocks.
 foreach x in array array['origin:'||coalesce(p_origin,'unknown'),'device:'||coalesce(p_device,'unknown'),'account:'||h] loop
  limit_at:=case when x like 'account:%' then 5 when x like 'device:%' then 80 else 180 end;
  x:=encode(sha256(convert_to(x,'UTF8')),'hex');
  insert into workspace_private.id_attempts(key) values(x) on conflict do nothing;
  select attempts,blocked_until into n,blocked from workspace_private.id_attempts where key=x for update;
  if blocked>now() then insert into workspace_private.id_audit(user_id,action) values(target,p_action||'_throttled');return jsonb_build_object('error','Espera antes de volver a intentarlo','retry_after',greatest(1,ceil(extract(epoch from blocked-now()))));end if;
  update workspace_private.id_attempts set attempts=case when started_at<now()-interval '1 hour' then 1 else attempts+1 end,started_at=case when started_at<now()-interval '1 hour' then now() else started_at end where key=x returning attempts into n;
  if n>=limit_at then update workspace_private.id_attempts set blocked_until=now()+least(900,power(2,least(n-limit_at,10))::integer)*interval '1 second' where key=x;end if;
 end loop;

 if p_action='prepare' then
  if target is not null then return jsonb_build_object('error','No pudimos crear la cuenta');end if;
  return jsonb_build_object('prepared',true);
 end if;
 if p_action='register' then
  if target is distinct from p_user_id or target is null then return jsonb_build_object('error','Cuenta inválida');end if;
  insert into workspace_private.id_secrets(user_id,pin_hash,recovery_hash) values(target,extensions.crypt(p_pin,extensions.gen_salt('bf',12)),extensions.crypt(encode(sha256(convert_to(lower(trim(p_recovery)),'UTF8')),'hex'),extensions.gen_salt('bf',12)));
  insert into workspace_private.id_audit(user_id,action) values(target,'registered');return jsonb_build_object('user_id',target,'email',v_email);
 end if;
 select * into secret from workspace_private.id_secrets where user_id=target;
 if target is null or secret.user_id is null or exists(select 1 from workspace_private.accounts where user_id=target and suspended_at is not null) then return jsonb_build_object('error','GBA ID o secreto incorrectos');end if;
 if p_action='login' then
  valid:=secret.pin_hash=extensions.crypt(case when secret.legacy_pin then 'GBA-'||p_pin||'-SecureVault' else p_pin end,secret.pin_hash);
 else
  valid:=secret.recovery_hash=extensions.crypt(encode(sha256(convert_to(lower(trim(p_recovery)),'UTF8')),'hex'),secret.recovery_hash);
  if not coalesce(valid,false) then select exists(select 1 from gimg_recruitment_private.identities where user_id=target and recovery_hash=encode(sha256(convert_to(lower(regexp_replace(trim(p_recovery),'[-[:space:]]','','g')),'UTF8')),'hex')) into valid;end if;
 end if;
 insert into workspace_private.id_audit(user_id,action) values(target,case when valid then p_action||'_succeeded' else p_action||'_failed' end);
 if not coalesce(valid,false) then return jsonb_build_object('error','GBA ID o secreto incorrectos');end if;
 if p_action='recover' then
  delete from auth.sessions where user_id=target;
  update workspace_private.id_secrets set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf',12)),legacy_pin=false where user_id=target;
  update auth.users set encrypted_password=extensions.crypt(encode(extensions.gen_random_bytes(32),'hex'),extensions.gen_salt('bf',12)),updated_at=now() where id=target;
 end if;
 update workspace_private.id_attempts set attempts=0,blocked_until=null where key=encode(sha256(convert_to('account:'||h,'UTF8')),'hex');
 -- Global origin/device budgets survive successful logins.
 return jsonb_build_object('user_id',target,'email',v_email);
end;$$;
revoke all on function public.gba_id_gateway(text,text,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.gba_id_gateway(text,text,text,text,text,text,uuid) to service_role;
-- Retire both legacy recovery paths: they could restore a brute-forceable Auth password.
do $$ declare f record;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='public' and p.proname in('reset_pin_seguro','gimg_recover_identity')) or (n.nspname='gimg_recruitment_private' and p.proname='recover_identity') loop
  execute format('revoke all on function %s from public,anon,authenticated',f.oid::regprocedure);
 end loop;
end;$$;
create function workspace_private.secure_membership() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if new.membership_status in('active','continuity_requested','continuity_confirmed') and exists(select 1 from auth.users where id=new.user_id and email like '%@gba.com') and not exists(select 1 from workspace_private.id_secrets where user_id=new.user_id) then raise exception 'Esta cuenta debe configurar el acceso seguro de GBA ID antes de incorporarse';end if;
 return new;
end;$$;
revoke all on function workspace_private.secure_membership() from public,anon,authenticated;
create trigger workspace_secure_membership before insert or update on public.workspace_unit_memberships for each row execute function workspace_private.secure_membership();
create function public.workspace_revoke_sessions(p_user_id uuid,p_reason text) returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if auth.uid()<>p_user_id then perform workspace_private.require('platform.manage',null);end if;
 if not workspace_private.session_active() or length(trim(coalesce(p_reason,'')))<10 then raise exception 'Sesión o motivo inválido';end if;
 insert into workspace_private.id_audit(user_id,action) values(p_user_id,'sessions_revoked');
 perform workspace_private.log(null,null,null,null,'sessions.revoked',p_user_id,jsonb_build_object('reason',p_reason));
 delete from auth.sessions where user_id=p_user_id;
end;$$;
revoke all on function public.workspace_revoke_sessions(uuid,text) from public,anon;
grant execute on function public.workspace_revoke_sessions(uuid,text) to authenticated;
revoke all on all tables in schema workspace_private from public,anon,authenticated;
commit;
