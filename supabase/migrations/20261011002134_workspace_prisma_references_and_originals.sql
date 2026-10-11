-- Workspace 1.5.0 Prisma: published references and a private, metered R2 gateway.
-- Authenticated clients never receive the R2 credential or the gateway secret.
insert into workspace_private.role_permissions(role,permission,mode) values
 ('gimg_direction','reference.manage_creative','U'),
 ('gimg_project_director','reference.manage_creative','D'),
 ('gimg_direction','reference.manage_instructions','U'),
 ('gimg_production_lead','reference.manage_instructions','U'),
 ('gimg_workspace_coordinator','reference.manage_instructions','P'),
 ('gimg_project_director','reference.manage_instructions','P'),
 ('gimg_area_lead','reference.manage_instructions','A')
 on conflict(role,permission) do nothing;

create table workspace_private.edition_references(
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.workspace_projects(id),
 area_id uuid references public.workspace_areas(id), kind text not null check(kind in('concept','creative_direction','moodboard','instructions')),
 title text not null check(length(trim(title)) between 1 and 180), content_document jsonb, content_markdown text not null default '',
 palette jsonb not null default '[]' check(jsonb_typeof(palette)='array' and jsonb_array_length(palette)<=24),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 revision integer not null default 1 check(revision>0), archived_at timestamptz,
 check(kind='instructions' or area_id is null)
);
create index edition_references_project on workspace_private.edition_references(project_id,updated_at desc);
create index edition_references_area on workspace_private.edition_references(area_id);
create index edition_references_author on workspace_private.edition_references(created_by);
create table workspace_private.reference_history(
 reference_id uuid not null references workspace_private.edition_references(id), revision integer not null,
 snapshot jsonb not null, actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 primary key(reference_id,revision)
);
create index reference_history_actor on workspace_private.reference_history(actor_id);
create table workspace_private.original_limits(
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 gateway_url text, gateway_key_hash text check(gateway_key_hash ~ '^[a-f0-9]{64}$'),
 capacity_bytes bigint not null default 10000000000 check(capacity_bytes between 1 and 10000000000),
 allocated_bytes bigint not null default 0 check(allocated_bytes>=0 and allocated_bytes<=capacity_bytes),
 month_start date not null default date_trunc('month',now() at time zone 'UTC')::date,
 write_operations integer not null default 0, read_operations integer not null default 0,
 day_start date not null default (now() at time zone 'UTC')::date, gateway_requests integer not null default 0,
 check(gateway_url is null or gateway_url ~ '^https://[a-z0-9.-]+\.workers\.dev/?$')
);
insert into workspace_private.original_limits default values;
create table workspace_private.reference_originals(
 id uuid primary key default gen_random_uuid(), reference_id uuid not null references workspace_private.edition_references(id),
 file_name text not null check(length(file_name) between 1 and 240), mime_type text not null,
 size_bytes integer not null check(size_bytes between 1 and 26214400), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 object_key text not null unique, status text not null default 'reserved' check(status in('reserved','ready','failed')),
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now(), verified_at timestamptz
);
create index reference_originals_reference on workspace_private.reference_originals(reference_id,status);
create index reference_originals_author on workspace_private.reference_originals(uploaded_by);
alter table workspace_private.edition_references enable row level security;
alter table workspace_private.reference_history enable row level security;
alter table workspace_private.original_limits enable row level security;
alter table workspace_private.reference_originals enable row level security;
revoke all on workspace_private.edition_references,workspace_private.reference_history,workspace_private.original_limits,workspace_private.reference_originals from public,anon,authenticated;

create function workspace_private.reference_writable(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.allowed(case when r.kind='instructions' then 'reference.manage_instructions' else 'reference.manage_creative' end,p.unit_id,p.id,r.area_id)
 from public.workspace_projects p where p.id=r.project_id and p.status not in('closed','archived');
$$;
create function workspace_private.reference_readable(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.session_active() and workspace_private.can_read_project(r.project_id) and
 (r.area_id is null or workspace_private.allowed('content.read',p.unit_id,p.id,r.area_id)
 or exists(select 1 from public.workspace_assignments a where a.user_id=auth.uid() and a.unit_id=p.unit_id and a.project_id=p.id
 and (a.area_id is null or a.area_id=r.area_id) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())))
 from public.workspace_projects p where p.id=r.project_id;
$$;
create function workspace_private.reference_source_allowed(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.reference_readable(r) and (workspace_private.allowed('asset.download_source',p.unit_id,p.id,r.area_id)
 or exists(select 1 from public.workspace_deliverables t where t.project_id=p.id and (r.area_id is null or t.area_id=r.area_id)
 and workspace_private.allowed('asset.download_source',p.unit_id,p.id,t.area_id,t.id)))
 from public.workspace_projects p where p.id=r.project_id;
$$;

create function public.workspace_reference_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare result jsonb; storage jsonb;
begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Sin permiso para consultar esta edición' using errcode='42501';end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('area_name',a.name,'can_edit',workspace_private.reference_writable(r),
 'originals',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'file_name',o.file_name,'mime_type',o.mime_type,'size_bytes',o.size_bytes,'sha256',o.sha256,'can_download',workspace_private.reference_source_allowed(r)) order by o.created_at),'[]') from workspace_private.reference_originals o where o.reference_id=r.id and o.status='ready')) order by r.created_at),'[]') into result
 from workspace_private.edition_references r left join public.workspace_areas a on a.id=r.area_id
 where r.project_id=p_project_id and r.archived_at is null and workspace_private.reference_readable(r);
 select jsonb_build_object('gateway_url',case when enabled then gateway_url end,'capacity_bytes',capacity_bytes,'used_bytes',allocated_bytes,'file_limit_bytes',26214400) into storage from workspace_private.original_limits;
 return jsonb_build_object('references',result,'storage',storage);
end;$$;

create function public.workspace_save_reference(p_project_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references; p public.workspace_projects; old workspace_private.edition_references; col jsonb;
begin
 select * into p from public.workspace_projects where id=p_project_id;
 if p.id is null then raise exception 'Edición no encontrada';end if;
 r.project_id:=p.id;r.area_id:=nullif(p_data->>'area_id','')::uuid;r.kind:=p_data->>'kind';
 if not coalesce(workspace_private.reference_writable(r),false) then raise exception 'Sin permiso para modificar esta referencia' using errcode='42501';end if;
 if r.area_id is not null and not exists(select 1 from public.workspace_areas where id=r.area_id and project_id=p.id) then raise exception 'Área de otra edición';end if;
 if r.kind not in('concept','creative_direction','moodboard','instructions') or r.kind is null then raise exception 'Tipo de referencia inválido';end if;
 if r.kind<>'instructions' and r.area_id is not null then raise exception 'La dirección creativa corresponde a toda la edición';end if;
 r.title:=trim(p_data->>'title');r.content_document:=p_data->'content_document';
 if r.content_document is null or r.content_document='null' or r.content_document->>'type' is distinct from 'doc' or octet_length(r.content_document::text)>1048576 then raise exception 'Documento inválido o demasiado grande';end if;
 r.content_markdown:=workspace_private.document_markdown(r.content_document);
 if r.kind<>'moodboard' and trim(r.content_markdown)='' then raise exception 'Escribe el contenido de la referencia';end if;
 r.palette:=coalesce(p_data->'palette','[]');
 if jsonb_typeof(r.palette)<>'array' or jsonb_array_length(r.palette)>24 then raise exception 'Paleta inválida';end if;
 for col in select value from jsonb_array_elements(r.palette) loop if col #>> '{}' !~ '^#[a-fA-F0-9]{6}$' then raise exception 'Código de color inválido';end if;end loop;
 if nullif(p_data->>'id','') is not null then
  select * into old from workspace_private.edition_references where id=(p_data->>'id')::uuid for update;
  if old.id is null or old.project_id<>p.id or old.archived_at is not null or not workspace_private.reference_writable(old) then raise exception 'Sin permiso para esta referencia' using errcode='42501';end if;
  if old.kind<>r.kind or old.area_id is distinct from r.area_id then raise exception 'El tipo y alcance de una referencia no se pueden cambiar';end if;
  if p_revision is distinct from old.revision then raise exception 'La referencia cambió en otra ventana; actualiza la vista' using errcode='40001';end if;
  update workspace_private.edition_references set title=r.title,content_document=r.content_document,content_markdown=r.content_markdown,palette=r.palette,updated_at=now(),revision=revision+1 where id=old.id returning * into r;
 else
  if p_revision is distinct from 0 then raise exception 'Revisión inválida';end if;
  insert into workspace_private.edition_references(project_id,area_id,kind,title,content_document,content_markdown,palette,created_by)
  values(p.id,r.area_id,r.kind,r.title,r.content_document,r.content_markdown,r.palette,auth.uid()) returning * into r;
 end if;
 insert into workspace_private.reference_history(reference_id,revision,snapshot,actor_id) values(r.id,r.revision,to_jsonb(r),auth.uid());
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,'reference.saved',r.id,jsonb_build_object('kind',r.kind,'revision',r.revision));
 return to_jsonb(r);
end;$$;
create function public.workspace_archive_reference(p_id uuid,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references; p public.workspace_projects;
begin
 select * into r from workspace_private.edition_references where id=p_id for update;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) then raise exception 'Sin permiso para archivar esta referencia' using errcode='42501';end if;
 if p_revision is distinct from r.revision then raise exception 'La referencia cambió; actualiza la vista';end if;
 update workspace_private.edition_references set archived_at=now(),updated_at=now(),revision=revision+1 where id=r.id returning * into r;
 insert into workspace_private.reference_history values(r.id,r.revision,to_jsonb(r),auth.uid(),now());
 select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,'reference.archived',r.id);
 return jsonb_build_object('id',r.id);
end;$$;

create function workspace_private.original_gateway(p_key text) returns void
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() or not exists(select 1 from workspace_private.original_limits where enabled and gateway_url is not null and gateway_key_hash=encode(extensions.digest(p_key,'sha256'),'hex')) then raise exception 'Almacenamiento privado no disponible' using errcode='42501';end if;
end;$$;
create function workspace_private.original_tick(p_operation text) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare l workspace_private.original_limits; month_day date:=date_trunc('month',now() at time zone 'UTC')::date; today date:=(now() at time zone 'UTC')::date;
begin
 select * into l from workspace_private.original_limits for update;
 if l.month_start<>month_day then l.month_start:=month_day;l.write_operations:=0;l.read_operations:=0;end if;
 if l.day_start<>today then l.day_start:=today;l.gateway_requests:=0;end if;
 if l.gateway_requests>=50000 or (p_operation='write' and l.write_operations>=200000) or (p_operation='read' and l.read_operations>=2000000) then raise exception 'Se alcanzó el límite de uso gratuito. Inténtalo en el siguiente periodo';end if;
 update workspace_private.original_limits set month_start=l.month_start,day_start=l.day_start,gateway_requests=l.gateway_requests+1,
 write_operations=l.write_operations+case when p_operation='write' then 1 else 0 end,read_operations=l.read_operations+case when p_operation='read' then 1 else 0 end;
end;$$;

-- Gateway-only entry points also carry the user's JWT: the secret cannot bypass RBAC.
create function public.workspace_original_gate(p_reference_id uuid,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) or not workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 perform workspace_private.original_tick('request');
 return jsonb_build_object('kind',r.kind,'limit',26214400);
end;$$;
create function public.workspace_original_begin(p_reference_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;o workspace_private.reference_originals;l workspace_private.original_limits;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null for update;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) or not workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 if p_mime not in('image/jpeg','image/png','image/webp','image/gif','image/tiff','image/avif','image/heic','image/heif','application/pdf') or (p_mime='application/pdf' and r.kind<>'moodboard') then raise exception 'PDF sólo para moodboards; formato no permitido';end if;
 if p_size is null or p_size not between 1 and 26214400 then raise exception 'Límite de 25 MB por archivo';end if;
 if (select count(*) from workspace_private.reference_originals where reference_id=r.id and status<>'failed')>=40 then raise exception 'Máximo 40 originales por referencia';end if;
 select * into l from workspace_private.original_limits for update;
 if l.allocated_bytes+p_size>l.capacity_bytes then raise exception 'Se alcanzó el límite de 10 GB. No se permiten más subidas';end if;
 perform workspace_private.original_tick('write');
 o.id:=gen_random_uuid();o.object_key:=p.id::text||'/'||r.id::text||'/'||o.id::text;
 insert into workspace_private.reference_originals(id,reference_id,file_name,mime_type,size_bytes,sha256,object_key,uploaded_by)
 values(o.id,r.id,regexp_replace(p_name,'[[:cntrl:]/\\]','_','g'),p_mime,p_size,p_sha256,o.object_key,auth.uid()) returning * into o;
 update workspace_private.original_limits set allocated_bytes=allocated_bytes+p_size;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,'original.reserved',o.id,jsonb_build_object('size_bytes',p_size));
 return to_jsonb(o);
end;$$;
create function public.workspace_original_finish(p_id uuid,p_success boolean,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare o workspace_private.reference_originals;r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into o from workspace_private.reference_originals where id=p_id for update;
 if o.id is null or o.uploaded_by<>auth.uid() then raise exception 'Original no autorizado' using errcode='42501';end if;
 if o.status<>'reserved' then raise exception 'Este original ya se procesó';end if;
 -- Failure is accepted only after the trusted gateway has confirmed R2 deletion.
 update workspace_private.reference_originals set status=case when p_success then 'ready' else 'failed' end,verified_at=case when p_success then now() end where id=o.id;
 if not p_success then update workspace_private.original_limits set allocated_bytes=allocated_bytes-o.size_bytes;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,case when p_success then 'original.verified' else 'original.failed' end,o.id,jsonb_build_object('sha256',o.sha256,'size_bytes',o.size_bytes));
 return jsonb_build_object('id',o.id,'verified',p_success);
end;$$;
create function public.workspace_original_access(p_id uuid,p_download boolean,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare o workspace_private.reference_originals;r workspace_private.edition_references;p public.workspace_projects;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into o from workspace_private.reference_originals where id=p_id and status='ready';
 select * into r from workspace_private.edition_references where id=o.reference_id and archived_at is null;
 if r.id is null or not coalesce(workspace_private.reference_readable(r),false) or (p_download and not workspace_private.reference_source_allowed(r)) then raise exception 'Sin permiso para acceder al original' using errcode='42501';end if;
 perform workspace_private.original_tick('read');
 select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,case when p_download then 'original.downloaded' else 'original.viewed' end,o.id);
 return to_jsonb(o);
end;$$;

-- Close the legacy brief field as an alternate route for changing a concept.
create function workspace_private.protect_project_concept() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if (tg_op='INSERT' and coalesce(new.brief,'')<>'') or (tg_op='UPDATE' and new.brief is distinct from old.brief) then
  perform workspace_private.require('reference.manage_creative',new.unit_id,new.id);
 end if;return new;
end;$$;
create trigger workspace_protect_project_concept before insert or update of brief on public.workspace_projects for each row execute function workspace_private.protect_project_concept();

revoke all on function workspace_private.reference_writable(workspace_private.edition_references),workspace_private.reference_readable(workspace_private.edition_references),workspace_private.reference_source_allowed(workspace_private.edition_references),workspace_private.original_gateway(text),workspace_private.original_tick(text),workspace_private.protect_project_concept() from public,anon,authenticated;
revoke all on function public.workspace_reference_bundle(uuid),public.workspace_save_reference(uuid,jsonb,integer),public.workspace_archive_reference(uuid,integer),public.workspace_original_gate(uuid,text),public.workspace_original_begin(uuid,text,text,integer,text,text),public.workspace_original_finish(uuid,boolean,text),public.workspace_original_access(uuid,boolean,text) from public,anon;
grant execute on function public.workspace_reference_bundle(uuid),public.workspace_save_reference(uuid,jsonb,integer),public.workspace_archive_reference(uuid,integer),public.workspace_original_gate(uuid,text),public.workspace_original_begin(uuid,text,text,integer,text,text),public.workspace_original_finish(uuid,boolean,text),public.workspace_original_access(uuid,boolean,text) to authenticated;
