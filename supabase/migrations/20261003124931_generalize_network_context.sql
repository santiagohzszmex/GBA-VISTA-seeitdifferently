begin;

-- Network serves geopolitical Minecraft communities across servers.
-- Replace only locations matching the previous automatic default.
-- Custom locations and all newspaper content remain unchanged.
do $$
declare
  v_previous_default text;
begin
  select pg_get_expr(d.adbin, d.adrelid) into v_previous_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'public.network_businesses'::regclass
    and a.attname = 'ubicacion';

  if v_previous_default is not null then
    execute format(
      'update public.network_businesses set ubicacion = %L where ubicacion = (%s) and ubicacion <> %L and categoria <> %L and editorial_id is null',
      'Geopolíticos de Minecraft', v_previous_default, 'Geopolíticos de Minecraft', 'Medios'
    );
  end if;
end;
$$;

alter table public.network_businesses
  alter column ubicacion set default 'Geopolíticos de Minecraft';

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
    trim(p_descripcion), trim(p_contacto), 'Geopolíticos de Minecraft', 'pendiente'
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
    ubicacion = left(coalesce(nullif(trim(coalesce(p_ubicacion, '')), ''), 'Geopolíticos de Minecraft'), 120),
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

commit;
