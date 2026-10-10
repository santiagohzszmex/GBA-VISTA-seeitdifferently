begin;
create table workspace_private.license_codes(
 id uuid primary key default gen_random_uuid(),code_hash text not null unique,duration_seconds bigint not null check(duration_seconds between 3600 and 315360000),
 assigned_user_id uuid references auth.users(id),issued_by uuid not null references auth.users(id),issued_at timestamptz not null default now(),redeem_before timestamptz,
 redeemed_by uuid references auth.users(id),redeemed_at timestamptz,revoked_at timestamptz,label text not null);
create table public.workspace_licenses(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),code_id uuid not null unique references workspace_private.license_codes(id),
 starts_at timestamptz not null,expires_at timestamptz not null,revoked_at timestamptz,check(expires_at>starts_at));
create table workspace_private.activation_limits(user_id uuid primary key references auth.users(id),attempts integer not null,started_at timestamptz not null);
alter table public.workspace_licenses enable row level security;
revoke all on public.workspace_licenses from public,anon,authenticated;
grant select on public.workspace_licenses to authenticated;
create policy license_read on public.workspace_licenses for select to authenticated using(workspace_private.session_active() and (user_id=auth.uid() or workspace_private.allowed('platform.manage',null)));
create function public.workspace_license_recipient(p_handle text) returns uuid language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare h text; ids uuid[];
begin
 perform workspace_private.require('platform.manage',null);
 h:=lower(regexp_replace(trim(regexp_replace(trim(coalesce(p_handle,'')),'^@+','','g')),'[[:space:]]+',' ','g'));
 if length(h) not between 3 and 64 then raise exception 'Escribe un GBA ID válido';end if;
 select array_agg(id) into ids from public.usuarios where lower(regexp_replace(trim(nombre),'[[:space:]]+',' ','g'))=h;
 if coalesce(array_length(ids,1),0)<>1 then raise exception 'No encontramos un GBA ID único con ese nombre';end if;
 return ids[1];
end;$$;
revoke all on function public.workspace_license_recipient(text) from public,anon;
grant execute on function public.workspace_license_recipient(text) to authenticated;
create function public.workspace_issue_license(p_duration_seconds bigint,p_label text,p_user_id uuid default null,p_redeem_before timestamptz default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare secret text; i uuid;
begin
 perform workspace_private.require('platform.manage',null);
 if length(trim(coalesce(p_label,''))) not between 1 and 120 or (p_redeem_before is not null and p_redeem_before<=now()) then raise exception 'Etiqueta o fecha inválida';end if;
 secret:=upper(encode(extensions.gen_random_bytes(24),'hex'));
 insert into workspace_private.license_codes(code_hash,duration_seconds,assigned_user_id,issued_by,redeem_before,label) values(encode(sha256(convert_to(secret,'UTF8')),'hex'),p_duration_seconds,p_user_id,auth.uid(),p_redeem_before,p_label) returning id into i;
 perform workspace_private.log(null,null,null,null,'license.issued',i,jsonb_build_object('duration_seconds',p_duration_seconds,'label',p_label,'assigned_user_id',p_user_id));
 return jsonb_build_object('id',i,'code',secret,'duration_seconds',p_duration_seconds);
end;$$;
create function public.workspace_activate_license(p_code text) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c workspace_private.license_codes; n integer; l public.workspace_licenses;
begin
 if not workspace_private.session_active() then return jsonb_build_object('error','Sesión inválida');end if;
 insert into workspace_private.activation_limits values(auth.uid(),1,now()) on conflict(user_id) do update set attempts=case when workspace_private.activation_limits.started_at<now()-interval '1 hour' then 1 else workspace_private.activation_limits.attempts+1 end,started_at=case when workspace_private.activation_limits.started_at<now()-interval '1 hour' then now() else workspace_private.activation_limits.started_at end returning attempts into n;
 if n>8 then return jsonb_build_object('error','Demasiados intentos. Vuelve a intentarlo en una hora.');end if;
 p_code:=upper(regexp_replace(coalesce(p_code,''),'[-[:space:]]','','g'));
 select * into c from workspace_private.license_codes where code_hash=encode(sha256(convert_to(p_code,'UTF8')),'hex') for update;
 if length(p_code)<>48 or c.id is null or c.revoked_at is not null or (c.redeem_before is not null and c.redeem_before<=now()) or (c.assigned_user_id is not null and c.assigned_user_id<>auth.uid()) or (c.redeemed_by is not null and c.redeemed_by<>auth.uid()) then
  perform workspace_private.log(null,null,null,null,'license.activation_failed',null);return jsonb_build_object('error','Código inválido, vencido o ya utilizado');
 end if;
 if c.redeemed_by=auth.uid() then select * into l from public.workspace_licenses where code_id=c.id;return to_jsonb(l);end if;
 insert into public.workspace_licenses(user_id,code_id,starts_at,expires_at) values(auth.uid(),c.id,now(),now()+c.duration_seconds*interval '1 second') returning * into l;
 update workspace_private.license_codes set redeemed_by=auth.uid(),redeemed_at=now() where id=c.id;
 perform workspace_private.log(null,null,null,null,'license.activated',l.id,jsonb_build_object('expires_at',l.expires_at));return to_jsonb(l);
end;$$;
create function public.workspace_license_status() returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('active',workspace_private.session_active() and exists(select 1 from public.workspace_licenses where user_id=auth.uid() and revoked_at is null and starts_at<=now() and expires_at>now()),'expires_at',(select max(expires_at) from public.workspace_licenses where user_id=auth.uid() and revoked_at is null and starts_at<=now() and expires_at>now()));
$$;
create function public.workspace_license_codes() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin perform workspace_private.require('platform.manage',null);return coalesce((select jsonb_agg(to_jsonb(c)-'code_hash' order by issued_at desc) from workspace_private.license_codes c),'[]');end;$$;
create function public.workspace_revoke_license(p_code_id uuid,p_reason text) returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 perform workspace_private.require('platform.manage',null);
 if length(trim(coalesce(p_reason,'')))<10 then raise exception 'Registra el motivo de revocación';end if;
 update workspace_private.license_codes set revoked_at=now() where id=p_code_id;
 update public.workspace_licenses set revoked_at=now() where code_id=p_code_id;
 perform workspace_private.log(null,null,null,null,'license.revoked',p_code_id,jsonb_build_object('reason',p_reason));
end;$$;
revoke all on function public.workspace_issue_license(bigint,text,uuid,timestamptz),public.workspace_activate_license(text),public.workspace_license_status(),public.workspace_license_codes(),public.workspace_revoke_license(uuid,text) from public,anon;
grant execute on function public.workspace_issue_license(bigint,text,uuid,timestamptz),public.workspace_activate_license(text),public.workspace_license_status(),public.workspace_license_codes(),public.workspace_revoke_license(uuid,text) to authenticated;
revoke all on all tables in schema workspace_private from public,anon,authenticated;
commit;
