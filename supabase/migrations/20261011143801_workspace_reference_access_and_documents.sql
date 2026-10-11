-- Workspace 1.5.7: assignment opens shared materials without opening private work.
create or replace function workspace_private.can_read_project(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(select 1 from public.workspace_projects where id=p_id and deleted_at is null) and (coalesce((select (workspace_private.allowed('project.read',unit_id,id) or workspace_private.allowed('reference.read',unit_id,id)) from public.workspace_projects where id=p_id),false)
 or exists(select 1 from public.workspace_deliverables where project_id=p_id and workspace_private.can_read_task(id))
 or exists(select 1 from public.workspace_areas where project_id=p_id and (workspace_private.allowed('project.read',unit_id,project_id,id) or workspace_private.allowed('reference.read',unit_id,project_id,id))));
$$;

-- Common edition materials open at assignment; private task/content policies remain unchanged.
drop policy area_read on public.workspace_areas;
create policy area_read on public.workspace_areas for select to authenticated using(
 workspace_private.allowed('project.read',unit_id,project_id,id)
 or (workspace_private.allowed('reference.read',unit_id,project_id,id) and exists(
  select 1 from public.workspace_assignments a where a.user_id=auth.uid() and a.unit_id=workspace_areas.unit_id
  and a.project_id=workspace_areas.project_id and (a.area_id is null or a.area_id=workspace_areas.id)
  and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())))
 or exists(select 1 from public.workspace_deliverables t where t.area_id=workspace_areas.id and workspace_private.can_read_task(t.id)));
drop policy event_read on public.workspace_events;
create policy event_read on public.workspace_events for select to authenticated using(
 workspace_private.can_read_project(project_id) and (deliverable_id is null or workspace_private.can_read_task(deliverable_id)));

create or replace function workspace_private.reference_source_allowed(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.reference_readable(r) and (workspace_private.allowed('reference.read',p.unit_id,p.id,r.area_id) or (r.area_id is null and exists(select 1 from public.workspace_areas a where a.project_id=p.id and workspace_private.allowed('reference.read',p.unit_id,p.id,a.id))) or workspace_private.allowed('asset.download_source',p.unit_id,p.id,r.area_id)
 or exists(select 1 from public.workspace_deliverables t where t.project_id=p.id and (r.area_id is null or t.area_id=r.area_id)
 and workspace_private.allowed('asset.download_source',p.unit_id,p.id,t.area_id,t.id)))
 from public.workspace_projects p where p.id=r.project_id;
$$;
create or replace function public.workspace_save_reference(p_project_id uuid,p_data jsonb,p_revision integer) returns jsonb
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
create or replace function public.workspace_original_begin(p_reference_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;p public.workspace_projects;o workspace_private.reference_originals;l workspace_private.original_limits;
begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into r from workspace_private.edition_references where id=p_reference_id and archived_at is null for update;
 select * into p from public.workspace_projects where id=r.project_id;
 if r.id is null or not coalesce(workspace_private.reference_writable(r),false) or not workspace_private.allowed('asset.upload',p.unit_id,p.id,r.area_id) then raise exception 'Sin permiso para subir originales' using errcode='42501';end if;
 if p_mime not in('image/jpeg','image/png','image/webp','image/gif','image/tiff','image/avif','image/heic','image/heif','application/pdf') then raise exception 'Selecciona un PDF o una imagen original; formato no permitido';end if;
 if p_size is null or p_size not between 1 and 26214400 then raise exception 'Límite de 25 MB por archivo';end if;
 if (select count(*) from workspace_private.reference_originals where reference_id=r.id and status<>'failed')>=40 then raise exception 'Máximo 40 originales por referencia';end if;
 select * into l from workspace_private.original_limits for update;
 if l.allocated_bytes+p_size>l.capacity_bytes then raise exception 'Se alcanzó el límite de 10 GB. No se permiten más subidas';end if;
 perform workspace_private.original_tick('write');
 o.id:=gen_random_uuid();o.object_key:=p.id::text||'/'||r.id::text||'/'||o.id::text;
 insert into workspace_private.reference_originals(id,reference_id,file_name,mime_type,size_bytes,sha256,object_key,uploaded_by)
 values(o.id,r.id,regexp_replace(p_name,'[[:cntrl:]/\\]','_','g'),p_mime,p_size,p_sha256,o.object_key,auth.uid()) returning * into o;
 update workspace_private.original_limits set allocated_bytes=allocated_bytes+p_size where singleton;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,null,'original.reserved',o.id,jsonb_build_object('size_bytes',p_size));
 return to_jsonb(o);
end;$$;
