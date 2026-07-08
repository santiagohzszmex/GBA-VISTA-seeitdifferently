alter table public.campanias
add column if not exists likes_count integer not null default 0;

alter table public.contenido
add column if not exists campania_id uuid references public.campanias(id) on delete set null;

create index if not exists idx_contenido_campania_id
on public.contenido (campania_id);

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.campania_assets'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%tipo%poster%banner%video%';

  if constraint_name is not null then
    execute format('alter table public.campania_assets drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.campania_assets
add constraint campania_assets_tipo_check
check (tipo in ('poster', 'banner', 'video', 'audio', 'modelo_3d', 'documento', 'otro'));

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.campania_interacciones'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%evento%view%click%play%';

  if constraint_name is not null then
    execute format('alter table public.campania_interacciones drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.campania_interacciones
add constraint campania_interacciones_evento_check
check (evento in ('view', 'click', 'play', 'complete', 'dismiss', 'share', 'like', 'unlike'));

create table if not exists public.campania_likes (
  campania_id uuid not null references public.campanias(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campania_id, usuario_id)
);

alter table public.campania_likes enable row level security;

drop policy if exists "Usuarios leen sus likes de campanias" on public.campania_likes;
create policy "Usuarios leen sus likes de campanias"
on public.campania_likes for select
using (usuario_id = auth.uid());

drop policy if exists "Usuarios insertan sus likes de campanias" on public.campania_likes;
create policy "Usuarios insertan sus likes de campanias"
on public.campania_likes for insert
with check (usuario_id = auth.uid());

drop policy if exists "Usuarios eliminan sus likes de campanias" on public.campania_likes;
create policy "Usuarios eliminan sus likes de campanias"
on public.campania_likes for delete
using (usuario_id = auth.uid());

create or replace function public.toggle_campania_like(
  p_campania_id uuid,
  p_usuario_id uuid,
  p_liked boolean
)
returns table(likes_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_usuario_id is null then
    return query
    select c.likes_count
    from public.campanias c
    where c.id = p_campania_id;
    return;
  end if;

  if p_liked then
    insert into public.campania_likes (campania_id, usuario_id)
    values (p_campania_id, p_usuario_id)
    on conflict do nothing;
  else
    delete from public.campania_likes
    where campania_id = p_campania_id
      and usuario_id = p_usuario_id;
  end if;

  update public.campanias c
  set likes_count = (
    select count(*)::integer
    from public.campania_likes cl
    where cl.campania_id = p_campania_id
  )
  where c.id = p_campania_id;

  insert into public.campania_interacciones (campania_id, usuario_id, evento)
  values (p_campania_id, p_usuario_id, case when p_liked then 'like' else 'unlike' end);

  return query
  select c.likes_count
  from public.campanias c
  where c.id = p_campania_id;
end;
$$;
