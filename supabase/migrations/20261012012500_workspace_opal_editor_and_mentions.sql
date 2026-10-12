-- Workspace 1.6.0 Ópalo: editor schema, scoped mentions and assignment materials.
-- Existing editorial permissions remain authoritative. No role grants are added.
alter table public.workspace_deliverables add column description_document jsonb;
alter table public.workspace_comments add column body_document jsonb;
alter table workspace_private.edition_references add column deliverable_id uuid references public.workspace_deliverables(id);
alter table workspace_private.edition_references add column purpose text check(purpose in('assignment','document_image'));
alter table workspace_private.edition_references add constraint reference_task_purpose check((deliverable_id is null and purpose is null) or (deliverable_id is not null and purpose is not null and kind='instructions'));
create index edition_references_task on workspace_private.edition_references(deliverable_id) where deliverable_id is not null;
create table workspace_private.version_originals(
 version_id uuid not null references public.workspace_versions(id), original_id uuid not null references workspace_private.reference_originals(id), primary key(version_id,original_id)
);
create index version_originals_original on workspace_private.version_originals(original_id);
create table workspace_private.task_references(
 deliverable_id uuid not null references public.workspace_deliverables(id),source_id uuid not null,
 reference_id uuid references workspace_private.edition_references(id),version_id uuid references public.workspace_versions(id),
 revision integer not null,snapshot jsonb not null,original_ids uuid[] not null default '{}',
 linked_by uuid not null references auth.users(id),linked_at timestamptz not null default now(),
 primary key(deliverable_id,source_id),check((reference_id is null)<>(version_id is null)),
 check(source_id=coalesce(reference_id,version_id)),check(octet_length(snapshot::text)<=1100000)
);
create index task_references_reference on workspace_private.task_references(reference_id);
create index task_references_version on workspace_private.task_references(version_id);
create index task_references_author on workspace_private.task_references(linked_by);
create table workspace_private.mention_snapshots(
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in('reference','assignment','comment','version')),
 project_id uuid not null references public.workspace_projects(id),deliverable_id uuid references public.workspace_deliverables(id),
 reference_id uuid references workspace_private.edition_references(id),version_id uuid references public.workspace_versions(id),
 document jsonb not null,title text not null,created_at timestamptz not null default now(),check(octet_length(document::text)<=1048576)
);
create index mention_snapshots_project on workspace_private.mention_snapshots(project_id);
create index mention_snapshots_task on workspace_private.mention_snapshots(deliverable_id);
create index mention_snapshots_reference on workspace_private.mention_snapshots(reference_id);
create index mention_snapshots_version on workspace_private.mention_snapshots(version_id);
alter table workspace_private.notifications add column snapshot_id uuid references workspace_private.mention_snapshots(id);
alter table workspace_private.notifications add column anchor_id uuid;
create index notifications_snapshot on workspace_private.notifications(snapshot_id);
alter table workspace_private.version_originals enable row level security;
alter table workspace_private.task_references enable row level security;
alter table workspace_private.mention_snapshots enable row level security;
revoke all on workspace_private.version_originals,workspace_private.task_references,workspace_private.mention_snapshots from public,anon,authenticated;

-- Extend the reviewed fallback serializer. The old serializer still handles all
-- legacy nodes, recursively calling this function for their children.
alter function workspace_private.document_markdown(jsonb,integer) rename to opal_markdown_v1;
create function workspace_private.document_markdown(n jsonb,depth integer default 0) returns text
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare k text:=n->>'type';a jsonb:=n->'attrs';m jsonb;row jsonb;cell jsonb;body text:='';line text;raw text;escaped text;part text;clean jsonb;count_rows integer:=0;
begin
 if depth>30 or jsonb_typeof(n)<>'object' then raise exception 'Documento inválido o demasiado anidado';end if;
 if k in('paragraph','heading') then
  if a->>'textAlign' is not null and a->>'textAlign' not in('left','center','right','justify') then raise exception 'Alineación inválida';end if;
  if a->>'lineHeight' is not null and a->>'lineHeight' not in('1.3','1.6','1.8','2') then raise exception 'Interlineado inválido';end if;
 end if;
 if k='mention' then
  if coalesce(a->>'id','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or coalesce(a->>'anchorId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or length(coalesce(a->>'label','')) not between 1 and 120 then raise exception 'Mención inválida';end if;
  raw:=a->>'label';foreach part in array array[E'\\','*','_','[',']','<','>','#','`'] loop raw:=replace(raw,part,E'\\'||part);end loop;
  return '@'||raw;
 end if;
 if k='originalImage' then
  if coalesce(a->>'assetId','') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' or length(coalesce(a->>'caption',''))>2000 or length(coalesce(a->>'credits',''))>1000 then raise exception 'Imagen de documento inválida';end if;
  raw:=coalesce(nullif(a->>'caption',''),'Original privado');foreach part in array array[E'\\','*','_','[',']','<','>','#','`'] loop raw:=replace(raw,part,E'\\'||part);end loop;
  return E'\n[Imagen: '||raw||']'||case when coalesce(a->>'credits','')<>'' then ' · Crédito: '||(a->>'credits') else '' end||E'\n\n';
 end if;
 if k='table' then
  if jsonb_array_length(coalesce(n->'content','[]')) not between 1 and 100 then raise exception 'Usa hasta 100 filas por tabla';end if;
  for row in select value from jsonb_array_elements(n->'content') loop
   if row->>'type'<>'tableRow' or jsonb_array_length(coalesce(row->'content','[]')) not between 1 and 12 then raise exception 'Usa hasta 12 columnas por tabla';end if;
   line:='';for cell in select value from jsonb_array_elements(row->'content') loop
    if cell->>'type' not in('tableCell','tableHeader') then raise exception 'Celda inválida';end if;
    raw:=workspace_private.document_markdown(cell,depth+1);line:=line||case when line='' then '' else ' | ' end||replace(regexp_replace(trim(both E'\n' from raw),E'\n+',' ','g'),'|',E'\\|');
   end loop;body:=body||'| '||line||E' |\n';
  end loop;return body||E'\n';
 end if;
 if k in('tableCell','tableHeader') then
  if coalesce((a->>'colspan')::integer,1)<>1 or coalesce((a->>'rowspan')::integer,1)<>1 then raise exception 'Esta versión usa celdas sencillas';end if;
  for cell in select value from jsonb_array_elements(coalesce(n->'content','[]')) loop body:=body||workspace_private.document_markdown(cell,depth+1);end loop;return body;
 end if;
 if k='text' then
  clean:='[]';for m in select value from jsonb_array_elements(coalesce(n->'marks','[]')) loop
   if m->>'type'='highlight' then if m->'attrs'->>'color' is not null and m->'attrs'->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color de resaltado inválido';end if;
   else clean:=clean||jsonb_build_array(m);end if;
   if m->>'type'='textStyle' then
    if m->'attrs'->>'fontFamily' is not null and m->'attrs'->>'fontFamily' not in('Inter, system-ui, sans-serif','Georgia, serif','Arial, sans-serif','Times New Roman, serif') then raise exception 'Tipografía no permitida';end if;
    if m->'attrs'->>'fontSize' is not null and m->'attrs'->>'fontSize' not in('12px','14px','16px','18px','24px','32px') then raise exception 'Tamaño no permitido';end if;
    if m->'attrs'->>'color' is not null and m->'attrs'->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color inválido';end if;
   end if;
  end loop;n:=jsonb_set(n,'{marks}',clean);
 end if;
 return workspace_private.opal_markdown_v1(n,depth);
end;$$;

create function workspace_private.opal_project_for(p_user uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.member(p.unit_id,p_user) and p.deleted_at is null and (
  workspace_private.notification_allowed(p_user,'project.read',p.unit_id,p.id)
  or workspace_private.notification_allowed(p_user,'reference.read',p.unit_id,p.id)
  or exists(select 1 from public.workspace_areas a where a.project_id=p.id and (workspace_private.notification_allowed(p_user,'project.read',p.unit_id,p.id,a.id) or workspace_private.notification_allowed(p_user,'reference.read',p.unit_id,p.id,a.id)))
  or exists(select 1 from public.workspace_deliverables t where t.project_id=p.id and workspace_private.notification_allowed(p_user,'task.read',p.unit_id,p.id,t.area_id,t.id)))
  from public.workspace_projects p where p.id=p_project),false);
$$;
create function workspace_private.opal_approved_for(p_user uuid,p_task uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare t public.workspace_deliverables;begin
 select * into t from public.workspace_deliverables where id=p_task;
 if t.id is null or not workspace_private.opal_project_for(p_user,t.project_id) then return false;end if;
 if workspace_private.notification_allowed(p_user,'reference.read',t.unit_id,t.project_id,t.area_id,t.id) then return true;end if;
 -- An explicit principal restriction on this source always wins.
 if exists(select 1 from public.workspace_access_grants g where g.user_id=p_user and g.unit_id=t.unit_id and g.scope_type in('area','deliverable') and g.revoked_at is null and g.starts_at<=now() and (g.expires_at is null or g.expires_at>now()) and workspace_private.scope_matches(g.scope_type,g.scope_id,t.unit_id,t.project_id,t.area_id,t.id)) then return false;end if;
 return exists(select 1 from public.workspace_areas a where a.project_id=t.project_id and workspace_private.notification_allowed(p_user,'reference.read',t.unit_id,t.project_id,a.id));
end;$$;
create function workspace_private.opal_content_for(p_user uuid,p_task uuid,p_accepted uuid default null) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.opal_project_for(p_user,t.project_id) and (workspace_private.notification_allowed(p_user,'content.read',t.unit_id,t.project_id,t.area_id,t.id)
 or (not t.qa_blocked and exists(select 1 from workspace_private.document_acceptances ac where ac.version_id=p_accepted and ac.deliverable_id=t.id) and workspace_private.opal_approved_for(p_user,t.id))) from public.workspace_deliverables t where t.id=p_task),false);
$$;
create or replace function workspace_private.can_read_reference(p_deliverable_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.session_active() and (workspace_private.can_read_content(p_deliverable_id) or exists(select 1 from workspace_private.document_acceptances ac where ac.deliverable_id=p_deliverable_id and workspace_private.opal_content_for(auth.uid(),p_deliverable_id,ac.version_id)));
$$;
create function workspace_private.opal_reference_for(r workspace_private.edition_references,p_user uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;t public.workspace_deliverables;
begin
 select * into p from public.workspace_projects where id=r.project_id;
 if p.id is null or p.deleted_at is not null or r.archived_at is not null or not workspace_private.member(p.unit_id,p_user) then return false;end if;
 if r.deliverable_id is not null then
  select * into t from public.workspace_deliverables where id=r.deliverable_id and project_id=p.id;
  if t.id is null then return false;end if;
  if r.purpose='assignment' then return workspace_private.notification_allowed(p_user,'task.read',t.unit_id,t.project_id,t.area_id,t.id);end if;
  return r.created_by=p_user and workspace_private.notification_allowed(p_user,'content.read',t.unit_id,t.project_id,t.area_id,t.id);
 end if;
 return workspace_private.opal_project_for(p_user,p.id) and (r.area_id is null or workspace_private.notification_allowed(p_user,'content.read',p.unit_id,p.id,r.area_id)
  or exists(select 1 from public.workspace_assignments a where a.user_id=p_user and a.unit_id=p.unit_id and a.project_id=p.id and (a.area_id is null or a.area_id=r.area_id) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())));
end;$$;
create or replace function workspace_private.reference_readable(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$ select workspace_private.session_active() and workspace_private.opal_reference_for(r,auth.uid()); $$;
alter function workspace_private.reference_writable(workspace_private.edition_references) rename to opal_reference_writable_v1;
create function workspace_private.reference_writable(r workspace_private.edition_references) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;
begin
 if r.deliverable_id is null then return workspace_private.opal_reference_writable_v1(r);end if;
 select * into t from public.workspace_deliverables where id=r.deliverable_id;
 if t.id is null or not workspace_private.session_active() or not exists(select 1 from public.workspace_projects p where p.id=t.project_id and p.deleted_at is null and p.status not in('closed','archived')) then return false;end if;
 if r.purpose='assignment' then return t.state in('pending','assigned','in_progress','review','changes_requested','blocked') and workspace_private.allowed('task.assign',t.unit_id,t.project_id,t.area_id,t.id);end if;
 return r.created_by=auth.uid() and t.state in('pending','assigned','in_progress','changes_requested') and workspace_private.allowed('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
end;$$;
alter function workspace_private.reference_source_allowed(workspace_private.edition_references) rename to opal_source_v1;
create function workspace_private.reference_source_allowed(r workspace_private.edition_references) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select case when r.deliverable_id is null then workspace_private.opal_source_v1(r) else workspace_private.reference_readable(r) and (
  workspace_private.allowed('asset.download_source',p.unit_id,p.id,r.area_id,r.deliverable_id)
  or (r.purpose='document_image' and exists(select 1 from workspace_private.reference_originals o join workspace_private.version_originals vo on vo.original_id=o.id join workspace_private.document_acceptances ac on ac.version_id=vo.version_id where o.reference_id=r.id and workspace_private.opal_content_for(auth.uid(),r.deliverable_id,vo.version_id)))) end
 from public.workspace_projects p where p.id=r.project_id;
$$;

create function workspace_private.opal_mentions(doc jsonb) returns table(recipient uuid,anchor uuid,label text)
language sql immutable set search_path=pg_catalog,pg_temp as $$
 with recursive nodes(n) as(select doc union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child)
 select distinct (n->'attrs'->>'id')::uuid,(n->'attrs'->>'anchorId')::uuid,n->'attrs'->>'label' from nodes where n->>'type'='mention';
$$;
create function workspace_private.opal_validate(doc jsonb) returns void language plpgsql immutable set search_path=pg_catalog,pg_temp as $$begin
 if doc is null or doc->>'type' is distinct from 'doc' or jsonb_typeof(doc)<>'object' or octet_length(doc::text)>1048576 then raise exception 'Documento inválido o demasiado grande';end if;
 perform workspace_private.document_markdown(doc);
end;$$;
create function workspace_private.opal_assert_media(doc jsonb,p_project uuid) returns void
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare v_asset_id uuid; o workspace_private.reference_originals;r workspace_private.edition_references;
begin
 for v_asset_id in with recursive nodes(n) as(select doc union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child) select distinct (n->'attrs'->>'assetId')::uuid from nodes where n->>'type'='originalImage' loop
  select * into o from workspace_private.reference_originals where reference_originals.id=v_asset_id and status='ready' and mime_type like 'image/%';
  select * into r from workspace_private.edition_references where edition_references.id=o.reference_id and project_id=p_project;
  if r.id is null or not workspace_private.opal_original_for(o,auth.uid()) then raise exception 'Imagen fuera del acceso de este documento' using errcode='42501';end if;
 end loop;
end;$$;
create function public.workspace_mention_candidates(p_project_id uuid,p_deliverable_id uuid default null,p_reference_id uuid default null,p_area_id uuid default null,p_kind text default 'reference') returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;t public.workspace_deliverables;r workspace_private.edition_references; rows jsonb;
begin
 select * into p from public.workspace_projects where id=p_project_id;
 if p.id is null or not workspace_private.session_active() or not workspace_private.can_read_project(p.id) then raise exception 'Sin acceso a los integrantes de esta edición' using errcode='42501';end if;
 if p_deliverable_id is not null then
  select * into t from public.workspace_deliverables where id=p_deliverable_id and project_id=p.id;
  if t.id is null or not workspace_private.can_read_task(t.id) then raise exception 'Sin acceso a este encargo' using errcode='42501';end if;
  p_area_id:=t.area_id;
 elsif p_reference_id is not null then
  select * into r from workspace_private.edition_references where id=p_reference_id and project_id=p.id;
  if r.id is null or not coalesce(workspace_private.reference_readable(r),false) then raise exception 'Sin acceso a esta referencia' using errcode='42501';end if;p_area_id:=r.area_id;
 elsif p_area_id is not null and not exists(select 1 from public.workspace_areas where id=p_area_id and project_id=p.id) then raise exception 'Área inválida';end if;
 if not (workspace_private.allowed('unit.members.read',p.unit_id,p.id,p_area_id,t.id) or (t.id is not null and workspace_private.allowed('content.comment',p.unit_id,p.id,t.area_id,t.id))) then raise exception 'Tu función no permite consultar destinatarios aquí' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',u.id,'display_name',coalesce(nullif(u.nombre_publico,''),u.nombre),'handle',u.nombre) order by u.nombre),'[]') into rows from public.usuarios u
 where workspace_private.member(p.unit_id,u.id) and case
  when t.id is not null and p_kind='assignment' then workspace_private.notification_allowed(u.id,'task.read',p.unit_id,p.id,t.area_id,t.id)
  when t.id is not null then workspace_private.opal_content_for(u.id,t.id)
  when r.id is not null then workspace_private.opal_reference_for(r,u.id)
  else workspace_private.opal_project_for(u.id,p.id) and (p_area_id is null or workspace_private.notification_allowed(u.id,'content.read',p.unit_id,p.id,p_area_id) or exists(select 1 from public.workspace_assignments a where a.user_id=u.id and a.project_id=p.id and (a.area_id is null or a.area_id=p_area_id) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now()))) end;
 return rows;
end;$$;

create function workspace_private.opal_emit(doc jsonb,previous jsonb,p_kind text,p_project uuid,p_task uuid,p_reference uuid,p_version uuid,p_title text) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;t public.workspace_deliverables;r workspace_private.edition_references;m record;snap uuid;sender text;eligible boolean;
begin
 if (select count(*) from workspace_private.opal_mentions(doc))>50 then raise exception 'Usa hasta 50 menciones por documento';end if;
 select * into p from public.workspace_projects where id=p_project;select * into t from public.workspace_deliverables where id=p_task;select * into r from workspace_private.edition_references where id=p_reference;
 select coalesce(nullif(nombre_publico,''),nombre,'Un integrante') into sender from public.usuarios where id=auth.uid();sender:=coalesce(sender,'Un integrante');
 for m in select distinct on(recipient) * from workspace_private.opal_mentions(doc) x where not exists(select 1 from workspace_private.opal_mentions(previous) old where old.recipient=x.recipient and old.anchor=x.anchor) order by recipient,anchor loop
  if m.recipient=auth.uid() then continue;end if;
  eligible:=case when p_kind='reference' then workspace_private.opal_reference_for(r,m.recipient) when p_kind='assignment' then workspace_private.opal_project_for(m.recipient,p.id) and workspace_private.notification_allowed(m.recipient,'task.read',p.unit_id,p.id,t.area_id,t.id) else workspace_private.opal_content_for(m.recipient,t.id,p_version) end;
  if not coalesce(eligible,false) then continue;end if;
  if snap is null then insert into workspace_private.mention_snapshots(kind,project_id,deliverable_id,reference_id,version_id,document,title) values(p_kind,p.id,t.id,r.id,p_version,doc,p_title) returning id into snap;end if;
  insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,deliverable_id,reference_id,actor_id,event_key,event_type,title,body,snapshot_id,anchor_id)
  values(m.recipient,p.unit_id,p.id,coalesce(t.area_id,r.area_id),t.id,r.id,auth.uid(),'mention:'||snap||':'||m.recipient,'mention',sender||' te mencionó',p_title,snap,m.anchor) on conflict(recipient_id,event_key) do nothing;
  -- One notification replaces the generic notice from the same operation.
  delete from workspace_private.notifications n where n.recipient_id=m.recipient and n.actor_id=auth.uid() and n.project_id=p.id and n.deliverable_id is not distinct from t.id and n.reference_id is not distinct from r.id and n.created_at=now() and n.event_type in('assignment.updated','reference.updated','conversation.updated','review.requested');
 end loop;
end;$$;

alter function public.workspace_save_draft(uuid,jsonb,integer,integer) set schema workspace_private;
alter function workspace_private.workspace_save_draft(uuid,jsonb,integer,integer) rename to opal_save_draft_v1;
create function public.workspace_save_draft(p_deliverable_id uuid,p_data jsonb,p_revision integer,p_base_version integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;existing jsonb;
begin
 select * into t from public.workspace_deliverables where id=p_deliverable_id;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 select content_document into existing from workspace_private.drafts where deliverable_id=t.id and author_id=auth.uid();
 if existing is null then select d.content_document into existing from public.workspace_versions v join workspace_private.version_documents d on d.version_id=v.id where v.deliverable_id=t.id and v.version_number=t.current_version;end if;
 if coalesce((existing->'attrs'->>'schemaVersion')::integer,1)>=2 and coalesce((p_data->>'editor_version')::integer,1)<2 then raise exception 'Actualiza Workspace a 1.6.0 para editar este documento sin perder formato';end if;
 perform workspace_private.opal_validate(p_data->'content_document');perform workspace_private.opal_assert_media(p_data->'content_document',t.project_id);
 return workspace_private.opal_save_draft_v1(p_deliverable_id,p_data,p_revision,p_base_version);
end;$$;

alter function public.workspace_save_reference(uuid,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_save_reference(uuid,jsonb,integer) rename to opal_save_reference_v1;
create function public.workspace_save_reference(p_project_id uuid,p_data jsonb,p_revision integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare old workspace_private.edition_references;result jsonb;r workspace_private.edition_references;
begin
 if nullif(p_data->>'id','') is not null then select * into old from workspace_private.edition_references where id=(p_data->>'id')::uuid;end if;
 if old.id is not null and not coalesce(workspace_private.reference_writable(old),false) then raise exception 'Sin permiso para editar la referencia' using errcode='42501';end if;
 if coalesce((old.content_document->'attrs'->>'schemaVersion')::integer,1)>=2 and coalesce((p_data->>'editor_version')::integer,1)<2 then raise exception 'Actualiza Workspace a 1.6.0 para editar esta referencia';end if;
 perform workspace_private.opal_assert_media(p_data->'content_document',p_project_id);
 result:=workspace_private.opal_save_reference_v1(p_project_id,p_data,p_revision);
 select * into r from workspace_private.edition_references where id=(result->>'id')::uuid;
 perform workspace_private.opal_emit(r.content_document,old.content_document,'reference',r.project_id,null,r.id,null,r.title);
 return result;
end;$$;

create function workspace_private.opal_capture_version() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v public.workspace_versions;t public.workspace_deliverables;old jsonb;
begin
 select * into v from public.workspace_versions where id=new.version_id;select * into t from public.workspace_deliverables where id=v.deliverable_id;
 insert into workspace_private.version_originals(version_id,original_id)
 with recursive nodes(n) as(select new.content_document union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child)
 select distinct v.id,(n->'attrs'->>'assetId')::uuid from nodes where n->>'type'='originalImage' on conflict do nothing;
 select d.content_document into old from public.workspace_versions previous join workspace_private.version_documents d on d.version_id=previous.id where previous.deliverable_id=t.id and previous.version_number<v.version_number order by previous.version_number desc limit 1;
 perform workspace_private.opal_emit(new.content_document,old,'version',t.project_id,t.id,null,v.id,t.title);
 return new;
end;$$;
create trigger workspace_opal_version after insert on workspace_private.version_documents for each row execute function workspace_private.opal_capture_version();

alter function public.workspace_command(text,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_command(text,jsonb,integer) rename to opal_command_v1;
create function public.workspace_command(p_action text,p_data jsonb,p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare old public.workspace_deliverables;t public.workspace_deliverables;result jsonb;c public.workspace_comments;doc jsonb;before_comments uuid[];link workspace_private.task_references;r workspace_private.edition_references;person uuid;
begin
 if p_action='version.submit' and coalesce((p_data->>'editor_version')::integer,1)<2 and exists(select 1 from public.workspace_versions v join workspace_private.version_documents d on d.version_id=v.id join public.workspace_deliverables current_task on current_task.id=v.deliverable_id where current_task.id=(p_data->>'deliverable_id')::uuid and v.version_number=current_task.current_version and coalesce((d.content_document->'attrs'->>'schemaVersion')::integer,1)>=2) then raise exception 'Actualiza Workspace a 1.6.0 para enviar una versión de este documento';end if;
 if p_action in('task.save','task.create') then
  if p_action='task.save' then select * into old from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid;end if;
  if coalesce((old.description_document->'attrs'->>'schemaVersion')::integer,1)>=2 and coalesce((p_data->>'editor_version')::integer,1)<2 then raise exception 'Actualiza Workspace a 1.6.0 para editar estas indicaciones';end if;
  doc:=p_data->'description_document';if doc is not null then perform workspace_private.opal_validate(doc);p_data:=p_data||jsonb_build_object('description',workspace_private.document_markdown(doc));perform workspace_private.opal_assert_media(doc,(p_data->>'project_id')::uuid);end if;
 elsif p_action in('comment.add','qa.issue') and p_data->'body_document' is not null then
  select * into t from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid for update;
  perform workspace_private.require(case when p_action='comment.add' then 'content.comment' else 'qa.raise_issue' end,t.unit_id,t.project_id,t.area_id,t.id);
  select coalesce(array_agg(id),'{}') into before_comments from public.workspace_comments where deliverable_id=t.id;
  doc:=p_data->'body_document';perform workspace_private.opal_validate(doc);p_data:=p_data||jsonb_build_object('body',workspace_private.document_markdown(doc));perform workspace_private.opal_assert_media(doc,(p_data->>'project_id')::uuid);
 end if;
 result:=workspace_private.opal_command_v1(p_action,p_data,p_revision);
 if p_action='task.save' then
  t:=jsonb_populate_record(null::public.workspace_deliverables,result);
  for link in select * from workspace_private.task_references where deliverable_id=t.id loop
   select * into r from workspace_private.edition_references where id=link.reference_id;
   for person in select t.responsible_id where t.responsible_id is not null union select unnest(t.collaborator_ids) loop
    if (link.reference_id is not null and not workspace_private.opal_reference_for(r,person)) or (link.version_id is not null and not workspace_private.opal_content_for(person,(select deliverable_id from public.workspace_versions where id=link.version_id),link.version_id)) then
     raise exception 'Retira los materiales fuera del acceso de las personas antes de reasignar el encargo' using errcode='42501';
    end if;
   end loop;
  end loop;
 end if;
 if p_action in('task.save','task.create') and doc is not null then
  update public.workspace_deliverables set description_document=doc where id=(result->>'id')::uuid returning * into t;
  perform workspace_private.opal_emit(doc,old.description_document,'assignment',t.project_id,t.id,null,null,t.title);result:=to_jsonb(t);
 elsif p_action in('comment.add','qa.issue') and doc is not null then
  select * into t from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid;
  select * into c from public.workspace_comments where deliverable_id=t.id and actor_id=auth.uid() and not(id=any(before_comments)) limit 1;
  update public.workspace_comments set body_document=doc where id=c.id;
  perform workspace_private.opal_emit(doc,null,'comment',t.project_id,t.id,null,null,t.title);
 end if;
 return result;
end;$$;

create function public.workspace_prepare_task_reference(p_deliverable_id uuid,p_title text,p_purpose text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;r workspace_private.edition_references;
begin
 select * into t from public.workspace_deliverables where id=p_deliverable_id;
 if t.id is null or p_purpose not in('assignment','document_image') then raise exception 'Encargo o tipo de material inválido';end if;
 perform workspace_private.require(case when p_purpose='assignment' then 'task.assign' else 'content.edit_assigned' end,t.unit_id,t.project_id,t.area_id,t.id);
 if t.state not in('pending','assigned','in_progress','changes_requested') and not(p_purpose='assignment' and t.state in('review','blocked')) then raise exception 'Este encargo necesita reabrirse antes de añadir materiales';end if;
 if not exists(select 1 from public.workspace_projects where id=t.project_id and deleted_at is null and status not in('closed','archived')) then raise exception 'Edición cerrada';end if;
 if (select count(*) from workspace_private.edition_references where deliverable_id=t.id and purpose=p_purpose and archived_at is null)>=60 then raise exception 'Límite de 60 materiales por encargo';end if;
 insert into workspace_private.edition_references(project_id,area_id,kind,title,content_document,created_by,deliverable_id,purpose)
 values(t.project_id,t.area_id,'instructions',p_title,jsonb_build_object('type','doc','attrs',jsonb_build_object('schemaVersion',2),'content','[]'::jsonb),auth.uid(),t.id,p_purpose) returning * into r;
 perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'task.material_prepared',r.id,jsonb_build_object('purpose',p_purpose));
 return to_jsonb(r);
end;$$;
create function public.workspace_original_descriptor(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare o workspace_private.reference_originals;r workspace_private.edition_references;
begin
 select * into o from workspace_private.reference_originals where id=p_id and status='ready';select * into r from workspace_private.edition_references where id=o.reference_id;
 if r.id is null or not workspace_private.session_active() or not workspace_private.opal_original_for(o,auth.uid()) then raise exception 'Original fuera de tu acceso' using errcode='42501';end if;
 return jsonb_build_object('id',o.id,'file_name',o.file_name,'mime_type',o.mime_type,'size_bytes',o.size_bytes,'sha256',o.sha256,'can_download',workspace_private.opal_original_download(o));
end;$$;
create function public.workspace_set_task_references(p_deliverable_id uuid,p_reference_ids uuid[],p_revision integer,p_refresh boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;r workspace_private.edition_references;v public.workspace_versions;source public.workspace_deliverables;doc jsonb;v_source_id uuid;person uuid;link workspace_private.task_references;version integer;assets uuid[];
begin
 select * into t from public.workspace_deliverables where workspace_deliverables.id=p_deliverable_id for update;
 if t.id is null then raise exception 'Encargo no encontrado';end if;
 perform workspace_private.require('task.assign',t.unit_id,t.project_id,t.area_id,t.id);
 if t.revision is distinct from p_revision then raise exception 'El encargo cambió; vuelve a cargarlo' using errcode='40001';end if;
 if t.state not in('pending','assigned','in_progress','review','changes_requested','blocked') then raise exception 'Reabre el encargo para modificar sus materiales';end if;
 if cardinality(coalesce(p_reference_ids,'{}'))>30 then raise exception 'Usa hasta 30 referencias por encargo';end if;
 delete from workspace_private.task_references where deliverable_id=t.id and not(source_id=any(coalesce(p_reference_ids,'{}')));
 for v_source_id in select distinct unnest(coalesce(p_reference_ids,'{}')) loop
  r:=null;v:=null;source:=null;
  select * into r from workspace_private.edition_references where edition_references.id=v_source_id and project_id=t.project_id and archived_at is null;
  if r.id is not null then
   if (r.deliverable_id is not null and (r.deliverable_id<>t.id or r.purpose<>'assignment')) or not coalesce(workspace_private.reference_readable(r),false) then raise exception 'Referencia fuera del alcance del encargo' using errcode='42501';end if;
   for person in select t.responsible_id where t.responsible_id is not null union select unnest(t.collaborator_ids) loop if not workspace_private.opal_reference_for(r,person) then raise exception 'Una persona asignada no puede consultar esta referencia' using errcode='42501';end if;end loop;
   doc:=to_jsonb(r);version:=r.revision;select coalesce(array_agg(o.id),'{}') into assets from workspace_private.reference_originals o where o.reference_id=r.id and o.status='ready';
  else
   select * into v from public.workspace_versions where workspace_versions.id=v_source_id;
   select * into source from public.workspace_deliverables where workspace_deliverables.id=v.deliverable_id and project_id=t.project_id and not qa_blocked;
   if source.id is null or not workspace_private.opal_content_for(auth.uid(),source.id,v.id) or not exists(select 1 from workspace_private.document_acceptances where version_id=v.id) then raise exception 'Usa una referencia o un documento aceptado de esta edición' using errcode='42501';end if;
   for person in select t.responsible_id where t.responsible_id is not null union select unnest(t.collaborator_ids) loop if not workspace_private.opal_content_for(person,source.id,v.id) then raise exception 'Una persona asignada no puede consultar este documento aceptado' using errcode='42501';end if;end loop;
   doc:=jsonb_build_object('title',source.title,'kind','instructions','content_markdown',v.content_markdown,'content_document',(select content_document from workspace_private.version_documents where version_id=v.id),'palette','[]'::jsonb,'updated_at',v.created_at);version:=v.version_number;
   select coalesce(array_agg(original_id),'{}') into assets from workspace_private.version_originals where version_id=v.id;
  end if;
  select * into link from workspace_private.task_references where deliverable_id=t.id and source_id=v_source_id;
  if link.deliverable_id is null then
   insert into workspace_private.task_references(deliverable_id,source_id,reference_id,version_id,revision,snapshot,original_ids,linked_by) values(t.id,v_source_id,r.id,v.id,version,doc,assets,auth.uid());
  elsif p_refresh then update workspace_private.task_references set revision=version,snapshot=doc,original_ids=assets,linked_by=auth.uid(),linked_at=now() where deliverable_id=t.id and source_id=v_source_id;end if;
 end loop;
 update public.workspace_deliverables set revision=revision+1 where workspace_deliverables.id=t.id returning * into t;
 perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'task.save',t.id,jsonb_build_object('materials_updated',true));
 return to_jsonb(t);
end;$$;

alter function public.workspace_reference_bundle(uuid) set schema workspace_private;
alter function workspace_private.workspace_reference_bundle(uuid) rename to opal_reference_bundle_v1;
create function public.workspace_reference_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare bundle jsonb;
begin
 bundle:=workspace_private.opal_reference_bundle_v1(p_project_id);
 return jsonb_set(bundle,'{references}',coalesce((select jsonb_agg(r) from jsonb_array_elements(bundle->'references') r where r->>'deliverable_id' is null),'[]'));
end;$$;
create function public.workspace_opal_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare rows jsonb;pool jsonb;assets jsonb;
begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Sin acceso a esta edición' using errcode='42501';end if;
 select coalesce(jsonb_object_agg(task_id,items),'{}') into rows from (
  select tr.deliverable_id as task_id,jsonb_agg(jsonb_build_object('reference_id',tr.source_id,'title',tr.snapshot->>'title','revision',tr.revision,'latest_revision',coalesce(r.revision,(select max(v2.version_number) from public.workspace_versions v2 join workspace_private.document_acceptances ac on ac.version_id=v2.id where v2.deliverable_id=v.deliverable_id),tr.revision),'latest_source_id',coalesce(r.id,(select v2.id from public.workspace_versions v2 join workspace_private.document_acceptances ac on ac.version_id=v2.id where v2.deliverable_id=v.deliverable_id order by v2.version_number desc limit 1),tr.source_id),'snapshot',tr.snapshot,
  'originals',coalesce((select jsonb_agg(public.workspace_original_descriptor(o.id)) from workspace_private.reference_originals o where o.id=any(tr.original_ids) and o.status='ready'),'[]')) order by tr.linked_at) as items
  from workspace_private.task_references tr join public.workspace_deliverables t on t.id=tr.deliverable_id
  left join workspace_private.edition_references r on r.id=tr.reference_id
  left join public.workspace_versions v on v.id=tr.version_id
  where t.project_id=p_project_id and workspace_private.can_read_task(t.id) and case when r.id is not null then workspace_private.reference_readable(r) else workspace_private.opal_content_for(auth.uid(),v.deliverable_id,v.id) end group by tr.deliverable_id
 ) x;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('can_edit',workspace_private.reference_writable(r))),'[]') into pool from workspace_private.edition_references r where r.project_id=p_project_id and r.purpose='assignment' and workspace_private.reference_readable(r);
 select coalesce(jsonb_agg(public.workspace_original_descriptor(o.id)),'[]') into assets from workspace_private.reference_originals o join workspace_private.edition_references r on r.id=o.reference_id where r.project_id=p_project_id and o.status='ready' and workspace_private.opal_original_for(o,auth.uid());
 return jsonb_build_object('task_references',rows,'private_references',pool,'originals',assets);
end;$$;

alter function workspace_private.notification_visible(workspace_private.notifications) rename to opal_notification_v1;
create function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare s workspace_private.mention_snapshots;r workspace_private.edition_references;t public.workspace_deliverables;
begin
 if n.event_type<>'mention' then return workspace_private.opal_notification_v1(n);end if;
 if n.recipient_id is distinct from auth.uid() or not workspace_private.session_active() or not workspace_private.member(n.unit_id) then return false;end if;
 select * into s from workspace_private.mention_snapshots where id=n.snapshot_id;
 if s.id is null or not exists(select 1 from public.workspace_projects where id=s.project_id and deleted_at is null) then return false;end if;
 if s.kind='reference' then select * into r from workspace_private.edition_references where id=s.reference_id;return r.id is not null and coalesce(workspace_private.reference_readable(r),false);end if;
 select * into t from public.workspace_deliverables where id=s.deliverable_id;
 if t.id is null or t.state='archived' then return false;end if;
 if s.kind='assignment' then return workspace_private.can_read_task(t.id);end if;
 return workspace_private.opal_content_for(auth.uid(),t.id,s.version_id);
end;$$;
create or replace function public.workspace_notifications() returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare rows jsonb;unread integer;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 perform workspace_private.queue_deadline_notices();
 select count(*)::integer into unread from workspace_private.notifications n where recipient_id=auth.uid() and read_at is null and workspace_private.notification_visible(n);
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into rows from(
  select n.id,n.event_type,n.title,n.body,n.project_id,n.deliverable_id,n.reference_id,n.anchor_id,n.created_at,n.read_at,p.title as edition_title
  from workspace_private.notifications n left join public.workspace_projects p on p.id=n.project_id where recipient_id=auth.uid() and workspace_private.notification_visible(n) order by created_at desc limit 60
 ) x;return jsonb_build_object('items',rows,'unread_count',unread,'fetched_at',now());
end;$$;
create function public.workspace_notification_document(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare n workspace_private.notifications;s workspace_private.mention_snapshots;
begin
 select * into n from workspace_private.notifications where id=p_id and recipient_id=auth.uid();
 if n.id is null or n.event_type<>'mention' or not workspace_private.notification_visible(n) then raise exception 'La mención ya no está disponible en tu alcance' using errcode='42501';end if;
 select * into s from workspace_private.mention_snapshots where id=n.snapshot_id;
 return jsonb_build_object('title',s.title,'document',s.document,'created_at',s.created_at,'anchor_id',n.anchor_id,'kind',s.kind,'project_id',s.project_id,'deliverable_id',s.deliverable_id,'reference_id',s.reference_id,'edition_title',(select title from public.workspace_projects where id=s.project_id));
end;$$;

-- Explicit server submit identifies the new editor to the command wrapper.
create or replace function public.workspace_submit_draft(p_deliverable_id uuid,p_draft_revision integer,p_task_revision integer,p_change_summary text default 'Entrega para revisión') returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables; d workspace_private.drafts; result jsonb; v_id uuid; plain_text text;
begin
 select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 if t.id is null then raise exception 'Trabajo no encontrado';end if;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 perform workspace_private.require('content.request_review',t.unit_id,t.project_id,t.area_id,t.id);
 if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'El trabajo está en revisión o cerrado';end if;
 select * into d from workspace_private.drafts where deliverable_id=t.id and author_id=auth.uid() for update;
 if d.deliverable_id is null then raise exception 'Guarda el borrador antes de enviarlo';end if;
 if p_draft_revision is distinct from d.revision or d.base_version is distinct from t.current_version then raise exception 'El borrador cambió; actualiza la vista antes de enviar' using errcode='40001';end if;
 perform workspace_private.opal_assert_media(d.content_document,t.project_id);
 with recursive nodes(item) as (select d.content_document union all select child from nodes cross join lateral jsonb_array_elements(coalesce(item->'content','[]')) child)
 select coalesce(string_agg(case item->>'type' when 'originalImage' then 'Imagen original' when 'mention' then item->'attrs'->>'label' else item->>'text' end,''),'') into plain_text from nodes where item->>'type' in('text','mention','originalImage');
 if length(trim(translate(plain_text,E'\n\r\t\v\f'||chr(160)||chr(8203)||chr(65279),'')))=0 and d.asset_url is null then raise exception 'La entrega está vacía';end if;
 result:=public.workspace_command('version.submit',jsonb_build_object('project_id',t.project_id,'deliverable_id',t.id,
  'editor_version',2,'content_markdown',d.content_markdown,'credits',d.credits,'asset_url',d.asset_url,'change_summary',coalesce(nullif(trim(p_change_summary),''),'Entrega para revisión')),p_task_revision);
 select id into v_id from public.workspace_versions where deliverable_id=t.id and version_number=(result->>'current_version')::integer;
 insert into workspace_private.version_documents(version_id,content_document) values(v_id,d.content_document);
 delete from workspace_private.drafts where deliverable_id=t.id and author_id=auth.uid();
 return result;
end;$$;

-- Sharing an image never opens its container or sibling originals.
create table workspace_private.reference_media(reference_id uuid not null references workspace_private.edition_references(id),original_id uuid not null references workspace_private.reference_originals(id),primary key(reference_id,original_id));
create table workspace_private.assignment_media(deliverable_id uuid not null references public.workspace_deliverables(id),original_id uuid not null references workspace_private.reference_originals(id),primary key(deliverable_id,original_id));
create table workspace_private.comment_media(comment_id uuid not null references public.workspace_comments(id),original_id uuid not null references workspace_private.reference_originals(id),primary key(comment_id,original_id));
create index reference_media_original on workspace_private.reference_media(original_id);
create index assignment_media_original on workspace_private.assignment_media(original_id);
create index comment_media_original on workspace_private.comment_media(original_id);
alter table workspace_private.reference_media enable row level security;
alter table workspace_private.assignment_media enable row level security;
alter table workspace_private.comment_media enable row level security;
revoke all on workspace_private.reference_media,workspace_private.assignment_media,workspace_private.comment_media from public,anon,authenticated;
create function workspace_private.opal_original_for(o workspace_private.reference_originals,p_user uuid) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare r workspace_private.edition_references;p public.workspace_projects;begin
 if o.id is null or o.status<>'ready' then return false;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 if p.id is null or p.deleted_at is not null or not workspace_private.member(p.unit_id,p_user) then return false;end if;
 if workspace_private.opal_reference_for(r,p_user) then return true;end if;
 if o.mime_type not like 'image/%' then return false;end if;
 return exists(select 1 from workspace_private.version_originals vo join public.workspace_versions v on v.id=vo.version_id where vo.original_id=o.id and workspace_private.opal_content_for(p_user,v.deliverable_id,v.id))
  or exists(select 1 from workspace_private.reference_media rm join workspace_private.edition_references shared on shared.id=rm.reference_id where rm.original_id=o.id and shared.deliverable_id is null and workspace_private.opal_reference_for(shared,p_user))
  or exists(select 1 from workspace_private.assignment_media am join public.workspace_deliverables t on t.id=am.deliverable_id where am.original_id=o.id and workspace_private.opal_project_for(p_user,t.project_id) and workspace_private.notification_allowed(p_user,'task.read',t.unit_id,t.project_id,t.area_id,t.id))
  or exists(select 1 from workspace_private.comment_media cm join public.workspace_comments c on c.id=cm.comment_id where cm.original_id=o.id and workspace_private.opal_content_for(p_user,c.deliverable_id));
end;$$;
create function workspace_private.opal_original_download(o workspace_private.reference_originals) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare r workspace_private.edition_references;begin
 if not workspace_private.opal_original_for(o,auth.uid()) then return false;end if;
 select * into r from workspace_private.edition_references where id=o.reference_id;
 return coalesce(workspace_private.reference_source_allowed(r),false)
  or exists(select 1 from workspace_private.version_originals vo join public.workspace_versions v on v.id=vo.version_id join public.workspace_deliverables t on t.id=v.deliverable_id where vo.original_id=o.id and workspace_private.opal_content_for(auth.uid(),t.id,v.id) and (workspace_private.allowed('asset.download_source',t.unit_id,t.project_id,t.area_id,t.id) or exists(select 1 from workspace_private.document_acceptances ac where ac.version_id=v.id)))
  or exists(select 1 from workspace_private.reference_media rm join workspace_private.edition_references shared on shared.id=rm.reference_id where rm.original_id=o.id and shared.deliverable_id is null and workspace_private.reference_source_allowed(shared))
  or exists(select 1 from workspace_private.assignment_media am join public.workspace_deliverables t on t.id=am.deliverable_id where am.original_id=o.id and workspace_private.allowed('asset.download_source',t.unit_id,t.project_id,t.area_id,t.id))
  or exists(select 1 from workspace_private.comment_media cm join public.workspace_comments c on c.id=cm.comment_id join public.workspace_deliverables t on t.id=c.deliverable_id where cm.original_id=o.id and workspace_private.allowed('asset.download_source',t.unit_id,t.project_id,t.area_id,t.id));
end;$$;
create function workspace_private.opal_image_ids(doc jsonb) returns table(id uuid) language sql immutable set search_path=pg_catalog,pg_temp as $$
 with recursive nodes(n) as(select doc union all select child from nodes cross join lateral jsonb_array_elements(coalesce(n->'content','[]')) child) select distinct (n->'attrs'->>'assetId')::uuid from nodes where n->>'type'='originalImage';
$$;
create function workspace_private.opal_shared_media() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if tg_table_name='edition_references' then
  delete from workspace_private.reference_media where reference_id=new.id;
  if new.deliverable_id is null then insert into workspace_private.reference_media select new.id,id from workspace_private.opal_image_ids(new.content_document);end if;
 elsif tg_table_name='workspace_deliverables' then
  delete from workspace_private.assignment_media where deliverable_id=new.id;
  insert into workspace_private.assignment_media select new.id,id from workspace_private.opal_image_ids(new.description_document);
 else
  delete from workspace_private.comment_media where comment_id=new.id;
  insert into workspace_private.comment_media select new.id,id from workspace_private.opal_image_ids(new.body_document);
 end if;return new;
end;$$;
create trigger workspace_opal_reference_media after insert or update of content_document on workspace_private.edition_references for each row execute function workspace_private.opal_shared_media();
create trigger workspace_opal_assignment_media after update of description_document on public.workspace_deliverables for each row execute function workspace_private.opal_shared_media();
create trigger workspace_opal_comment_media after update of body_document on public.workspace_comments for each row execute function workspace_private.opal_shared_media();
alter function public.workspace_original_access(uuid,boolean,text) set schema workspace_private;
alter function workspace_private.workspace_original_access(uuid,boolean,text) rename to opal_original_access_v1;
create function public.workspace_original_access(p_id uuid,p_download boolean,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare o workspace_private.reference_originals;r workspace_private.edition_references;p public.workspace_projects;begin
 perform workspace_private.original_gateway(p_gateway_key);
 select * into o from workspace_private.reference_originals where id=p_id and status='ready';
 if not workspace_private.session_active() or not workspace_private.opal_original_for(o,auth.uid()) or (p_download and not workspace_private.opal_original_download(o)) then raise exception 'Sin permiso para acceder al original' using errcode='42501';end if;
 perform workspace_private.original_tick('read');
 select * into r from workspace_private.edition_references where id=o.reference_id;select * into p from public.workspace_projects where id=r.project_id;
 perform workspace_private.log(p.unit_id,p.id,r.area_id,r.deliverable_id,case when p_download then 'original.downloaded' else 'original.viewed' end,o.id);
 return to_jsonb(o);
end;$$;
revoke all on function public.workspace_original_access(uuid,boolean,text) from public,anon;
grant execute on function public.workspace_original_access(uuid,boolean,text) to authenticated;
-- Pin all new functions and close every inherited legacy execute privilege.
do $$declare f record;begin
 for f in select p.oid::regprocedure as identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='workspace_private' and (p.proname like 'opal_%' or p.proname in('document_markdown','reference_readable','reference_writable','reference_source_allowed','notification_visible')) loop execute 'revoke all on function '||f.identity||' from public,anon,authenticated';end loop;
end;$$;
revoke all on function public.workspace_save_draft(uuid,jsonb,integer,integer),public.workspace_save_reference(uuid,jsonb,integer),public.workspace_command(text,jsonb,integer),public.workspace_reference_bundle(uuid),public.workspace_mention_candidates(uuid,uuid,uuid,uuid,text),public.workspace_prepare_task_reference(uuid,text,text),public.workspace_original_descriptor(uuid),public.workspace_set_task_references(uuid,uuid[],integer,boolean),public.workspace_opal_bundle(uuid),public.workspace_notification_document(uuid) from public,anon;
grant execute on function public.workspace_save_draft(uuid,jsonb,integer,integer),public.workspace_save_reference(uuid,jsonb,integer),public.workspace_command(text,jsonb,integer),public.workspace_reference_bundle(uuid),public.workspace_mention_candidates(uuid,uuid,uuid,uuid,text),public.workspace_prepare_task_reference(uuid,text,text),public.workspace_original_descriptor(uuid),public.workspace_set_task_references(uuid,uuid[],integer,boolean),public.workspace_opal_bundle(uuid),public.workspace_notification_document(uuid) to authenticated;
