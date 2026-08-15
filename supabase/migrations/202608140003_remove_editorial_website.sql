begin;

-- Editorial profiles only expose their VISTA identity and Discord for now.
-- This follow-up is required for databases that already ran 202608140002.

drop function if exists public.vista_my_editorials();
drop function if exists public.vista_editorial_update_profile(
  uuid, text, text, text, text, text[], text[], text, text, text, text, boolean
);

alter table public.editoriales
  drop column if exists sitio_url;

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

revoke all on function public.vista_my_editorials() from public, anon;
revoke all on function public.vista_editorial_update_profile(
  uuid, text, text, text, text, text[], text[], text, text, text, boolean
) from public, anon;

grant execute on function public.vista_my_editorials() to authenticated;
grant execute on function public.vista_editorial_update_profile(
  uuid, text, text, text, text, text[], text[], text, text, text, boolean
) to authenticated;

commit;
