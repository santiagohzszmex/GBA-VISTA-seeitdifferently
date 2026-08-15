begin;

-- VISTA editorial organizations
-- GBA IDs remain personal identities. Editorials are shared organizations whose
-- permissions are granted through memberships and never through shared passwords.

create or replace function public.vista_editorial_slugify(value text)
returns text
language sql
immutable
strict
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(value),
      'áéíóúüñàèìòùâêîôûäëïöüç',
      'aeiouunaeiouaeiouaeiouc'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create table if not exists public.editoriales (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text not null default '',
  logo_url text,
  portada_url text,
  categorias text[] not null default '{}',
  idiomas text[] not null default array['es']::text[],
  servidor text,
  nacion text,
  discord_url text,
  acepta_colaboradores boolean not null default false,
  verificada boolean not null default false,
  created_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editoriales_nombre_lower_unique
  on public.editoriales (lower(nombre));

create table if not exists public.editorial_members (
  id uuid primary key default gen_random_uuid(),
  editorial_id uuid not null references public.editoriales(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  role text not null default 'collaborator'
    check (role in ('owner', 'admin', 'editor', 'collaborator', 'reviewer')),
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  invited_by uuid references public.usuarios(id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (editorial_id, usuario_id)
);

create unique index if not exists editorial_members_one_owner
  on public.editorial_members (editorial_id)
  where role = 'owner' and status = 'active';

create index if not exists editorial_members_user_active
  on public.editorial_members (usuario_id, status, editorial_id);

create table if not exists public.editorial_invitations (
  id uuid primary key default gen_random_uuid(),
  editorial_id uuid not null references public.editoriales(id) on delete cascade,
  invited_user_id uuid not null references public.usuarios(id) on delete cascade,
  invited_handle text not null,
  role text not null default 'collaborator'
    check (role in ('admin', 'editor', 'collaborator', 'reviewer')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired')),
  invited_by uuid not null references public.usuarios(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '7 days'),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists editorial_invitations_one_pending
  on public.editorial_invitations (editorial_id, invited_user_id)
  where status = 'pending';

create index if not exists editorial_invitations_recipient
  on public.editorial_invitations (invited_user_id, status, expires_at desc);

create table if not exists public.editorial_audit_log (
  id bigint generated always as identity primary key,
  editorial_id uuid not null references public.editoriales(id) on delete cascade,
  actor_id uuid references public.usuarios(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists editorial_audit_recent
  on public.editorial_audit_log (editorial_id, created_at desc);

alter table public.contenido
  add column if not exists editorial_id uuid references public.editoriales(id) on delete set null;
alter table public.contenido
  add column if not exists last_edited_by uuid references public.usuarios(id) on delete set null;
alter table public.editoriales_seguidas
  add column if not exists editorial_id uuid references public.editoriales(id) on delete cascade;
alter table public.notificaciones
  add column if not exists editorial_id uuid references public.editoriales(id) on delete cascade;

create index if not exists contenido_editorial_created
  on public.contenido (editorial_id, created_at desc);
create index if not exists editoriales_seguidas_editorial
  on public.editoriales_seguidas (editorial_id, created_at desc);

create or replace function public.vista_editorial_role_rank(value text)
returns integer
language sql
immutable
as $$
  select case value
    when 'owner' then 50
    when 'admin' then 40
    when 'editor' then 30
    when 'collaborator' then 20
    when 'reviewer' then 10
    else 0
  end;
$$;

create or replace function public.vista_current_editorial_role(p_editorial_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select em.role
  from public.editorial_members em
  where em.editorial_id = p_editorial_id
    and em.usuario_id = auth.uid()
    and em.status = 'active'
  limit 1;
$$;

create or replace function public.vista_editorial_has_role(p_editorial_id uuid, p_minimum_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.vista_editorial_role_rank(public.vista_current_editorial_role(p_editorial_id))
    >= public.vista_editorial_role_rank(p_minimum_role);
$$;

create or replace function public.vista_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol in ('Dueño', 'Admin')
  );
$$;

-- Convert every legacy user-owned seal into an organization. One matching GBA ID
-- becomes owner and any additional matching editors become team editors.
do $$
declare
  v_seal record;
  v_editorial_id uuid;
  v_owner_id uuid;
  v_slug text;
  v_suffix integer;
begin
  for v_seal in
    select lower(trim(sello_editorial)) as key, min(trim(sello_editorial)) as nombre
    from public.usuarios
    where nullif(trim(sello_editorial), '') is not null
    group by lower(trim(sello_editorial))
  loop
    select id into v_editorial_id
    from public.editoriales
    where lower(nombre) = v_seal.key
    limit 1;

    select id into v_owner_id
    from public.usuarios
    where lower(trim(sello_editorial)) = v_seal.key
    order by id
    limit 1;

    if v_editorial_id is null then
      v_slug := coalesce(nullif(public.vista_editorial_slugify(v_seal.nombre), ''), 'editorial');
      v_suffix := 1;
      while exists (select 1 from public.editoriales where slug = v_slug) loop
        v_suffix := v_suffix + 1;
        v_slug := coalesce(nullif(public.vista_editorial_slugify(v_seal.nombre), ''), 'editorial') || '-' || v_suffix;
      end loop;

      insert into public.editoriales (slug, nombre, created_by)
      values (v_slug, v_seal.nombre, v_owner_id)
      returning id into v_editorial_id;
    end if;

    insert into public.editorial_members (editorial_id, usuario_id, role, status, invited_by)
    select
      v_editorial_id,
      u.id,
      case when u.id = v_owner_id then 'owner' else 'editor' end,
      'active',
      v_owner_id
    from public.usuarios u
    where lower(trim(u.sello_editorial)) = v_seal.key
    on conflict (editorial_id, usuario_id) do nothing;
  end loop;
end $$;

update public.contenido c
set editorial_id = e.id
from public.editoriales e
where c.editorial_id is null
  and nullif(trim(c.sello_editorial), '') is not null
  and lower(trim(c.sello_editorial)) = lower(trim(e.nombre));

update public.editoriales_seguidas f
set editorial_id = e.id
from public.editoriales e
where f.editorial_id is null
  and lower(trim(f.sello_editorial)) = lower(trim(e.nombre));

create or replace function public.vista_sync_editorial_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.nombre is distinct from new.nombre then
    update public.contenido
      set sello_editorial = new.nombre
      where editorial_id = new.id;
    update public.editoriales_seguidas
      set sello_editorial = new.nombre
      where editorial_id = new.id;
    update public.usuarios u
      set sello_editorial = new.nombre
      where exists (
        select 1 from public.editorial_members em
        where em.editorial_id = new.id and em.usuario_id = u.id and em.status = 'active'
      )
      and (u.sello_editorial is null or lower(trim(u.sello_editorial)) = lower(trim(old.nombre)));
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_vista_sync_editorial_name on public.editoriales;
create trigger trg_vista_sync_editorial_name
before update on public.editoriales
for each row execute function public.vista_sync_editorial_name();

create or replace function public.vista_bind_content_editorial()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
begin
  if new.editorial_id is not null then
    select nombre into v_name from public.editoriales where id = new.editorial_id;
    if v_name is null then
      raise exception 'Editorial organization not found';
    end if;
    new.sello_editorial := v_name;
    new.last_edited_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vista_bind_content_editorial on public.contenido;
create trigger trg_vista_bind_content_editorial
before insert or update on public.contenido
for each row execute function public.vista_bind_content_editorial();

create or replace function public.vista_my_editorials()
returns table (
  id uuid,
  slug text,
  nombre text,
  descripcion text,
  logo_url text,
  portada_url text,
  categorias text[],
  idiomas text[],
  servidor text,
  nacion text,
  discord_url text,
  acepta_colaboradores boolean,
  verificada boolean,
  role text,
  member_count bigint,
  edition_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.slug, e.nombre, e.descripcion, e.logo_url, e.portada_url,
    e.categorias, e.idiomas, e.servidor, e.nacion, e.discord_url,
    e.acepta_colaboradores, e.verificada, em.role,
    (select count(*) from public.editorial_members members where members.editorial_id = e.id and members.status = 'active'),
    (select count(*) from public.contenido c where c.editorial_id = e.id)
  from public.editorial_members em
  join public.editoriales e on e.id = em.editorial_id
  where em.usuario_id = auth.uid() and em.status = 'active'
  order by public.vista_editorial_role_rank(em.role) desc, lower(e.nombre);
$$;

create or replace function public.vista_my_editorial_invitations()
returns table (
  id uuid,
  editorial_id uuid,
  editorial_name text,
  editorial_slug text,
  logo_url text,
  role text,
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.editorial_id, e.nombre, e.slug, e.logo_url, i.role,
    coalesce(inviter.nombre_publico, inviter.nombre), i.expires_at, i.created_at
  from public.editorial_invitations i
  join public.editoriales e on e.id = i.editorial_id
  left join public.usuarios inviter on inviter.id = i.invited_by
  where i.invited_user_id = auth.uid()
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.vista_editorial_member_directory(p_editorial_id uuid)
returns table (
  member_id uuid,
  usuario_id uuid,
  handle text,
  nombre_publico text,
  role text,
  status text,
  joined_at timestamptz,
  invitation_id uuid,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'reviewer') then
    raise exception 'Editorial membership required';
  end if;

  return query
  select em.id, em.usuario_id, u.nombre,
    coalesce(nullif(u.nombre_publico, ''), u.nombre), em.role, em.status,
    em.joined_at, null::uuid, null::timestamptz
  from public.editorial_members em
  join public.usuarios u on u.id = em.usuario_id
  where em.editorial_id = p_editorial_id
  union all
  select null::uuid, i.invited_user_id, i.invited_handle,
    coalesce(nullif(u.nombre_publico, ''), u.nombre), i.role, 'invited',
    i.created_at, i.id, i.expires_at
  from public.editorial_invitations i
  join public.usuarios u on u.id = i.invited_user_id
  where i.editorial_id = p_editorial_id
    and i.status = 'pending'
    and i.expires_at > now()
  order by 5, 4;
end;
$$;

create or replace function public.vista_editorial_invite_member(
  p_editorial_id uuid,
  p_handle text,
  p_role text default 'collaborator'
)
returns public.editorial_invitations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.usuarios%rowtype;
  v_invitation public.editorial_invitations;
  v_editorial_name text;
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'admin') then
    raise exception 'Editorial admin access required';
  end if;
  if p_role not in ('admin', 'editor', 'collaborator', 'reviewer') then
    raise exception 'Invalid editorial role';
  end if;

  select * into v_target
  from public.usuarios
  where lower(nombre) = lower(trim(leading '@' from trim(p_handle)))
  limit 1;

  if v_target.id is null then
    raise exception 'GBA ID not found';
  end if;
  if exists (
    select 1 from public.editorial_members
    where editorial_id = p_editorial_id and usuario_id = v_target.id and status = 'active'
  ) then
    raise exception 'This GBA ID already belongs to the editorial';
  end if;

  update public.editorial_invitations
  set status = 'revoked', responded_at = now(), updated_at = now()
  where editorial_id = p_editorial_id
    and invited_user_id = v_target.id
    and status = 'pending';

  insert into public.editorial_invitations (
    editorial_id, invited_user_id, invited_handle, role, invited_by
  ) values (
    p_editorial_id, v_target.id, v_target.nombre, p_role, auth.uid()
  ) returning * into v_invitation;

  select nombre into v_editorial_name from public.editoriales where id = p_editorial_id;
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, editorial_id, sello_editorial)
  values (
    v_target.id, 'invitacion_editorial', 'Invitación a ' || v_editorial_name,
    'Un equipo editorial quiere colaborar contigo en VISTA Studio.',
    p_editorial_id, v_editorial_name
  );
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id, details)
  values (p_editorial_id, auth.uid(), 'member_invited', 'user', v_target.id::text, jsonb_build_object('role', p_role));

  return v_invitation;
end;
$$;

create or replace function public.vista_editorial_respond_invitation(p_invitation_id uuid, p_accept boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.editorial_invitations%rowtype;
  v_name text;
begin
  select * into v_invitation
  from public.editorial_invitations
  where id = p_invitation_id
  for update;

  if v_invitation.id is null or v_invitation.invited_user_id <> auth.uid() then
    raise exception 'Invitation not found';
  end if;
  if v_invitation.status <> 'pending' or v_invitation.expires_at <= now() then
    raise exception 'Invitation is no longer available';
  end if;

  if p_accept then
    insert into public.editorial_members (
      editorial_id, usuario_id, role, status, invited_by
    ) values (
      v_invitation.editorial_id, auth.uid(), v_invitation.role, 'active', v_invitation.invited_by
    )
    on conflict (editorial_id, usuario_id) do update
      set role = excluded.role, status = 'active', invited_by = excluded.invited_by, updated_at = now();

    select nombre into v_name from public.editoriales where id = v_invitation.editorial_id;
    update public.usuarios
      set rol = case when rol in ('Dueño', 'Admin') then rol else 'Editor' end,
          sello_editorial = coalesce(nullif(sello_editorial, ''), v_name)
      where id = auth.uid();
  end if;

  update public.editorial_invitations
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now(), updated_at = now()
    where id = p_invitation_id;

  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id, details)
  values (
    v_invitation.editorial_id, auth.uid(),
    case when p_accept then 'invitation_accepted' else 'invitation_declined' end,
    'invitation', p_invitation_id::text, '{}'::jsonb
  );
  return p_accept;
end;
$$;

create or replace function public.vista_editorial_set_member_role(
  p_editorial_id uuid,
  p_member_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.editorial_members%rowtype;
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'admin') then
    raise exception 'Editorial admin access required';
  end if;
  if p_role not in ('admin', 'editor', 'collaborator', 'reviewer') then
    raise exception 'Use ownership transfer to assign the owner role';
  end if;
  select * into v_target from public.editorial_members
    where id = p_member_id and editorial_id = p_editorial_id;
  if v_target.id is null or v_target.role = 'owner' then
    raise exception 'This membership cannot be changed';
  end if;
  if public.vista_current_editorial_role(p_editorial_id) = 'admin' and v_target.role = 'admin' then
    raise exception 'Only the owner can change another administrator';
  end if;

  update public.editorial_members set role = p_role, updated_at = now() where id = p_member_id;
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id, details)
  values (p_editorial_id, auth.uid(), 'member_role_changed', 'membership', p_member_id::text, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.vista_editorial_remove_member(p_editorial_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_target public.editorial_members%rowtype;
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'admin') then
    raise exception 'Editorial admin access required';
  end if;
  select * into v_target from public.editorial_members
    where id = p_member_id and editorial_id = p_editorial_id;
  if v_target.id is null or v_target.role = 'owner' then
    raise exception 'The owner cannot be removed';
  end if;
  if public.vista_current_editorial_role(p_editorial_id) = 'admin' and v_target.role = 'admin' then
    raise exception 'Only the owner can remove another administrator';
  end if;
  delete from public.editorial_members where id = p_member_id;
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id, details)
  values (p_editorial_id, auth.uid(), 'member_removed', 'user', v_target.usuario_id::text, jsonb_build_object('role', v_target.role));
end;
$$;

create or replace function public.vista_editorial_revoke_invitation(p_editorial_id uuid, p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'admin') then
    raise exception 'Editorial admin access required';
  end if;
  update public.editorial_invitations
    set status = 'revoked', responded_at = now(), updated_at = now()
    where id = p_invitation_id and editorial_id = p_editorial_id and status = 'pending';
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id)
  values (p_editorial_id, auth.uid(), 'invitation_revoked', 'invitation', p_invitation_id::text);
end;
$$;

create or replace function public.vista_editorial_transfer_ownership(p_editorial_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_id uuid;
  v_target public.editorial_members%rowtype;
begin
  if public.vista_current_editorial_role(p_editorial_id) <> 'owner' then
    raise exception 'Only the owner can transfer ownership';
  end if;
  select id into v_current_id from public.editorial_members
    where editorial_id = p_editorial_id and usuario_id = auth.uid() and role = 'owner' and status = 'active';
  select * into v_target from public.editorial_members
    where id = p_member_id and editorial_id = p_editorial_id and status = 'active';
  if v_target.id is null then raise exception 'Target member not found'; end if;

  update public.editorial_members set role = 'admin', updated_at = now() where id = v_current_id;
  update public.editorial_members set role = 'owner', updated_at = now() where id = p_member_id;
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id)
  values (p_editorial_id, auth.uid(), 'ownership_transferred', 'membership', p_member_id::text);
end;
$$;

create or replace function public.vista_editorial_update_profile(
  p_editorial_id uuid,
  p_nombre text,
  p_descripcion text,
  p_logo_url text,
  p_portada_url text,
  p_categorias text[],
  p_idiomas text[],
  p_servidor text,
  p_nacion text,
  p_discord_url text,
  p_acepta_colaboradores boolean
)
returns public.editoriales
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.editoriales;
begin
  if not public.vista_editorial_has_role(p_editorial_id, 'admin') then
    raise exception 'Editorial admin access required';
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then
    raise exception 'Editorial name must contain between 2 and 80 characters';
  end if;
  if char_length(coalesce(p_descripcion, '')) > 800 then
    raise exception 'Editorial description is too long';
  end if;

  update public.editoriales set
    nombre = trim(p_nombre),
    descripcion = trim(coalesce(p_descripcion, '')),
    logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
    portada_url = nullif(trim(coalesce(p_portada_url, '')), ''),
    categorias = coalesce(p_categorias, '{}'),
    idiomas = case when coalesce(array_length(p_idiomas, 1), 0) = 0 then array['es']::text[] else p_idiomas end,
    servidor = nullif(trim(coalesce(p_servidor, '')), ''),
    nacion = nullif(trim(coalesce(p_nacion, '')), ''),
    discord_url = nullif(trim(coalesce(p_discord_url, '')), ''),
    acepta_colaboradores = coalesce(p_acepta_colaboradores, false),
    updated_at = now()
  where id = p_editorial_id
  returning * into v_result;

  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id)
  values (p_editorial_id, auth.uid(), 'profile_updated', 'editorial', p_editorial_id::text);
  return v_result;
end;
$$;

create or replace function public.vista_approve_editorial_request(p_request_id uuid)
returns public.editoriales
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.solicitudes_editoriales%rowtype;
  v_result public.editoriales;
  v_slug text;
  v_suffix integer := 1;
begin
  if not public.vista_is_platform_admin() then
    raise exception 'Platform admin access required';
  end if;
  select * into v_request from public.solicitudes_editoriales where id = p_request_id for update;
  if v_request.id is null then raise exception 'Editorial request not found'; end if;
  if exists (select 1 from public.editoriales where lower(nombre) = lower(trim(v_request.nombre_noticiero))) then
    raise exception 'An editorial with this name already exists';
  end if;

  v_slug := coalesce(nullif(public.vista_editorial_slugify(v_request.nombre_noticiero), ''), 'editorial');
  while exists (select 1 from public.editoriales where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := coalesce(nullif(public.vista_editorial_slugify(v_request.nombre_noticiero), ''), 'editorial') || '-' || v_suffix;
  end loop;

  insert into public.editoriales (slug, nombre, descripcion, created_by)
  values (v_slug, trim(v_request.nombre_noticiero), trim(coalesce(v_request.descripcion, '')), v_request.usuario_id)
  returning * into v_result;

  insert into public.editorial_members (editorial_id, usuario_id, role, status, invited_by)
  values (v_result.id, v_request.usuario_id, 'owner', 'active', auth.uid());

  update public.usuarios set rol = 'Editor', sello_editorial = v_result.nombre where id = v_request.usuario_id;
  delete from public.solicitudes_editoriales where id = p_request_id;
  insert into public.editorial_audit_log (editorial_id, actor_id, action, target_type, target_id)
  values (v_result.id, auth.uid(), 'editorial_created_from_request', 'user', v_request.usuario_id::text);
  return v_result;
end;
$$;

create or replace function public.get_editorial_followers_count_by_id(p_editorial_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::integer
  from public.editoriales_seguidas
  where editorial_id = p_editorial_id;
$$;

create or replace function public.notificar_publicacion_aprobada()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.estado_publicacion = 'pendiente' and new.editorial_id is not null then
    insert into public.notificaciones (
      usuario_id, tipo, titulo, mensaje, contenido_id, editorial_id, sello_editorial
    )
    select em.usuario_id, 'revision_editorial', 'Nueva edición del equipo',
      '"' || new.titulo || '" fue enviada a la Aduana.', new.id, new.editorial_id, new.sello_editorial
    from public.editorial_members em
    where em.editorial_id = new.editorial_id
      and em.status = 'active'
      and em.role in ('owner', 'admin', 'editor')
      and em.usuario_id is distinct from new.autor_id;
  end if;

  if new.estado_publicacion = 'aprobado'
     and (tg_op = 'INSERT' or old.estado_publicacion is distinct from 'aprobado') then
    if new.autor_id is not null then
      insert into public.notificaciones (
        usuario_id, tipo, titulo, mensaje, contenido_id, editorial_id, sello_editorial
      ) values (
        new.autor_id, 'publicacion_aprobada', 'Tu edición fue aprobada',
        '"' || new.titulo || '" ya está disponible en VISTA.',
        new.id, new.editorial_id, new.sello_editorial
      );
    end if;

    insert into public.notificaciones (
      usuario_id, tipo, titulo, mensaje, contenido_id, editorial_id, sello_editorial
    )
    select
      followed.usuario_id,
      case when new.es_comunidad = false then 'nuevo_gimg' else 'nueva_edicion' end,
      case when new.es_comunidad = false then 'Nueva publicación oficial de GIMG' else 'Nueva edición de ' || new.sello_editorial end,
      new.titulo,
      new.id,
      new.editorial_id,
      case when new.es_comunidad = false then 'GIMG' else new.sello_editorial end
    from public.editoriales_seguidas followed
    where followed.notificar = true
      and followed.usuario_id is distinct from new.autor_id
      and (
        (new.editorial_id is not null and followed.editorial_id = new.editorial_id)
        or (new.sello_editorial is not null and lower(followed.sello_editorial) = lower(new.sello_editorial))
        or (new.es_comunidad = false and lower(followed.sello_editorial) = 'gimg')
      )
    group by followed.usuario_id;
  end if;

  return new;
end;
$$;

alter table public.editoriales enable row level security;
alter table public.editorial_members enable row level security;
alter table public.editorial_invitations enable row level security;
alter table public.editorial_audit_log enable row level security;

drop policy if exists "Editorial profiles are public" on public.editoriales;
create policy "Editorial profiles are public" on public.editoriales
for select to anon, authenticated using (true);

drop policy if exists "Editorial members see their teams" on public.editorial_members;
create policy "Editorial members see their teams" on public.editorial_members
for select to authenticated
using (usuario_id = auth.uid() or public.vista_editorial_has_role(editorial_id, 'reviewer'));

drop policy if exists "Recipients and admins see invitations" on public.editorial_invitations;
create policy "Recipients and admins see invitations" on public.editorial_invitations
for select to authenticated
using (invited_user_id = auth.uid() or public.vista_editorial_has_role(editorial_id, 'admin'));

drop policy if exists "Editorial admins read audit log" on public.editorial_audit_log;
create policy "Editorial admins read audit log" on public.editorial_audit_log
for select to authenticated using (public.vista_editorial_has_role(editorial_id, 'admin'));

drop policy if exists "Editors submit their own editions" on public.contenido;
drop policy if exists "Editors read their own editions" on public.contenido;
drop policy if exists "Editorial teams submit editions" on public.contenido;
create policy "Editorial teams submit editions" on public.contenido
for insert to authenticated
with check (
  auth.uid() is not null
  and autor_id = auth.uid()
  and editorial_id is not null
  and public.vista_editorial_has_role(editorial_id, 'collaborator')
  and es_comunidad is true
  and estado_publicacion = 'pendiente'
);

drop policy if exists "Editorial teams read editions" on public.contenido;
create policy "Editorial teams read editions" on public.contenido
for select to authenticated
using (editorial_id is not null and public.vista_editorial_has_role(editorial_id, 'reviewer'));

drop policy if exists "Editorial teams update pending editions" on public.contenido;
create policy "Editorial teams update pending editions" on public.contenido
for update to authenticated
using (
  editorial_id is not null
  and estado_publicacion <> 'aprobado'
  and (
    public.vista_editorial_has_role(editorial_id, 'editor')
    or (autor_id = auth.uid() and public.vista_editorial_has_role(editorial_id, 'collaborator'))
  )
)
with check (
  editorial_id is not null
  and estado_publicacion = 'pendiente'
  and (
    public.vista_editorial_has_role(editorial_id, 'editor')
    or (autor_id = auth.uid() and public.vista_editorial_has_role(editorial_id, 'collaborator'))
  )
);

drop policy if exists "Editorial teams delete pending editions" on public.contenido;
create policy "Editorial teams delete pending editions" on public.contenido
for delete to authenticated
using (
  editorial_id is not null
  and estado_publicacion <> 'aprobado'
  and (
    public.vista_editorial_has_role(editorial_id, 'editor')
    or (autor_id = auth.uid() and public.vista_editorial_has_role(editorial_id, 'collaborator'))
  )
);

grant select on public.editoriales to anon, authenticated;
grant select on public.editorial_members, public.editorial_invitations, public.editorial_audit_log to authenticated;
grant select, insert, update, delete on public.contenido to authenticated;

revoke all on function public.vista_current_editorial_role(uuid) from public, anon;
revoke all on function public.vista_editorial_has_role(uuid, text) from public, anon;
revoke all on function public.vista_is_platform_admin() from public, anon;
revoke all on function public.vista_my_editorials() from public, anon;
revoke all on function public.vista_my_editorial_invitations() from public, anon;
revoke all on function public.vista_editorial_member_directory(uuid) from public, anon;
revoke all on function public.vista_editorial_invite_member(uuid, text, text) from public, anon;
revoke all on function public.vista_editorial_respond_invitation(uuid, boolean) from public, anon;
revoke all on function public.vista_editorial_set_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.vista_editorial_remove_member(uuid, uuid) from public, anon;
revoke all on function public.vista_editorial_revoke_invitation(uuid, uuid) from public, anon;
revoke all on function public.vista_editorial_transfer_ownership(uuid, uuid) from public, anon;
revoke all on function public.vista_editorial_update_profile(uuid, text, text, text, text, text[], text[], text, text, text, boolean) from public, anon;
revoke all on function public.vista_approve_editorial_request(uuid) from public, anon;

grant execute on function public.vista_current_editorial_role(uuid) to authenticated;
grant execute on function public.vista_editorial_has_role(uuid, text) to authenticated;
grant execute on function public.vista_is_platform_admin() to authenticated;
grant execute on function public.vista_my_editorials() to authenticated;
grant execute on function public.vista_my_editorial_invitations() to authenticated;
grant execute on function public.vista_editorial_member_directory(uuid) to authenticated;
grant execute on function public.vista_editorial_invite_member(uuid, text, text) to authenticated;
grant execute on function public.vista_editorial_respond_invitation(uuid, boolean) to authenticated;
grant execute on function public.vista_editorial_set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.vista_editorial_remove_member(uuid, uuid) to authenticated;
grant execute on function public.vista_editorial_revoke_invitation(uuid, uuid) to authenticated;
grant execute on function public.vista_editorial_transfer_ownership(uuid, uuid) to authenticated;
grant execute on function public.vista_editorial_update_profile(uuid, text, text, text, text, text[], text[], text, text, text, boolean) to authenticated;
grant execute on function public.vista_approve_editorial_request(uuid) to authenticated;
grant execute on function public.get_editorial_followers_count_by_id(uuid) to anon, authenticated;

commit;
