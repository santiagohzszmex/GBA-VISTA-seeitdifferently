alter table public.contenido
add column if not exists campania_id uuid references public.campanias(id) on delete set null;

create index if not exists idx_contenido_campania on public.contenido (campania_id);
