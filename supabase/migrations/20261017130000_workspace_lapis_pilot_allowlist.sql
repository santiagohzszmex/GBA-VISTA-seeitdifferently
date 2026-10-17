-- Test branch only. Default closed; production activation is a separate decision.
begin;
alter table workspace_private.upload_policy add column image_project_ids uuid[] not null default '{}',
 add constraint image_project_ids_bounded check(cardinality(image_project_ids)<=100 and array_position(image_project_ids,null) is null);
create function workspace_private.image_project_enabled(p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select images_enabled and p_project=any(image_project_ids) from workspace_private.upload_policy where singleton),false)
$$;
revoke all on function workspace_private.image_project_enabled(uuid) from public,anon,authenticated;

-- Defence in depth for every conversion/creation, including non-UI paths.
create function workspace_private.image_pilot_task_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 if new.kind='image' and not workspace_private.image_project_enabled(new.project_id) then
  raise exception 'Las imágenes no están habilitadas para esta edición' using errcode='42501';
 end if;return new;
end;$$;
revoke all on function workspace_private.image_pilot_task_guard() from public,anon,authenticated;
create trigger image_pilot_task before insert or update of kind,project_id on public.workspace_deliverables
 for each row execute function workspace_private.image_pilot_task_guard();

alter function public.workspace_image_command(text,uuid,jsonb,integer) rename to image_command_before_pilot;
alter function public.image_command_before_pilot(text,uuid,jsonb,integer) set schema workspace_private;
revoke all on function workspace_private.image_command_before_pilot(text,uuid,jsonb,integer) from public,anon,authenticated;
create function public.workspace_image_command(p_action text,p_deliverable_id uuid,p_data jsonb default '{}',p_revision integer default null) returns jsonb
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
revoke all on function public.workspace_image_command(text,uuid,jsonb,integer) from public,anon;
grant execute on function public.workspace_image_command(text,uuid,jsonb,integer) to authenticated;

alter function public.workspace_image_storage(text,jsonb,text) rename to image_storage_before_pilot;
alter function public.image_storage_before_pilot(text,jsonb,text) set schema workspace_private;
revoke all on function workspace_private.image_storage_before_pilot(text,jsonb,text) from public,anon,authenticated;
create function public.workspace_image_storage(p_action text,p_data jsonb,p_gateway_key text) returns jsonb
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
revoke all on function public.workspace_image_storage(text,jsonb,text) from public,anon;
grant execute on function public.workspace_image_storage(text,jsonb,text) to authenticated;

alter function public.workspace_image_bundle(uuid) rename to image_bundle_before_pilot;
alter function public.image_bundle_before_pilot(uuid) set schema workspace_private;
revoke all on function workspace_private.image_bundle_before_pilot(uuid) from public,anon,authenticated;
create function public.workspace_image_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare b jsonb;enabled boolean;begin
 b:=workspace_private.image_bundle_before_pilot(p_project_id);
 enabled:=workspace_private.image_project_enabled(p_project_id);
 -- Retained data stay readable even after removing this edition from the list.
 return b||jsonb_build_object('uploads_enabled',enabled,'enabled',enabled or exists(select 1 from public.workspace_deliverables t where t.project_id=p_project_id and t.kind='image' and workspace_private.can_read_content(t.id)));
end;$$;
revoke all on function public.workspace_image_bundle(uuid) from public,anon;
grant execute on function public.workspace_image_bundle(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
