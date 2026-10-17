-- Phase 4 verified fix: disabling new uploads must retain authorized reads.
begin;
create or replace function public.workspace_image_bundle(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare result jsonb;p workspace_private.upload_policy;begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Edición fuera de tu acceso' using errcode='42501';end if;
 select * into p from workspace_private.upload_policy where singleton;
 with tasks as(select t.id from public.workspace_deliverables t where t.project_id=p_project_id and t.kind='image' and workspace_private.can_read_content(t.id)),
 versions as(select v.* from workspace_private.image_versions v where deliverable_id in(select id from tasks))
 select jsonb_build_object('enabled',p.images_enabled or exists(select 1 from tasks),'uploads_enabled',p.images_enabled,'policy',to_jsonb(p)-'singleton',
 'specs',coalesce((select jsonb_object_agg(s.deliverable_id,to_jsonb(s)) from workspace_private.image_specs s join public.workspace_deliverables t on t.id=s.deliverable_id where t.project_id=p_project_id and workspace_private.can_read_task(t.id)),'{}'),
 'drafts',coalesce((select jsonb_object_agg(d.deliverable_id,to_jsonb(d)) from workspace_private.image_drafts d where d.deliverable_id in(select id from tasks) and d.author_id=auth.uid()),'{}'),
 'assets',coalesce((select jsonb_object_agg(a.id,workspace_private.image_safe_asset(a)) from workspace_private.image_assets a where a.deliverable_id in(select id from tasks) and (a.owner_id=auth.uid() or exists(select 1 from workspace_private.image_version_files f where f.asset_id=a.id))),'{}'),
 'versions',coalesce((select jsonb_object_agg(v.version_id,to_jsonb(v)||jsonb_build_object('files',(select jsonb_object_agg(f.role,f.asset_id) from workspace_private.image_version_files f where f.version_id=v.version_id),'quality',q.report)) from versions v left join workspace_private.image_quality_reports q on q.version_id=v.version_id),'{}'),
 'notes',coalesce((select jsonb_agg(n order by n.created_at,n.id) from workspace_private.image_notes n where n.version_id in(select version_id from versions)),'[]'),
 'replies',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_note_replies r join workspace_private.image_notes n on n.id=r.note_id where n.version_id in(select version_id from versions)),'[]'),
 'resolutions',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_note_resolutions r where r.verified_version_id in(select version_id from versions)),'[]'),
 'approvals',coalesce((select jsonb_agg(r order by r.created_at,r.id) from workspace_private.image_approval_warnings r where r.version_id in(select version_id from versions)),'[]')) into result;
 return result;
end;$$;
revoke all on function public.workspace_image_bundle(uuid) from public,anon;
grant execute on function public.workspace_image_bundle(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
