alter table public.contenido
  add column if not exists gimg_video_url text,
  add column if not exists gimg_video_portada_url text,
  add column if not exists gimg_video_titulo text,
  add column if not exists gimg_video_descripcion text,
  add column if not exists gimg_video_estreno_at timestamptz,
  add column if not exists publicar_at timestamptz;

comment on column public.contenido.gimg_video_url is
  'Video nativo producido por GIMG y vinculado a esta misma edicion.';
comment on column public.contenido.gimg_video_portada_url is
  'Imagen previa usada antes de revelar la portada de la edicion.';
comment on column public.contenido.gimg_video_estreno_at is
  'Fecha desde la que el reproductor del coverflow queda disponible.';
comment on column public.contenido.publicar_at is
  'Fecha desde la que la portada, paginas e interacciones de la edicion quedan disponibles.';

alter table public.contenido
  drop constraint if exists contenido_gimg_premiere_dates_check;

alter table public.contenido
  add constraint contenido_gimg_premiere_dates_check
  check (
    gimg_video_url is null
    or publicar_at is null
    or gimg_video_estreno_at is null
    or gimg_video_estreno_at < publicar_at
  );
