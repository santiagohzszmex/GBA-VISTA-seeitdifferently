-- Private working copies are distinct from immutable submitted versions.
-- Approved references are shared only inside an edition the reader can access.
create table workspace_private.drafts (
 deliverable_id uuid not null references public.workspace_deliverables(id),
 author_id uuid not null references auth.users(id),
 content_markdown text not null default '', content_document jsonb not null,
 credits text not null default '', asset_url text,
 base_version integer not null check(base_version>=0), revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(), primary key(deliverable_id,author_id),
 check(content_document @> '{"type":"doc"}'::jsonb and jsonb_typeof(content_document)='object'),
 check(octet_length(content_document::text)<=1048576 and octet_length(content_markdown)<=1048576),
 check(length(credits)<=10000), check(asset_url is null or (asset_url ~ '^https://' and length(asset_url)<=4096))
);
create index workspace_drafts_author_idx on workspace_private.drafts(author_id);
create table workspace_private.version_documents (
 version_id uuid primary key references public.workspace_versions(id),
 content_document jsonb not null check(content_document @> '{"type":"doc"}'::jsonb and jsonb_typeof(content_document)='object'),
 check(octet_length(content_document::text)<=1048576)
);
create table workspace_private.document_acceptances (
 version_id uuid primary key references public.workspace_versions(id),
 deliverable_id uuid not null references public.workspace_deliverables(id),
 project_id uuid not null references public.workspace_projects(id),
 title text not null, approved_by uuid not null references auth.users(id),
 approved_at timestamptz not null default now(), imported boolean not null default false
);
create index workspace_acceptances_project_idx on workspace_private.document_acceptances(project_id,deliverable_id,approved_at desc);
create index workspace_acceptances_task_idx on workspace_private.document_acceptances(deliverable_id);
create index workspace_acceptances_approver_idx on workspace_private.document_acceptances(approved_by);
alter table workspace_private.drafts enable row level security;
alter table workspace_private.version_documents enable row level security;
alter table workspace_private.document_acceptances enable row level security;
revoke all on workspace_private.drafts,workspace_private.version_documents,workspace_private.document_acceptances from public,anon,authenticated;

-- The reviewed rich document is also the source of its Markdown fallback.
-- A client cannot show one text to a reviewer and publish a different fallback.
create function workspace_private.document_markdown(n jsonb,depth integer default 0) returns text
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare kind text:=n->>'type'; body text:=''; item jsonb; mark jsonb; raw text; href text; i integer:=0; fence text:='```';
begin
 if depth>30 then raise exception 'Documento demasiado anidado';end if;
 if kind='text' then
  raw:=coalesce(n->>'text','');body:=raw;
  foreach href in array array[E'\\','*','_','[',']','<','>','#','`'] loop body:=replace(body,href,E'\\'||href);end loop;
  for mark in select value from jsonb_array_elements(coalesce(n->'marks','[]')) loop
   case mark->>'type'
    when 'bold' then body:='**'||body||'**';
    when 'italic' then body:='*'||body||'*';
    when 'code' then select repeat('`',coalesce(max(length(value[1])),0)+1) into fence from regexp_matches(raw,'`+','g') as runs(value);body:=fence||' '||raw||' '||fence;
    when 'link' then href:=mark->'attrs'->>'href';if href ~ '^https?://[^[:space:]<>]+$' then body:='['||body||']('||replace(replace(href,'(','%28'),')','%29')||')';end if;
    when 'textStyle' then null;when 'underline' then null;when 'strike' then body:='~~'||body||'~~';
    else raise exception 'Formato de documento no permitido';
   end case;
  end loop;
  return body;
 end if;
 if kind='hardBreak' then return E'\n';end if;
 if kind='horizontalRule' then return E'\n---\n\n';end if;
 for item in select value from jsonb_array_elements(coalesce(n->'content','[]')) loop
  if kind='codeBlock' then body:=body||coalesce(item->>'text','');continue;end if;
  i:=i+1;raw:=workspace_private.document_markdown(item,depth+1);
  if kind in('bulletList','orderedList') then raw:=(case when kind='bulletList' then '- ' else i::text||'. ' end)||replace(trim(trailing E'\n' from raw),E'\n',E'\n  ')||E'\n';end if;
  body:=body||raw;
 end loop;
 case kind
  when 'doc' then return body;
  when 'paragraph' then return body||E'\n\n';
  when 'heading' then return repeat('#',least(6,greatest(1,coalesce((n->'attrs'->>'level')::integer,2))))||' '||body||E'\n\n';
  when 'bulletList' then return body||E'\n';when 'orderedList' then return body||E'\n';when 'listItem' then return body;
  when 'blockquote' then return '> '||replace(trim(trailing E'\n' from body),E'\n',E'\n> ')||E'\n\n';
  when 'codeBlock' then select repeat('`',greatest(3,coalesce(max(length(value[1])),0)+1)) into fence from regexp_matches(body,'`+','g') as runs(value);return fence||E'\n'||body||E'\n'||fence||E'\n\n';
  else raise exception 'Elemento de documento no permitido';
 end case;
end;$$;
revoke all on function workspace_private.document_markdown(jsonb,integer) from public,anon,authenticated;

create function public.workspace_draft(p_deliverable_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables; result jsonb;
begin
 select * into t from public.workspace_deliverables where id=p_deliverable_id;
 if t.id is null then raise exception 'Trabajo no encontrado';end if;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 select to_jsonb(d) into result from workspace_private.drafts d where d.deliverable_id=t.id and d.author_id=auth.uid();
 return result;
end;$$;

create function public.workspace_save_draft(p_deliverable_id uuid,p_data jsonb,p_revision integer,p_base_version integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables; d workspace_private.drafts; next_revision integer;
begin
 select * into t from public.workspace_deliverables where id=p_deliverable_id for update;
 if t.id is null then raise exception 'Trabajo no encontrado';end if;
 perform workspace_private.require('content.edit_assigned',t.unit_id,t.project_id,t.area_id,t.id);
 if t.state not in('pending','assigned','in_progress','changes_requested') then raise exception 'El trabajo está en revisión o cerrado';end if;
 if p_base_version is distinct from t.current_version then raise exception 'El trabajo cambió; actualiza la vista antes de guardar' using errcode='40001';end if;
 select * into d from workspace_private.drafts where deliverable_id=t.id and author_id=auth.uid() for update;
 if p_revision is distinct from coalesce(d.revision,0) then raise exception 'El borrador cambió en otra ventana; actualiza la vista' using errcode='40001';end if;
 if octet_length((p_data->'content_document')::text)>1048576 then raise exception 'Documento demasiado grande';end if;
 next_revision:=coalesce(d.revision,0)+1;
 insert into workspace_private.drafts(deliverable_id,author_id,content_markdown,content_document,credits,asset_url,base_version,revision)
 values(t.id,auth.uid(),workspace_private.document_markdown(p_data->'content_document'),p_data->'content_document',coalesce(p_data->>'credits',''),nullif(trim(p_data->>'asset_url'),''),t.current_version,next_revision)
 on conflict(deliverable_id,author_id) do update set content_markdown=excluded.content_markdown,content_document=excluded.content_document,
 credits=excluded.credits,asset_url=excluded.asset_url,base_version=excluded.base_version,revision=excluded.revision,updated_at=now() returning * into d;
 return to_jsonb(d);
end;$$;

create function public.workspace_submit_draft(p_deliverable_id uuid,p_draft_revision integer,p_task_revision integer,p_change_summary text default 'Entrega para revisión') returns jsonb
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
 with recursive nodes(item) as (select d.content_document union all select child from nodes cross join lateral jsonb_array_elements(coalesce(item->'content','[]')) child)
 select coalesce(string_agg(item->>'text',''),'') into plain_text from nodes where item->>'type'='text';
 if length(trim(translate(plain_text,E'\n\r\t\v\f'||chr(160)||chr(8203)||chr(65279),'')))=0 and d.asset_url is null then raise exception 'La entrega está vacía';end if;
 result:=public.workspace_command('version.submit',jsonb_build_object('project_id',t.project_id,'deliverable_id',t.id,
  'content_markdown',d.content_markdown,'credits',d.credits,'asset_url',d.asset_url,'change_summary',coalesce(nullif(trim(p_change_summary),''),'Entrega para revisión')),p_task_revision);
 select id into v_id from public.workspace_versions where deliverable_id=t.id and version_number=(result->>'current_version')::integer;
 insert into workspace_private.version_documents(version_id,content_document) values(v_id,d.content_document);
 delete from workspace_private.drafts where deliverable_id=t.id and author_id=auth.uid();
 return result;
end;$$;

create function workspace_private.capture_document_acceptance() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_id uuid;
begin
 if new.state='area_approved' and old.state is distinct from new.state and new.area_approved_by is not null then
  select id into v_id from public.workspace_versions where deliverable_id=new.id and version_number=new.current_version;
  if v_id is null then raise exception 'La aprobación necesita una versión entregada';end if;
  insert into workspace_private.document_acceptances(version_id,deliverable_id,project_id,title,approved_by)
  values(v_id,new.id,new.project_id,new.title,new.area_approved_by) on conflict(version_id) do nothing;
 end if;
 return new;
end;$$;
create trigger workspace_capture_accepted_document after update on public.workspace_deliverables for each row execute function workspace_private.capture_document_acceptance();

-- Only currently accepted, immutable versions can be imported from the previous workflow.
insert into workspace_private.document_acceptances(version_id,deliverable_id,project_id,title,approved_by,imported)
 select v.id,t.id,t.project_id,t.title,t.area_approved_by,true from public.workspace_deliverables t
 join public.workspace_versions v on v.deliverable_id=t.id and v.version_number=t.current_version
 where t.state in('area_approved','in_qa','qa_approved','published','archived') and t.area_approved_by is not null;

-- Shared approved references are a distinct read capability. Explicit narrower
-- grants still win; this never changes access to raw submissions or originals.
insert into workspace_private.role_permissions(role,permission,mode) values('gimg_contributor','reference.read','P') on conflict(role,permission) do nothing;
create function workspace_private.can_read_reference(p_deliverable_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.can_read_content(t.id) or workspace_private.allowed('reference.read',t.unit_id,t.project_id,t.area_id,t.id)
 from public.workspace_deliverables t where t.id=p_deliverable_id),false);
$$;
revoke all on function workspace_private.can_read_reference(uuid) from public,anon,authenticated;

create function public.workspace_edition_documents(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Sin permiso para consultar esta edición';end if;
 return coalesce((select jsonb_agg(to_jsonb(x)) from (
  select distinct on(a.deliverable_id) a.version_id,a.deliverable_id,a.title,a.approved_at,a.approved_by,a.imported,
   v.version_number,v.content_markdown,v.credits,v.author_id,t.area_id,ar.name as area_name,ar.specialty,d.content_document
  from workspace_private.document_acceptances a
  join public.workspace_versions v on v.id=a.version_id
  join public.workspace_deliverables t on t.id=a.deliverable_id
  join public.workspace_areas ar on ar.id=t.area_id
  left join workspace_private.version_documents d on d.version_id=v.id
  where a.project_id=p_project_id and not t.qa_blocked and workspace_private.can_read_reference(t.id)
  order by a.deliverable_id,v.version_number desc
 ) x),'[]'::jsonb);
end;$$;

create function public.workspace_version_document(p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare task_id uuid; result jsonb;
begin
 select deliverable_id into task_id from public.workspace_versions where id=p_version_id;
 if task_id is null or not workspace_private.can_read_content(task_id) then raise exception 'Sin permiso para leer esta versión';end if;
 select content_document into result from workspace_private.version_documents where version_id=p_version_id;
 return result;
end;$$;
revoke all on function workspace_private.capture_document_acceptance() from public,anon,authenticated;
revoke all on function public.workspace_draft(uuid),public.workspace_save_draft(uuid,jsonb,integer,integer),public.workspace_submit_draft(uuid,integer,integer,text),public.workspace_edition_documents(uuid),public.workspace_version_document(uuid) from public,anon;
grant execute on function public.workspace_draft(uuid),public.workspace_save_draft(uuid,jsonb,integer,integer),public.workspace_submit_draft(uuid,integer,integer,text),public.workspace_edition_documents(uuid),public.workspace_version_document(uuid) to authenticated;

-- One request resolves the separate capabilities of a contributor and each area lead.
create function public.workspace_work_permissions(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;
begin
 select * into p from public.workspace_projects where id=p_project_id;
 if p.id is null or not workspace_private.session_active() or not workspace_private.can_read_project(p.id) then raise exception 'Sin permiso para consultar esta edición';end if;
 return jsonb_build_object('project',public.workspace_permissions(p.unit_id,p.id),
  'areas',coalesce((select jsonb_object_agg(a.id::text,public.workspace_permissions(p.unit_id,p.id,a.id)) from public.workspace_areas a where a.project_id=p.id),'{}'::jsonb),
  'tasks',coalesce((select jsonb_object_agg(t.id::text,public.workspace_permissions(p.unit_id,p.id,t.area_id,t.id)) from public.workspace_deliverables t where t.project_id=p.id and workspace_private.can_read_task(t.id)),'{}'::jsonb),
  'version_files',coalesce((select jsonb_object_agg(v.id::text,true) from public.workspace_deliverables t join public.workspace_versions v on v.deliverable_id=t.id join workspace_private.asset_links links on links.version_id=v.id where t.project_id=p.id and workspace_private.can_read_content(t.id)),'{}'::jsonb),
  'version_documents',coalesce((select jsonb_object_agg(v.id::text,d.content_document) from public.workspace_deliverables t join public.workspace_versions v on v.deliverable_id=t.id and v.version_number=t.current_version join workspace_private.version_documents d on d.version_id=v.id where t.project_id=p.id and workspace_private.can_read_content(t.id)),'{}'::jsonb));
end;$$;
revoke all on function public.workspace_work_permissions(uuid) from public,anon;
grant execute on function public.workspace_work_permissions(uuid) to authenticated;
