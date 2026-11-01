-- Closed editions retain access and originals, but cannot accept editorial writes.
set lock_timeout='5s';
create function workspace_private.require_open_project(p_project uuid) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;
begin
 -- This lock serializes a save already in flight with the project's close/reopen.
 select * into p from public.workspace_projects where id=p_project for share;
 if p.id is null or p.deleted_at is not null or p.status in('closed','archived') then
  raise exception 'La edición está cerrada. Puedes consultarla; para modificarla, Dirección debe reabrirla.' using errcode='55000';
 end if;
end;$$;
revoke all on function workspace_private.require_open_project(uuid) from public,anon,authenticated;

create function workspace_private.guard_closed_editorial_write() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare payload jsonb; rows jsonb[]:='{}'; k uuid; project uuid; projects uuid[]:='{}';
begin
 if TG_OP<>'INSERT' then rows:=array_append(rows,to_jsonb(OLD));end if;
 if TG_OP<>'DELETE' then rows:=array_append(rows,to_jsonb(NEW));end if;
 foreach payload in array rows loop
  k:=(payload->>TG_ARGV[1])::uuid; project:=null;
  case TG_ARGV[0]
   when 'project' then project:=k;
   when 'task' then select project_id into project from public.workspace_deliverables where id=k;
   when 'version' then select t.project_id into project from public.workspace_versions v join public.workspace_deliverables t on t.id=v.deliverable_id where v.id=k;
   when 'reference' then select project_id into project from workspace_private.edition_references where id=k;
   when 'support' then select project_id into project from workspace_private.support_documents where id=k;
   when 'note' then select t.project_id into project from workspace_private.image_notes n join public.workspace_versions v on v.id=n.version_id join public.workspace_deliverables t on t.id=v.deliverable_id where n.id=k;
   when 'comment' then select t.project_id into project from public.workspace_comments c join public.workspace_deliverables t on t.id=c.deliverable_id where c.id=k;
   when 'asset' then select t.project_id into project from workspace_private.image_assets a join public.workspace_deliverables t on t.id=a.deliverable_id where a.id=k;
   else raise exception 'Relación editorial no reconocida';
  end case;
  if project is null then raise exception 'No se encontró la edición del contenido' using errcode='55000';end if;
  projects:=array_append(projects,project);
 end loop;
 -- Stable ordering also protects a row reassigned between different projects.
 for project in select distinct unnest(projects) order by 1 loop
  perform workspace_private.require_open_project(project);
 end loop;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;$$;
revoke all on function workspace_private.guard_closed_editorial_write() from public,anon,authenticated;

-- Freeze editorial content at its actual write boundary, including older clients.
-- Read receipts, notifications, audit and storage cleanup/processing remain operational.
do $$declare r record;begin
 for r in select * from (values
 ('public','workspace_areas','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_deliverables','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_events','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_versions','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_comments','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_dependencies','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('public','workspace_publications','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','drafts','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','edition_references','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','support_documents','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','document_acceptances','project','project_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_specs','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_drafts','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_versions','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_notes','version','version_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_note_replies','note','note_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_note_resolutions','note','note_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','image_version_files','version','version_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','task_references','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','assignment_media','task','deliverable_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','reference_media','reference','reference_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','reference_history','reference','reference_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','support_media','support','document_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','support_history','support','document_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','version_documents','version','version_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','version_originals','version','version_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','asset_links','version','version_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','comment_media','comment','comment_id','INSERT OR UPDATE OR DELETE'),
 ('workspace_private','document_deliveries','support','document_id','INSERT'),
 ('workspace_private','image_assets','task','deliverable_id','INSERT'),
 ('workspace_private','reference_originals','reference','reference_id','INSERT'),
 ('workspace_private','image_upload_sessions','asset','asset_id','INSERT')
 ) as x(s,t,relationship,key,events) loop
  execute format('create trigger closed_edition_write before %s on %I.%I for each row execute function workspace_private.guard_closed_editorial_write(%L,%L)',r.events,r.s,r.t,r.relationship,r.key);
 end loop;
end;$$;

-- Also reject before reserving R2 work or entering a note/review transaction.
create or replace function public.workspace_image_command(p_action text,p_deliverable_id uuid,p_data jsonb default '{}',p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare project uuid;begin
 if not workspace_private.session_active() or not workspace_private.can_read_task(p_deliverable_id) then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 select project_id into project from public.workspace_deliverables where id=p_deliverable_id;
 if p_action<>'draft.get' then perform workspace_private.require_open_project(project);end if;
 if p_action in('spec.save','draft.save','version.submit') then
  perform 1 from workspace_private.upload_policy where singleton for share;
  if not workspace_private.image_project_enabled(project) then raise exception 'Las imágenes no están habilitadas para esta edición' using errcode='42501';end if;
 end if;
 return workspace_private.image_command_before_pilot(p_action,p_deliverable_id,p_data,p_revision);
end;$$;
create or replace function public.workspace_image_storage(p_action text,p_data jsonb,p_gateway_key text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare project uuid;begin
 perform workspace_private.original_gateway(p_gateway_key);
 if p_action in('open','attach','part','verified') or (p_action='lock' and p_data->>'operation' in('begin','part','complete')) then
  perform 1 from workspace_private.upload_policy where singleton for share;
  if p_action='open' then select project_id into project from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid;
  else select t.project_id into project from workspace_private.image_upload_sessions s join workspace_private.image_assets a on a.id=s.asset_id join public.workspace_deliverables t on t.id=a.deliverable_id where s.id=(p_data->>'session_id')::uuid;end if;
  perform workspace_private.require_open_project(project);
  if not workspace_private.image_project_enabled(project) then raise exception 'Las imágenes no están habilitadas para esta edición' using errcode='42501';end if;
 end if;
 return workspace_private.image_storage_before_pilot(p_action,p_data,p_gateway_key);
end;$$;
-- CREATE OR REPLACE preserves the existing grants; helpers are private, never public APIs.

-- Disable upload affordances for older clients while retaining readable versions.
create or replace function public.workspace_image_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare b jsonb;enabled boolean;begin
 b:=workspace_private.image_bundle_before_pilot(p_project_id);
 enabled:=workspace_private.image_project_enabled(p_project_id) and exists(select 1 from public.workspace_projects where id=p_project_id and deleted_at is null and status not in('closed','archived'));
 return b||jsonb_build_object('uploads_enabled',enabled,'enabled',enabled or exists(select 1 from public.workspace_deliverables t where t.project_id=p_project_id and t.kind='image' and workspace_private.can_read_content(t.id)));
end;$$;
notify pgrst,'reload schema';
reset lock_timeout;
