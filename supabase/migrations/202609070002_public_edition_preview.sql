create or replace function public.vista_public_edition_preview(p_content_id uuid)
returns table (
  id uuid,
  titulo text,
  descripcion text,
  poster_url text,
  banner_url text,
  sello_editorial text,
  vistas bigint,
  likes_count bigint,
  estado_publicacion text,
  has_gimg_premiere boolean,
  gimg_video_url text,
  gimg_video_portada_url text,
  gimg_video_titulo text,
  gimg_video_descripcion text,
  gimg_video_estreno_at timestamptz,
  publicar_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    c.id,
    c.titulo::text,
    c.descripcion::text,
    case when c.publicar_at is null or now() >= c.publicar_at then c.poster_url::text else null end,
    case when c.publicar_at is null or now() >= c.publicar_at then c.banner_url::text else null end,
    c.sello_editorial::text,
    coalesce(c.vistas, 0)::bigint,
    coalesce(c.likes_count, 0)::bigint,
    c.estado_publicacion::text,
    (c.gimg_video_url is not null),
    case
      when c.gimg_video_url is not null
        and (c.gimg_video_estreno_at is null or now() >= c.gimg_video_estreno_at)
      then c.gimg_video_url::text
      else null
    end,
    c.gimg_video_portada_url::text,
    c.gimg_video_titulo::text,
    c.gimg_video_descripcion::text,
    c.gimg_video_estreno_at,
    c.publicar_at
  from public.contenido c
  where c.id = p_content_id
    and c.estado_publicacion = 'aprobado'
  limit 1;
$$;

revoke all on function public.vista_public_edition_preview(uuid) from public;
grant execute on function public.vista_public_edition_preview(uuid) to anon, authenticated;
