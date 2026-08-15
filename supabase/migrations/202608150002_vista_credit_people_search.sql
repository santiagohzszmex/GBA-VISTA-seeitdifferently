begin;

create or replace function public.vista_search_public_profiles(p_query text)
returns table (
  user_id uuid,
  handle text,
  profile_name text,
  platform_role text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with search as (
    select lower(left(trim(leading '@' from trim(coalesce(p_query, ''))), 50)) as query
  )
  select
    u.id,
    u.nombre,
    coalesce(nullif(trim(u.nombre_publico), ''), u.nombre),
    u.rol
  from public.usuarios u
  cross join search s
  where auth.uid() is not null
    and u.perfil_publico = true
    and char_length(s.query) >= 2
    and (
      strpos(lower(u.nombre), s.query) > 0
      or strpos(lower(coalesce(u.nombre_publico, '')), s.query) > 0
    )
  order by
    case
      when lower(u.nombre) = s.query then 0
      when strpos(lower(u.nombre), s.query) = 1 then 1
      when strpos(lower(coalesce(u.nombre_publico, '')), s.query) = 1 then 2
      else 3
    end,
    lower(u.nombre)
  limit 8;
$$;

revoke all on function public.vista_search_public_profiles(text) from public, anon;
grant execute on function public.vista_search_public_profiles(text) to authenticated;

commit;
