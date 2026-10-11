-- Workspace 1.5.5: private, scoped notifications and editable legacy concepts.
-- Recipient evaluation follows the same RBAC rules without impersonating a JWT.
create function workspace_private.notification_allowed(p_user uuid,k text,u uuid,p uuid default null,a uuid default null,d uuid default null) returns boolean language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare g record; m text; own boolean; pa boolean; aa boolean; depth integer;
begin
 if p_user is null then return false;end if;
 if k='platform.manage' then return false;end if;
 if not workspace_private.member(u,p_user) then return false;end if;
 own:=exists(select 1 from public.workspace_deliverables t where id=d and (responsible_id=p_user or p_user=any(collaborator_ids)) and exists(select 1 from public.workspace_assignments x where x.user_id=p_user and x.unit_id=u and x.project_id=p and (x.deliverable_id=t.id or (x.deliverable_id is null and (x.area_id is null or x.area_id=t.area_id))) and x.starts_at<=now() and (x.expires_at is null or x.expires_at>now())));
 if k='content.edit_assigned' and not own then return workspace_private.notification_allowed(p_user,'content.edit_any_scoped',u,p,a,d);end if;
 if d is null and k='task.create' then own:=exists(select 1 from public.workspace_assignments z where z.user_id=p_user and z.unit_id=u and z.project_id=p and z.deliverable_id is null and (z.area_id is null or z.area_id=a) and z.starts_at<=now() and (z.expires_at is null or z.expires_at>now()));end if;
 pa:=exists(select 1 from public.workspace_assignments where user_id=p_user and unit_id=u and project_id=p and starts_at<=now() and (expires_at is null or expires_at>now()));
 aa:=exists(select 1 from public.workspace_assignments where user_id=p_user and unit_id=u and project_id=p and area_id=a and starts_at<=now() and (expires_at is null or expires_at>now()));
 -- The narrowest live principal grant overrides broader principal grants.
 select max(case scope_type when 'platform' then 0 when 'unit' then 1 when 'project' then 2 when 'area' then 3 else 4 end) into depth from public.workspace_access_grants
 where user_id=p_user and (unit_id=u or scope_type='platform') and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d);
 if depth is null then return false;end if;
 for g in select * from public.workspace_access_grants where user_id=p_user and (unit_id=u or scope_type='platform') and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d)
 and case scope_type when 'platform' then 0 when 'unit' then 1 when 'project' then 2 when 'area' then 3 else 4 end=depth loop
  select mode into m from workspace_private.role_permissions where role=g.access_role and permission=k;
  -- Product direction requires an explicit written permission, even for defaults P.
  if g.access_role='gimg_project_director' and k not in('unit.read','project.read','task.read','content.read','unit.members.read','audit.read_scoped') then continue;end if;
  if m='U' or (m='P' and pa) or (m='A' and aa) or (m like 'E%' and own) then return true;end if;
 end loop;
 -- Delegated permissions cannot bypass suspension, final editorial authority or expiry.
 if k='publication.approve_final' then return false;end if;
 return exists(select 1 from public.workspace_delegations x where delegate_user_id=p_user and unit_id=u and revoked_at is null and starts_at<=now() and expires_at>now() and k=any(permission_keys) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d));
end;$$;

create table workspace_private.notifications(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references auth.users(id),
 unit_id uuid not null references public.workspace_units(id),project_id uuid references public.workspace_projects(id),
 area_id uuid references public.workspace_areas(id),deliverable_id uuid references public.workspace_deliverables(id),
 reference_id uuid references workspace_private.edition_references(id),actor_id uuid references auth.users(id),
 event_key text not null,event_type text not null,title text not null,body text not null,
 permission_keys text[] not null default '{}',personal boolean not null default false,
 created_at timestamptz not null default now(),read_at timestamptz,unique(recipient_id,event_key)
);
create index notifications_recipient_date on workspace_private.notifications(recipient_id,created_at desc);
create index notifications_unread on workspace_private.notifications(recipient_id,created_at desc) where read_at is null;
create index notifications_unit on workspace_private.notifications(unit_id);
create index notifications_project on workspace_private.notifications(project_id);
create index notifications_area on workspace_private.notifications(area_id);
create index notifications_task on workspace_private.notifications(deliverable_id);
create index notifications_reference on workspace_private.notifications(reference_id);
create index notifications_actor on workspace_private.notifications(actor_id);
create index workspace_due_notices on public.workspace_deliverables(due_at,id) where due_at is not null and state not in('published','archived','area_approved','qa_approved');
alter table workspace_private.notifications enable row level security;
revoke all on workspace_private.notifications from public,anon,authenticated;

create function workspace_private.notification_visible(n workspace_private.notifications) returns boolean
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;t public.workspace_deliverables;
begin
 if n.recipient_id is distinct from auth.uid() or not workspace_private.session_active() or not workspace_private.member(n.unit_id) then return false;end if;
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

create function workspace_private.notify_audit() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;r workspace_private.edition_references;ar public.workspace_areas;
 person uuid;keys text[]:='{}';kind text;label text;message text;own_notice boolean;eligible boolean;target uuid;
begin
 if new.unit_id is null then return new;end if;
 if new.deliverable_id is not null then
  select * into t from public.workspace_deliverables where id=new.deliverable_id;
  select * into ar from public.workspace_areas where id=t.area_id;
 end if;
 if new.action='reference.saved' then
  select * into r from workspace_private.edition_references where id=new.entity_id and archived_at is null;
  if r.id is null then return new;end if;
  kind:='reference.updated';label:='Referencia de la edición actualizada';message:=r.title;
  keys:=array['content.read','project.read','reference.read'];
 elsif new.action in('member.save','grant.save','assignment.save','delegation.save','grant.revoke','delegation.revoke') then
  target:=nullif(new.context->>'resolved_user_id','')::uuid;
  if target is null and new.action='grant.revoke' then select user_id into target from public.workspace_access_grants where id=new.entity_id;end if;
  if target is null and new.action='delegation.revoke' then select delegate_user_id into target from public.workspace_delegations where id=new.entity_id;end if;
  kind:='access.updated';label:='Tu acceso de GIMG se actualizó';message:='Consulta tus ediciones y funciones disponibles.';
 elsif new.action='event.save' then
  kind:='calendar.updated';label:='El calendario de la edición cambió';message:='Consulta la fecha actualizada.';keys:=array['project.read'];
 elsif t.id is not null then
  if new.action in('task.create','task.save') then kind:='assignment.updated';label:='Tu asignación se actualizó';keys:=array['task.assign'];
  elsif new.action='task.schedule' then kind:='schedule.updated';label:='Fecha de entrega o prioridad actualizada';keys:=array['task.assign'];
  elsif new.action='review.changes' then kind:='corrections.requested';label:='Hay correcciones para tu trabajo';keys:=array['task.assign'];
  elsif new.action in('comment.add','qa.issue') then kind:='conversation.updated';label:=case when new.action='qa.issue' then 'Nueva incidencia de calidad' else 'Nuevo comentario en el trabajo' end;keys:=array['task.assign','qa.approve'];
  elsif new.action in('qa.block','qa.release') then kind:='quality.updated';label:=case when new.action='qa.block' then 'QA bloqueó la salida del trabajo' else 'QA verificó la corrección' end;keys:=array['task.assign','qa.approve'];
  elsif new.action='review.reopen' then kind:='work.reopened';label:='El trabajo se reabrió para una nueva versión';keys:=array['task.assign'];
  elsif new.action='publication.approve' then kind:='publication.authorized';label:='Dirección autorizó la publicación';keys:=array['publication.execute'];
  elsif new.action in('version.submit','task.transition') then
   if t.state='review' then kind:='review.requested';label:='Nueva entrega por revisar';keys:=array['review.approve_'||ar.specialty,'task.assign'];
   elsif t.state='area_approved' then kind:='document.accepted';label:='Documento aceptado para consulta';keys:=array['content.read','reference.read','review.queue_qa'];
   elsif t.state='in_qa' then kind:='qa.requested';label:='Hay un trabajo listo para QA';keys:=array['qa.approve'];
   elsif t.state='qa_approved' then kind:='publication.requested';label:='Falta la aprobación final de Dirección';keys:=array['publication.approve_final'];
   elsif t.state='published' then kind:='publication.completed';label:='El trabajo se publicó';keys:=array['content.read','reference.read'];
   elsif t.state='blocked' then kind:='work.blocked';label:='El trabajo tiene un bloqueo';keys:=array['task.assign','qa.approve'];
   end if;
  end if;
  message:=t.title;
 end if;
 if kind is null then return new;end if;
 for person in select user_id from public.workspace_unit_memberships where unit_id=new.unit_id loop
  if person=new.actor_id or not workspace_private.member(new.unit_id,person) then continue;end if;
  own_notice:=false;eligible:=false;
  if kind='access.updated' then eligible:=person=target;own_notice:=eligible;
  elsif r.id is not null then
   eligible:=workspace_private.notification_allowed(person,'content.read',new.unit_id,r.project_id,r.area_id)
    or workspace_private.notification_allowed(person,'project.read',new.unit_id,r.project_id,r.area_id)
    or workspace_private.notification_allowed(person,'reference.read',new.unit_id,r.project_id,r.area_id);
   -- A contributor's project-wide reference capability never reveals another area's instructions.
   if r.area_id is not null then eligible:=eligible and (workspace_private.notification_allowed(person,'content.read',new.unit_id,r.project_id,r.area_id)
    or exists(select 1 from public.workspace_assignments a where a.user_id=person and a.project_id=r.project_id and (a.area_id is null or a.area_id=r.area_id) and a.starts_at<=now() and (a.expires_at is null or a.expires_at>now())));end if;
  else
   own_notice:=t.id is not null and (t.responsible_id=person or person=any(t.collaborator_ids))
    and workspace_private.notification_allowed(person,'task.read',new.unit_id,t.project_id,t.area_id,t.id);
   eligible:=exists(select 1 from unnest(keys) k where workspace_private.notification_allowed(person,k,new.unit_id,new.project_id,new.area_id,new.deliverable_id));
   if kind='publication.requested' and (person=t.responsible_id or person=any(t.collaborator_ids) or exists(select 1 from public.workspace_versions where deliverable_id=t.id and author_id=person)) then eligible:=false;own_notice:=false;end if;
   if kind='qa.requested' or kind='review.requested' then own_notice:=false;end if;
   eligible:=eligible or own_notice;
  end if;
  if eligible then
   insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,deliverable_id,reference_id,actor_id,event_key,event_type,title,body,permission_keys,personal)
   values(person,new.unit_id,new.project_id,new.area_id,new.deliverable_id,r.id,new.actor_id,'audit:'||new.id,kind,label,coalesce(message,''),keys,own_notice)
   on conflict(recipient_id,event_key) do nothing;
  end if;
 end loop;
 return new;
end;$$;
create trigger workspace_notify_audit after insert on public.workspace_audit for each row execute function workspace_private.notify_audit();

-- Deadline notices are materialized once when the person's active inbox is refreshed.
-- They don't require a paid scheduler, browser permission, email or a running Mac.
create function workspace_private.queue_deadline_notices() returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare t public.workspace_deliverables;
begin
 for t in select * from public.workspace_deliverables where due_at<=now()+interval '24 hours' and due_at>now()-interval '7 days'
  and state not in('published','archived','area_approved','qa_approved') and workspace_private.member(unit_id) and workspace_private.can_read_task(id)
  and (responsible_id=auth.uid() or auth.uid()=any(collaborator_ids) or workspace_private.allowed('task.assign',unit_id,project_id,area_id,id)) order by due_at limit 200 loop
  if not workspace_private.member(t.unit_id) or not workspace_private.can_read_task(t.id) then continue;end if;
  if not (t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids) or workspace_private.allowed('task.assign',t.unit_id,t.project_id,t.area_id,t.id)) then continue;end if;
  insert into workspace_private.notifications(recipient_id,unit_id,project_id,area_id,deliverable_id,event_key,event_type,title,body,permission_keys,personal)
  values(auth.uid(),t.unit_id,t.project_id,t.area_id,t.id,'deadline:'||t.id||':'||t.due_at::text||':'||case when t.due_at<now() then 'late' else 'soon' end,'deadline',case when t.due_at<now() then 'Una entrega tiene retraso' else 'Entrega en las próximas 24 horas' end,t.title,array['task.assign'],t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids))
  on conflict(recipient_id,event_key) do nothing;
 end loop;
end;$$;

create function public.workspace_notifications() returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare rows jsonb;unread integer;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 perform workspace_private.queue_deadline_notices();
 select count(*)::integer into unread from workspace_private.notifications n where recipient_id=auth.uid() and read_at is null and workspace_private.notification_visible(n);
 select coalesce(jsonb_agg(to_jsonb(x) order by created_at desc),'[]') into rows from(
  select n.id,n.event_type,n.title,n.body,n.project_id,n.deliverable_id,n.reference_id,n.created_at,n.read_at,p.title as edition_title
  from workspace_private.notifications n left join public.workspace_projects p on p.id=n.project_id
  where n.recipient_id=auth.uid() and workspace_private.notification_visible(n) order by n.created_at desc limit 60
 ) x;
 return jsonb_build_object('items',rows,'unread_count',unread,'fetched_at',now());
end;$$;

create function public.workspace_read_notification(p_id uuid default null,p_before timestamptz default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare n workspace_private.notifications;changed integer;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 if p_id is not null then
  select * into n from workspace_private.notifications where id=p_id and recipient_id=auth.uid();
  if n.id is null or not workspace_private.notification_visible(n) then raise exception 'Aviso no disponible en tu alcance' using errcode='42501';end if;
  update workspace_private.notifications set read_at=coalesce(read_at,now()) where id=n.id and recipient_id=auth.uid();
  return jsonb_build_object('id',n.id,'project_id',n.project_id,'deliverable_id',n.deliverable_id,'reference_id',n.reference_id,'event_type',n.event_type);
 end if;
 if p_before is null or p_before>now() then raise exception 'Selecciona los avisos que quieres marcar';end if;
 update workspace_private.notifications n set read_at=now() where recipient_id=auth.uid() and read_at is null and created_at<=p_before and workspace_private.notification_visible(n);
 get diagnostics changed=row_count;return jsonb_build_object('read',changed);
end;$$;

create function public.workspace_import_concept(p_project_id uuid,p_data jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.workspace_projects;r jsonb;
begin
 select * into p from public.workspace_projects where id=p_project_id for update;
 if p.id is null or p.status in('closed','archived') or not workspace_private.allowed('reference.manage_creative',p.unit_id,p.id) then raise exception 'Sin permiso para editar el concepto' using errcode='42501';end if;
 if trim(p.brief)='' then raise exception 'No hay concepto anterior que convertir';end if;
 if exists(select 1 from workspace_private.edition_references where project_id=p.id and kind='concept' and archived_at is null) then raise exception 'El concepto ya tiene una referencia editable. Actualiza la vista';end if;
 r:=public.workspace_save_reference(p.id,(p_data-'id')||jsonb_build_object('kind','concept','area_id',null),0);
 insert into workspace_private.reference_history(reference_id,revision,snapshot,actor_id)
 values((r->>'id')::uuid,0,jsonb_build_object('title','Descripción breve original','kind','concept','content_markdown',p.brief,'palette','[]'::jsonb,'content_document',null),auth.uid());
 return r;
end;$$;
create function public.workspace_reference_history(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare r workspace_private.edition_references;
begin
 select * into r from workspace_private.edition_references where id=p_id and archived_at is null;
 if r.id is null or not coalesce(workspace_private.reference_readable(r),false) then raise exception 'Sin permiso para consultar este historial' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('revision',h.revision,'created_at',h.created_at,'snapshot',h.snapshot) order by h.revision desc) from workspace_private.reference_history h where reference_id=p_id),'[]');
end;$$;

revoke all on function workspace_private.notification_allowed(uuid,text,uuid,uuid,uuid,uuid),workspace_private.notification_visible(workspace_private.notifications),workspace_private.notify_audit(),workspace_private.queue_deadline_notices() from public,anon,authenticated;
revoke all on function public.workspace_notifications(),public.workspace_read_notification(uuid,timestamptz),public.workspace_import_concept(uuid,jsonb),public.workspace_reference_history(uuid) from public,anon;
grant execute on function public.workspace_notifications(),public.workspace_read_notification(uuid,timestamptz),public.workspace_import_concept(uuid,jsonb),public.workspace_reference_history(uuid) to authenticated;
