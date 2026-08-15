begin;

-- VISTA Network Beta
-- Commercial profiles belong to a personal GBA ID. Editorial memberships do
-- not grant or restrict ownership of a business profile.

create table if not exists public.network_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.usuarios(id) on delete cascade,
  slug text not null unique,
  nombre text not null,
  account_type text not null default 'business'
    check (account_type in ('business', 'company')),
  categoria text not null default 'Negocios'
    check (categoria in ('Negocios', 'Talento', 'Proyectos', 'Medios')),
  headline text not null default '',
  descripcion text not null default '',
  ubicacion text not null default 'Empyria',
  contacto text not null default '',
  logo_url text,
  portada_url text,
  tags text[] not null default '{}',
  busca_colaboradores boolean not null default false,
  oportunidad_titulo text,
  oportunidad_descripcion text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'suspendido')),
  verificada boolean not null default false,
  promocionada boolean not null default false,
  reviewed_by uuid references public.usuarios(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id)
);

create index if not exists network_businesses_public_directory
  on public.network_businesses (estado, promocionada desc, updated_at desc);

alter table public.network_businesses enable row level security;

drop policy if exists "network approved profiles are public" on public.network_businesses;
create policy "network approved profiles are public"
on public.network_businesses for select
using (estado = 'aprobado');

drop policy if exists "network owners read own profile" on public.network_businesses;
create policy "network owners read own profile"
on public.network_businesses for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "network admins read every profile" on public.network_businesses;
create policy "network admins read every profile"
on public.network_businesses for select
to authenticated
using (public.vista_is_platform_admin());

revoke insert, update, delete on public.network_businesses from anon, authenticated;
grant select on public.network_businesses to anon, authenticated;

create or replace function public.vista_network_unique_slug(value text, ignored_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base text;
  v_slug text;
  v_suffix integer := 1;
begin
  v_base := coalesce(nullif(public.vista_editorial_slugify(value), ''), 'network');
  v_slug := v_base;
  while exists (
    select 1 from public.network_businesses nb
    where nb.slug = v_slug and (ignored_id is null or nb.id <> ignored_id)
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;
  return v_slug;
end;
$$;

create or replace function public.vista_my_network_business()
returns setof public.network_businesses
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from public.network_businesses
  where owner_id = auth.uid()
  limit 1;
$$;

create or replace function public.vista_request_network_business(
  p_nombre text,
  p_account_type text,
  p_categoria text,
  p_headline text,
  p_descripcion text,
  p_contacto text
)
returns public.network_businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.network_businesses;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.network_businesses where owner_id = auth.uid()) then
    raise exception 'This GBA ID already has a Network profile';
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then
    raise exception 'Business name must contain between 2 and 80 characters';
  end if;
  if p_account_type not in ('business', 'company') then raise exception 'Invalid account type'; end if;
  if p_categoria not in ('Negocios', 'Talento', 'Proyectos', 'Medios') then raise exception 'Invalid category'; end if;
  if char_length(trim(coalesce(p_descripcion, ''))) not between 20 and 800 then
    raise exception 'Description must contain between 20 and 800 characters';
  end if;
  if char_length(trim(coalesce(p_contacto, ''))) not between 2 and 160 then
    raise exception 'Contact is required';
  end if;

  insert into public.network_businesses (
    owner_id, slug, nombre, account_type, categoria, headline,
    descripcion, contacto, ubicacion, estado
  ) values (
    auth.uid(), public.vista_network_unique_slug(p_nombre), trim(p_nombre),
    p_account_type, p_categoria, left(trim(coalesce(p_headline, '')), 160),
    trim(p_descripcion), trim(p_contacto), 'Empyria', 'pendiente'
  ) returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.vista_update_network_business(
  p_business_id uuid,
  p_nombre text,
  p_account_type text,
  p_categoria text,
  p_headline text,
  p_descripcion text,
  p_contacto text,
  p_ubicacion text,
  p_logo_url text,
  p_portada_url text,
  p_tags text[],
  p_busca_colaboradores boolean,
  p_oportunidad_titulo text,
  p_oportunidad_descripcion text
)
returns public.network_businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.network_businesses;
  v_result public.network_businesses;
begin
  select * into v_current from public.network_businesses where id = p_business_id for update;
  if v_current.id is null then raise exception 'Network profile not found'; end if;
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if v_current.owner_id <> auth.uid() and not public.vista_is_platform_admin() then
    raise exception 'Network profile owner access required';
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) not between 2 and 80 then
    raise exception 'Business name must contain between 2 and 80 characters';
  end if;
  if p_account_type not in ('business', 'company') then raise exception 'Invalid account type'; end if;
  if p_categoria not in ('Negocios', 'Talento', 'Proyectos', 'Medios') then raise exception 'Invalid category'; end if;
  if char_length(trim(coalesce(p_descripcion, ''))) not between 20 and 800 then
    raise exception 'Description must contain between 20 and 800 characters';
  end if;
  if char_length(trim(coalesce(p_contacto, ''))) not between 2 and 160 then
    raise exception 'Contact is required';
  end if;
  if coalesce(p_busca_colaboradores, false)
     and char_length(trim(coalesce(p_oportunidad_titulo, ''))) < 5 then
    raise exception 'Opportunity title is required';
  end if;

  update public.network_businesses set
    slug = public.vista_network_unique_slug(p_nombre, p_business_id),
    nombre = trim(p_nombre),
    account_type = p_account_type,
    categoria = p_categoria,
    headline = left(trim(coalesce(p_headline, '')), 160),
    descripcion = trim(p_descripcion),
    contacto = left(trim(coalesce(p_contacto, '')), 160),
    ubicacion = left(coalesce(nullif(trim(coalesce(p_ubicacion, '')), ''), 'Empyria'), 120),
    logo_url = nullif(trim(coalesce(p_logo_url, '')), ''),
    portada_url = nullif(trim(coalesce(p_portada_url, '')), ''),
    tags = coalesce(p_tags, '{}'),
    busca_colaboradores = coalesce(p_busca_colaboradores, false),
    oportunidad_titulo = case when coalesce(p_busca_colaboradores, false) then nullif(trim(coalesce(p_oportunidad_titulo, '')), '') else null end,
    oportunidad_descripcion = case when coalesce(p_busca_colaboradores, false) then nullif(trim(coalesce(p_oportunidad_descripcion, '')), '') else null end,
    estado = case when v_current.estado = 'rechazado' then 'pendiente' else v_current.estado end,
    reviewed_by = case when v_current.estado = 'rechazado' then null else v_current.reviewed_by end,
    reviewed_at = case when v_current.estado = 'rechazado' then null else v_current.reviewed_at end,
    updated_at = now()
  where id = p_business_id
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.vista_review_network_business(
  p_business_id uuid,
  p_estado text,
  p_verificada boolean default false,
  p_promocionada boolean default false
)
returns public.network_businesses
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.network_businesses;
begin
  if not public.vista_is_platform_admin() then raise exception 'Platform admin access required'; end if;
  if p_estado not in ('aprobado', 'rechazado', 'suspendido') then raise exception 'Invalid review state'; end if;

  update public.network_businesses set
    estado = p_estado,
    verificada = case when p_estado = 'aprobado' then coalesce(p_verificada, false) else false end,
    promocionada = case when p_estado = 'aprobado' then coalesce(p_promocionada, false) else false end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = p_business_id
  returning * into v_result;

  if v_result.id is null then raise exception 'Network profile not found'; end if;
  return v_result;
end;
$$;

revoke all on function public.vista_network_unique_slug(text, uuid) from public;
revoke all on function public.vista_my_network_business() from public;
revoke all on function public.vista_request_network_business(text, text, text, text, text, text) from public;
revoke all on function public.vista_update_network_business(uuid, text, text, text, text, text, text, text, text, text, text[], boolean, text, text) from public;
revoke all on function public.vista_review_network_business(uuid, text, boolean, boolean) from public;

grant execute on function public.vista_my_network_business() to authenticated;
grant execute on function public.vista_request_network_business(text, text, text, text, text, text) to authenticated;
grant execute on function public.vista_update_network_business(uuid, text, text, text, text, text, text, text, text, text, text[], boolean, text, text) to authenticated;
grant execute on function public.vista_review_network_business(uuid, text, boolean, boolean) to authenticated;

commit;
