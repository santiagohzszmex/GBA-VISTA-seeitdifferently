create table if not exists public.campanias (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text,
  estado text not null default 'borrador' check (estado in ('borrador', 'activa', 'pausada', 'finalizada')),
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  prioridad integer not null default 0,
  ubicaciones text[] not null default array['home_banner']::text[],
  cta_texto text not null default 'Ver campaña',
  cta_tipo text not null default 'campania' check (cta_tipo in ('campania', 'video', 'noticia', 'url')),
  cta_target text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campania_assets (
  id uuid primary key default gen_random_uuid(),
  campania_id uuid not null references public.campanias(id) on delete cascade,
  tipo text not null check (tipo in ('poster', 'banner', 'video', 'modelo_3d', 'documento', 'otro')),
  url text not null,
  thumbnail_url text,
  titulo text,
  orden integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.campania_interacciones (
  id uuid primary key default gen_random_uuid(),
  campania_id uuid not null references public.campanias(id) on delete cascade,
  asset_id uuid references public.campania_assets(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  evento text not null check (evento in ('view', 'click', 'play', 'complete', 'dismiss', 'share')),
  created_at timestamptz not null default now()
);

create index if not exists idx_campanias_estado_fechas on public.campanias (estado, fecha_inicio, fecha_fin);
create index if not exists idx_campanias_prioridad on public.campanias (prioridad desc, created_at desc);
create index if not exists idx_campania_assets_campania on public.campania_assets (campania_id, orden);
create index if not exists idx_campania_interacciones_campania on public.campania_interacciones (campania_id, evento, created_at desc);

alter table public.campanias enable row level security;
alter table public.campania_assets enable row level security;
alter table public.campania_interacciones enable row level security;

drop policy if exists "Campanias activas visibles" on public.campanias;
create policy "Campanias activas visibles"
on public.campanias for select
using (estado = 'activa');

drop policy if exists "Assets de campanias activas visibles" on public.campania_assets;
create policy "Assets de campanias activas visibles"
on public.campania_assets for select
using (
  exists (
    select 1 from public.campanias c
    where c.id = campania_assets.campania_id
      and c.estado = 'activa'
  )
);

drop policy if exists "Interacciones insertables" on public.campania_interacciones;
create policy "Interacciones insertables"
on public.campania_interacciones for insert
with check (true);

drop policy if exists "Admins gestionan campanias" on public.campanias;
create policy "Admins gestionan campanias"
on public.campanias for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin')
  )
);

drop policy if exists "Admins gestionan assets de campanias" on public.campania_assets;
create policy "Admins gestionan assets de campanias"
on public.campania_assets for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin')
  )
);
