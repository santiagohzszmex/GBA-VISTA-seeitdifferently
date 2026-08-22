begin;

-- Anonymous visitors only need to know whether an exact GBA ID exists.
create or replace function public.vista_gba_id_exists(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.usuarios u
    where lower(u.nombre) = lower(trim(leading '@' from trim(coalesce(p_handle, ''))))
  );
$$;

revoke all on function public.vista_gba_id_exists(text) from public;
grant execute on function public.vista_gba_id_exists(text) to anon, authenticated;

alter table public.usuarios enable row level security;

-- Remove every legacy policy before installing the restricted ownership model.
do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'usuarios'
  loop
    execute format('drop policy if exists %I on public.usuarios', policy_record.policyname);
  end loop;
end;
$$;

revoke all privileges on table public.usuarios from public, anon, authenticated;

-- Authenticated GBA IDs can read their full private record, but no one else's.
grant select on table public.usuarios to authenticated;
create policy "GBA IDs read their own account"
on public.usuarios
for select
to authenticated
using (auth.uid() = id);

-- Only user-editable fields are writable from the browser. Roles, balances,
-- editorial ownership and other administrative fields stay server-managed.
grant update (
  nombre_publico,
  bio,
  avatar_url,
  servidor,
  nacion,
  discord_id,
  perfil_publico,
  onboarding_completado,
  autoplay,
  recommendations,
  frase_seguridad
) on table public.usuarios to authenticated;

create policy "GBA IDs update their own account"
on public.usuarios
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

commit;
