-- Lapislázuli Phase 2: private gateway state, no production activation.
begin;
alter table workspace_private.upload_policy
 add column part_bytes integer not null default 8388608 check(part_bytes between 5242880 and 33554432),
 add column session_hours integer not null default 24 check(session_hours between 1 and 24),
 add column signed_url_seconds integer not null default 300 check(signed_url_seconds between 1 and 300),
 add column lease_seconds integer not null default 600 check(lease_seconds between 60 and 900),
 add column max_dimension integer not null default 32768 check(max_dimension between 1 and 65536),
 add column derivative_max_bytes integer not null default 4194304 check(derivative_max_bytes>0),
 add column storage_warn_percent integer not null default 80 check(storage_warn_percent between 1 and 99);
alter table workspace_private.image_assets add column quota_released boolean not null default false;
alter table workspace_private.image_upload_sessions
 add column request_id uuid unique,add column lease_id uuid,add column lease_until timestamptz,add column lease_action text,
 add column completed_at timestamptz,add column cleaned_at timestamptz,add column part_bytes integer;
update workspace_private.image_upload_sessions set part_bytes=(select part_bytes from workspace_private.upload_policy where singleton);
alter table workspace_private.image_upload_sessions alter column part_bytes set not null;
alter table workspace_private.image_upload_sessions drop constraint image_upload_sessions_state_check;
alter table workspace_private.image_upload_sessions add constraint image_upload_sessions_state_check check(state in('reserved','receiving','validating','ready','cleaning','cancelled','expired','failed'));
create table workspace_private.image_processing(
 asset_id uuid primary key references workspace_private.image_assets(id),state text not null default 'pending' check(state in('pending','processing','ready','unavailable')),
 processor text,error_code text,lease_id uuid,lease_until timestamptz,updated_at timestamptz not null default now()
);
create index image_processing_pending on workspace_private.image_processing(updated_at) where state in('pending','processing');
alter table workspace_private.image_processing enable row level security;
revoke all on workspace_private.image_processing from public,anon,authenticated;
create table workspace_private.image_derived_reservations(
 id uuid primary key default gen_random_uuid(),asset_id uuid not null references workspace_private.image_assets(id),
 kind text not null check(kind in('thumbnail','preview')),object_key text not null unique,
 size_bytes bigint not null check(size_bytes>0),sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 width integer not null check(width>0),height integer not null check(height>0),processor text not null,
 state text not null default 'reserved' check(state in('reserved','ready','cleaned')),created_at timestamptz not null default now(),
 unique(asset_id,kind,processor)
);
create index image_derived_asset on workspace_private.image_derived_reservations(asset_id);
alter table workspace_private.image_derived_reservations enable row level security;
revoke all on workspace_private.image_derived_reservations from public,anon,authenticated;
-- Reuse the Phase 1 reservation trigger; reservations count before any R2 write.
create trigger image_derived_reserve before insert on workspace_private.image_derived_reservations for each row execute function workspace_private.image_reserve_bytes();
drop trigger image_derivative_quota on workspace_private.image_derivatives;

-- System cleanup has no user actor; do not impersonate the original author.
create table workspace_private.image_storage_audit(
 id uuid primary key default gen_random_uuid(),asset_id uuid not null references workspace_private.image_assets(id),
 deliverable_id uuid not null references public.workspace_deliverables(id),actor_id uuid references auth.users(id),
 execution text not null default 'gateway' check(execution='gateway'),action text not null,
 details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index image_storage_audit_asset on workspace_private.image_storage_audit(asset_id,created_at);
alter table workspace_private.image_storage_audit enable row level security;
revoke all on workspace_private.image_storage_audit from public,anon,authenticated;

create function workspace_private.image_gateway_authorized(p_key text) returns void
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$begin
 if not exists(select 1 from workspace_private.original_limits where singleton and enabled and gateway_key_hash=encode(extensions.digest(coalesce(p_key,''),'sha256'),'hex')) then raise exception 'Pasarela no autorizada' using errcode='42501';end if;
end;$$;
revoke all on function workspace_private.image_gateway_authorized(text) from public,anon,authenticated;

-- Signed-link redemption and cron have no caller JWT. These private evaluators
-- use a specified member; the public file RPC separately checks its actual session.
create function workspace_private.image_member_for(p_unit uuid,p_user uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(select 1 from public.workspace_unit_memberships where unit_id=p_unit and user_id=p_user
 and membership_status in('active','continuity_requested','continuity_confirmed') and suspended_at is null and (expires_at is null or expires_at>now()))
 and not exists(select 1 from workspace_private.accounts where user_id=p_user and suspended_at is not null);
$$;
revoke all on function workspace_private.image_member_for(uuid,uuid) from public,anon,authenticated;
-- Preserve the canonical RBAC algorithm (including narrow grants/delegations).
do $$declare f text;signature text;begin
 foreach signature in array array['workspace_private.notification_allowed(uuid,text,uuid,uuid,uuid,uuid)','workspace_private.opal_project_for(uuid,uuid)','workspace_private.opal_approved_for(uuid,uuid)'] loop
  f:=pg_get_functiondef(signature::regprocedure);
  f:=replace(replace(replace(replace(f,'workspace_private.notification_allowed','workspace_private.image_allowed_for'),'workspace_private.opal_project_for','workspace_private.image_project_for'),'workspace_private.opal_approved_for','workspace_private.image_approved_for'),'workspace_private.member','workspace_private.image_member_for');
  execute f;
 end loop;
end;$$;
revoke all on function workspace_private.image_allowed_for(uuid,text,uuid,uuid,uuid,uuid),workspace_private.image_project_for(uuid,uuid),workspace_private.image_approved_for(uuid,uuid) from public,anon,authenticated;

-- Notify current Direction once per crossing. No per-user task/count information.
create table workspace_private.storage_pressure(singleton boolean primary key default true check(singleton),warned boolean not null default false,episode bigint not null default 0);
insert into workspace_private.storage_pressure default values;
alter table workspace_private.storage_pressure enable row level security;
revoke all on workspace_private.storage_pressure from public,anon,authenticated;
create function workspace_private.storage_pressure_notice() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare threshold integer;epoch bigint;u uuid;begin
 select storage_warn_percent into threshold from workspace_private.upload_policy where singleton;
 if new.allocated_bytes::numeric*100<new.capacity_bytes::numeric*threshold then update workspace_private.storage_pressure set warned=false where singleton;return new;end if;
 update workspace_private.storage_pressure set warned=true,episode=episode+1 where singleton and not warned returning episode into epoch;
 if epoch is null then return new;end if;
 select id into u from public.workspace_units where slug='gimg';
 insert into workspace_private.notifications(recipient_id,unit_id,event_key,event_type,title,body,permission_keys)
 select m.user_id,u,'storage.pressure:'||epoch,'storage.warning','Workspace se acerca al límite de almacenamiento','Se alcanzó el '||threshold||'% del espacio reservado. Revisa los originales y las versiones conservadas.',array['unit.settings.manage']
 from public.workspace_unit_memberships m where m.unit_id=u and workspace_private.image_allowed_for(m.user_id,'unit.settings.manage',u)
 on conflict(recipient_id,event_key) do nothing;
 return new;
end;$$;
create trigger workspace_storage_pressure after update of allocated_bytes,capacity_bytes on workspace_private.original_limits for each row execute function workspace_private.storage_pressure_notice();
revoke all on function workspace_private.storage_pressure_notice() from public,anon,authenticated;
-- A full quota must explain what the collaborator can do next.
do $$declare f text;begin
 f:=pg_get_functiondef('workspace_private.image_reserve_bytes()'::regprocedure);
 execute replace(f,'Se alcanzó la capacidad de almacenamiento','No hay espacio disponible en Workspace; avisa a Dirección');
 f:=pg_get_functiondef('public.workspace_original_begin(uuid,text,text,integer,text,text)'::regprocedure);
 execute replace(f,'Se alcanzó el límite de 10 GB. No se permiten más subidas','No hay espacio disponible en Workspace; avisa a Dirección');
end;$$;

create function workspace_private.image_session_descriptor(p_id uuid) returns jsonb
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select to_jsonb(s)||jsonb_build_object('asset',to_jsonb(a),'preview_state',coalesce((select state from workspace_private.image_processing where asset_id=a.id),case when a.role='png' then 'pending' else 'not_applicable' end),'policy',(select (to_jsonb(p)-'singleton')||jsonb_build_object('part_bytes',s.part_bytes) from workspace_private.upload_policy p where singleton))
 from workspace_private.image_upload_sessions s join workspace_private.image_assets a on a.id=s.asset_id where s.id=p_id;
$$;
revoke all on function workspace_private.image_session_descriptor(uuid) from public,anon,authenticated;

create function public.workspace_image_storage(p_action text,p_data jsonb,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.image_upload_sessions;a workspace_private.image_assets;t public.workspace_deliverables;p workspace_private.upload_policy;
 key uuid;target uuid;format text;role_name text;file_name text;part jsonb;oldpart jsonb;expected bigint;part_number integer;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 if p_action<>'unlock' then perform workspace_private.original_tick('request');end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>32768 then raise exception 'Datos inválidos';end if;
 select * into p from workspace_private.upload_policy where singleton;
 if p_action='open' then
  if not p.images_enabled then raise exception 'Lapislázuli todavía no está habilitado';end if;
  select * into t from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid for update;
  if t.id is null or t.kind<>'image' or t.state not in('pending','assigned','in_progress','changes_requested') or not exists(select 1 from public.workspace_projects where id=t.project_id and deleted_at is null and status='active') then raise exception 'Asignación de imagen no disponible' using errcode='42501';end if;
  perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
  select * into s from workspace_private.image_upload_sessions where request_id=(p_data->>'request_id')::uuid;
  if s.id is not null then
   select * into a from workspace_private.image_assets where id=s.asset_id;
   if s.owner_id<>auth.uid() or a.deliverable_id<>t.id or a.sha256 is distinct from p_data->>'sha256' or a.size_bytes is distinct from (p_data->>'size_bytes')::bigint or a.format is distinct from p_data->>'format' or a.role is distinct from p_data->>'role' then raise exception 'La solicitud ya pertenece a otro archivo' using errcode='42501';end if;
   return workspace_private.image_session_descriptor(s.id);
  end if;
  if p_data->>'request_id' is null then raise exception 'Falta el identificador de reanudación';end if;
  format:=p_data->>'format';role_name:=p_data->>'role';file_name:=regexp_replace(trim(p_data->>'file_name'),'[[:cntrl:]/\\]','_','g');
  if format not in('png','psd','tiff','kra','procreate','afphoto','clip') or role_name not in('png','layered') or (role_name='png') is distinct from (format='png') or length(file_name) not between 1 and 240 then raise exception 'Formato o nombre inválido';end if;
  if lower(file_name) !~ ('\.'||case when format='tiff' then 'tiff?' else format end||'$') then raise exception 'El nombre no coincide con el formato declarado';end if;
  a.id:=gen_random_uuid();
  insert into workspace_private.image_assets(id,deliverable_id,owner_id,role,object_key,file_name,size_bytes,sha256,mime_type,format)
  values(a.id,t.id,auth.uid(),role_name,'images/'||t.project_id||'/'||t.id||'/'||a.id,file_name,(p_data->>'size_bytes')::bigint,p_data->>'sha256',case when format='png' then 'image/png' else 'application/octet-stream' end,format) returning * into a;
  insert into workspace_private.image_upload_sessions(asset_id,owner_id,request_id,reserved_bytes,expires_at,part_bytes)
  values(a.id,auth.uid(),(p_data->>'request_id')::uuid,a.size_bytes,now()+make_interval(hours=>p.session_hours),p.part_bytes) returning * into s;
  perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'image.upload.reserved',a.id,jsonb_build_object('bytes',a.size_bytes,'session_id',s.id));
  return workspace_private.image_session_descriptor(s.id);
 end if;
 select * into s from workspace_private.image_upload_sessions where id=(p_data->>'session_id')::uuid for update;
 select * into a from workspace_private.image_assets where id=s.asset_id;
 select * into t from public.workspace_deliverables where id=a.deliverable_id;
 if s.id is null or s.owner_id<>auth.uid() or not workspace_private.can_read_task(t.id) then raise exception 'Subida fuera de tu acceso' using errcode='42501';end if;
 if p_action='status' then return workspace_private.image_session_descriptor(s.id);end if;
 if p_action='unlock' then
  update workspace_private.image_upload_sessions set lease_id=null,lease_until=null,lease_action=null where id=s.id and lease_id=(p_data->>'lease_id')::uuid;
  return jsonb_build_object('released',found);
 end if;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 if p_action='lock' then
  if p_data->>'operation' not in('begin','part','complete','cancel') then raise exception 'Operación inválida';end if;
  if s.state='ready' then return workspace_private.image_session_descriptor(s.id);end if;
  if s.lease_until>now() then raise exception 'Hay otra operación en curso' using errcode='40001';end if;
  if s.state in('cancelled','expired','failed','cleaning') then raise exception 'La sesión ya terminó';end if;
  if s.expires_at<=now() and p_data->>'operation'<>'cancel' then raise exception 'La sesión de subida venció';end if;
  if p_data->>'operation'<>'cancel' and (not p.images_enabled or t.state not in('pending','assigned','in_progress','changes_requested') or not exists(select 1 from public.workspace_projects where id=t.project_id and status='active' and deleted_at is null)) then raise exception 'La asignación no acepta subidas';end if;
  if p_data->>'operation'='complete' and (s.received_bytes<>a.size_bytes or jsonb_array_length(s.parts)<>ceil(a.size_bytes::numeric/s.part_bytes)::integer) then raise exception 'Faltan partes por subir';end if;
  if p_data->>'operation' in('begin','part','complete') then perform workspace_private.original_tick('write');end if;
  -- Reserve a conservative R2 read budget for hashing and bounded format inspection.
  if p_data->>'operation'='complete' then for part_number in 1..32 loop perform workspace_private.original_tick('read');end loop;end if;
  key:=gen_random_uuid();
  update workspace_private.image_upload_sessions set lease_id=key,lease_until=now()+make_interval(secs=>p.lease_seconds),lease_action=p_data->>'operation',state=case when p_data->>'operation'='complete' then 'validating' when p_data->>'operation'='cancel' then 'cleaning' else state end where id=s.id;
  return workspace_private.image_session_descriptor(s.id);
 end if;
 if s.lease_id is distinct from (p_data->>'lease_id')::uuid or s.lease_id is null or s.lease_until<=now() then raise exception 'La operación perdió su reserva';end if;
 if p_action='attach' then
  if s.lease_action<>'begin' or s.upload_id is not null or length(p_data->>'upload_id') not between 1 and 2048 then raise exception 'Sesión multipart inválida';end if;
  update workspace_private.image_upload_sessions set upload_id=p_data->>'upload_id',state='receiving' where id=s.id;
 elsif p_action='part' then
  if s.lease_action<>'part' or s.state<>'receiving' or s.expires_at<=now() then raise exception 'La sesión no acepta partes';end if;
  part_number:=(p_data->>'part_number')::integer;
  expected:=least(s.part_bytes::bigint,a.size_bytes-(part_number-1)::bigint*s.part_bytes);
  if part_number<1 or expected<=0 or expected is distinct from (p_data->>'size_bytes')::bigint or p_data->>'sha256' !~ '^[a-f0-9]{64}$' or length(p_data->>'etag') not between 1 and 512 then raise exception 'Parte inválida';end if;
  select x into oldpart from jsonb_array_elements(s.parts) x where (x->>'partNumber')::integer=part_number;
  part:=jsonb_build_object('partNumber',part_number,'etag',p_data->>'etag','size_bytes',expected,'sha256',p_data->>'sha256');
  update workspace_private.image_upload_sessions set parts=(select coalesce(jsonb_agg(x order by (x->>'partNumber')::integer),'[]') from (select x from jsonb_array_elements(s.parts) x where (x->>'partNumber')::integer<>part_number union all select part) items),received_bytes=s.received_bytes+expected-coalesce((oldpart->>'size_bytes')::bigint,0) where id=s.id;
 elsif p_action='verified' then
  if s.lease_action<>'complete' or s.state<>'validating' or s.expires_at<=now() or s.received_bytes<>a.size_bytes then raise exception 'Subida incompleta o vencida';end if;
  if p_data->>'sha256' is distinct from a.sha256 or (p_data->>'size_bytes')::bigint is distinct from a.size_bytes then raise exception 'La integridad no coincide';end if;
  if a.size_bytes>workspace_private.upload_limit(a.role) then raise exception 'El archivo supera el límite configurado';end if;
  if a.role='png' and (p_data->>'verification'<>'decoded' or (p_data->>'width')::bigint*(p_data->>'height')::bigint>p.max_pixels or (p_data->>'width')::integer>p.max_dimension or (p_data->>'height')::integer>p.max_dimension) then raise exception 'PNG inválido';end if;
  if (a.format in('psd','tiff') and p_data->>'verification' is distinct from 'header') or (a.format='kra' and p_data->>'verification' is distinct from 'zip_manifest') or (a.format in('procreate','afphoto','clip') and p_data->>'verification' is distinct from 'unverified') then raise exception 'Validación de formato incorrecta';end if;
  update workspace_private.image_assets set status='validated',verified_at=now(),verification=p_data->>'verification',width=(p_data->>'width')::integer,height=(p_data->>'height')::integer,has_transparency=(p_data->>'has_transparency')::boolean,color_profile=p_data->>'color_profile',metadata=jsonb_build_object('animation',p_data->>'animation') where id=a.id;
  update workspace_private.image_upload_sessions set state='ready',completed_at=now(),lease_id=null,lease_until=null,lease_action=null where id=s.id;
  if a.role='png' then insert into workspace_private.image_processing(asset_id) values(a.id) on conflict do nothing;end if;
  perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'image.upload.verified',a.id,jsonb_build_object('sha256',a.sha256));
 elsif p_action='failed' then
  update workspace_private.image_upload_sessions set state='failed',lease_id=null,lease_until=null,lease_action=null where id=s.id;
 else raise exception 'Comando de almacenamiento inválido';end if;
 return workspace_private.image_session_descriptor(s.id);
end;$$;
revoke all on function public.workspace_image_storage(text,jsonb,text) from public,anon;
grant execute on function public.workspace_image_storage(text,jsonb,text) to authenticated;

alter table workspace_private.image_derived_reservations add column cleanup_lease uuid,add column cleanup_until timestamptz;
alter table workspace_private.image_derived_reservations drop constraint image_derived_reservations_asset_id_kind_processor_key;
create unique index image_derived_live on workspace_private.image_derived_reservations(asset_id,kind,processor) where state<>'cleaned';
create function public.workspace_image_maintenance(p_action text,p_data jsonb,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.image_upload_sessions;a workspace_private.image_assets;j workspace_private.image_processing;r workspace_private.image_derived_reservations;
 p workspace_private.upload_policy;t public.workspace_deliverables;key uuid;
begin
 perform workspace_private.image_gateway_authorized(p_gateway_key);
 select * into p from workspace_private.upload_policy where singleton;
 if p_action='cleanup.claim' then
  select * into s from workspace_private.image_upload_sessions x where x.cleaned_at is null and x.state<>'ready'
   and (x.expires_at<=now() or x.state in('failed','cleaning')) and (x.lease_until is null or x.lease_until<=now())
   and (p_data->>'session_id' is null or x.id=(p_data->>'session_id')::uuid)
   and not exists(select 1 from workspace_private.image_version_files where asset_id=x.asset_id)
   order by x.expires_at limit 1 for update skip locked;
  if s.id is null then return null;end if;
  update workspace_private.image_upload_sessions set state='cleaning',lease_id=gen_random_uuid(),lease_until=now()+make_interval(secs=>p.lease_seconds),lease_action='cleanup' where id=s.id;
  return workspace_private.image_session_descriptor(s.id);
 elsif p_action='cleanup.confirm' then
  select * into s from workspace_private.image_upload_sessions where id=(p_data->>'session_id')::uuid for update;
  if s.cleaned_at is not null then return jsonb_build_object('cleaned',true);end if;
  if s.state<>'cleaning' or s.lease_id is distinct from (p_data->>'lease_id')::uuid or s.lease_id is null or s.lease_until<=now() or p_data->>'deleted' is distinct from 'true' then raise exception 'Limpieza sin confirmar';end if;
  select * into a from workspace_private.image_assets where id=s.asset_id for update;
  if exists(select 1 from workspace_private.image_version_files where asset_id=a.id) then raise exception 'Nunca se limpia una versión enviada';end if;
  if not a.quota_released then
   update workspace_private.image_assets set status='failed',quota_released=true where id=a.id;
   update workspace_private.original_limits set allocated_bytes=allocated_bytes-a.size_bytes where singleton;
  end if;
  update workspace_private.image_upload_sessions set state=case when expires_at<=now() then 'expired' else 'cancelled' end,cleaned_at=now(),lease_id=null,lease_until=null,lease_action=null where id=s.id;
  select * into t from public.workspace_deliverables where id=a.deliverable_id;
  insert into workspace_private.image_storage_audit(asset_id,deliverable_id,actor_id,action,details) values(a.id,t.id,auth.uid(),'image.upload.cleaned',jsonb_build_object('confirmed_r2_deletion',true,'bytes',a.size_bytes,'owner_id',a.owner_id,'session_id',s.id));
  return jsonb_build_object('cleaned',true);
 elsif p_action='preview.claim' then
  select jobs.* into j from workspace_private.image_processing jobs join workspace_private.image_assets x on x.id=jobs.asset_id
   where x.status='validated' and x.role='png' and jobs.state in('pending','processing') and (jobs.lease_until is null or jobs.lease_until<=now())
   and (p_data->>'asset_id' is null or jobs.asset_id=(p_data->>'asset_id')::uuid) order by jobs.updated_at limit 1 for update of jobs skip locked;
  if j.asset_id is null then return null;end if;
  perform workspace_private.original_tick('read');perform workspace_private.original_tick('read');
  update workspace_private.image_processing set state='processing',processor=p_data->>'processor',lease_id=gen_random_uuid(),lease_until=now()+make_interval(secs=>p.lease_seconds),updated_at=now() where asset_id=j.asset_id returning * into j;
  select * into a from workspace_private.image_assets where id=j.asset_id;
  return to_jsonb(j)||jsonb_build_object('asset',to_jsonb(a),'preview_state',coalesce((select state from workspace_private.image_processing where asset_id=a.id),case when a.role='png' then 'pending' else 'not_applicable' end),'policy',to_jsonb(p)-'singleton');
 elsif p_action in('preview.reserve','preview.commit','preview.finish') then
  select * into j from workspace_private.image_processing where asset_id=(p_data->>'asset_id')::uuid for update;
  if j.state<>'processing' or j.lease_id is null or j.lease_id is distinct from (p_data->>'lease_id')::uuid or j.lease_until<=now() then raise exception 'El procesador perdió su reserva';end if;
  if p_action='preview.reserve' then
   if (p_data->>'size_bytes')::bigint>p.derivative_max_bytes then raise exception 'Derivado demasiado grande';end if;
   perform workspace_private.original_tick('write');perform workspace_private.original_tick('read');
   key:=gen_random_uuid();
   insert into workspace_private.image_derived_reservations(id,asset_id,kind,object_key,size_bytes,sha256,width,height,processor)
   values(key,j.asset_id,p_data->>'kind','image-previews/'||j.asset_id||'/'||key,(p_data->>'size_bytes')::bigint,p_data->>'sha256',(p_data->>'width')::integer,(p_data->>'height')::integer,j.processor)
   on conflict(asset_id,kind,processor) where state<>'cleaned' do nothing;
   select * into r from workspace_private.image_derived_reservations where asset_id=j.asset_id and kind=p_data->>'kind' and processor=j.processor and state<>'cleaned';
   if r.sha256 is distinct from p_data->>'sha256' or r.size_bytes is distinct from (p_data->>'size_bytes')::bigint then raise exception 'El derivado cambió';end if;
   return to_jsonb(r);
  elsif p_action='preview.commit' then
   select * into r from workspace_private.image_derived_reservations where id=(p_data->>'reservation_id')::uuid and asset_id=j.asset_id and processor=j.processor for update;
   if r.id is null or r.state='cleaned' or p_data->>'written' is distinct from 'true' then raise exception 'Derivado no confirmado';end if;
   insert into workspace_private.image_derivatives(id,asset_id,kind,object_key,size_bytes,sha256,width,height,generator_version,metadata_stripped)
   values(r.id,r.asset_id,r.kind,r.object_key,r.size_bytes,r.sha256,r.width,r.height,r.processor,true) on conflict do nothing;
   update workspace_private.image_derived_reservations set state='ready' where id=r.id;
   return jsonb_build_object('committed',true);
  end if;
  update workspace_private.image_processing set state=case when (select count(*) from workspace_private.image_derivatives where asset_id=j.asset_id and generator_version=j.processor)=2 then 'ready' else 'unavailable' end,error_code=left(p_data->>'error_code',120),lease_id=null,lease_until=null,updated_at=now() where asset_id=j.asset_id;
  select * into j from workspace_private.image_processing where asset_id=j.asset_id;
  return jsonb_build_object('finished',true,'state',j.state);
 elsif p_action='derived.claim' then
  select x.* into r from workspace_private.image_derived_reservations x join workspace_private.image_processing jobs on jobs.asset_id=x.asset_id
  where x.state='reserved' and (jobs.state='unavailable' or (jobs.lease_until<now())) and (x.cleanup_until is null or x.cleanup_until<=now())
  order by x.created_at limit 1 for update of x skip locked;
  if r.id is null then return null;end if;
  update workspace_private.image_derived_reservations set cleanup_lease=gen_random_uuid(),cleanup_until=now()+make_interval(secs=>p.lease_seconds) where id=r.id returning * into r;return to_jsonb(r);
 elsif p_action='derived.confirm' then
  select * into r from workspace_private.image_derived_reservations where id=(p_data->>'reservation_id')::uuid for update;
  if r.state='cleaned' then return jsonb_build_object('cleaned',true);end if;
  if r.state<>'reserved' or r.cleanup_lease is null or r.cleanup_lease is distinct from (p_data->>'lease_id')::uuid or r.cleanup_until<=now() or p_data->>'deleted' is distinct from 'true' then raise exception 'Limpieza de derivado no confirmada';end if;
  update workspace_private.image_derived_reservations set state='cleaned',cleanup_lease=null,cleanup_until=null where id=r.id;
  update workspace_private.original_limits set allocated_bytes=allocated_bytes-r.size_bytes where singleton;
  select d.* into t from public.workspace_deliverables d join workspace_private.image_assets x on x.deliverable_id=d.id where x.id=r.asset_id;
  insert into workspace_private.image_storage_audit(asset_id,deliverable_id,actor_id,action,details) values(r.asset_id,t.id,auth.uid(),'image.derivative.cleaned',jsonb_build_object('confirmed_r2_deletion',true,'bytes',r.size_bytes,'reservation_id',r.id));
  return jsonb_build_object('cleaned',true);
 end if;
 raise exception 'Operación de mantenimiento desconocida';
end;$$;
-- The scheduler has no user JWT. The gateway credential is mandatory even for anon.
revoke all on function public.workspace_image_maintenance(text,jsonb,text) from public;
grant execute on function public.workspace_image_maintenance(text,jsonb,text) to anon,authenticated;

create function workspace_private.image_access_for(p_user uuid,p_asset uuid,p_operation text) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare a workspace_private.image_assets;t public.workspace_deliverables;begin
 select * into a from workspace_private.image_assets where id=p_asset and status='validated';
 select * into t from public.workspace_deliverables where id=a.deliverable_id;
 if a.id is null or not workspace_private.image_member_for(t.unit_id,p_user) or not exists(select 1 from public.workspace_projects where id=t.project_id and deleted_at is null) then return false;end if;
 -- Unsubmitted originals and derivatives remain the author's private working copy.
 if not exists(select 1 from workspace_private.image_version_files where asset_id=a.id) and a.owner_id<>p_user then return false;end if;
 if p_operation='original' then return workspace_private.image_allowed_for(p_user,'content.read',t.unit_id,t.project_id,t.area_id,t.id) and workspace_private.image_allowed_for(p_user,'asset.download_source',t.unit_id,t.project_id,t.area_id,t.id);end if;
 if p_operation not in('preview','thumbnail') then return false;end if;
 return (workspace_private.image_allowed_for(p_user,'content.read',t.unit_id,t.project_id,t.area_id,t.id) and workspace_private.image_allowed_for(p_user,'asset.download_preview',t.unit_id,t.project_id,t.area_id,t.id))
 or (not t.qa_blocked and t.state in('area_approved','in_qa','qa_approved','published') and workspace_private.image_approved_for(p_user,t.id)
 and exists(select 1 from workspace_private.image_version_files f join public.workspace_versions v on v.id=f.version_id join workspace_private.image_versions iv on iv.version_id=v.id where f.asset_id=a.id and v.version_number=t.current_version and (iv.spec_snapshot->>'offer_to_documents')::boolean));
end;$$;
revoke all on function workspace_private.image_access_for(uuid,uuid,text) from public,anon,authenticated;
create function public.workspace_image_file(p_data jsonb,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare a workspace_private.image_assets;d workspace_private.image_derivatives;u uuid;sid uuid;op text;job workspace_private.image_processing;ttl integer;
begin
 perform workspace_private.image_gateway_authorized(p_gateway_key);
 -- Issuance uses the real JWT; redemption uses the signed, server-issued session.
 if p_data->>'redeem'='true' then u:=(p_data->>'user_id')::uuid;sid:=(p_data->>'session_id')::uuid;
 else
  if not workspace_private.session_active() then raise exception 'Sesión activa requerida' using errcode='42501';end if;
  u:=auth.uid();sid:=(auth.jwt()->>'session_id')::uuid;
 end if;
 if not exists(select 1 from auth.sessions where id=sid and user_id=u) then raise exception 'Sesión revocada' using errcode='42501';end if;
 op:=p_data->>'operation';
 select * into a from workspace_private.image_assets where id=(p_data->>'asset_id')::uuid;
 if not workspace_private.image_access_for(u,a.id,op) then raise exception 'Archivo fuera de tu acceso' using errcode='42501';end if;
 perform workspace_private.original_tick(case when p_data->>'redeem'='true' then 'read' else 'request' end);
 select signed_url_seconds into ttl from workspace_private.upload_policy where singleton;
 select * into job from workspace_private.image_processing where asset_id=a.id;
 if op<>'original' then
  select * into d from workspace_private.image_derivatives where asset_id=a.id and kind=op and (p_data->>'file_id' is null or id=(p_data->>'file_id')::uuid) order by created_at desc limit 1;
  if d.id is null then return jsonb_build_object('available',false,'message','Vista previa no disponible; descarga el original','can_download',workspace_private.image_access_for(u,a.id,'original'));end if;
 elsif p_data->>'file_id' is not null and (p_data->>'file_id')::uuid<>a.id then raise exception 'Archivo firmado incorrecto';end if;
 return jsonb_build_object('available',true,'asset_id',a.id,'file_id',coalesce(d.id,a.id),'operation',op,'object_key',coalesce(d.object_key,a.object_key),'file_name',a.file_name,'mime_type',case when op='original' then a.mime_type else 'image/webp' end,'size_bytes',coalesce(d.size_bytes,a.size_bytes),'sha256',coalesce(d.sha256,a.sha256),'user_id',u,'session_id',sid,'ttl',ttl,'preview_state',job.state);
end;$$;
revoke all on function public.workspace_image_file(jsonb,text) from public;
grant execute on function public.workspace_image_file(jsonb,text) to authenticated,anon;
notify pgrst,'reload schema';
commit;
