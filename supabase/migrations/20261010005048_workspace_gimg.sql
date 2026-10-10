-- GIMG organization and editorial workflow. Existing Keynotes remain intact.
begin;
create schema workspace_private;
revoke all on schema workspace_private from public,anon,authenticated;
grant usage on schema workspace_private to authenticated;
create table workspace_private.role_permissions(role text,permission text,mode text not null,primary key(role,permission));
insert into workspace_private.role_permissions values
('gba_platform_owner','unit.read','U'),
('gimg_direction','unit.read','U'),
('gimg_production_lead','unit.read','U'),
('gimg_workspace_coordinator','unit.read','U'),
('gimg_project_director','unit.read','P'),
('gimg_area_lead','unit.read','A'),
('gimg_contributor','unit.read','E'),
('gimg_quality_manager','unit.read','U'),
('gimg_viewer','unit.read','D'),
('gba_platform_owner','platform.manage','U'),
('gimg_direction','unit.settings.manage','U'),
('gba_platform_owner','unit.members.read','U'),
('gimg_direction','unit.members.read','U'),
('gimg_production_lead','unit.members.read','U'),
('gimg_workspace_coordinator','unit.members.read','U'),
('gimg_project_director','unit.members.read','P'),
('gimg_area_lead','unit.members.read','A'),
('gimg_contributor','unit.members.read','P'),
('gimg_quality_manager','unit.members.read','U'),
('gimg_direction','unit.members.invite','U'),
('gimg_workspace_coordinator','unit.members.invite','D'),
('gba_platform_owner','unit.members.suspend','D'),
('gimg_direction','unit.members.suspend','U'),
('gimg_production_lead','unit.members.suspend','D'),
('gba_platform_owner','unit.roles.grant','D'),
('gimg_direction','unit.roles.grant','U'),
('gimg_direction','project.create','U'),
('gimg_production_lead','project.create','U'),
('gimg_direction','project.update','U'),
('gimg_production_lead','project.update','U'),
('gimg_workspace_coordinator','project.update','P'),
('gimg_project_director','project.update','P'),
('gimg_direction','project.archive','U'),
('gimg_production_lead','project.archive','D'),
('gimg_direction','task.create','U'),
('gimg_production_lead','task.create','U'),
('gimg_workspace_coordinator','task.create','P'),
('gimg_project_director','task.create','P'),
('gimg_area_lead','task.create','A'),
('gimg_contributor','task.create','E'),
('gimg_quality_manager','task.create','E'),
('gimg_direction','task.assign','U'),
('gimg_production_lead','task.assign','U'),
('gimg_workspace_coordinator','task.assign','P'),
('gimg_project_director','task.assign','P'),
('gimg_area_lead','task.assign','A'),
('gimg_direction','task.update_schedule','U'),
('gimg_production_lead','task.update_schedule','U'),
('gimg_workspace_coordinator','task.update_schedule','P'),
('gimg_project_director','task.update_schedule','P'),
('gimg_area_lead','task.update_schedule','D'),
('gimg_direction','task.update_status','U'),
('gimg_production_lead','task.update_status','U'),
('gimg_workspace_coordinator','task.update_status','P'),
('gimg_project_director','task.update_status','P'),
('gimg_area_lead','task.update_status','A'),
('gimg_contributor','task.update_status','E'),
('gimg_quality_manager','task.update_status','E'),
('gimg_direction','task.block','U'),
('gimg_production_lead','task.block','U'),
('gimg_workspace_coordinator','task.block','P'),
('gimg_project_director','task.block','P'),
('gimg_area_lead','task.block','A'),
('gimg_contributor','task.block','E'),
('gimg_quality_manager','task.block','U'),
('gimg_direction','content.create','U'),
('gimg_production_lead','content.create','U'),
('gimg_workspace_coordinator','content.create','P'),
('gimg_project_director','content.create','P'),
('gimg_area_lead','content.create','A'),
('gimg_contributor','content.create','E'),
('gimg_quality_manager','content.create','E'),
('gimg_direction','content.edit_assigned','U'),
('gimg_production_lead','content.edit_assigned','U'),
('gimg_workspace_coordinator','content.edit_assigned','P'),
('gimg_project_director','content.edit_assigned','P'),
('gimg_area_lead','content.edit_assigned','A'),
('gimg_contributor','content.edit_assigned','E'),
('gimg_quality_manager','content.edit_assigned','E'),
('gimg_direction','content.edit_any_scoped','U'),
('gimg_production_lead','content.edit_any_scoped','D'),
('gimg_project_director','content.edit_any_scoped','P'),
('gimg_area_lead','content.edit_any_scoped','A'),
('gimg_direction','content.comment','U'),
('gimg_production_lead','content.comment','U'),
('gimg_workspace_coordinator','content.comment','P'),
('gimg_project_director','content.comment','P'),
('gimg_area_lead','content.comment','A'),
('gimg_contributor','content.comment','E'),
('gimg_quality_manager','content.comment','U'),
('gimg_viewer','content.comment','D'),
('gimg_direction','content.request_review','U'),
('gimg_production_lead','content.request_review','U'),
('gimg_workspace_coordinator','content.request_review','P'),
('gimg_project_director','content.request_review','P'),
('gimg_area_lead','content.request_review','A'),
('gimg_contributor','content.request_review','E'),
('gimg_quality_manager','content.request_review','E'),
('gimg_direction','review.request_changes','U'),
('gimg_production_lead','review.request_changes','U'),
('gimg_workspace_coordinator','review.request_changes','P'),
('gimg_project_director','review.request_changes','P'),
('gimg_area_lead','review.request_changes','A'),
('gimg_quality_manager','review.request_changes','U'),
('gimg_direction','review.approve_research','U'),
('gimg_production_lead','review.approve_research','D'),
('gimg_project_director','review.approve_research','P'),
('gimg_area_lead','review.approve_research','A'),
('gimg_direction','review.approve_text','U'),
('gimg_project_director','review.approve_text','P'),
('gimg_area_lead','review.approve_text','A'),
('gimg_direction','review.approve_art','U'),
('gimg_project_director','review.approve_art','P'),
('gimg_area_lead','review.approve_art','A'),
('gimg_direction','review.approve_integration','U'),
('gimg_project_director','review.approve_integration','P'),
('gimg_area_lead','review.approve_integration','A'),
('gimg_quality_manager','review.approve_integration','U'),
('gimg_direction','review.authorize_extra_round','U'),
('gimg_project_director','review.authorize_extra_round','D'),
('gimg_direction','review.reopen','U'),
('gimg_project_director','review.reopen','D'),
('gimg_quality_manager','review.reopen','D'),
('gimg_direction','qa.raise_issue','U'),
('gimg_production_lead','qa.raise_issue','P'),
('gimg_workspace_coordinator','qa.raise_issue','P'),
('gimg_project_director','qa.raise_issue','P'),
('gimg_area_lead','qa.raise_issue','A'),
('gimg_contributor','qa.raise_issue','E'),
('gimg_quality_manager','qa.raise_issue','U'),
('gimg_direction','qa.block_release','U'),
('gimg_quality_manager','qa.block_release','U'),
('gimg_direction','qa.approve','U'),
('gimg_quality_manager','qa.approve','U'),
('gimg_direction','publication.approve_final','U'),
('gba_platform_owner','publication.execute','D'),
('gimg_direction','publication.execute','U'),
('gimg_production_lead','publication.execute','D'),
('gimg_quality_manager','publication.execute','P'),
('gba_platform_owner','asset.download_preview','U'),
('gimg_direction','asset.download_preview','U'),
('gimg_production_lead','asset.download_preview','U'),
('gimg_workspace_coordinator','asset.download_preview','P'),
('gimg_project_director','asset.download_preview','P'),
('gimg_area_lead','asset.download_preview','A'),
('gimg_contributor','asset.download_preview','E'),
('gimg_quality_manager','asset.download_preview','U'),
('gimg_viewer','asset.download_preview','D'),
('gba_platform_owner','asset.download_source','D'),
('gimg_direction','asset.download_source','U'),
('gimg_production_lead','asset.download_source','U'),
('gimg_workspace_coordinator','asset.download_source','P'),
('gimg_project_director','asset.download_source','P'),
('gimg_area_lead','asset.download_source','A'),
('gimg_contributor','asset.download_source','E'),
('gimg_quality_manager','asset.download_source','U'),
('gimg_direction','asset.upload','U'),
('gimg_production_lead','asset.upload','U'),
('gimg_workspace_coordinator','asset.upload','P'),
('gimg_project_director','asset.upload','P'),
('gimg_area_lead','asset.upload','A'),
('gimg_contributor','asset.upload','E'),
('gimg_quality_manager','asset.upload','E'),
('gimg_direction','asset.archive','U'),
('gimg_production_lead','asset.archive','U'),
('gimg_workspace_coordinator','asset.archive','P'),
('gimg_project_director','asset.archive','P'),
('gimg_area_lead','asset.archive','A'),
('gimg_contributor','asset.archive','E'),
('gimg_quality_manager','asset.archive','U'),
('gba_platform_owner','asset.delete_physical','D'),
('gimg_direction','credits.edit','U'),
('gimg_production_lead','credits.edit','P'),
('gimg_workspace_coordinator','credits.edit','P'),
('gimg_project_director','credits.edit','P'),
('gimg_area_lead','credits.edit','A'),
('gimg_contributor','credits.edit','E'),
('gimg_quality_manager','credits.edit','U'),
('gimg_direction','credits.approve','U'),
('gimg_quality_manager','credits.approve','U'),
('gba_platform_owner','audit.read_scoped','U'),
('gimg_direction','audit.read_scoped','U'),
('gimg_production_lead','audit.read_scoped','U'),
('gimg_workspace_coordinator','audit.read_scoped','P'),
('gimg_project_director','audit.read_scoped','P'),
('gimg_area_lead','audit.read_scoped','A'),
('gimg_contributor','audit.read_scoped','E propia'),
('gimg_quality_manager','audit.read_scoped','U'),
('gba_platform_owner','audit.export_full','U'),
('gimg_direction','audit.export_full','U'),
('gimg_quality_manager','audit.export_full','D'),
('gba_platform_owner','project.read','D'),
('gba_platform_owner','content.read','D'),
('gba_platform_owner','task.read','D'),
('gimg_direction','project.read','U'),
('gimg_direction','content.read','U'),
('gimg_direction','task.read','U'),
('gimg_production_lead','project.read','U'),
('gimg_production_lead','content.read','U'),
('gimg_production_lead','task.read','U'),
('gimg_workspace_coordinator','project.read','U'),
('gimg_workspace_coordinator','content.read','U'),
('gimg_workspace_coordinator','task.read','U'),
('gimg_project_director','project.read','P'),
('gimg_project_director','content.read','P'),
('gimg_project_director','task.read','P'),
('gimg_area_lead','project.read','A'),
('gimg_area_lead','content.read','A'),
('gimg_area_lead','task.read','A'),
('gimg_contributor','project.read','E'),
('gimg_contributor','content.read','E'),
('gimg_contributor','task.read','E'),
('gimg_quality_manager','project.read','U'),
('gimg_quality_manager','content.read','U'),
('gimg_quality_manager','task.read','U'),
('gimg_viewer','project.read','D'),
('gimg_viewer','content.read','D'),
('gimg_viewer','task.read','D')
,('gimg_direction','review.queue_qa','U'),('gimg_production_lead','review.queue_qa','U'),('gimg_project_director','review.queue_qa','P'),('gimg_area_lead','review.queue_qa','A')
;
create table workspace_private.accounts(user_id uuid primary key references auth.users(id),suspended_at timestamptz,reason text);
create table public.workspace_units(id uuid primary key default gen_random_uuid(),slug text not null unique,name text not null,settings jsonb not null default '{}');
insert into public.workspace_units(slug,name) values('gimg','GIMG');
create table public.workspace_unit_memberships(
 unit_id uuid references public.workspace_units(id),user_id uuid references auth.users(id),
 membership_status text not null check(membership_status in('accepted','active','continuity_requested','continuity_confirmed','inactive','departed','suspended')),
 joined_at timestamptz not null default now(),expires_at timestamptz,suspended_at timestamptz,primary key(unit_id,user_id));
create table public.workspace_projects(
 id uuid primary key default gen_random_uuid(),unit_id uuid not null references public.workspace_units(id),title text not null check(length(trim(title)) between 1 and 180),
 brief text not null default '',status text not null default 'active' check(status in('planned','active','closed','archived')),
 starts_at timestamptz,ends_at timestamptz,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),revision integer not null default 1,
 unique(id,unit_id),check(ends_at is null or starts_at is null or ends_at>=starts_at));
create table public.workspace_areas(id uuid primary key default gen_random_uuid(),project_id uuid not null,unit_id uuid not null,name text not null,
 specialty text not null check(specialty in('research','text','art','integration','qa')),
 foreign key(project_id,unit_id) references public.workspace_projects(id,unit_id),unique(id,project_id,unit_id));
create table public.workspace_deliverables(
 id uuid primary key default gen_random_uuid(),unit_id uuid not null,project_id uuid not null,area_id uuid not null,
 title text not null check(length(trim(title)) between 1 and 180),description text not null default '',responsible_id uuid references auth.users(id),collaborator_ids uuid[] not null default '{}',
 priority text not null default 'normal' check(priority in('low','normal','high','urgent')),due_at timestamptz,
 state text not null default 'pending' check(state in('pending','assigned','in_progress','review','changes_requested','area_approved','in_qa','qa_approved','published','archived','blocked')),
 blocked_from text,block_reason text,qa_blocked boolean not null default false,qa_issue text,round integer not null default 0,extra_rounds integer not null default 0,
 current_version integer not null default 0,area_approved_by uuid,qa_approved_by uuid,final_approved_by uuid,final_approved_at timestamptz,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(area_id,project_id,unit_id) references public.workspace_areas(id,project_id,unit_id),unique(id,project_id,unit_id));
create table public.workspace_assignments(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),assignment_role text not null,unit_id uuid not null references public.workspace_units(id),
 project_id uuid,area_id uuid,deliverable_id uuid,starts_at timestamptz not null default now(),expires_at timestamptz,assigned_by uuid not null references auth.users(id),
 foreign key(project_id,unit_id) references public.workspace_projects(id,unit_id),foreign key(area_id,project_id,unit_id) references public.workspace_areas(id,project_id,unit_id),
 foreign key(deliverable_id,project_id,unit_id) references public.workspace_deliverables(id,project_id,unit_id),
 check(area_id is null or project_id is not null),check(deliverable_id is null or project_id is not null),check(expires_at is null or expires_at>starts_at));
create table public.workspace_access_grants(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),access_role text not null,
 unit_id uuid references public.workspace_units(id),scope_type text not null check(scope_type in('platform','unit','project','area','deliverable')),scope_id uuid,
 starts_at timestamptz not null default now(),expires_at timestamptz,granted_by uuid references auth.users(id),revoked_at timestamptz,reason text not null,
 check(expires_at is null or expires_at>starts_at),check((scope_type='platform' and unit_id is null and scope_id is null and access_role='gba_platform_owner') or (scope_type<>'platform' and unit_id is not null and scope_id is not null)),
 check(access_role in('gba_platform_owner','gimg_direction','gimg_production_lead','gimg_workspace_coordinator','gimg_project_director','gimg_area_lead','gimg_contributor','gimg_quality_manager','gimg_viewer')));
create unique index workspace_principal_role on public.workspace_access_grants(user_id,scope_type,coalesce(scope_id,'00000000-0000-0000-0000-000000000000'::uuid)) where revoked_at is null;
create table public.workspace_delegations(
 id uuid primary key default gen_random_uuid(),delegate_user_id uuid not null references auth.users(id),delegated_by uuid not null references auth.users(id),
 unit_id uuid not null references public.workspace_units(id),scope_type text not null check(scope_type in('unit','project','area','deliverable')),scope_id uuid not null,
 permission_keys text[] not null,starts_at timestamptz not null,expires_at timestamptz not null,written_brief_id uuid,reason text not null check(length(trim(reason))>=10),revoked_at timestamptz,
 check(expires_at>starts_at));
create table public.workspace_versions(
 id uuid primary key default gen_random_uuid(),deliverable_id uuid not null references public.workspace_deliverables(id),version_number integer not null,
 content_markdown text not null default '',asset_title text,credits text not null default '',change_summary text not null,
 author_id uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(deliverable_id,version_number));
create table workspace_private.asset_links(version_id uuid primary key references public.workspace_versions(id),source_url text not null check(source_url ~ '^https://'));
create table public.workspace_publications(
 id uuid primary key default gen_random_uuid(),deliverable_id uuid not null references public.workspace_deliverables(id),version_id uuid not null unique references public.workspace_versions(id),
 title text not null,content_markdown text not null,credits text not null,published_at timestamptz not null default now(),is_public boolean not null default true);
create table public.workspace_comments(
 id uuid primary key default gen_random_uuid(),deliverable_id uuid not null references public.workspace_deliverables(id),version_number integer not null,
 kind text not null check(kind in('comment','changes','verified','qa_issue')),body text not null check(length(trim(body)) between 1 and 10000),
 assigned_to uuid references auth.users(id),round integer not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now());
create table public.workspace_dependencies(deliverable_id uuid references public.workspace_deliverables(id),depends_on_id uuid references public.workspace_deliverables(id),primary key(deliverable_id,depends_on_id),check(deliverable_id<>depends_on_id));
create table public.workspace_events(
 id uuid primary key default gen_random_uuid(),unit_id uuid not null,project_id uuid not null,deliverable_id uuid,title text not null,starts_at timestamptz not null,ends_at timestamptz,
 kind text not null check(kind in('milestone','review','editorial','deadline')),created_by uuid not null references auth.users(id),revision integer not null default 1,
 foreign key(project_id,unit_id) references public.workspace_projects(id,unit_id),foreign key(deliverable_id,project_id,unit_id) references public.workspace_deliverables(id,project_id,unit_id),check(ends_at is null or ends_at>=starts_at));
create unique index workspace_deadline on public.workspace_events(deliverable_id) where kind='deadline';
create table public.workspace_audit(
 id bigint generated always as identity primary key,unit_id uuid references public.workspace_units(id),project_id uuid,area_id uuid,deliverable_id uuid,
 actor_id uuid not null references auth.users(id),action text not null,entity_id uuid,context jsonb not null default '{}',created_at timestamptz not null default now());
create index workspace_audit_date on public.workspace_audit(unit_id,created_at desc);
create index workspace_grants_actor on public.workspace_access_grants(user_id,unit_id);
create index workspace_assignments_actor on public.workspace_assignments(user_id,unit_id,project_id);
create index workspace_tasks_project on public.workspace_deliverables(project_id,due_at);

create function workspace_private.session_active() returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from auth.sessions where user_id=auth.uid() and id::text=auth.jwt()->>'session_id')
 and not exists(select 1 from workspace_private.accounts where user_id=auth.uid() and suspended_at is not null);
$$;
create function workspace_private.member(p_unit uuid,p_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select workspace_private.session_active() and exists(select 1 from public.workspace_unit_memberships where unit_id=p_unit and user_id=p_user
 and membership_status in('active','continuity_requested','continuity_confirmed') and suspended_at is null and (expires_at is null or expires_at>now())) and not exists(select 1 from workspace_private.accounts where user_id=p_user and suspended_at is not null);
$$;
create function workspace_private.scope_matches(s text,i uuid,u uuid,p uuid,a uuid,d uuid) returns boolean language sql immutable as $$
 select case s when 'platform' then true when 'unit' then i=u when 'project' then i=p when 'area' then i=a when 'deliverable' then i=d else false end;
$$;
create function workspace_private.allowed(k text,u uuid,p uuid default null,a uuid default null,d uuid default null) returns boolean language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare g record; m text; own boolean; pa boolean; aa boolean; depth integer;
begin
 if not workspace_private.session_active() then return false;end if;
 if k='platform.manage' then return exists(select 1 from public.workspace_access_grants where user_id=auth.uid() and access_role='gba_platform_owner' and scope_type='platform' and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()));end if;
 if not workspace_private.member(u) then return false;end if;
 own:=exists(select 1 from public.workspace_deliverables t where id=d and (responsible_id=auth.uid() or auth.uid()=any(collaborator_ids)) and exists(select 1 from public.workspace_assignments x where x.user_id=auth.uid() and x.unit_id=u and x.project_id=p and (x.deliverable_id=t.id or (x.deliverable_id is null and (x.area_id is null or x.area_id=t.area_id))) and x.starts_at<=now() and (x.expires_at is null or x.expires_at>now())));
 if k='content.edit_assigned' and not own then return workspace_private.allowed('content.edit_any_scoped',u,p,a,d);end if;
 if d is null and k='task.create' then own:=exists(select 1 from public.workspace_assignments z where z.user_id=auth.uid() and z.unit_id=u and z.project_id=p and z.deliverable_id is null and (z.area_id is null or z.area_id=a) and z.starts_at<=now() and (z.expires_at is null or z.expires_at>now()));end if;
 pa:=exists(select 1 from public.workspace_assignments where user_id=auth.uid() and unit_id=u and project_id=p and starts_at<=now() and (expires_at is null or expires_at>now()));
 aa:=exists(select 1 from public.workspace_assignments where user_id=auth.uid() and unit_id=u and project_id=p and area_id=a and starts_at<=now() and (expires_at is null or expires_at>now()));
 -- The narrowest live principal grant overrides broader principal grants.
 select max(case scope_type when 'platform' then 0 when 'unit' then 1 when 'project' then 2 when 'area' then 3 else 4 end) into depth from public.workspace_access_grants
 where user_id=auth.uid() and (unit_id=u or scope_type='platform') and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d);
 if depth is null then return false;end if;
 for g in select * from public.workspace_access_grants where user_id=auth.uid() and (unit_id=u or scope_type='platform') and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now()) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d)
 and case scope_type when 'platform' then 0 when 'unit' then 1 when 'project' then 2 when 'area' then 3 else 4 end=depth loop
  select mode into m from workspace_private.role_permissions where role=g.access_role and permission=k;
  -- Product direction requires an explicit written permission, even for defaults P.
  if g.access_role='gimg_project_director' and k not in('unit.read','project.read','task.read','content.read','unit.members.read','audit.read_scoped') then continue;end if;
  if m='U' or (m='P' and pa) or (m='A' and aa) or (m like 'E%' and own) then return true;end if;
 end loop;
 -- Delegated permissions cannot bypass suspension, final editorial authority or expiry.
 if k='publication.approve_final' then return false;end if;
 return exists(select 1 from public.workspace_delegations x where delegate_user_id=auth.uid() and unit_id=u and revoked_at is null and starts_at<=now() and expires_at>now() and k=any(permission_keys) and workspace_private.scope_matches(scope_type,scope_id,u,p,a,d));
end;$$;
create function workspace_private.can_read_task(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.allowed('task.read',unit_id,project_id,area_id,id) from public.workspace_deliverables where id=p_id),false);
$$;
create function workspace_private.can_read_content(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.allowed('content.read',unit_id,project_id,area_id,id) from public.workspace_deliverables where id=p_id),false);
$$;
create function workspace_private.can_read_project(p_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce((select workspace_private.allowed('project.read',unit_id,id) from public.workspace_projects where id=p_id),false)
 or exists(select 1 from public.workspace_deliverables where project_id=p_id and workspace_private.can_read_task(id))
 or exists(select 1 from public.workspace_areas where project_id=p_id and workspace_private.allowed('project.read',unit_id,project_id,id));
$$;
create function workspace_private.require(k text,u uuid,p uuid default null,a uuid default null,d uuid default null) returns void language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin if not workspace_private.allowed(k,u,p,a,d) then raise exception 'No tienes permiso para esta acción' using errcode='42501';end if;end;$$;
create function workspace_private.log(u uuid,p uuid,a uuid,d uuid,act text,e uuid,ctx jsonb default '{}') returns void language sql security definer set search_path=pg_catalog,pg_temp as $$
 insert into public.workspace_audit(unit_id,project_id,area_id,deliverable_id,actor_id,action,entity_id,context) values(u,p,a,d,auth.uid(),act,e,ctx);
$$;
create function workspace_private.validate_scope(s text,i uuid,u uuid) returns void language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if s='unit' and i=u then return;end if;
 if s='project' and exists(select 1 from public.workspace_projects where id=i and unit_id=u) then return;end if;
 if s='area' and exists(select 1 from public.workspace_areas where id=i and unit_id=u) then return;end if;
 if s='deliverable' and exists(select 1 from public.workspace_deliverables where id=i and unit_id=u) then return;end if;
 raise exception 'Alcance inválido';
end;$$;

create function public.workspace_asset_link(p_version_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare task public.workspace_deliverables; link text;
begin
 select t.* into task from public.workspace_deliverables t join public.workspace_versions v on v.deliverable_id=t.id where v.id=p_version_id;
 perform workspace_private.require('asset.download_source',task.unit_id,task.project_id,task.area_id,task.id);
 select source_url into link from workspace_private.asset_links where version_id=p_version_id;
 if link is null then raise exception 'Esta versión no tiene un activo externo';end if;
 perform workspace_private.log(task.unit_id,task.project_id,task.area_id,task.id,'asset.external_link_issued',p_version_id);
 return jsonb_build_object('url',link);
end;$$;
revoke all on function public.workspace_asset_link(uuid) from public,anon;
grant execute on function public.workspace_asset_link(uuid) to authenticated;

-- One mutation endpoint: explicit fields and field-specific permission checks.
create function public.workspace_command(p_action text,p_data jsonb,p_revision integer default null) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare u uuid; p public.workspace_projects; t public.workspace_deliverables; target uuid; ar public.workspace_areas; result jsonb; v text; req text; person uuid; old_state text; item record;
begin
 if not workspace_private.session_active() then raise exception 'Sesión revocada o cuenta suspendida' using errcode='42501';end if;
 u:=(p_data->>'unit_id')::uuid;
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
   if exists(select 1 from jsonb_array_elements_text(p_data->'permission_keys') k where k='publication.approve_final' or not workspace_private.allowed(k,u,case when p_data->>'scope_type'='project' then (p_data->>'scope_id')::uuid end,case when p_data->>'scope_type'='area' then (p_data->>'scope_id')::uuid end,case when p_data->>'scope_type'='deliverable' then (p_data->>'scope_id')::uuid end)) then raise exception 'No puedes delegar estos permisos';end if;
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

create function public.workspace_context() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not workspace_private.session_active() then return jsonb_build_object('units','[]'::jsonb,'platform_owner',false);end if;
 return jsonb_build_object('platform_owner',workspace_private.allowed('platform.manage',null),'keynotes_access',public.gba_workspace_has_role('reader'),'units',coalesce((select jsonb_agg(to_jsonb(u)) from public.workspace_units u where workspace_private.member(u.id)),'[]'),
 'grants',coalesce((select jsonb_agg(to_jsonb(g)) from public.workspace_access_grants g where user_id=auth.uid() and revoked_at is null and starts_at<=now() and (expires_at is null or expires_at>now())),'[]'));
end;$$;
create function public.workspace_permissions(p_unit uuid,p_project uuid default null,p_area uuid default null,p_deliverable uuid default null) returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce(jsonb_object_agg(permission,workspace_private.allowed(permission,p_unit,p_project,p_area,p_deliverable)),'{}') from(select distinct permission from workspace_private.role_permissions) x;
$$;
create function public.workspace_directory(p_unit uuid,p_project uuid default null,p_area uuid default null,p_deliverable uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
begin
 perform workspace_private.require('unit.members.read',p_unit,p_project,p_area,p_deliverable);
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',coalesce(nullif(u.nombre_publico,''),u.nombre),'handle',u.nombre,'membership_status',m.membership_status,'joined_at',m.joined_at,'expires_at',m.expires_at)) from public.workspace_unit_memberships m join public.usuarios u on u.id=m.user_id where m.unit_id=p_unit
 and (workspace_private.allowed('unit.members.read',p_unit) or m.user_id=auth.uid() or exists(select 1 from public.workspace_assignments x where x.user_id=m.user_id and x.unit_id=p_unit and x.project_id=p_project and (p_area is null or x.area_id=p_area) and x.starts_at<=now() and (x.expires_at is null or x.expires_at>now())))),'[]');
end;$$;

alter table public.workspace_publications enable row level security;
revoke all on public.workspace_publications from public,anon,authenticated;
grant select on public.workspace_publications to anon,authenticated;
create policy publication_read on public.workspace_publications for select to anon,authenticated using(is_public);

create function public.workspace_export_audit(p_unit uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 perform workspace_private.require('audit.export_full',p_unit);
 perform workspace_private.log(p_unit,null,null,null,'audit.exported',p_unit);
 return jsonb_build_object('unit_id',p_unit,'exported_at',now(),'records',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.workspace_audit a where a.unit_id=p_unit),'[]'));
end;$$;
revoke all on function public.workspace_export_audit(uuid) from public,anon;
grant execute on function public.workspace_export_audit(uuid) to authenticated;

-- No browser writes to business tables; every write must pass the command RPC.
do $$declare t text;begin
 foreach t in array array['workspace_units','workspace_unit_memberships','workspace_projects','workspace_areas','workspace_deliverables','workspace_assignments','workspace_access_grants','workspace_delegations','workspace_versions','workspace_comments','workspace_dependencies','workspace_events','workspace_audit'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant select on public.%I to authenticated',t);
 end loop;end;$$;
create policy unit_read on public.workspace_units for select to authenticated using(workspace_private.member(id));
create policy member_read on public.workspace_unit_memberships for select to authenticated using(workspace_private.member(unit_id) and (user_id=auth.uid() or workspace_private.allowed('unit.members.read',unit_id)));
create policy project_read on public.workspace_projects for select to authenticated using(workspace_private.can_read_project(id));
create policy area_read on public.workspace_areas for select to authenticated using(workspace_private.allowed('project.read',unit_id,project_id,id) or exists(select 1 from public.workspace_deliverables t where t.area_id=workspace_areas.id and workspace_private.can_read_task(t.id)));
create policy task_read on public.workspace_deliverables for select to authenticated using(workspace_private.can_read_task(id));
create policy assignment_read on public.workspace_assignments for select to authenticated using(workspace_private.member(unit_id) and (user_id=auth.uid() or workspace_private.allowed('unit.members.read',unit_id,project_id,area_id,deliverable_id)));
create policy grant_read on public.workspace_access_grants for select to authenticated using(workspace_private.session_active() and ((user_id=auth.uid() and (scope_type='platform' or workspace_private.member(unit_id))) or workspace_private.allowed('unit.roles.grant',unit_id)));
create policy delegation_read on public.workspace_delegations for select to authenticated using(workspace_private.member(unit_id) and (delegate_user_id=auth.uid() or workspace_private.allowed('unit.roles.grant',unit_id)));
create policy version_read on public.workspace_versions for select to authenticated using(workspace_private.can_read_content(deliverable_id));
create policy comment_read on public.workspace_comments for select to authenticated using(workspace_private.can_read_content(deliverable_id));
create policy dependency_read on public.workspace_dependencies for select to authenticated using(workspace_private.can_read_task(deliverable_id) and workspace_private.can_read_task(depends_on_id));
create policy event_read on public.workspace_events for select to authenticated using(case when deliverable_id is not null then workspace_private.can_read_task(deliverable_id) else workspace_private.allowed('project.read',unit_id,project_id) end);
create policy audit_read on public.workspace_audit for select to authenticated using(workspace_private.allowed('audit.read_scoped',unit_id,project_id,area_id,deliverable_id) and (actor_id=auth.uid() or not exists(select 1 from public.workspace_access_grants where user_id=auth.uid() and access_role='gimg_contributor' and revoked_at is null)));
revoke all on all functions in schema workspace_private from public,anon,authenticated;
grant execute on function workspace_private.session_active(),workspace_private.member(uuid,uuid),workspace_private.allowed(text,uuid,uuid,uuid,uuid),workspace_private.can_read_task(uuid),workspace_private.can_read_project(uuid),workspace_private.can_read_content(uuid) to authenticated;
revoke all on function public.workspace_command(text,jsonb,integer),public.workspace_context(),public.workspace_permissions(uuid,uuid,uuid,uuid),public.workspace_directory(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.workspace_command(text,jsonb,integer),public.workspace_context(),public.workspace_permissions(uuid,uuid,uuid,uuid),public.workspace_directory(uuid,uuid,uuid,uuid) to authenticated;
-- Technical owners gain no membership or editorial authority automatically.
insert into public.workspace_access_grants(user_id,access_role,scope_type,reason) select id,'gba_platform_owner','platform','Administración técnica existente de GBA' from public.usuarios where rol='Dueño';
-- Explicit existing recruitment directors are already editorial appointments.
insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) select u.id,r.user_id,'active' from public.workspace_units u cross join public.gimg_recruitment_reviewers r where u.slug='gimg' and r.role='director';
insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) select m.user_id,'gimg_direction',m.unit_id,'unit',m.unit_id,'Dirección de GIMG previamente asignada en convocatoria' from public.workspace_unit_memberships m;

-- Legacy Keynotes retain their permissions; no legacy role unlocks GIMG.
create or replace function public.gba_workspace_my_access() returns jsonb language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select jsonb_build_object('role',public.gba_workspace_current_role(),'can_access',workspace_private.session_active() and (public.gba_workspace_has_role('reader') or exists(select 1 from public.workspace_unit_memberships where user_id=auth.uid() and workspace_private.member(unit_id))),
 'can_edit',workspace_private.session_active() and public.gba_workspace_has_role('editor'),'can_approve',workspace_private.session_active() and public.gba_workspace_has_role('approver'),'can_manage',workspace_private.session_active() and public.gba_workspace_has_role('admin'));
$$;
create or replace function public.gba_workspace_has_role(p_required_role text) returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select workspace_private.session_active() and public.gba_workspace_role_rank(public.gba_workspace_current_role())>=public.gba_workspace_role_rank(p_required_role);
$$;
revoke all on all tables in schema workspace_private from public,anon,authenticated;
commit;
