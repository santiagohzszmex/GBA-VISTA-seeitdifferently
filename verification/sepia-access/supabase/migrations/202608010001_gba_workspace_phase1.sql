-- GBA Workspace - Phase 1
-- Shared documents, revisions, calendar and access through GBA ID.
begin;

create table if not exists public.gba_workspace_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  workspace_role text not null default 'reader'
    check (workspace_role in ('owner', 'admin', 'approver', 'editor', 'commenter', 'reader')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gba_workspace_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  color text not null default '#2563eb',
  position smallint not null default 0,
  minimum_role text not null default 'reader'
    check (minimum_role in ('owner', 'admin', 'approver', 'editor', 'commenter', 'reader')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gba_workspace_documents (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.gba_workspace_collections(id) on delete restrict,
  title text not null,
  content_markdown text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'review', 'approved', 'superseded', 'archived')),
  version integer not null default 1 check (version > 0),
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gba_workspace_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.gba_workspace_documents(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  title text not null,
  content_markdown text not null,
  status text not null,
  change_summary text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (document_id, revision_number)
);

create table if not exists public.gba_workspace_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'internal'
    check (event_type in ('keynote', 'public_event', 'internal', 'deadline', 'review')),
  status text not null default 'planned'
    check (status in ('planned', 'confirmed', 'completed', 'cancelled')),
  visibility text not null default 'workspace'
    check (visibility in ('workspace', 'restricted')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'America/Mexico_City',
  linked_document_id uuid references public.gba_workspace_documents(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create table if not exists public.gba_workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gba_workspace_documents_collection
  on public.gba_workspace_documents (collection_id, updated_at desc);
create index if not exists idx_gba_workspace_revisions_document
  on public.gba_workspace_document_revisions (document_id, revision_number desc);
create index if not exists idx_gba_workspace_events_date
  on public.gba_workspace_events (starts_at, status);
create index if not exists idx_gba_workspace_audit_date
  on public.gba_workspace_audit_log (created_at desc);

create or replace function public.gba_workspace_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case p_role
    when 'owner' then 60
    when 'admin' then 50
    when 'approver' then 40
    when 'editor' then 30
    when 'commenter' then 20
    when 'reader' then 10
    else 0
  end;
$$;

create or replace function public.gba_workspace_current_role()
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_platform_role text;
  v_workspace_role text;
begin
  select rol into v_platform_role
  from public.usuarios
  where id = auth.uid();

  if v_platform_role = 'Dueño' then return 'owner'; end if;
  if v_platform_role = 'Admin' then return 'admin'; end if;

  select workspace_role into v_workspace_role
  from public.gba_workspace_members
  where user_id = auth.uid() and status = 'active';

  return v_workspace_role;
end;
$$;

create or replace function public.gba_workspace_has_role(p_required_role text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.gba_workspace_role_rank(public.gba_workspace_current_role())
    >= public.gba_workspace_role_rank(p_required_role);
$$;

create or replace function public.gba_workspace_can_read_collection(p_collection_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.gba_workspace_collections c
    where c.id = p_collection_id
      and public.gba_workspace_role_rank(public.gba_workspace_current_role())
        >= public.gba_workspace_role_rank(c.minimum_role)
  );
$$;

create or replace function public.gba_workspace_can_edit_collection(p_collection_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.gba_workspace_has_role('editor')
    and public.gba_workspace_can_read_collection(p_collection_id);
$$;

create or replace function public.gba_workspace_can_approve_collection(p_collection_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.gba_workspace_has_role('approver')
    and public.gba_workspace_can_read_collection(p_collection_id);
$$;

create or replace function public.gba_workspace_my_access()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'role', public.gba_workspace_current_role(),
    'can_access', public.gba_workspace_has_role('reader'),
    'can_edit', public.gba_workspace_has_role('editor'),
    'can_approve', public.gba_workspace_has_role('approver'),
    'can_manage', public.gba_workspace_has_role('admin')
  );
$$;

create or replace function public.gba_workspace_member_directory()
returns table (
  id uuid,
  user_id uuid,
  workspace_role text,
  status text,
  created_at timestamptz,
  handle text,
  display_name text,
  platform_role text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.gba_workspace_has_role('reader') then
    raise exception 'Workspace access required';
  end if;

  return query
  select m.id, u.id,
    coalesce(m.workspace_role, case when u.rol = 'Dueño' then 'owner' else 'admin' end),
    coalesce(m.status, 'active'), coalesce(m.created_at, now()),
    u.nombre, coalesce(nullif(u.nombre_publico, ''), u.nombre), u.rol
  from public.usuarios u
  left join public.gba_workspace_members m on m.user_id = u.id
  where u.rol in ('Dueño', 'Admin') or m.status = 'active'
  order by public.gba_workspace_role_rank(
    coalesce(m.workspace_role, case when u.rol = 'Dueño' then 'owner' else 'admin' end)
  ) desc, u.nombre;
end;
$$;

create or replace function public.gba_workspace_add_member(p_handle text, p_role text default 'reader')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_current_role text;
begin
  if not public.gba_workspace_has_role('admin') then
    raise exception 'Only Workspace administrators can add members';
  end if;
  if public.gba_workspace_role_rank(p_role) = 0 then
    raise exception 'Invalid Workspace role';
  end if;

  v_current_role := public.gba_workspace_current_role();
  if p_role = 'owner' and v_current_role <> 'owner' then
    raise exception 'Only the Workspace owner can assign owner access';
  end if;

  select id into v_user_id
  from public.usuarios
  where lower(nombre) = lower(trim(leading '@' from trim(p_handle)))
  limit 1;

  if v_user_id is null then
    raise exception 'GBA ID not found';
  end if;

  insert into public.gba_workspace_members (user_id, workspace_role, status, invited_by)
  values (v_user_id, p_role, 'active', auth.uid())
  on conflict (user_id) do update
    set workspace_role = excluded.workspace_role,
        status = 'active',
        updated_at = now()
  returning id into v_member_id;

  insert into public.gba_workspace_audit_log (action, entity_type, entity_id, metadata, actor_id)
  values ('member_added', 'member', v_member_id, jsonb_build_object('role', p_role), auth.uid());

  return v_member_id;
end;
$$;

create or replace function public.gba_workspace_set_member_role(p_member_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_current_role text;
begin
  if not public.gba_workspace_has_role('admin') then
    raise exception 'Only Workspace administrators can change roles';
  end if;
  if public.gba_workspace_role_rank(p_role) = 0 then
    raise exception 'Invalid Workspace role';
  end if;

  select workspace_role into v_target_role
  from public.gba_workspace_members where id = p_member_id;
  v_current_role := public.gba_workspace_current_role();

  if (v_target_role = 'owner' or p_role = 'owner') and v_current_role <> 'owner' then
    raise exception 'Only the Workspace owner can modify owner access';
  end if;

  update public.gba_workspace_members
  set workspace_role = p_role, updated_at = now()
  where id = p_member_id;

  insert into public.gba_workspace_audit_log (action, entity_type, entity_id, metadata, actor_id)
  values ('member_role_changed', 'member', p_member_id, jsonb_build_object('role', p_role), auth.uid());
end;
$$;

create or replace function public.gba_workspace_remove_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
begin
  if not public.gba_workspace_has_role('admin') then
    raise exception 'Only Workspace administrators can remove members';
  end if;

  select workspace_role into v_target_role
  from public.gba_workspace_members where id = p_member_id;
  if v_target_role = 'owner' then
    raise exception 'The Workspace owner cannot be removed';
  end if;

  update public.gba_workspace_members
  set status = 'suspended', updated_at = now()
  where id = p_member_id;

  insert into public.gba_workspace_audit_log (action, entity_type, entity_id, actor_id)
  values ('member_suspended', 'member', p_member_id, auth.uid());
end;
$$;

create or replace function public.gba_workspace_prepare_document_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();

    if new.status = 'approved' then
      if not public.gba_workspace_can_approve_collection(new.collection_id) then
        raise exception 'Approver access required';
      end if;
      new.approved_by := auth.uid();
      new.approved_at := now();
    end if;

    return new;
  end if;

  if old.status = 'approved'
    and row(new.title, new.content_markdown)
      is distinct from row(old.title, old.content_markdown)
    and new.status = 'approved' then
    new.status := 'review';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    if not public.gba_workspace_can_approve_collection(new.collection_id) then
      raise exception 'Approver access required';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status = 'approved' then
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  elsif new.status is distinct from 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  if row(new.title, new.content_markdown, new.status)
    is distinct from row(old.title, old.content_markdown, old.status) then
    new.version := old.version + 1;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.gba_workspace_snapshot_document()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.version is distinct from old.version then
    insert into public.gba_workspace_document_revisions (
      document_id, revision_number, title, content_markdown, status, created_by
    ) values (
      new.id, new.version, new.title, new.content_markdown, new.status, new.updated_by
    ) on conflict (document_id, revision_number) do nothing;

    insert into public.gba_workspace_audit_log (
      action, entity_type, entity_id, metadata, actor_id
    ) values (
      case when tg_op = 'INSERT' then 'document_created' else 'document_revised' end,
      'document', new.id,
      jsonb_build_object('version', new.version, 'status', new.status),
      new.updated_by
    );
  end if;
  return new;
end;
$$;

create or replace function public.gba_workspace_touch_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_gba_workspace_document_revision on public.gba_workspace_documents;
create trigger trg_gba_workspace_document_revision
before insert or update on public.gba_workspace_documents
for each row execute function public.gba_workspace_prepare_document_revision();

drop trigger if exists trg_gba_workspace_document_snapshot on public.gba_workspace_documents;
create trigger trg_gba_workspace_document_snapshot
after insert or update on public.gba_workspace_documents
for each row execute function public.gba_workspace_snapshot_document();

drop trigger if exists trg_gba_workspace_event_touch on public.gba_workspace_events;
create trigger trg_gba_workspace_event_touch
before insert or update on public.gba_workspace_events
for each row execute function public.gba_workspace_touch_event();

alter table public.gba_workspace_members enable row level security;
alter table public.gba_workspace_collections enable row level security;
alter table public.gba_workspace_documents enable row level security;
alter table public.gba_workspace_document_revisions enable row level security;
alter table public.gba_workspace_events enable row level security;
alter table public.gba_workspace_audit_log enable row level security;

drop policy if exists "Workspace members read directory" on public.gba_workspace_members;
drop policy if exists "Workspace admins manage members" on public.gba_workspace_members;
drop policy if exists "Workspace members read authorized collections" on public.gba_workspace_collections;
drop policy if exists "Workspace admins manage collections" on public.gba_workspace_collections;
drop policy if exists "Workspace members read authorized documents" on public.gba_workspace_documents;
drop policy if exists "Workspace editors create documents" on public.gba_workspace_documents;
drop policy if exists "Workspace editors update documents" on public.gba_workspace_documents;
drop policy if exists "Workspace admins delete documents" on public.gba_workspace_documents;
drop policy if exists "Workspace members read authorized revisions" on public.gba_workspace_document_revisions;
drop policy if exists "Workspace members read events" on public.gba_workspace_events;
drop policy if exists "Workspace editors create events" on public.gba_workspace_events;
drop policy if exists "Workspace editors update events" on public.gba_workspace_events;
drop policy if exists "Workspace admins delete events" on public.gba_workspace_events;
drop policy if exists "Workspace approvers read audit log" on public.gba_workspace_audit_log;

create policy "Workspace members read directory"
on public.gba_workspace_members for select
using (public.gba_workspace_has_role('reader'));

create policy "Workspace admins manage members"
on public.gba_workspace_members for all
using (public.gba_workspace_has_role('admin'))
with check (public.gba_workspace_has_role('admin'));

create policy "Workspace members read authorized collections"
on public.gba_workspace_collections for select
using (public.gba_workspace_can_read_collection(id));

create policy "Workspace admins manage collections"
on public.gba_workspace_collections for all
using (public.gba_workspace_has_role('admin'))
with check (public.gba_workspace_has_role('admin'));

create policy "Workspace members read authorized documents"
on public.gba_workspace_documents for select
using (public.gba_workspace_can_read_collection(collection_id));

create policy "Workspace editors create documents"
on public.gba_workspace_documents for insert
with check (public.gba_workspace_can_edit_collection(collection_id));

create policy "Workspace editors update documents"
on public.gba_workspace_documents for update
using (public.gba_workspace_can_edit_collection(collection_id))
with check (public.gba_workspace_can_edit_collection(collection_id));

create policy "Workspace admins delete documents"
on public.gba_workspace_documents for delete
using (public.gba_workspace_has_role('admin'));

create policy "Workspace members read authorized revisions"
on public.gba_workspace_document_revisions for select
using (
  exists (
    select 1 from public.gba_workspace_documents d
    where d.id = document_id
      and public.gba_workspace_can_read_collection(d.collection_id)
  )
);

create policy "Workspace members read events"
on public.gba_workspace_events for select
using (
  public.gba_workspace_has_role('reader')
  and (visibility = 'workspace' or public.gba_workspace_has_role('approver') or created_by = auth.uid())
);

create policy "Workspace editors create events"
on public.gba_workspace_events for insert
with check (public.gba_workspace_has_role('editor'));

create policy "Workspace editors update events"
on public.gba_workspace_events for update
using (
  public.gba_workspace_has_role('editor')
  and (visibility = 'workspace' or public.gba_workspace_has_role('approver') or created_by = auth.uid())
)
with check (
  public.gba_workspace_has_role('editor')
  and (visibility = 'workspace' or public.gba_workspace_has_role('approver') or created_by = auth.uid())
);

create policy "Workspace admins delete events"
on public.gba_workspace_events for delete
using (public.gba_workspace_has_role('admin'));

create policy "Workspace approvers read audit log"
on public.gba_workspace_audit_log for select
using (public.gba_workspace_has_role('approver'));

revoke insert, update, delete on public.gba_workspace_members from authenticated;
grant select on public.gba_workspace_members to authenticated;
grant select, insert, update, delete on public.gba_workspace_collections to authenticated;
grant select, insert, update, delete on public.gba_workspace_documents to authenticated;
grant select on public.gba_workspace_document_revisions to authenticated;
grant select, insert, update, delete on public.gba_workspace_events to authenticated;
grant select on public.gba_workspace_audit_log to authenticated;

revoke all on function public.gba_workspace_my_access() from public, anon;
revoke all on function public.gba_workspace_member_directory() from public, anon;
revoke all on function public.gba_workspace_add_member(text, text) from public, anon;
revoke all on function public.gba_workspace_set_member_role(uuid, text) from public, anon;
revoke all on function public.gba_workspace_remove_member(uuid) from public, anon;

grant execute on function public.gba_workspace_my_access() to authenticated;
grant execute on function public.gba_workspace_member_directory() to authenticated;
grant execute on function public.gba_workspace_add_member(text, text) to authenticated;
grant execute on function public.gba_workspace_set_member_role(uuid, text) to authenticated;
grant execute on function public.gba_workspace_remove_member(uuid) to authenticated;

insert into public.gba_workspace_collections (slug, name, description, color, position, minimum_role)
values
  ('direction', 'Dirección', 'Identidad, principios y decisiones fundacionales.', '#111111', 10, 'approver'),
  ('keynotes', 'Keynotes', 'Borradores, guiones y archivos de las presentaciones de GBA.', '#2563eb', 20, 'reader'),
  ('products', 'Productos', 'Definiciones vigentes de VISTA, ANIMA y GBA Forge.', '#0891b2', 30, 'reader'),
  ('architectures', 'Arquitecturas', 'Especificaciones y actualizaciones antes de su implementación.', '#7c3aed', 40, 'reader'),
  ('business', 'Negocio', 'Contexto económico, inversiones e hipótesis comerciales.', '#15803d', 50, 'approver')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  color = excluded.color,
  position = excluded.position;

commit;
