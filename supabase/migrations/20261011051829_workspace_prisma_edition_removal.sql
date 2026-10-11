-- Reversible edition removal. Originals and immutable versions remain intact.
alter table public.workspace_projects add column deleted_at timestamptz, add column deleted_by uuid references auth.users(id), add column deletion_reason text, add column deleted_from_status text;
create index workspace_projects_deleted_by on public.workspace_projects(deleted_by);
create index workspace_projects_removed on public.workspace_projects(unit_id,deleted_at desc) where deleted_at is not null;
create function workspace_private.protect_removed_edition() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if old.deleted_at is not null then
  if new.deleted_at is not null or (to_jsonb(new)-array['deleted_at','deleted_by','deletion_reason','deleted_from_status','status','revision']) is distinct from (to_jsonb(old)-array['deleted_at','deleted_by','deletion_reason','deleted_from_status','status','revision']) then raise exception 'La edición está eliminada; restáurala antes de modificarla';end if;
  perform workspace_private.require('project.archive',old.unit_id,old.id);
 end if;
 if new.brief='' and old.brief<>'' then new.brief:=old.brief;end if;
 return new;
end;$$;
create trigger protect_removed_edition before update on public.workspace_projects for each row execute function workspace_private.protect_removed_edition();
create or replace function workspace_private.can_read_task(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.allowed('task.read',unit_id,project_id,area_id,id) from public.workspace_deliverables where id=p_id and exists(select 1 from public.workspace_projects p where p.id=project_id and p.deleted_at is null)),false);
$$;
create or replace function workspace_private.can_read_content(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.allowed('content.read',unit_id,project_id,area_id,id) from public.workspace_deliverables where id=p_id and exists(select 1 from public.workspace_projects p where p.id=project_id and p.deleted_at is null)),false);
$$;
create or replace function workspace_private.can_read_project(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(select 1 from public.workspace_projects where id=p_id and deleted_at is null) and (coalesce((select workspace_private.allowed('project.read',unit_id,id) from public.workspace_projects where id=p_id),false)
 or exists(select 1 from public.workspace_deliverables where project_id=p_id and workspace_private.can_read_task(id))
 or exists(select 1 from public.workspace_areas where project_id=p_id and workspace_private.allowed('project.read',unit_id,project_id,id)));
$$;
create or replace function workspace_private.can_read_reference(p_deliverable_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select (workspace_private.can_read_content(t.id) or workspace_private.allowed('reference.read',t.unit_id,t.project_id,t.area_id,t.id)) and p.deleted_at is null from public.workspace_deliverables t join public.workspace_projects p on p.id=t.project_id where t.id=p_deliverable_id),false);
$$;
create function public.workspace_removed_editions(p_unit_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() or not workspace_private.member(p_unit_id) then raise exception 'Sesión o membresía no válida' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'deleted_at',deleted_at,'deletion_reason',deletion_reason,'revision',revision) order by deleted_at desc) from public.workspace_projects p where unit_id=p_unit_id and deleted_at is not null and workspace_private.allowed('project.archive',unit_id,id)),'[]');
end;$$;
create function public.workspace_remove_edition(p_project_id uuid,p_revision integer,p_confirmation text,p_reason text) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;
begin
 select * into p from public.workspace_projects where id=p_project_id for update;
 if p.id is null or p.deleted_at is not null then raise exception 'Edición no disponible';end if;
 perform workspace_private.require('project.archive',p.unit_id,p.id);
 if p.revision is distinct from p_revision then raise exception 'La edición cambió; vuelve a cargarla' using errcode='40001';end if;
 if p_confirmation is distinct from p.title then raise exception 'Escribe el nombre exacto de la edición para confirmar';end if;
 if p_reason is null or length(trim(p_reason)) not between 10 and 2000 then raise exception 'Registra un motivo de entre 10 y 2000 caracteres';end if;
 update public.workspace_projects set deleted_at=now(),deleted_by=auth.uid(),deletion_reason=trim(p_reason),deleted_from_status=status,status='archived',revision=revision+1 where id=p.id returning * into p;
 perform workspace_private.log(p.unit_id,p.id,null,null,'project.removed',p.id,jsonb_build_object('reason',p_reason,'previous_status',p.deleted_from_status));
 return jsonb_build_object('id',p.id,'revision',p.revision);
end;$$;
create function public.workspace_restore_edition(p_project_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;
begin
 select * into p from public.workspace_projects where id=p_project_id for update;
 if p.id is null or p.deleted_at is null then raise exception 'La edición no está eliminada';end if;
 perform workspace_private.require('project.archive',p.unit_id,p.id);
 if p.revision is distinct from p_revision then raise exception 'La edición cambió; vuelve a cargarla' using errcode='40001';end if;
 update public.workspace_projects set status=coalesce(deleted_from_status,'active'),deleted_at=null,deleted_by=null,deletion_reason=null,deleted_from_status=null,revision=revision+1 where id=p.id returning * into p;
 perform workspace_private.log(p.unit_id,p.id,null,null,'project.restored',p.id);
 return jsonb_build_object('id',p.id,'revision',p.revision);
end;$$;
revoke all on function workspace_private.protect_removed_edition() from public,anon,authenticated;
revoke all on function public.workspace_removed_editions(uuid),public.workspace_remove_edition(uuid,integer,text,text),public.workspace_restore_edition(uuid,integer) from public,anon;
grant execute on function public.workspace_removed_editions(uuid),public.workspace_remove_edition(uuid,integer,text,text),public.workspace_restore_edition(uuid,integer) to authenticated;
create or replace function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;t public.workspace_deliverables;
begin
 if n.recipient_id is distinct from auth.uid() or not workspace_private.session_active() or not workspace_private.member(n.unit_id) then return false;end if;
 if n.project_id is not null and exists(select 1 from public.workspace_projects where id=n.project_id and deleted_at is not null) then return false;end if;
 if n.reference_id is not null then
  select * into r from workspace_private.edition_references where id=n.reference_id and archived_at is null;
  return r.id is not null and coalesce(workspace_private.reference_readable(r),false);
 end if;
 if n.deliverable_id is not null then
  select * into t from public.workspace_deliverables where id=n.deliverable_id;
  if t.id is null or t.state='archived' then return false;end if;
  if n.event_type='deadline' and (t.due_at is null or t.state in('published','archived','area_approved','qa_approved') or n.event_key is distinct from 'deadline:'||t.id||':'||t.due_at::text||':'||case when t.due_at<now() then 'late' else 'soon' end) then return false;end if;
  if n.event_type='document.accepted' then
   return not t.qa_blocked and workspace_private.can_read_reference(t.id);
  end if;
  if not workspace_private.can_read_task(t.id) then return false;end if;
  if n.personal then return t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids);end if;
 elsif n.project_id is not null then
  if not exists(select 1 from public.workspace_projects where id=n.project_id and status not in('closed','archived')) then return false;end if;
  if not workspace_private.can_read_project(n.project_id) then return false;end if;
 elsif n.personal then return true;
 end if;
 return exists(select 1 from unnest(n.permission_keys) k where workspace_private.allowed(k,n.unit_id,n.project_id,n.area_id,n.deliverable_id));
end;$$;
