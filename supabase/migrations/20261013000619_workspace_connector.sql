-- A connector receives a revocable opaque capability, never a Supabase JWT.
-- It borrows its own login session's actor solely inside this fixed dispatcher.
create table workspace_private.connector_sessions (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references auth.users(id),
 session_id uuid not null, token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 name text not null check(length(name) between 1 and 80), created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days', revoked_at timestamptz,
 window_at timestamptz not null default now(), window_count integer not null default 0
);
create index connector_sessions_actor on workspace_private.connector_sessions(actor_id,created_at);
create table workspace_private.connector_requests (
 actor_id uuid not null references auth.users(id), request_id uuid not null, method text not null,
 payload_hash text not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(actor_id,request_id)
);
alter table workspace_private.connector_sessions enable row level security;
alter table workspace_private.connector_requests enable row level security;
revoke all on workspace_private.connector_sessions,workspace_private.connector_requests from public,anon,authenticated;

create function public.workspace_connector_register(p_token_hash text,p_name text default 'Codex · esta Mac') returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c workspace_private.connector_sessions;
begin
 if not workspace_private.session_active() then raise exception 'Sesión inválida' using errcode='42501';end if;
 if (select count(*) from workspace_private.connector_sessions where actor_id=auth.uid() and revoked_at is null and expires_at>now())>=10 then raise exception 'Revoca una conexión antes de añadir otra';end if;
 insert into workspace_private.connector_sessions(actor_id,session_id,token_hash,name)
 values(auth.uid(),(auth.jwt()->>'session_id')::uuid,p_token_hash,p_name) returning * into c;
 return jsonb_build_object('id',c.id,'actor_id',c.actor_id,'name',c.name,'expires_at',c.expires_at,'scope','editorial');
end;$$;
create function public.workspace_connector_sessions() returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() then raise exception 'Sesión inválida' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'created_at',created_at,'expires_at',expires_at,'revoked_at',revoked_at) order by created_at desc) from workspace_private.connector_sessions where actor_id=auth.uid()),'[]');
end;$$;
create function public.workspace_connector_revoke(p_id uuid) returns boolean
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c workspace_private.connector_sessions;
begin
 if not workspace_private.session_active() then raise exception 'Sesión inválida' using errcode='42501';end if;
 update workspace_private.connector_sessions set revoked_at=coalesce(revoked_at,now()) where id=p_id and actor_id=auth.uid() returning * into c;
 if c.id is null then raise exception 'Conexión ajena' using errcode='42501';end if;
 delete from auth.sessions where id=c.session_id and user_id=c.actor_id;
 return true;
end;$$;

create function workspace_private.connector_dispatch(p_method text,p_args jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;t public.workspace_deliverables;r workspace_private.edition_references;out jsonb;rows jsonb;ctx jsonb;o workspace_private.reference_originals;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada' using errcode='42501';end if;
 if p_method='context' then
  ctx:=public.workspace_context();
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at),'[]') into rows from public.workspace_projects x where x.deleted_at is null and workspace_private.can_read_project(x.id);
  out:=jsonb_build_object('actor_id',auth.uid(),'units',ctx->'units','projects',rows);
  if nullif(p_args->>'project_id','') is null then return out;end if;
  select * into p from public.workspace_projects where id=(p_args->>'project_id')::uuid and deleted_at is null;
  if p.id is null or not workspace_private.can_read_project(p.id) then raise exception 'Edición fuera de tu acceso' using errcode='42501';end if;
  return out||jsonb_build_object('project',to_jsonb(p),
   'areas',coalesce((select jsonb_agg(to_jsonb(a)) from public.workspace_areas a where a.project_id=p.id and (workspace_private.allowed('project.read',p.unit_id,p.id,a.id) or exists(select 1 from public.workspace_deliverables d where d.area_id=a.id and workspace_private.can_read_task(d.id)))),'[]'),
   'tasks',coalesce((select jsonb_agg(to_jsonb(d)) from public.workspace_deliverables d where d.project_id=p.id and workspace_private.can_read_task(d.id)),'[]'),
   'members',public.workspace_mention_candidates(p.id,null,null,null,'assignment'),
   'permissions',public.workspace_work_permissions(p.id),
   'references',public.workspace_reference_bundle(p.id), 'materials',public.workspace_opal_bundle(p.id),
   'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.workspace_events e where e.project_id=p.id and case when e.deliverable_id is not null then workspace_private.can_read_task(e.deliverable_id) else workspace_private.allowed('project.read',p.unit_id,p.id) end),'[]'));
 elsif p_method='reference.save' then
  return public.workspace_save_reference((p_args->>'project_id')::uuid,p_args->'data',(p_args->>'revision')::integer);
 elsif p_method='task.material' then
  out:=public.workspace_prepare_task_reference((p_args->>'deliverable_id')::uuid,p_args->>'title','assignment');
  if p_args ? 'content_document' then
   perform workspace_private.opal_validate(p_args->'content_document');perform workspace_private.opal_assert_media(p_args->'content_document',(out->>'project_id')::uuid);
   update workspace_private.edition_references set content_document=p_args->'content_document',content_markdown=workspace_private.document_markdown(p_args->'content_document') where id=(out->>'id')::uuid returning * into r;
   out:=to_jsonb(r);
  end if;
  return out;
 elsif p_method='task.create' then
  out:=public.workspace_command('task.create',p_args->'data',null);
  if p_args ? 'schedule' then out:=public.workspace_command('task.schedule',(p_args->'schedule')||jsonb_build_object('deliverable_id',out->'id','project_id',out->'project_id'),(out->>'revision')::integer);end if;
  if p_args ? 'reference_ids' then out:=public.workspace_set_task_references((out->>'id')::uuid,array(select jsonb_array_elements_text(p_args->'reference_ids')::uuid),(out->>'revision')::integer,false);end if;
  return out;
 elsif p_method='task.references' then
  return public.workspace_set_task_references((p_args->>'deliverable_id')::uuid,array(select jsonb_array_elements_text(p_args->'reference_ids')::uuid),(p_args->>'revision')::integer,false);
 elsif p_method='draft.get' then return public.workspace_draft((p_args->>'deliverable_id')::uuid);
 elsif p_method='draft.save' then return public.workspace_save_draft((p_args->>'deliverable_id')::uuid,p_args->'data',(p_args->>'revision')::integer,(p_args->>'base_version')::integer);
 elsif p_method='event.save' then return public.workspace_command('event.save',p_args->'data',(p_args->>'revision')::integer);
 elsif p_method='original.status' then
  select * into o from workspace_private.reference_originals where reference_id=(p_args->>'reference_id')::uuid and sha256=p_args->>'sha256' order by created_at desc limit 1;
  if o.id is null then return 'null'::jsonb;end if;
  if not workspace_private.reference_readable((select r from workspace_private.edition_references r where id=o.reference_id)) then raise exception 'Original fuera de tu acceso' using errcode='42501';end if;
  return jsonb_build_object('id',o.id,'status',o.status,'sha256',o.sha256,'size_bytes',o.size_bytes);
 elsif p_method='workspace_original_gate' then return public.workspace_original_gate((p_args->>'p_reference_id')::uuid,p_args->>'p_gateway_key');
 elsif p_method='workspace_original_begin' then return public.workspace_original_begin((p_args->>'p_reference_id')::uuid,p_args->>'p_name',p_args->>'p_mime',(p_args->>'p_size')::integer,p_args->>'p_sha256',p_args->>'p_gateway_key');
 elsif p_method='workspace_original_finish' then
  perform workspace_private.original_gateway(p_args->>'p_gateway_key');
  select * into o from workspace_private.reference_originals where id=(p_args->>'p_id')::uuid;
  if o.uploaded_by=auth.uid() and o.status='ready' and (p_args->>'p_success')::boolean then return jsonb_build_object('id',o.id,'verified',true);end if;
  return public.workspace_original_finish((p_args->>'p_id')::uuid,(p_args->>'p_success')::boolean,p_args->>'p_gateway_key');
 elsif p_method='workspace_original_access' then return public.workspace_original_access((p_args->>'p_id')::uuid,(p_args->>'p_download')::boolean,p_args->>'p_gateway_key');
 end if;
 raise exception 'Operación fuera del alcance editorial del conector' using errcode='42501';
end;$$;

create function public.workspace_connector_call(p_token text,p_method text,p_args jsonb default '{}',p_request_id uuid default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c workspace_private.connector_sessions;old_claims text;old_claim text;old_sub text;fingerprint text;previous workspace_private.connector_requests;out jsonb;write_op boolean;o workspace_private.reference_originals;
begin
 if p_token !~ '^wsc_[a-f0-9]{64}$' or octet_length(p_args::text)>1100000 then raise exception 'Solicitud inválida' using errcode='42501';end if;
 select * into c from workspace_private.connector_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if c.id is null or c.revoked_at is not null or c.expires_at<=now() or not exists(select 1 from auth.sessions where id=c.session_id and user_id=c.actor_id) then raise exception 'Conexión vencida o revocada; vuelve a conectar' using errcode='42501';end if;
 if c.window_at<now()-interval '1 minute' then c.window_at:=now();c.window_count:=0;end if;
 if c.window_count>=300 then raise exception 'Espera un minuto antes de continuar el lote' using errcode='PT429';end if;
 update workspace_private.connector_sessions set window_at=c.window_at,window_count=c.window_count+1 where id=c.id;
 old_claims:=current_setting('request.jwt.claims',true);
 old_claim:=current_setting('request.jwt.claim',true);old_sub:=current_setting('request.jwt.claim.sub',true);
 perform set_config('request.jwt.claim','',true);perform set_config('request.jwt.claim.sub',c.actor_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.actor_id,'session_id',c.session_id,'role','authenticated')::text,true);
 if not workspace_private.session_active() then raise exception 'Cuenta suspendida' using errcode='42501';end if;
 if p_method='disconnect' then
  update workspace_private.connector_sessions set revoked_at=now() where id=c.id;delete from auth.sessions where id=c.session_id and user_id=c.actor_id;out:='true';
 else
  write_op:=p_method in('reference.save','task.material','task.create','task.references','draft.save','event.save','workspace_original_begin');
  if write_op and p_request_id is null then raise exception 'Falta la clave de reanudación';end if;
  fingerprint:=encode(extensions.digest(jsonb_build_object('method',p_method,'args',p_args-'p_gateway_key')::text,'sha256'),'hex');
  if write_op then
   -- Actor-wide lock also serializes reconnection retries from separate sessions.
   perform pg_advisory_xact_lock(hashtextextended(c.actor_id::text||':'||p_request_id::text,0));
   select * into previous from workspace_private.connector_requests where actor_id=c.actor_id and request_id=p_request_id;
   if previous.request_id is not null then
    if previous.payload_hash<>fingerprint then raise exception 'Esta clave de lote corresponde a otros datos';end if;
    -- Never return an old payload after its edition/task access was removed.
    if previous.result ? 'project_id' and not workspace_private.can_read_project((previous.result->>'project_id')::uuid) then raise exception 'El acceso al destino cambió' using errcode='42501';end if;
    if p_method like 'draft.%' or p_method in('task.references','task.material') then perform workspace_private.require(case when p_method='draft.save' then 'content.edit_assigned' else 'task.assign' end,(select unit_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(select project_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(select area_id from public.workspace_deliverables where id=(p_args->>'deliverable_id')::uuid),(p_args->>'deliverable_id')::uuid);end if;
    if p_method='task.create' and not workspace_private.can_read_task((previous.result->>'id')::uuid) then raise exception 'El acceso al encargo cambió' using errcode='42501';end if;
    if p_method='reference.save' and not coalesce(workspace_private.reference_writable((select r from workspace_private.edition_references r where id=(previous.result->>'id')::uuid and archived_at is null)),false) then raise exception 'El acceso a la referencia cambió' using errcode='42501';end if;
    if p_method='workspace_original_begin' then
     perform workspace_private.connector_dispatch('workspace_original_gate',p_args);
     select * into o from workspace_private.reference_originals where id=(previous.result->>'id')::uuid;
     if o.status='failed' then raise exception 'La subida anterior falló; prepara otro intento explícito';end if;
     out:=to_jsonb(o);
    else out:=previous.result;end if;
   else
    out:=workspace_private.connector_dispatch(p_method,p_args);
    insert into workspace_private.connector_requests(actor_id,request_id,method,payload_hash,result) values(c.actor_id,p_request_id,p_method,fingerprint,out);
   end if;
  else out:=workspace_private.connector_dispatch(p_method,p_args);end if;
 end if;
 perform set_config('request.jwt.claims',coalesce(old_claims,''),true);
 perform set_config('request.jwt.claim',coalesce(old_claim,''),true);perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return out;
end;$$;
revoke all on function workspace_private.connector_dispatch(text,jsonb),public.workspace_connector_register(text,text),public.workspace_connector_sessions(),public.workspace_connector_revoke(uuid),public.workspace_connector_call(text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.workspace_connector_register(text,text),public.workspace_connector_sessions(),public.workspace_connector_revoke(uuid) to authenticated;
grant execute on function public.workspace_connector_call(text,text,jsonb,uuid) to anon,authenticated;
