create table if not exists public.anima_layers (
  id uuid primary key default gen_random_uuid(),
  layer_key text not null unique check (layer_key in ('research', 'runtime', 'services')),
  display_order smallint not null unique check (display_order between 1 and 3),
  status text not null default 'planned' check (status in ('planned', 'researching', 'building', 'pilot', 'operational', 'paused')),
  progress smallint not null default 0 check (progress between 0 and 100),
  current_focus text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anima_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_code text not null unique,
  title text not null,
  layer text not null default 'research' check (layer in ('research', 'runtime', 'services')),
  phase smallint not null default 0 check (phase between 0 and 5),
  status text not null default 'draft' check (status in ('draft', 'baseline', 'running', 'analyzing', 'validated', 'failed', 'paused')),
  hypothesis text not null,
  model_name text,
  dataset_name text,
  hardware text,
  ram_limit_gb numeric(10, 2) check (ram_limit_gb >= 0),
  cpu_threads integer check (cpu_threads > 0),
  baseline_peak_ram_gb numeric(10, 2) check (baseline_peak_ram_gb >= 0),
  peak_ram_gb numeric(10, 2) check (peak_ram_gb >= 0),
  baseline_duration_minutes numeric(14, 2) check (baseline_duration_minutes >= 0),
  duration_minutes numeric(14, 2) check (duration_minutes >= 0),
  tokens_per_second numeric(14, 4) check (tokens_per_second >= 0),
  energy_wh numeric(14, 2) check (energy_wh >= 0),
  quality_metric text,
  quality_value numeric(16, 6),
  cost_mxn numeric(12, 2) check (cost_mxn >= 0),
  resumable boolean not null default true,
  reproducible boolean not null default false,
  result_summary text,
  evidence_url text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.anima_experiment_logs (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.anima_experiments(id) on delete cascade,
  event_type text not null default 'note' check (event_type in ('note', 'checkpoint', 'metric', 'decision', 'incident')),
  message text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_anima_experiments_layer_status
  on public.anima_experiments (layer, status, created_at desc);
create index if not exists idx_anima_experiment_logs_experiment_date
  on public.anima_experiment_logs (experiment_id, created_at desc);

alter table public.anima_layers enable row level security;
alter table public.anima_experiments enable row level security;
alter table public.anima_experiment_logs enable row level security;

drop policy if exists "ANIMA team manages layers" on public.anima_layers;
create policy "ANIMA team manages layers"
on public.anima_layers for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
);

drop policy if exists "ANIMA team manages experiments" on public.anima_experiments;
create policy "ANIMA team manages experiments"
on public.anima_experiments for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
);

drop policy if exists "ANIMA team manages experiment logs" on public.anima_experiment_logs;
create policy "ANIMA team manages experiment logs"
on public.anima_experiment_logs for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer', 'ANIMA Researcher')
  )
);

grant select, insert, update, delete on public.anima_layers to authenticated;
grant select, insert, update, delete on public.anima_experiments to authenticated;
grant select, insert, update, delete on public.anima_experiment_logs to authenticated;

insert into public.anima_layers (layer_key, display_order, status, progress, current_focus)
values
  ('research', 1, 'researching', 10, 'Definir líneas base y el primer protocolo reproducible.'),
  ('runtime', 2, 'planned', 0, 'Traducir resultados validados a políticas adaptativas.'),
  ('services', 3, 'planned', 0, 'Esperar capacidades técnicas comprobadas antes de ofrecer pilotos.')
on conflict (layer_key) do nothing;
