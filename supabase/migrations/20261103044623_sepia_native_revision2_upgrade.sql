begin;
-- Upgrade the unshipped isolated revision-1 prototype without deleting licensing records.
grant create on schema public to sepia_access_owner;
set local role sepia_access_owner;
grant create,usage on schema sepia_private to postgres;
update sepia_private.runtime set enabled=false;
update sepia_private.connections set revoked_at=coalesce(revoked_at,now());
alter table sepia_private.connections add column if not exists auth_session_id uuid;
reset role;
create or replace function sepia_private.auth_user_active(u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(select 1 from auth.users where id=u and deleted_at is null and (banned_until is null or banned_until<=now()));
$$;
create or replace function sepia_private.auth_session_active(u uuid,s uuid,policy jsonb) returns boolean language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare r record;timebox integer;inactive integer;
begin
 if not coalesce(policy ?& array['timebox','inactivity','single'],false) then return false;end if;
 timebox:=(policy->>'timebox')::integer;inactive:=(policy->>'inactivity')::integer;
 if timebox is null or inactive is null or timebox<0 or inactive<0 or policy->>'single' not in('true','false') then return false;end if;
 select a.id,a.created_at,a.refreshed_at,a.not_after,to_jsonb(a)->>'aal' aal into r from auth.sessions a where id=s and user_id=u;
 if r.id is null or (r.not_after is not null and r.not_after<=now())
 or (timebox>0 and r.created_at+make_interval(secs=>timebox)<=now())
 or (inactive>0 and coalesce(r.refreshed_at at time zone 'UTC',r.created_at)+make_interval(secs=>inactive)<=now())
 or ((policy->>'single')::boolean and exists(select 1 from auth.sessions where user_id=u and created_at>r.created_at)) then return false;end if;
 if exists(select 1 from auth.mfa_factors where user_id=u and status='verified') and coalesce(r.aal,'')<>'aal2' then return false;end if;
 return true;
end$$;
revoke all on function sepia_private.auth_user_active(uuid),sepia_private.auth_session_active(uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function sepia_private.auth_user_active(uuid),sepia_private.auth_session_active(uuid,uuid,jsonb) to sepia_access_owner;
set local role sepia_access_owner;
create or replace function sepia_private.account_active(u uuid) returns boolean language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select sepia_private.auth_user_active(u) and exists(select 1 from public.usuarios where id=u)
 and not exists(select 1 from workspace_private.accounts where user_id=u and suspended_at is not null);
$$;
create or replace function sepia_private.workspace_expiry(u uuid) returns timestamptz language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select max(expires_at) from sepia_private.licenses where user_id=u and revoked_at is null and starts_at<=now() and expires_at>now() and exists(select 1 from sepia_private.runtime where enabled);
$$;
create or replace function sepia_private.limit_ok(k text,maximum integer,window_seconds integer) returns boolean language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare n integer;begin
 insert into sepia_private.limits(key,attempts) values(k,1) on conflict(key) do update set
 attempts=case when sepia_private.limits.started_at<=now()-make_interval(secs=>window_seconds) then 1 else sepia_private.limits.attempts+1 end,
 started_at=case when sepia_private.limits.started_at<=now()-make_interval(secs=>window_seconds) then now() else sepia_private.limits.started_at end returning attempts into n;
 return n<=maximum;
end$$;
create or replace function sepia_private.web_user(ctx jsonb,csrf text default null) returns uuid language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u uuid:=(ctx->>'user_id')::uuid;s uuid:=(ctx->>'session_id')::uuid;
begin
 if not coalesce((ctx->>'verified')::boolean,false) or (ctx->>'jwt_exp')::bigint<=extract(epoch from now()) then return null;end if;
 if not sepia_private.account_active(u) or not sepia_private.auth_session_active(u,s,ctx->'policy') then return null;end if;
 if csrf is not null and not exists(select 1 from sepia_private.web_sessions where session_id=s and user_id=u and csrf_hash=csrf and expires_at>now()) then return null;end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',s,'role','authenticated')::text,true);
 return u;
end$$;
create or replace function sepia_private.state(c sepia_private.connections) returns jsonb language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare out jsonb;l sepia_private.licenses;old record;owner_access boolean;reason text;
begin
 out:=jsonb_build_object('contrato','gba.sepia.acceso/1.0','revision',2,'servidorUtc',now(),'aplicacion',c.app,
 'cuenta',jsonb_build_object('id',c.user_id,'nombreVisible',(select coalesce(nullif(nombre_publico,''),nombre,'GBA ID') from public.usuarios where id=c.user_id)),
 'conexion',jsonb_build_object('id',c.id,'venceEn',c.expires_at));
 select * into l from sepia_private.licenses where user_id=c.user_id and starts_at<=now() and expires_at>now() and revoked_at is null order by expires_at desc,id limit 1;
 if c.app='workspace' then
  perform set_config('request.jwt.claims',jsonb_build_object('sub',c.user_id,'role','authenticated')::text,true);
  -- The native connection is not an Auth/editorial session. Evaluate existing owner rules explicitly.
  select exists(select 1 from public.usuarios where id=c.user_id and rol='Dueño') and exists(select 1 from public.workspace_access_grants where user_id=c.user_id and access_role='gba_platform_owner' and scope_type='platform' and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now())) into owner_access;
  select id,expires_at into old from public.workspace_licenses where user_id=c.user_id and starts_at<=now() and expires_at>now() and revoked_at is null order by expires_at desc,id limit 1;
  if owner_access then return out||jsonb_build_object('estado','autorizado','acceso',jsonb_build_object('producto','workspace_owner','aplicaciones',jsonb_build_array('workspace')));end if;
  if old.id is not null and (l.id is null or old.expires_at>=l.expires_at) then return out||jsonb_build_object('estado','autorizado','acceso',jsonb_build_object('producto','workspace_legacy','aplicaciones',jsonb_build_array('workspace'),'licenciaId',old.id,'venceEn',old.expires_at));end if;
 end if;
 if l.id is not null then return out||jsonb_build_object('estado','autorizado','acceso',jsonb_build_object('producto','sepia','edicion','01','aplicaciones',jsonb_build_array('workspace','ultramar'),'licenciaId',l.id,'venceEn',l.expires_at));end if;
 select case when revoked_at is not null then 'revocada' else 'vencida' end into reason from sepia_private.licenses where user_id=c.user_id order by expires_at desc limit 1;
 return out||jsonb_build_object('estado','requiere_licencia','motivo',coalesce(reason,'ausente'));
end$$;
create or replace function sepia_private.invalidate() returns trigger language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare u uuid;invalidate boolean:=false;
begin
 if tg_table_name='id_audit' then u:=new.user_id;invalidate:=new.action in('sessions_revoked','recover_succeeded');
 elsif tg_table_name='accounts' then u:=new.user_id;invalidate:=new.suspended_at is not null;
 else u:=new.id;invalidate:=(new.banned_until is not null and new.banned_until>now()) or new.deleted_at is not null;end if;
 if invalidate and u is not null then
  insert into sepia_private.accounts(user_id,epoch) values(u,1) on conflict(user_id) do update set epoch=sepia_private.accounts.epoch+1;
  delete from sepia_private.web_sessions where user_id=u;
  insert into sepia_private.audit(actor_id,action) values(u,'account.connections_invalidated');
 end if;return new;
end$$;
create or replace function sepia_private.delete_account() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 update sepia_private.license_codes set revoked_at=coalesce(revoked_at,now()) where assigned_user_id=old.id or redeemed_by=old.id;
 return old;
end$$;
create or replace function public.sepia_access_gateway(p_op text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c sepia_private.connections;code sepia_private.license_codes;l sepia_private.licenses;u uuid;ep bigint;sid uuid;recipient uuid;
begin
 if not exists(select 1 from sepia_private.runtime where enabled) then return jsonb_build_object('error','service_unavailable');end if;
 if p_op='runtime.status' then return jsonb_build_object('ok',true);end if;
 if p_op='session.create' then
  u:=sepia_private.web_user(p_data->'auth');
  if u is null then return jsonb_build_object('error','session_invalid');end if;
  if not sepia_private.limit_ok('create:'||(p_data->>'origin_hash'),10,60) then return jsonb_build_object('error','rate_limited');end if;
  insert into sepia_private.accounts(user_id) values(u) on conflict do nothing;
  select epoch into ep from sepia_private.accounts where user_id=u;
  insert into sepia_private.connections(token_hash,user_id,app,device_id,device_name,epoch,auth_session_id)
  values(p_data->>'token_hash',u,p_data->>'app',(p_data->>'device_id')::uuid,p_data->>'device_name',ep,(p_data->'auth'->>'session_id')::uuid) returning * into c;
  insert into sepia_private.audit(actor_id,action,entity_id) values(u,'connection.created',c.id);
  return jsonb_build_object('estadoPublico',sepia_private.state(c));
 elsif p_op like 'web.%' then
  u:=sepia_private.web_user(p_data->'web',case when p_op='web.session' then null else p_data->>'csrf_hash' end);
  if u is null then return jsonb_build_object('error','session_invalid');end if;
  sid:=(p_data->'web'->>'session_id')::uuid;
  if p_op='web.session' then
   insert into sepia_private.web_sessions values(sid,u,p_data->>'new_csrf_hash',least(to_timestamp((p_data->'web'->>'jwt_exp')::bigint),now()+interval '1 hour')) on conflict(session_id) do update set csrf_hash=excluded.csrf_hash,expires_at=excluded.expires_at;
   return jsonb_build_object('cuenta',jsonb_build_object('id',u,'nombreVisible',(select coalesce(nullif(nombre_publico,''),nombre,'GBA ID') from public.usuarios where id=u)),
   'admin',workspace_private.allowed('platform.manage',null));
  end if;
  if not sepia_private.limit_ok('web:'||sid,120,60) then return jsonb_build_object('error','rate_limited');end if;
  if p_op='web.connections' then
   return coalesce((select jsonb_agg(jsonb_build_object('id',id,'aplicacion',app,'nombreDispositivo',device_name,'venceEn',expires_at,'revocada',revoked_at is not null or epoch<>coalesce((select a.epoch from sepia_private.accounts a where a.user_id=u),0))) from sepia_private.connections where user_id=u),'[]');
  elsif p_op='web.revoke_connection' then
   update sepia_private.connections set revoked_at=now() where id=(p_data->>'id')::uuid and user_id=u;
   return jsonb_build_object('ok',true);
  elsif p_op='web.revoke_all' then
   -- Existing GBA ID operation emits sessions_revoked; the trigger invalidates every app epoch.
   perform public.workspace_revoke_sessions(u,'Revocación global solicitada desde Sepia');
   return jsonb_build_object('ok',true);
  elsif p_op in('web.issue','web.revoke','web.licenses') then
   if not workspace_private.allowed('platform.manage',null) then return jsonb_build_object('error','access_denied');end if;
   if p_op='web.issue' then
    if nullif(trim(p_data->>'assigned_handle'),'') is not null then recipient:=public.workspace_license_recipient(p_data->>'assigned_handle');end if;
    insert into sepia_private.license_codes(code_hash,duration_seconds,assigned_user_id,issued_by,redeem_before,label) values(p_data->>'code_hash',(p_data->>'duration_seconds')::bigint,recipient,u,(p_data->>'redeem_before')::timestamptz,p_data->>'label') returning * into code;
    if code.redeem_before<=now() then raise exception 'invalid deadline';end if;
    insert into sepia_private.audit(actor_id,action,entity_id) values(u,'license.issued',code.id);
    return jsonb_build_object('id',code.id,'duration_seconds',code.duration_seconds,'redeem_before',code.redeem_before);
   elsif p_op='web.revoke' then
    if length(trim(coalesce(p_data->>'reason','')))<10 or length(p_data->>'reason')>500 then return jsonb_build_object('error','invalid_request');end if;
    update sepia_private.license_codes set revoked_at=now() where id=(p_data->>'id')::uuid;
    update sepia_private.licenses set revoked_at=now() where code_id=(p_data->>'id')::uuid;
    insert into sepia_private.audit(actor_id,action,entity_id,reason) values(u,'license.revoked',(p_data->>'id')::uuid,p_data->>'reason');
    return jsonb_build_object('ok',true);
   end if;
   return coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'label',x.label,'duration_seconds',x.duration_seconds,'assigned_user_id',x.assigned_user_id,'issued_at',x.issued_at,'redeem_before',x.redeem_before,'redeemed_at',x.redeemed_at,'revoked_at',x.revoked_at) order by x.issued_at desc) from sepia_private.license_codes x),'[]');
  end if;
  return jsonb_build_object('error','invalid_request');
 end if;
 if p_op not in('session.status','license.activate','session.logout') then return jsonb_build_object('error','invalid_request');end if;
 select * into c from sepia_private.connections where token_hash=p_data->>'token_hash' for update;
 if c.id is null or c.revoked_at is not null or c.expires_at<=now() or c.app<>p_data->>'app' or c.device_id<>(p_data->>'device_id')::uuid then return jsonb_build_object('error','session_invalid');end if;
 select epoch into ep from sepia_private.accounts where user_id=c.user_id;
 if not sepia_private.account_active(c.user_id) then update sepia_private.connections set revoked_at=now() where id=c.id;return jsonb_build_object('error','account_suspended');end if;
 if ep is distinct from c.epoch or not sepia_private.auth_session_active(c.user_id,c.auth_session_id,p_data->'policy') then return jsonb_build_object('error','session_invalid');end if;
 if p_op='session.logout' then update sepia_private.connections set revoked_at=now() where id=c.id;insert into sepia_private.audit(actor_id,action,entity_id) values(c.user_id,'connection.revoked',c.id);return jsonb_build_object('ok',true);end if;
 if p_op='license.activate' then
  if not sepia_private.limit_ok('activate:'||c.user_id,8,3600) then return jsonb_build_object('error','rate_limited');end if;
  select * into code from sepia_private.license_codes where code_hash=p_data->>'code_hash' for update;
  if code.id is null or code.revoked_at is not null or code.redeem_before<=now() or (code.assigned_user_id is not null and code.assigned_user_id<>c.user_id) or (code.redeemed_at is not null and code.redeemed_by is distinct from c.user_id) then return jsonb_build_object('error','license_invalid_or_used');end if;
  if code.redeemed_by=c.user_id then
   select * into l from sepia_private.licenses where code_id=code.id;
   if l.id is null or l.revoked_at is not null or l.expires_at<=now() then return jsonb_build_object('error','license_invalid_or_used');end if;
  else
   insert into sepia_private.licenses(user_id,code_id,starts_at,expires_at) values(c.user_id,code.id,now(),now()+make_interval(secs=>code.duration_seconds)) returning * into l;
   update sepia_private.license_codes set redeemed_by=c.user_id,redeemed_at=now() where id=code.id;
   insert into sepia_private.audit(actor_id,action,entity_id) values(c.user_id,'license.activated',l.id);
  end if;
 end if;
 update sepia_private.connections set expires_at=now()+interval '7 days',last_checked_at=now() where id=c.id returning * into c;
 return jsonb_build_object('estadoPublico',sepia_private.state(c),'device_id',c.device_id);
end$$;
alter function sepia_private.invalidate() security definer;
do $$declare f record;begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proowner='sepia_access_owner'::regrole and (n.nspname='sepia_private' or (n.nspname='public' and p.proname='sepia_access_gateway')) loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
 end loop;
end$$;
grant execute on function public.sepia_access_gateway(text,jsonb) to service_role;
grant execute on function sepia_private.workspace_expiry(uuid) to postgres;
revoke create on schema sepia_private from postgres;
reset role;
revoke create on schema public from sepia_access_owner;
create or replace function public.workspace_license_status() returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 with entitlement as (
  select workspace_private.session_active() session_valid,
  (workspace_private.allowed('platform.manage',null) and exists(select 1 from public.usuarios where id=auth.uid() and rol='Dueño')) owner_access,
  (select max(expires_at) from (
   select expires_at from public.workspace_licenses where user_id=auth.uid() and revoked_at is null and starts_at<=now() and expires_at>now()
   union all select sepia_private.workspace_expiry(auth.uid()) as expires_at
  ) x) license_expiry)
 select jsonb_build_object('active',session_valid and(owner_access or license_expiry is not null),'owner_access',session_valid and owner_access,
 'expires_at',case when not session_valid then null when owner_access then timestamptz '9999-12-31 23:59:59+00' else license_expiry end) from entitlement;
$$;
revoke all on function public.workspace_license_status() from public,anon;
grant execute on function public.workspace_license_status() to authenticated;
commit;
