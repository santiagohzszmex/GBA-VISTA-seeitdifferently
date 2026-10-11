-- Workspace 1.5.6: person-first administration, same RBAC authority.
alter table public.workspace_access_grants add column cargo_key text;
alter table public.workspace_assignments add column grant_id uuid references public.workspace_access_grants(id),add column function_key text;
create index workspace_assignments_grant on public.workspace_assignments(grant_id);
alter table public.workspace_delegations add column grant_id uuid references public.workspace_access_grants(id);
create index workspace_delegations_grant on public.workspace_delegations(grant_id);
-- A revoked assignment can have an empty validity interval; it never grants access.
do $$declare c record;begin
 for c in select conname from pg_catalog.pg_constraint where conrelid='public.workspace_assignments'::regclass and contype='c' and pg_catalog.pg_get_constraintdef(oid) like '%expires_at > starts_at%' loop execute format('alter table public.workspace_assignments drop constraint %I',c.conname);end loop;
end;$$;
alter table public.workspace_assignments add constraint assignment_validity check(expires_at is null or expires_at>=starts_at);
create table workspace_private.written_briefs(id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.workspace_units(id),text text not null check(length(trim(text)) between 20 and 10000),created_by uuid not null references auth.users(id),created_at timestamptz not null default now());
create index written_briefs_unit on workspace_private.written_briefs(unit_id);
alter table public.workspace_delegations add constraint delegation_written_brief foreign key(written_brief_id) references workspace_private.written_briefs(id);
create index workspace_delegations_brief on public.workspace_delegations(written_brief_id);
create index written_briefs_author on workspace_private.written_briefs(created_by);
alter table workspace_private.written_briefs enable row level security;
revoke all on workspace_private.written_briefs from public,anon,authenticated;

create function workspace_private.cargo_catalog() returns jsonb language sql immutable set search_path=pg_catalog,pg_temp as $$
 select '[{"key":"direction","title":"Dirección general y creativa","accessRole":"gimg_direction","assignmentRole":"direction","scope":"unit","expiry":"none"},{"key":"production","title":"Responsable de Producción","accessRole":"gimg_production_lead","assignmentRole":"production","scope":"unit","expiry":"optional"},{"key":"coordination","title":"Coordinación de Producción y Workspace","accessRole":"gimg_workspace_coordinator","assignmentRole":"production","scope":"unit","expiry":"optional","needsProject":true},{"key":"project_director","title":"Dirección de microedición","accessRole":"gimg_project_director","assignmentRole":"direction","scope":"project","expiry":"required"},{"key":"area_lead","title":"Responsable de área","accessRole":"gimg_area_lead","scope":"area","expiry":"optional","functions":["research","editorial","layout","illustration","photography"]},{"key":"contributor","title":"Integrante de un área","accessRole":"gimg_contributor","scope":"area","expiry":"optional","functions":["research","writing","design","illustration","photography"]},{"key":"quality","title":"Gestión de archivos y QA","accessRole":"gimg_quality_manager","assignmentRole":"qa","scope":"unit","expiry":"optional","needsProject":true},{"key":"viewer","title":"Consulta","accessRole":"gimg_viewer","scope":"project","expiry":"required"}]'::jsonb;
$$;
create function workspace_private.permission_delegable(k text) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select k not in('platform.manage','unit.roles.grant','asset.delete_physical','publication.approve_final') and exists(select 1 from workspace_private.role_permissions where permission=k and (mode='D' or (role='gimg_project_director' and mode='P' and permission not in('unit.read','project.read','task.read','content.read','unit.members.read','audit.read_scoped'))));
$$;
create function workspace_private.member_expiry(u uuid,person uuid,requested timestamptz) returns timestamptz language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare cap timestamptz;answer timestamptz;
begin
 select expires_at into cap from public.workspace_unit_memberships where unit_id=u and user_id=person;
 answer:=case when cap is not null and (requested is null or requested>cap) then cap else requested end;
 if answer is not null and answer<=now() then raise exception 'La vigencia debe estar en el futuro';end if;
 return answer;
end;$$;
create function workspace_private.sync_cargo_assignment() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if new.revoked_at is not null and old.revoked_at is null then
  update public.workspace_assignments set expires_at=greatest(starts_at,least(coalesce(expires_at,now()),now())) where grant_id=new.id;
  update public.workspace_delegations set revoked_at=now() where grant_id=new.id and revoked_at is null;
 elsif new.expires_at is distinct from old.expires_at then
  update public.workspace_assignments set expires_at=case when new.expires_at is null then null else greatest(starts_at,new.expires_at) end where grant_id=new.id;
  update public.workspace_delegations set expires_at=new.expires_at where grant_id=new.id and revoked_at is null and new.expires_at>starts_at;
 end if;return new;
end;$$;
create trigger sync_cargo_assignment after update on public.workspace_access_grants for each row execute function workspace_private.sync_cargo_assignment();

-- Enforce a shortened membership cap for both old and new administration APIs.
create function workspace_private.cap_member_access() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if new.expires_at is not null and new.expires_at is distinct from old.expires_at then
    update public.workspace_access_grants set expires_at=new.expires_at where unit_id=new.unit_id and user_id=new.user_id and revoked_at is null and starts_at<new.expires_at and (expires_at is null or expires_at>new.expires_at);
    update public.workspace_access_grants set revoked_at=now() where unit_id=new.unit_id and user_id=new.user_id and revoked_at is null and starts_at>=new.expires_at;
    update public.workspace_assignments set expires_at=greatest(starts_at,new.expires_at) where unit_id=new.unit_id and user_id=new.user_id and (expires_at is null or expires_at>new.expires_at);
    update public.workspace_delegations set expires_at=new.expires_at where unit_id=new.unit_id and delegate_user_id=new.user_id and revoked_at is null and starts_at<new.expires_at and expires_at>new.expires_at;
    update public.workspace_delegations set revoked_at=now() where unit_id=new.unit_id and delegate_user_id=new.user_id and revoked_at is null and starts_at>=new.expires_at;
   end if;
 return new;
end;$$;
create trigger cap_member_access after update of expires_at on public.workspace_unit_memberships for each row execute function workspace_private.cap_member_access();

-- Protect the existing endpoint too; hiding the old forms is not security.
create function workspace_private.people_guard(u uuid,action text,value jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare person uuid;m public.workspace_unit_memberships;e timestamptz;g public.workspace_access_grants;d public.workspace_delegations;brief uuid;result jsonb:=value;key text;
begin
 if action not in('member.save','grant.save','assignment.save','delegation.save','grant.revoke','delegation.revoke') then return value;end if;
 perform workspace_private.require(case when action='member.save' then case when value->>'membership_status' in('suspended','inactive','departed') then 'unit.members.suspend' else 'unit.members.invite' end else 'unit.roles.grant' end,u);
 person:=nullif(value->>'user_id','')::uuid;
 if action='member.save' and person is null then select id into person from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(value->>'handle')));end if;
 if action='grant.revoke' then select * into g from public.workspace_access_grants where id=(value->>'id')::uuid and unit_id=u;person:=g.user_id;end if;
 if action='delegation.revoke' then select * into d from public.workspace_delegations where id=(value->>'id')::uuid and unit_id=u;person:=d.delegate_user_id;end if;
 if person is null then raise exception 'GBA ID o registro no encontrado';end if;
 select * into m from public.workspace_unit_memberships where unit_id=u and user_id=person for update;
 result:=result||jsonb_build_object('user_id',person);
 if action='member.save' then
  if m.user_id is not null and value->>'membership_status' not in('suspended','inactive','departed') then perform workspace_private.require('unit.roles.grant',u);end if;
  if value->>'membership_status' in('suspended','inactive','departed') then
   if length(trim(coalesce(value->>'reason','')))<3 then raise exception 'Escribe el motivo del cambio de acceso';end if;
   if not(value?'expires_at') then result:=result||jsonb_build_object('expires_at',m.expires_at);end if;
  elsif nullif(value->>'expires_at','')::timestamptz<=now() then raise exception 'La vigencia debe estar en el futuro';end if;
  return result;
 end if;
 if action in('grant.revoke','delegation.revoke') then
  if length(trim(coalesce(value->>'reason','')))<3 then raise exception 'Escribe el motivo de la revocación';end if;
  return result;
 end if;
 if not workspace_private.member(u,person) then raise exception 'La persona necesita una membresía activa y vigente';end if;
 e:=workspace_private.member_expiry(u,person,nullif(value->>'expires_at','')::timestamptz);
 result:=result||jsonb_build_object('expires_at',e);
 if action='grant.save' and not exists(select 1 from workspace_private.role_permissions where role=value->>'access_role' and role like 'gimg_%') then raise exception 'Rol técnico inválido para GIMG';end if;
 if action='grant.save' and exists(select 1 from public.workspace_access_grants where user_id=person and unit_id=u and scope_type=value->>'scope_type' and scope_id=(value->>'scope_id')::uuid and revoked_at is null and (expires_at is null or expires_at>now())) then raise exception 'Ya existe un cargo vigente en ese alcance; modifica o quita el cargo anterior';end if;
 if action='delegation.save' then
  if e is null or e<=coalesce(nullif(value->>'starts_at','')::timestamptz,now()) then raise exception 'La delegación necesita un vencimiento futuro';end if;
  if jsonb_typeof(value->'permission_keys') is distinct from 'array' or jsonb_array_length(value->'permission_keys')=0 then raise exception 'Elige al menos un permiso';end if;
  for key in select jsonb_array_elements_text(value->'permission_keys') loop
   if not workspace_private.authorizes_scope(key,u,value->>'scope_type',(value->>'scope_id')::uuid) then raise exception 'No puedes delegar este permiso en ese alcance: %',key;end if;
   if not workspace_private.permission_delegable(key) then raise exception 'Este permiso no se puede delegar: %',key;end if;
   if key in('unit.members.invite','unit.members.suspend') and value->>'scope_type'<>'unit' then raise exception 'Los permisos del equipo requieren alcance de unidad';end if;
  end loop;
  if length(trim(coalesce(value->>'reason','')))<20 or length(value->>'reason')>10000 or lower(value->>'reason') like '%[escribe el motivo]%' then raise exception 'Completa el mandato escrito (mínimo 20 caracteres) con un motivo real';end if;
  insert into workspace_private.written_briefs(unit_id,text,created_by) values(u,trim(value->>'reason'),auth.uid()) returning id into brief;
  result:=result||jsonb_build_object('written_brief_id',brief);
 end if;
 return result;
end;$$;

create or replace function public.workspace_command(p_action text,p_data jsonb,p_revision integer default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare u uuid; p public.workspace_projects; t public.workspace_deliverables; target uuid; ar public.workspace_areas; result jsonb; v text; req text; person uuid; old_state text; item record;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 u:=(p_data->>'unit_id')::uuid;
 p_data:=workspace_private.people_guard(u,p_action,p_data);
 if p_action in('member.save','grant.save','assignment.save','delegation.save','grant.revoke','delegation.revoke') then
  perform workspace_private.require(case when p_action='member.save' then case when p_data->>'membership_status' in('suspended','departed','inactive') then 'unit.members.suspend' else 'unit.members.invite' end else 'unit.roles.grant' end,u);
  person:=(p_data->>'user_id')::uuid;
  if p_action='member.save' then
   if person is null then select id into person from public.usuarios where lower(nombre)=lower(trim(p_data->>'handle'));end if;
   if person is null then raise exception 'GBA ID no encontrado';end if;
   insert into public.workspace_unit_memberships(unit_id,user_id,membership_status,expires_at,suspended_at) values(u,person,p_data->>'membership_status',(p_data->>'expires_at')::timestamptz,case when p_data->>'membership_status'='suspended' then now() end)
   on conflict(unit_id,user_id) do update set membership_status=excluded.membership_status,expires_at=excluded.expires_at,suspended_at=excluded.suspended_at;
   target:=person;
  elsif p_action='grant.revoke' then
   update public.workspace_access_grants set revoked_at=now() where id=(p_data->>'id')::uuid and unit_id=u returning id into target;
  elsif p_action='delegation.revoke' then
   update public.workspace_delegations set revoked_at=now() where id=(p_data->>'id')::uuid and unit_id=u returning id into target;
  elsif p_action='grant.save' then
   perform workspace_private.validate_scope(p_data->>'scope_type',(p_data->>'scope_id')::uuid,u);
   if p_data->>'access_role'='gimg_project_director' and p_data->>'expires_at' is null then raise exception 'La Dirección de producto requiere vencimiento';end if;
   if p_data->>'access_role'='gba_platform_owner' then raise exception 'El rol de plataforma se configura fuera de la autoridad editorial';end if;
   if not workspace_private.member(u,person) then raise exception 'Membresía activa requerida';end if;
   update public.workspace_access_grants set revoked_at=now() where user_id=person and scope_type=p_data->>'scope_type' and scope_id=(p_data->>'scope_id')::uuid and revoked_at is null;
   insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,expires_at,granted_by,reason) values(person,p_data->>'access_role',u,p_data->>'scope_type',(p_data->>'scope_id')::uuid,(p_data->>'expires_at')::timestamptz,auth.uid(),p_data->>'reason') returning id into target;
  elsif p_action='assignment.save' then
   if not workspace_private.member(u,person) then raise exception 'Membresía activa requerida';end if;
   insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,deliverable_id,expires_at,assigned_by) values(person,p_data->>'assignment_role',u,(p_data->>'project_id')::uuid,(p_data->>'area_id')::uuid,(p_data->>'deliverable_id')::uuid,(p_data->>'expires_at')::timestamptz,auth.uid()) returning id into target;
  else
   perform workspace_private.validate_scope(p_data->>'scope_type',(p_data->>'scope_id')::uuid,u);
   if not workspace_private.member(u,person) then raise exception 'Membresía activa requerida';end if;
   if exists(select 1 from jsonb_array_elements_text(p_data->'permission_keys') k where k='publication.approve_final' or not workspace_private.authorizes_scope(k,u,p_data->>'scope_type',(p_data->>'scope_id')::uuid)) then raise exception 'No puedes delegar estos permisos';end if;
   insert into public.workspace_delegations(delegate_user_id,delegated_by,unit_id,scope_type,scope_id,permission_keys,starts_at,expires_at,written_brief_id,reason)
   values(person,auth.uid(),u,p_data->>'scope_type',(p_data->>'scope_id')::uuid,array(select jsonb_array_elements_text(p_data->'permission_keys')),(p_data->>'starts_at')::timestamptz,(p_data->>'expires_at')::timestamptz,(p_data->>'written_brief_id')::uuid,p_data->>'reason') returning id into target;
  end if;
  perform workspace_private.log(u,null,null,null,p_action,target,p_data||jsonb_build_object('resolved_user_id',person));
  return jsonb_build_object('id',target);
 end if;
 if p_action='unit.settings' then
  perform workspace_private.require('unit.settings.manage',u);update public.workspace_units set settings=p_data->'settings' where id=u;perform workspace_private.log(u,null,null,null,p_action,u);return jsonb_build_object('id',u);
 end if;
 if p_action='project.create' then
  perform workspace_private.require('project.create',u);
  insert into public.workspace_projects(unit_id,title,brief,starts_at,ends_at,created_by) values(u,p_data->>'title',coalesce(p_data->>'brief',''),(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,auth.uid()) returning * into p;
  insert into public.workspace_areas(unit_id,project_id,name,specialty) values(u,p.id,'Investigación','research'),(u,p.id,'Editorial','text'),(u,p.id,'Ilustración','art'),(u,p.id,'Diseño y maquetación','integration'),(u,p.id,'QA','qa');
  perform workspace_private.log(u,p.id,null,null,p_action,p.id);return to_jsonb(p);
 end if;
 select * into p from public.workspace_projects where id=(p_data->>'project_id')::uuid for update;
 if p.id is null then raise exception 'Proyecto no encontrado';end if;
 u:=p.unit_id;
 if p_action='project.save' then
  perform workspace_private.require('project.update',u,p.id);
  if p_revision is distinct from p.revision then raise exception 'El proyecto cambió; vuelve a cargarlo' using errcode='40001';end if;
  if p_data->>'status'='archived' then perform workspace_private.require('project.archive',u,p.id);end if;
  update public.workspace_projects set title=p_data->>'title',brief=coalesce(p_data->>'brief',''),status=coalesce(p_data->>'status',status),starts_at=(p_data->>'starts_at')::timestamptz,ends_at=(p_data->>'ends_at')::timestamptz,revision=revision+1 where id=p.id returning * into p;
  perform workspace_private.log(u,p.id,null,null,p_action,p.id,p_data);return to_jsonb(p);
 end if;
 if p.status in('closed','archived') then raise exception 'El proyecto está cerrado';end if;
 if p_action='event.save' then
  perform workspace_private.require('task.update_schedule',u,p.id);
  if p_data->>'kind'='deadline' then raise exception 'La fecha de entrega se cambia desde el entregable';end if;
  if p_data->>'deliverable_id' is not null then perform workspace_private.require('task.update_schedule',u,p.id,(select area_id from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid),(p_data->>'deliverable_id')::uuid);end if;
  if p_data->>'id' is not null then
   update public.workspace_events set title=p_data->>'title',starts_at=(p_data->>'starts_at')::timestamptz,ends_at=(p_data->>'ends_at')::timestamptz,revision=revision+1 where id=(p_data->>'id')::uuid and project_id=p.id and kind<>'deadline' and revision=p_revision returning id into target;
   if target is null then raise exception 'El evento cambió; vuelve a cargarlo' using errcode='40001';end if;
  else
   insert into public.workspace_events(unit_id,project_id,deliverable_id,title,starts_at,ends_at,kind,created_by) values(u,p.id,(p_data->>'deliverable_id')::uuid,p_data->>'title',(p_data->>'starts_at')::timestamptz,(p_data->>'ends_at')::timestamptz,p_data->>'kind',auth.uid()) returning id into target;
  end if;
  perform workspace_private.log(u,p.id,null,null,p_action,target,p_data);return jsonb_build_object('id',target);
 end if;
 if p_action='task.create' then
  if not workspace_private.member(u) then raise exception 'Membresía activa requerida';end if;
  select * into ar from public.workspace_areas where id=(p_data->>'area_id')::uuid and project_id=p.id;
  if ar.id is null then raise exception 'Área inválida';end if;
  perform workspace_private.require('task.create',u,p.id,ar.id);
  person:=(p_data->>'responsible_id')::uuid;
  if not workspace_private.allowed('task.assign',u,p.id,ar.id) and person is distinct from auth.uid() then raise exception 'Sólo puedes crear tu propio trabajo';end if;
  if person is not null and not workspace_private.member(u,person) then raise exception 'Responsable sin membresía activa';end if;
  if person is distinct from auth.uid() then perform workspace_private.require('task.assign',u,p.id,ar.id);end if;
  insert into public.workspace_deliverables(unit_id,project_id,area_id,title,description,responsible_id,created_by,state) values(u,p.id,ar.id,p_data->>'title',coalesce(p_data->>'description',''),person,auth.uid(),case when person is null then 'pending' else 'assigned' end) returning * into t;
  if person is not null then insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,deliverable_id,assigned_by) values(person,'contributor',u,p.id,ar.id,t.id,auth.uid());end if;
  perform workspace_private.log(u,p.id,t.area_id,t.id,p_action,t.id);return to_jsonb(t);
 end if;
 select * into t from public.workspace_deliverables where id=(p_data->>'deliverable_id')::uuid and project_id=p.id for update;
 if t.id is null then raise exception 'Entregable no encontrado';end if;
 if p_revision is distinct from t.revision then raise exception 'El entregable cambió; vuelve a cargarlo' using errcode='40001';end if;
 if p_action='task.save' then
  perform workspace_private.require('task.assign',u,p.id,t.area_id,t.id);
  person:=(p_data->>'responsible_id')::uuid;
  if person is not null and not workspace_private.member(u,person) then raise exception 'Responsable sin membresía activa';end if;
  for item in select value from jsonb_array_elements_text(coalesce(p_data->'collaborator_ids','[]')) loop if not workspace_private.member(u,item.value::uuid) then raise exception 'Colaborador sin membresía activa';end if;end loop;
  if t.state in('area_approved','in_qa','qa_approved','published','archived') then raise exception 'Reabre el entregable antes de modificar su asignación';end if;
  update public.workspace_deliverables set title=p_data->>'title',description=coalesce(p_data->>'description',''),responsible_id=person,collaborator_ids=array(select value::uuid from jsonb_array_elements_text(coalesce(p_data->'collaborator_ids','[]'))),state=case when t.state='pending' and person is not null then 'assigned' else t.state end where id=t.id;
  update public.workspace_assignments set expires_at=now() where deliverable_id=t.id and starts_at<now() and (expires_at is null or expires_at>now());
  for item in select person as id union select value::uuid from jsonb_array_elements_text(coalesce(p_data->'collaborator_ids','[]')) loop
   if item.id is not null then insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,deliverable_id,assigned_by) values(item.id,'contributor',u,p.id,t.area_id,t.id,auth.uid());end if;
  end loop;
 elsif p_action='task.schedule' then
  perform workspace_private.require('task.update_schedule',u,p.id,t.area_id,t.id);
  update public.workspace_deliverables set due_at=(p_data->>'due_at')::timestamptz,priority=p_data->>'priority' where id=t.id;
  delete from public.workspace_events where deliverable_id=t.id and kind='deadline';
  if p_data->>'due_at' is not null then insert into public.workspace_events(unit_id,project_id,deliverable_id,title,starts_at,kind,created_by) values(u,p.id,t.id,t.title,(p_data->>'due_at')::timestamptz,'deadline',auth.uid());end if;
 elsif p_action='dependency.add' then
  perform workspace_private.require('task.assign',u,p.id,t.area_id,t.id);
  target:=(p_data->>'depends_on_id')::uuid;
  if not exists(select 1 from public.workspace_deliverables where id=target and project_id=p.id) then raise exception 'La dependencia debe pertenecer al proyecto';end if;
  if t.id=target or exists(with recursive chain(id) as(select depends_on_id from public.workspace_dependencies where deliverable_id=target union select d.depends_on_id from public.workspace_dependencies d join chain c on d.deliverable_id=c.id) select 1 from chain where id=t.id) then raise exception 'Dependencia circular';end if;
  insert into public.workspace_dependencies values(t.id,target) on conflict do nothing;
 elsif p_action='version.submit' then
  perform workspace_private.require('content.edit_assigned',u,p.id,t.area_id,t.id);
  if t.state in('published','archived','area_approved','in_qa','qa_approved','blocked') then raise exception 'Reabre el entregable antes de enviar una versión';end if;
  if length(trim(coalesce(p_data->>'content_markdown','')))=0 and p_data->>'asset_url' is null then raise exception 'La entrega está vacía';end if;
  insert into public.workspace_versions(deliverable_id,version_number,content_markdown,asset_title,credits,change_summary,author_id) values(t.id,t.current_version+1,coalesce(p_data->>'content_markdown',''),p_data->>'asset_title',coalesce(p_data->>'credits',''),coalesce(p_data->>'change_summary','Nueva versión'),auth.uid()) returning id into target;
  if p_data->>'asset_url' is not null then insert into workspace_private.asset_links values(target,p_data->>'asset_url');end if;
  update public.workspace_deliverables set current_version=current_version+1,state='review',area_approved_by=null,qa_approved_by=null,final_approved_by=null,final_approved_at=null where id=t.id;
 elsif p_action='comment.add' then
  perform workspace_private.require('content.comment',u,p.id,t.area_id,t.id);
  insert into public.workspace_comments(deliverable_id,version_number,kind,body,round,actor_id) values(t.id,t.current_version,'comment',p_data->>'body',t.round,auth.uid());
 elsif p_action='qa.issue' then
  perform workspace_private.require('qa.raise_issue',u,p.id,t.area_id,t.id);
  insert into public.workspace_comments(deliverable_id,version_number,kind,body,round,actor_id) values(t.id,t.current_version,'qa_issue',p_data->>'body',t.round,auth.uid());
 elsif p_action='review.changes' then
  perform workspace_private.require('review.request_changes',u,p.id,t.area_id,t.id);
  if t.state not in('review','in_qa') then raise exception 'No está en revisión';end if;
  if t.state='in_qa' then perform workspace_private.require('qa.approve',u,p.id,t.area_id,t.id);end if;
  if t.round>=1+t.extra_rounds then raise exception 'Dirección debe autorizar otra ronda';end if;
  insert into public.workspace_comments(deliverable_id,version_number,kind,body,assigned_to,round,actor_id) values(t.id,t.current_version,'changes',p_data->>'body',t.responsible_id,t.round+1,auth.uid());
  update public.workspace_deliverables set state='changes_requested',round=round+1,area_approved_by=null,qa_approved_by=null,final_approved_by=null,final_approved_at=null where id=t.id;
 elsif p_action='review.extra_round' then
  perform workspace_private.require('review.authorize_extra_round',u,p.id,t.area_id,t.id);
  if length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Registra el motivo';end if;
  update public.workspace_deliverables set extra_rounds=extra_rounds+1 where id=t.id;
 elsif p_action='review.reopen' then
  perform workspace_private.require('review.reopen',u,p.id,t.area_id,t.id);
  if t.state not in('area_approved','in_qa','qa_approved','published','archived') then raise exception 'No está aprobado o cerrado';end if;
  if length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Registra el motivo';end if;
  update public.workspace_deliverables set state='in_progress',area_approved_by=null,qa_approved_by=null,final_approved_by=null,final_approved_at=null where id=t.id;
 elsif p_action='qa.block' then
  perform workspace_private.require('qa.block_release',u,p.id,t.area_id,t.id);
  if length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Registra la incidencia crítica';end if;
  update public.workspace_publications set is_public=false where deliverable_id=t.id;
  update public.workspace_deliverables set qa_blocked=true,qa_issue=p_data->>'reason',blocked_from=state,state='blocked',block_reason=p_data->>'reason',final_approved_by=null,final_approved_at=null where id=t.id;
 elsif p_action='qa.release' then
  perform workspace_private.require('qa.approve',u,p.id,t.area_id,t.id);
  if not t.qa_blocked then raise exception 'No existe un bloqueo de QA';end if;
  if length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Registra la verificación de la corrección';end if;
  update public.workspace_deliverables set qa_blocked=false,qa_issue=null,block_reason=null,state='in_progress',area_approved_by=null,qa_approved_by=null,final_approved_by=null,final_approved_at=null where id=t.id;
 elsif p_action='publication.approve' then
  perform workspace_private.require('publication.approve_final',u,p.id,t.area_id,t.id);
  if t.state<>'qa_approved' or t.qa_blocked then raise exception 'Se requiere QA aprobado y sin bloqueos';end if;
  if t.responsible_id=auth.uid() or auth.uid()=any(t.collaborator_ids) or exists(select 1 from public.workspace_versions where deliverable_id=t.id and author_id=auth.uid()) then raise exception 'No puedes aprobar finalmente tu propio entregable';end if;
  update public.workspace_deliverables set final_approved_by=auth.uid(),final_approved_at=now() where id=t.id;
 elsif p_action='task.transition' then
  v:=p_data->>'state'; old_state:=t.state;
  if v='blocked' then
   perform workspace_private.require('task.block',u,p.id,t.area_id,t.id);
   if length(trim(coalesce(p_data->>'reason','')))<5 then raise exception 'Registra el motivo del bloqueo';end if;
   update public.workspace_deliverables set blocked_from=state,block_reason=p_data->>'reason',state='blocked' where id=t.id;
  elsif t.state='blocked' then
   perform workspace_private.require('task.block',u,p.id,t.area_id,t.id);
   if t.qa_blocked then raise exception 'Sólo QA puede liberar su bloqueo';end if;
   if v is distinct from t.blocked_from then raise exception 'Retoma el estado anterior al bloqueo';end if;
   update public.workspace_deliverables set state=v,blocked_from=null,block_reason=null where id=t.id;
  else
   req:=case
    when t.state='assigned' and v='in_progress' then 'task.update_status'
    when t.state='in_progress' and v='review' then 'content.request_review'
    when t.state='review' and v='area_approved' then 'review.approve_'||(select specialty from public.workspace_areas where id=t.area_id)
    when t.state='area_approved' and v='in_qa' then 'review.queue_qa'
    when t.state='in_qa' and v='qa_approved' then 'qa.approve'
    when t.state='qa_approved' and v='published' then 'publication.execute'
    when t.state='published' and v='archived' then 'asset.archive' end;
   if req is null then raise exception 'Transición no autorizada';end if;
   perform workspace_private.require(req,u,p.id,t.area_id,t.id);
   if v in('review','area_approved','in_qa','qa_approved','published') and t.current_version=0 then raise exception 'Entrega una versión primero';end if;
   if v='area_approved' and t.round>0 then insert into public.workspace_comments(deliverable_id,version_number,kind,body,round,actor_id) values(t.id,t.current_version,'verified','Cambios verificados y aprobación de área',t.round,auth.uid());end if;
   if v in('in_progress','published') and exists(select 1 from public.workspace_dependencies x join public.workspace_deliverables y on y.id=x.depends_on_id where x.deliverable_id=t.id and y.state not in('published','archived')) then raise exception 'Hay dependencias pendientes';end if;
   if v='published' and (t.final_approved_by is null or t.qa_blocked) then raise exception 'Dirección debe aprobar la publicación';end if;
   if v='published' then
    update public.workspace_publications set is_public=false where deliverable_id=t.id;
    insert into public.workspace_publications(deliverable_id,version_id,title,content_markdown,credits) select t.id,vv.id,t.title,vv.content_markdown,vv.credits from public.workspace_versions vv where vv.deliverable_id=t.id and vv.version_number=t.current_version on conflict(version_id) do update set is_public=true,published_at=now();
   end if;
   update public.workspace_deliverables set state=v,area_approved_by=case when v='area_approved' then auth.uid() else area_approved_by end,qa_approved_by=case when v='qa_approved' then auth.uid() else qa_approved_by end where id=t.id;
  end if;
 else raise exception 'Acción desconocida';end if;
 update public.workspace_deliverables set revision=revision+1,updated_at=now() where id=t.id returning * into t;
 perform workspace_private.log(u,p.id,t.area_id,t.id,p_action,t.id,jsonb_build_object('title',t.title,'revision',t.revision,'version',t.current_version,'previous_state',old_state,'state',t.state,'reason',p_data->>'reason','due_at',t.due_at,'responsible_id',t.responsible_id));
 return to_jsonb(t);
end;$$;
create function workspace_private.authorizes_scope(k text,u uuid,s text,i uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare p uuid;a uuid;d uuid;
begin
 perform workspace_private.validate_scope(s,i,u);
 if s='project' then p:=i;elsif s='area' then select project_id,id into p,a from public.workspace_areas where id=i and unit_id=u;elsif s='deliverable' then select project_id,area_id,id into p,a,d from public.workspace_deliverables where id=i and unit_id=u;end if;
 return workspace_private.allowed(k,u,p,a,d);
end;$$;

create function public.workspace_find_profile(p_unit_id uuid,p_gba_id text) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare person record;matches integer;
begin
 perform workspace_private.require('unit.members.invite',p_unit_id);
 if length(trim(coalesce(p_gba_id,''))) not between 1 and 180 then return null;end if;
 select count(*) into matches from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(p_gba_id)));
 if matches>1 then raise exception 'Ese GBA ID no identifica una cuenta única';end if;
 select id,coalesce(nullif(nombre_publico,''),nombre) as name,nombre as handle into person from public.usuarios where lower(nombre)=lower(trim(leading '@' from trim(p_gba_id))) limit 1;
 if person.id is null then return null;end if;
 return jsonb_build_object('profile',jsonb_build_object('id',person.id,'name',person.name,'handle',person.handle),'alreadyMember',exists(select 1 from public.workspace_unit_memberships where unit_id=p_unit_id and user_id=person.id));
end;$$;

create function public.workspace_people_action(p_unit_id uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare person uuid;m public.workspace_unit_memberships;g public.workspace_access_grants;dl public.workspace_delegations;c jsonb;out jsonb;e timestamptz;pid uuid;aid uuid;s text;sid uuid;role_id text;fn text;selected_specialty text;area_name text;gr uuid;ar uuid;key text;was_capped boolean;reason text;previous_notice text;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 if p_action not in('invite','assign','expiry','remove','membership','delegate','revoke') then raise exception 'Operación de integrantes desconocida';end if;
 perform workspace_private.require(case when p_action='invite' then 'unit.members.invite' when p_action='membership' and p_data->>'status'='suspended' then 'unit.members.suspend' else 'unit.roles.grant' end,p_unit_id);
 person:=nullif(p_data->>'userId','')::uuid;
 if p_action in('expiry','remove') then select * into g from public.workspace_access_grants where id=(p_data->>'grantId')::uuid and unit_id=p_unit_id;person:=g.user_id;end if;
 if p_action='revoke' then select * into dl from public.workspace_delegations where id=(p_data->>'delegationId')::uuid and unit_id=p_unit_id;person:=dl.delegate_user_id;end if;
 if p_action='delegate' then person:=nullif(p_data->>'delegateId','')::uuid;end if;
 if person is null then raise exception 'Integrante o registro no encontrado';end if;
 if not exists(select 1 from public.usuarios where id=person) then raise exception 'GBA ID no encontrado';end if;
 -- All administration of one member uses the same row lock, including legacy RPCs.
 perform 1 from public.usuarios where id=person for update;
 select * into m from public.workspace_unit_memberships where unit_id=p_unit_id and user_id=person for update;
 reason:=trim(coalesce(p_data->>'reason',''));
 if p_action='invite' then
  if m.user_id is not null then raise exception 'Esa persona ya es integrante; modifica su acceso desde la ficha';end if;
  if p_data->>'mode' not in('team','reserve','viewer') or p_data->>'mode' is null then raise exception 'Elige cómo entra la persona';end if;
  e:=nullif(p_data->>'expiresAt','')::timestamptz;if e<=now() then raise exception 'La vigencia debe estar en el futuro';end if;
  out:=public.workspace_command('member.save',jsonb_build_object('unit_id',p_unit_id,'user_id',person,'membership_status',case when p_data->>'mode'='reserve' then 'accepted' else 'active' end,'expires_at',e,'reason','Ingreso: '||(p_data->>'mode')));
  if p_data->>'mode'='viewer' then
   perform workspace_private.require('unit.roles.grant',p_unit_id);
   pid:=nullif(p_data->>'projectId','')::uuid;
   if pid is null then raise exception 'Selecciona la edición compartida para Consulta';end if;
   perform public.workspace_people_action(p_unit_id,'assign',jsonb_build_object('userId',person,'cargoKey','viewer','projectId',pid,'expiresAt',e,'reason','Consulta de una edición expresamente compartida'));
  end if;
  return jsonb_build_object('userId',person,'mode',p_data->>'mode');
 end if;
 if m.user_id is null then raise exception 'La persona no es integrante de GIMG';end if;
 if p_action='membership' then
  if p_data->>'status'='suspended' then
   if length(reason)<3 then raise exception 'Escribe el motivo de la suspensión';end if;
   update public.workspace_unit_memberships set membership_status='suspended',suspended_at=now() where unit_id=p_unit_id and user_id=person;
  elsif p_data->>'status'='active' then
   e:=nullif(p_data->>'expiresAt','')::timestamptz;if e<=now() then raise exception 'La vigencia debe estar en el futuro';end if;
   update public.workspace_unit_memberships set membership_status='active',suspended_at=null,expires_at=e where unit_id=p_unit_id and user_id=person;

  else raise exception 'Estado de membresía inválido';end if;
  perform workspace_private.log(p_unit_id,null,null,null,'member.save',person,jsonb_build_object('resolved_user_id',person,'membership_status',p_data->>'status','reason',reason,'expires_at',e));
  return jsonb_build_object('userId',person);
 end if;
 if p_action='remove' then
  if g.id is null or g.revoked_at is not null then raise exception 'Cargo no disponible';end if;
  return public.workspace_command('grant.revoke',jsonb_build_object('unit_id',p_unit_id,'id',g.id,'reason',reason));
 end if;
 if p_action='revoke' then
  if dl.id is null or dl.revoked_at is not null then raise exception 'Delegación no disponible';end if;
  return public.workspace_command('delegation.revoke',jsonb_build_object('unit_id',p_unit_id,'id',dl.id,'reason',reason));
 end if;
 if not workspace_private.member(p_unit_id,person) then raise exception 'La persona debe tener acceso activo y vigente a GIMG';end if;
 e:=workspace_private.member_expiry(p_unit_id,person,nullif(p_data->>'expiresAt','')::timestamptz);
 was_capped:=m.expires_at is not null and (nullif(p_data->>'expiresAt','')::timestamptz is null or nullif(p_data->>'expiresAt','')::timestamptz>m.expires_at);
 if p_action='expiry' then
  if g.id is null or g.revoked_at is not null then raise exception 'Cargo no disponible';end if;
  if g.access_role in('gimg_project_director','gimg_viewer') and e is null then raise exception 'La Dirección de producto requiere vencimiento';end if;
  if e<=g.starts_at then raise exception 'La vigencia debe terminar después del inicio del cargo';end if;
  if length(reason)<3 then raise exception 'Escribe el motivo del cambio de vigencia';end if;
  update public.workspace_access_grants set expires_at=e where id=g.id;
  perform workspace_private.log(p_unit_id,null,null,null,'grant.save',g.id,jsonb_build_object('resolved_user_id',person,'operation','expiry','expires_at',e,'reason',reason));
  return jsonb_build_object('id',g.id,'expiresAt',e,'clamped',was_capped);
 end if;
 pid:=nullif(p_data->>'projectId','')::uuid;
 if pid is not null and not exists(select 1 from public.workspace_projects where id=pid and unit_id=p_unit_id and deleted_at is null and status not in('closed','archived')) then raise exception 'Selecciona una edición disponible de GIMG';end if;
 if p_action='delegate' then
  s:=case when p_data->>'scopeType'='unit' then 'unit' when nullif(p_data->>'areaId','') is not null then 'area' else 'project' end;
  sid:=case when s='unit' then p_unit_id when s='area' then (p_data->>'areaId')::uuid else pid end;
  if sid is null then raise exception 'Selecciona el alcance de la delegación';end if;
  if s='area' and not exists(select 1 from public.workspace_areas where id=sid and project_id=pid and unit_id=p_unit_id) then raise exception 'Área de otra edición';end if;
  if e is null then raise exception 'La delegación necesita un vencimiento futuro';end if;
  return public.workspace_command('delegation.save',jsonb_build_object('unit_id',p_unit_id,'user_id',person,'scope_type',s,'scope_id',sid,'permission_keys',p_data->'permissionKeys','starts_at',now(),'expires_at',e,'reason',p_data->>'brief'))||jsonb_build_object('expiresAt',e,'clamped',was_capped);
 end if;
 select x into c from jsonb_array_elements(workspace_private.cargo_catalog()) x where x->>'key'=p_data->>'cargoKey';
 if c is null then raise exception 'Cargo desconocido';end if;
 if c->>'key'='viewer' and e is null then e:=workspace_private.member_expiry(p_unit_id,person,now()+interval '30 days');end if;
 s:=c->>'scope';role_id:=coalesce(nullif(p_data->>'accessRole',''),c->>'accessRole');
 if not exists(select 1 from workspace_private.role_permissions where role=role_id and role like 'gimg_%') then raise exception 'El rango técnico de GBA no es un cargo de GIMG';end if;
 if (c->>'expiry'='required' or role_id='gimg_project_director') and e is null then raise exception 'Este cargo requiere fecha de vencimiento';end if;
 if (s<>'unit' or coalesce((c->>'needsProject')::boolean,false)) and pid is null then raise exception 'Selecciona el proyecto asignado';end if;
 fn:=coalesce(nullif(p_data->>'functionKey',''),c->>'assignmentRole');
 if c?'functions' and not exists(select 1 from jsonb_array_elements_text(c->'functions') x where x=fn) then raise exception 'Elige una función válida para el cargo';end if;
 if s='area' then
  selected_specialty:=case fn when 'research' then 'research' when 'writing' then 'text' when 'editorial' then 'text' when 'layout' then 'integration' when 'design' then 'integration' else 'art' end;
  area_name:=case fn when 'photography' then 'Fotografía' when 'research' then 'Investigación' when 'writing' then 'Editorial' when 'editorial' then 'Editorial' when 'layout' then 'Diseño y maquetación' when 'design' then 'Diseño y maquetación' else 'Ilustración' end;
  -- Real area UUIDs; Photography remains separate from Illustration.
  perform 1 from public.workspace_projects where id=pid for update;
  select wa.id into aid from public.workspace_areas wa where wa.project_id=pid and wa.specialty=selected_specialty and (fn<>'photography' or wa.name=area_name) and (fn='photography' or wa.name<>'Fotografía') order by wa.id limit 1;
  if aid is null then insert into public.workspace_areas(unit_id,project_id,name,specialty) values(p_unit_id,pid,area_name,selected_specialty) returning id into aid;end if;
 end if;
 sid:=case s when 'unit' then p_unit_id when 'project' then pid else aid end;
 select * into g from public.workspace_access_grants where user_id=person and unit_id=p_unit_id and scope_type=s and scope_id=sid and revoked_at is null and (expires_at is null or expires_at>now()) for update;
 previous_notice:=current_setting('workspace.people_notice',true);
 perform set_config('workspace.people_notice',gen_random_uuid()::text,true);
 if g.id is not null then
  -- One principal grant, multiple organizational functions. Never silently replace a role.
  if g.access_role<>role_id or (g.cargo_key is not null and g.cargo_key<>c->>'key') or exists(select 1 from public.workspace_assignments where grant_id=g.id and project_id is not distinct from case when s='unit' and not coalesce((c->>'needsProject')::boolean,false) then null else pid end and function_key is not distinct from fn and (expires_at is null or expires_at>now())) then raise exception 'Ya existe un cargo vigente en ese alcance; modifica o quita el cargo anterior';end if;
  gr:=g.id;update public.workspace_access_grants set cargo_key=c->>'key',expires_at=e where id=gr;
 else
  out:=public.workspace_command('grant.save',jsonb_build_object('unit_id',p_unit_id,'user_id',person,'access_role',role_id,'scope_type',s,'scope_id',sid,'expires_at',e,'reason',case when length(reason)>=3 then reason else 'Asignación de '||(c->>'title') end));gr:=(out->>'id')::uuid;
  update public.workspace_access_grants set cargo_key=c->>'key' where id=gr;
 end if;
 if fn is not null then
  out:=public.workspace_command('assignment.save',jsonb_build_object('unit_id',p_unit_id,'user_id',person,'assignment_role',case when c->>'key'='area_lead' then 'area_lead' else fn end,'project_id',case when s='unit' and not coalesce((c->>'needsProject')::boolean,false) then null else pid end,'area_id',aid,'expires_at',e));
  ar:=(out->>'id')::uuid;update public.workspace_assignments set grant_id=gr,function_key=fn where id=ar;
 end if;
 if c->>'key'='viewer' then
  out:=public.workspace_command('delegation.save',jsonb_build_object('unit_id',p_unit_id,'user_id',person,'scope_type','project','scope_id',pid,'permission_keys',jsonb_build_array('unit.read','project.read','content.read','asset.download_preview'),'starts_at',now(),'expires_at',coalesce(e,now()+interval '30 days'),'reason','Consulta autorizada de esta edición, sin modificación ni acceso a originales.'));
  update public.workspace_delegations set grant_id=gr where id=(out->>'id')::uuid;
 end if;
 perform workspace_private.log(p_unit_id,pid,aid,null,'people.cargo_assigned',gr,jsonb_build_object('resolved_user_id',person,'cargo_key',c->>'key','assignment_id',ar,'expires_at',e));
 perform set_config('workspace.people_notice',coalesce(previous_notice,''),true);
 return jsonb_build_object('id',gr,'expiresAt',e,'clamped',was_capped);
end;$$;
create function public.workspace_members_snapshot(p_unit_id uuid,p_project_id uuid default null,p_area_id uuid default null,p_deliverable_id uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare directory jsonb;ids uuid[];admin boolean;result jsonb;
begin
 perform workspace_private.require('unit.members.read',p_unit_id,p_project_id,p_area_id,p_deliverable_id);
 directory:=public.workspace_directory(p_unit_id,p_project_id,p_area_id,p_deliverable_id);
 ids:=array(select (x->>'user_id')::uuid from jsonb_array_elements(directory) x);
 admin:=workspace_private.allowed('unit.roles.grant',p_unit_id);
 select jsonb_build_object(
 'unit',(select jsonb_build_object('id',id,'name',name) from public.workspace_units where id=p_unit_id),
 'profiles',(select coalesce(jsonb_agg(jsonb_build_object('id',x->>'user_id','name',x->>'display_name','handle',x->>'handle')),'[]') from jsonb_array_elements(directory) x),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from public.workspace_unit_memberships m where unit_id=p_unit_id and user_id=any(ids)),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('name',p.title,'short',p.title)),'[]') from public.workspace_projects p where unit_id=p_unit_id and deleted_at is null and workspace_private.can_read_project(id)),
 'areas',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.workspace_areas a where unit_id=p_unit_id and workspace_private.can_read_project(project_id) and (admin or workspace_private.allowed('unit.members.read',p_unit_id,project_id,id))),
 'grants',(select coalesce(jsonb_agg(case when admin or g.user_id=auth.uid() then to_jsonb(g) else to_jsonb(g)-'reason' end),'[]') from public.workspace_access_grants g where unit_id=p_unit_id and user_id=any(ids) and (admin or scope_type='unit' or workspace_private.authorizes_scope('unit.members.read',p_unit_id,scope_type,scope_id))),
 'assignments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.workspace_assignments a where unit_id=p_unit_id and user_id=any(ids) and (admin or user_id=auth.uid() or workspace_private.allowed('unit.members.read',p_unit_id,project_id,area_id,deliverable_id))),
 'delegations',(select coalesce(jsonb_agg(to_jsonb(d)),'[]') from public.workspace_delegations d where unit_id=p_unit_id and delegate_user_id=any(ids) and (admin or delegate_user_id=auth.uid())),
 'briefs',(select coalesce(jsonb_agg(to_jsonb(b)),'[]') from workspace_private.written_briefs b where unit_id=p_unit_id and (admin or exists(select 1 from public.workspace_delegations d where d.written_brief_id=b.id and d.delegate_user_id=auth.uid()))),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from (select id,created_at as at,actor_id as actor,action,entity_id as object_id,context as detail from public.workspace_audit where unit_id=p_unit_id and action in('member.save','grant.save','assignment.save','delegation.save','grant.revoke','delegation.revoke','people.cargo_assigned') and (admin or workspace_private.allowed('audit.read_scoped',p_unit_id) or context->>'resolved_user_id'=auth.uid()::text) order by created_at desc limit 200) a),
 'permissions',public.workspace_permissions(p_unit_id),
 'catalog',workspace_private.cargo_catalog(),
 'matrix',(select jsonb_object_agg(role,permissions) from (select role,jsonb_object_agg(permission,mode) as permissions from workspace_private.role_permissions group by role) r),
 'delegableKeys',(select coalesce(jsonb_agg(key order by key),'[]') from (select distinct permission as key from workspace_private.role_permissions where workspace_private.permission_delegable(permission)) k)
 ) into result;
 return result;
end;$$;
revoke all on function workspace_private.cargo_catalog(),workspace_private.permission_delegable(text),workspace_private.member_expiry(uuid,uuid,timestamptz),workspace_private.sync_cargo_assignment(),workspace_private.people_guard(uuid,text,jsonb),workspace_private.authorizes_scope(text,uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.workspace_find_profile(uuid,text),public.workspace_people_action(uuid,text,jsonb),public.workspace_members_snapshot(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.workspace_find_profile(uuid,text),public.workspace_people_action(uuid,text,jsonb),public.workspace_members_snapshot(uuid,uuid,uuid,uuid) to authenticated;

-- A single cargo operation produces one access notice, while retaining each audit entry.
create or replace function workspace_private.notify_audit() returns trigger
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
   values(person,new.unit_id,new.project_id,new.area_id,new.deliverable_id,r.id,new.actor_id,case when kind='access.updated' and nullif(current_setting('workspace.people_notice',true),'') is not null then 'cargo:'||current_setting('workspace.people_notice',true) else 'audit:'||new.id end,kind,label,coalesce(message,''),keys,own_notice)
   on conflict(recipient_id,event_key) do nothing;
  end if;
 end loop;
 return new;
end;$$;

revoke all on function workspace_private.cap_member_access() from public,anon,authenticated;
