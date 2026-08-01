-- Allow an approved editorial account to submit only its own editions for review.
-- The platform role lives in public.usuarios, not in the Supabase Auth JWT.

create or replace function public.vista_current_platform_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select u.rol
  from public.usuarios u
  where u.id = auth.uid()
  limit 1;
$$;

revoke all on function public.vista_current_platform_role() from public, anon;
grant execute on function public.vista_current_platform_role() to authenticated;

alter table public.contenido enable row level security;

drop policy if exists "Editors submit their own editions" on public.contenido;
create policy "Editors submit their own editions"
on public.contenido
for insert
to authenticated
with check (
  auth.uid() is not null
  and autor_id = auth.uid()
  and public.vista_current_platform_role() = 'Editor'
  and es_comunidad is true
  and estado_publicacion = 'pendiente'
);

drop policy if exists "Editors read their own editions" on public.contenido;
create policy "Editors read their own editions"
on public.contenido
for select
to authenticated
using (
  autor_id = auth.uid()
  and public.vista_current_platform_role() = 'Editor'
);

grant select, insert on table public.contenido to authenticated;
