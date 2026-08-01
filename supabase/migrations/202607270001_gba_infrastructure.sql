create table if not exists public.gba_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  name text not null,
  asset_type text not null check (asset_type in ('computer', 'storage', 'network', 'power', 'other')),
  ownership text not null default 'personal_assigned' check (ownership in ('personal_assigned', 'gba_owned', 'borrowed')),
  status text not null default 'planned' check (status in ('planned', 'testing', 'active', 'maintenance', 'retired')),
  acquisition_date date,
  acquisition_cost numeric(12, 2) not null default 0 check (acquisition_cost >= 0),
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  owner_name text,
  assigned_project text,
  serial_number text,
  specs jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gba_budget_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  purpose text,
  currency text not null default 'MXN' check (currency in ('MXN', 'USD')),
  target_amount numeric(12, 2) not null default 0 check (target_amount >= 0),
  status text not null default 'active' check (status in ('planned', 'active', 'closed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gba_finance_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.gba_budget_accounts(id) on delete restrict,
  asset_id uuid references public.gba_assets(id) on delete set null,
  entry_type text not null check (entry_type in ('contribution', 'income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  entry_date date not null default current_date,
  concept text not null,
  counterparty text,
  payment_method text,
  reimbursable boolean not null default false,
  receipt_url text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.gba_nodes (
  id uuid primary key default gen_random_uuid(),
  node_code text not null unique,
  name text not null,
  codename text,
  asset_id uuid references public.gba_assets(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'offline', 'online', 'maintenance', 'retired')),
  environment text not null default 'lab' check (environment in ('lab', 'staging', 'production', 'backup')),
  purpose text,
  hostname text,
  last_heartbeat timestamptz,
  telemetry jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gba_finance_entries_account_date
  on public.gba_finance_entries (account_id, entry_date desc, created_at desc);
create index if not exists idx_gba_assets_status on public.gba_assets (status, created_at desc);
create index if not exists idx_gba_nodes_status on public.gba_nodes (status, created_at desc);

alter table public.gba_assets enable row level security;
alter table public.gba_budget_accounts enable row level security;
alter table public.gba_finance_entries enable row level security;
alter table public.gba_nodes enable row level security;

drop policy if exists "Forge gestiona activos" on public.gba_assets;
create policy "Forge gestiona activos"
on public.gba_assets for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
);

drop policy if exists "Forge gestiona presupuestos" on public.gba_budget_accounts;
create policy "Forge gestiona presupuestos"
on public.gba_budget_accounts for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
);

drop policy if exists "Forge gestiona movimientos" on public.gba_finance_entries;
create policy "Forge gestiona movimientos"
on public.gba_finance_entries for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
);

drop policy if exists "Forge gestiona nodos" on public.gba_nodes;
create policy "Forge gestiona nodos"
on public.gba_nodes for all
using (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
)
with check (
  exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.rol in ('Dueño', 'Admin', 'Forge Engineer')
  )
);

insert into public.gba_budget_accounts (code, name, purpose, currency, target_amount, status)
values
  ('VISTA-OPS', 'VISTA Operations', 'Dominio, servicios, almacenamiento y operación de VISTA.', 'MXN', 0, 'active'),
  ('GBA-INFRA', 'GBA Infrastructure', 'Equipos, discos, energía, red y respaldos.', 'MXN', 0, 'active'),
  ('ANIMA-RD', 'ANIMA R&D', 'Capital reservado para hardware, entrenamiento e investigación de ANIMA.', 'MXN', 10000, 'active')
on conflict (code) do nothing;

insert into public.gba_nodes (node_code, name, codename, status, environment, purpose)
values (
  'GBA-NODE-01',
  'GBA Node 01',
  'Foundation',
  'planned',
  'lab',
  'Primer nodo experimental de GBA Forge para almacenamiento, respaldos y desarrollo.'
)
on conflict (node_code) do nothing;
