-- Forward rollback for 1.7.1.2: use as a new reviewed migration, never erase migration history.
-- Keeps every document, original, project status, membership and license.
set lock_timeout='5s';
create or replace function public.workspace_image_command(p_action text,p_deliverable_id uuid,p_data jsonb default '{}',p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare project uuid;begin
 if not workspace_private.session_active() or not workspace_private.can_read_task(p_deliverable_id) then raise exception 'Asignación fuera de tu acceso' using errcode='42501';end if;
 if p_action in('spec.save','draft.save','version.submit') then
  -- Serialize policy removal with DB writes; in-flight R2 completions are checked again.
  perform 1 from workspace_private.upload_policy where singleton for share;
  select project_id into project from public.workspace_deliverables where id=p_deliverable_id;
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
  if not workspace_private.image_project_enabled(project) then raise exception 'Las imágenes no están habilitadas para esta edición' using errcode='42501';end if;
 end if;
 return workspace_private.image_storage_before_pilot(p_action,p_data,p_gateway_key);
end;$$;
create or replace function public.workspace_image_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare b jsonb;enabled boolean;begin
 b:=workspace_private.image_bundle_before_pilot(p_project_id);
 enabled:=workspace_private.image_project_enabled(p_project_id);
 -- Retained data stay readable even after removing this edition from the list.
 return b||jsonb_build_object('uploads_enabled',enabled,'enabled',enabled or exists(select 1 from public.workspace_deliverables t where t.project_id=p_project_id and t.kind='image' and workspace_private.can_read_content(t.id)));
end;$$;
do $$declare r record;begin
 for r in select n.nspname as s,c.relname as t,t.tgname as name from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where t.tgfoid='workspace_private.guard_closed_editorial_write()'::regprocedure loop
  execute format('drop trigger %I on %I.%I',r.name,r.s,r.t);
 end loop;
end;$$;
drop function workspace_private.guard_closed_editorial_write();
drop function workspace_private.require_open_project(uuid);
drop trigger closed_edition_content on public.workspace_projects;
drop function workspace_private.guard_closed_project_content();
notify pgrst,'reload schema';
reset lock_timeout;
