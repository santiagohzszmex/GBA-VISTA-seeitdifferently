-- 1.7.1: deadline facts only; no role grants or review-chain changes.
begin;
set local lock_timeout='5s';
set local statement_timeout='90s';
alter table public.workspace_deliverables add column due_has_time boolean not null default true;
alter table public.workspace_versions add column due_at_on_submit timestamptz,
 add column deadline_snapshot_known boolean not null default false;
create function workspace_private.capture_version_deadline() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$begin
 select due_at into new.due_at_on_submit from public.workspace_deliverables where id=new.deliverable_id for share;
 new.deadline_snapshot_known:=true;return new;
end;$$;
revoke all on function workspace_private.capture_version_deadline() from public,anon,authenticated;
create trigger workspace_version_deadline before insert on public.workspace_versions for each row execute function workspace_private.capture_version_deadline();

-- Preserve the existing command and its RBAC; enrich schedule receipts atomically.
alter function public.workspace_command(text,jsonb,integer) set schema workspace_private;
alter function workspace_private.workspace_command(text,jsonb,integer) rename to command_before_deadlines;
revoke all on function workspace_private.command_before_deadlines(text,jsonb,integer) from public,anon,authenticated;
create function public.workspace_command(p_action text,p_data jsonb,p_revision integer default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$declare t public.workspace_deliverables;r jsonb;begin
 if p_action='task.schedule' then
  if not workspace_private.session_active() then raise exception 'Sesión activa requerida' using errcode='42501';end if;
  select * into t from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid;
  perform workspace_private.require('task.update_schedule',t.unit_id,t.project_id,t.area_id,t.id);
  select * into t from public.workspace_deliverables where id=t.id for update;
 end if;
 r:=workspace_private.command_before_deadlines(p_action,p_data,p_revision);
 if p_action='task.schedule' then
  update public.workspace_deliverables set due_has_time=case when p_data ? 'due_has_time' then (p_data->>'due_has_time')::boolean else true end where id=t.id;
  if t.due_at is distinct from (r->>'due_at')::timestamptz then
   perform workspace_private.log(t.unit_id,t.project_id,t.area_id,t.id,'task.deadline_changed',t.id,jsonb_build_object('previous_due_at',t.due_at,'due_at',r->'due_at','previous_known',true));
  end if;
  select to_jsonb(x) into r from public.workspace_deliverables x where id=t.id;
 end if;
 return r;
end;$$;
revoke all on function public.workspace_command(text,jsonb,integer) from public,anon;
grant execute on function public.workspace_command(text,jsonb,integer) to authenticated;
create index workspace_deadline_audit on public.workspace_audit(deliverable_id,action,created_at,id) where action in('task.schedule','task.deadline_changed','version.submit');

-- Bounded projection: no document bodies, general audit, grants, tokens or originals.
create function public.workspace_deadline_facts(p_project_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$declare result jsonb;begin
 if not workspace_private.session_active() or not workspace_private.can_read_project(p_project_id) then raise exception 'Edición fuera de tu acceso' using errcode='42501';end if;
 select coalesce(jsonb_object_agg(t.id,jsonb_build_object(
 'first_submitted_at',v.created_at,
 'submitted_deadline_known',coalesce(v.deadline_snapshot_known,false) or receipt.context ? 'due_at',
 'submitted_due_at',case when v.deadline_snapshot_known then to_jsonb(v.due_at_on_submit) else receipt.context->'due_at' end,
 'deadline_changes',coalesce(changes.items,'[]'::jsonb))),'{}') into result
 from public.workspace_deliverables t
 left join lateral(select * from public.workspace_versions v where v.deliverable_id=t.id order by version_number limit 1) v on true
 left join lateral(select a.context from public.workspace_audit a where a.deliverable_id=t.id and a.action='version.submit' and a.context->>'version'=v.version_number::text and a.context ? 'due_at' order by a.id limit 1) receipt on true
 left join lateral(
  with scheduled as (
   select a.*,lag(a.context->'due_at') over(order by a.id) previous_value,row_number() over(order by a.id) position
   from public.workspace_audit a where a.deliverable_id=t.id and a.action='task.schedule' and a.context ? 'due_at'
  ), history as (
   select a.id,a.actor_id,a.created_at,a.context->'previous_due_at' previous_value,a.context->'due_at' due_value,true previous_known
   from public.workspace_audit a where a.deliverable_id=t.id and a.action='task.deadline_changed'
   union all
   select a.id,a.actor_id,a.created_at,a.previous_value,a.context->'due_at',a.position>1
   from scheduled a where (a.position=1 or a.previous_value is distinct from a.context->'due_at')
   and not exists(select 1 from public.workspace_audit n where n.deliverable_id=t.id and n.action='task.deadline_changed' and n.created_at=a.created_at and n.actor_id=a.actor_id)
  )
  select jsonb_agg(jsonb_build_object('at',a.created_at,'by',coalesce(nullif(u.nombre_publico,''),u.nombre,'Integrante'),'previous_due_at',a.previous_value,'due_at',a.due_value,'previous_known',a.previous_known) order by a.id desc) items
  from (select * from history order by id desc limit 10) a left join public.usuarios u on u.id=a.actor_id
 ) changes on true
 where t.project_id=p_project_id and workspace_private.can_read_task(t.id);
 return result;
end;$$;
revoke all on function public.workspace_deadline_facts(uuid) from public,anon;
grant execute on function public.workspace_deadline_facts(uuid) to authenticated;

-- Explicit rollout mode: enabled separately after migration acceptance.
alter table workspace_private.upload_policy add column images_all_projects boolean not null default false;
create or replace function workspace_private.image_project_enabled(p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select p.images_enabled and (p.images_all_projects or p_project=any(p.image_project_ids))
 and exists(select 1 from public.workspace_projects e join public.workspace_units u on u.id=e.unit_id where e.id=p_project and e.deleted_at is null and e.status<>'archived' and u.slug='gimg')
 from workspace_private.upload_policy p where singleton),false)
$$;
revoke all on function workspace_private.image_project_enabled(uuid) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
