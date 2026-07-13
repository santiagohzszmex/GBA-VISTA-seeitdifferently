alter table public.usuarios
  add column if not exists nombre_publico text,
  add column if not exists bio text,
  add column if not exists avatar_url text,
  add column if not exists servidor text,
  add column if not exists nacion text,
  add column if not exists perfil_publico boolean not null default true,
  add column if not exists onboarding_completado boolean not null default false;

alter table public.contenido
  add column if not exists categoria_editorial text not null default 'comunidad';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contenido_categoria_editorial_check'
  ) then
    alter table public.contenido
      add constraint contenido_categoria_editorial_check
      check (categoria_editorial in (
        'comunidad', 'politica', 'economia', 'internacional', 'cultura',
        'sociedad', 'opinion', 'historia', 'ciencia_tecnologia', 'deportes'
      ));
  end if;
end $$;

create table if not exists public.editoriales_seguidas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  sello_editorial text not null,
  notificar boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (usuario_id, sello_editorial)
);

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null default 'sistema',
  titulo text not null,
  mensaje text,
  contenido_id uuid references public.contenido(id) on delete cascade,
  sello_editorial text,
  leida boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_editoriales_seguidas_usuario
  on public.editoriales_seguidas (usuario_id, created_at desc);
create index if not exists idx_editoriales_seguidas_sello
  on public.editoriales_seguidas (sello_editorial);
create index if not exists idx_notificaciones_usuario
  on public.notificaciones (usuario_id, leida, created_at desc);
create index if not exists idx_contenido_categoria_editorial
  on public.contenido (categoria_editorial, created_at desc);

alter table public.editoriales_seguidas enable row level security;
alter table public.notificaciones enable row level security;

drop policy if exists "Usuarios gestionan sus editoriales seguidas" on public.editoriales_seguidas;
create policy "Usuarios gestionan sus editoriales seguidas"
on public.editoriales_seguidas for all
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios leen sus notificaciones" on public.notificaciones;
create policy "Usuarios leen sus notificaciones"
on public.notificaciones for select
using (auth.uid() = usuario_id);

drop policy if exists "Usuarios actualizan sus notificaciones" on public.notificaciones;
create policy "Usuarios actualizan sus notificaciones"
on public.notificaciones for update
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios eliminan sus notificaciones" on public.notificaciones;
create policy "Usuarios eliminan sus notificaciones"
on public.notificaciones for delete
using (auth.uid() = usuario_id);

create or replace function public.get_editorial_followers_count(p_sello text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.editoriales_seguidas
  where lower(sello_editorial) = lower(p_sello);
$$;

create or replace function public.get_public_profile(p_handle text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'id', u.id,
    'handle', u.nombre,
    'nombre_publico', coalesce(nullif(u.nombre_publico, ''), u.nombre),
    'bio', coalesce(u.bio, ''),
    'avatar_url', u.avatar_url,
    'servidor', u.servidor,
    'nacion', u.nacion,
    'rol', u.rol,
    'sello_editorial', u.sello_editorial,
    'publicaciones', (
      select count(*) from public.contenido c
      where c.autor_id = u.id and c.estado_publicacion = 'aprobado'
    ),
    'vistas', (
      select coalesce(sum(c.vistas), 0) from public.contenido c
      where c.autor_id = u.id and c.estado_publicacion = 'aprobado'
    ),
    'likes', (
      select coalesce(sum(c.likes_count), 0) from public.contenido c
      where c.autor_id = u.id and c.estado_publicacion = 'aprobado'
    )
  )
  from public.usuarios u
  where lower(u.nombre) = lower(trim(leading '@' from p_handle))
    and u.perfil_publico = true
  limit 1;
$$;

grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_editorial_followers_count(text) to anon, authenticated;

create or replace function public.notificar_publicacion_aprobada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado_publicacion = 'aprobado'
     and (tg_op = 'INSERT' or old.estado_publicacion is distinct from 'aprobado') then
    if new.autor_id is not null then
      insert into public.notificaciones (
        usuario_id, tipo, titulo, mensaje, contenido_id, sello_editorial
      ) values (
        new.autor_id,
        'publicacion_aprobada',
        'Tu edición fue aprobada',
        '"' || new.titulo || '" ya está disponible en VISTA.',
        new.id,
        new.sello_editorial
      );
    end if;

    if new.sello_editorial is not null then
      insert into public.notificaciones (
        usuario_id, tipo, titulo, mensaje, contenido_id, sello_editorial
      )
      select
        es.usuario_id,
        'nueva_edicion',
        'Nueva edición de ' || new.sello_editorial,
        new.titulo,
        new.id,
        new.sello_editorial
      from public.editoriales_seguidas es
      where lower(es.sello_editorial) = lower(new.sello_editorial)
        and es.notificar = true
        and es.usuario_id is distinct from new.autor_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notificar_publicacion_aprobada on public.contenido;
create trigger trg_notificar_publicacion_aprobada
after insert or update on public.contenido
for each row execute function public.notificar_publicacion_aprobada();
