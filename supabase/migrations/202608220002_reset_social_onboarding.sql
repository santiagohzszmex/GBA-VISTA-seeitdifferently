-- Reactiva una sola vez la nueva bienvenida social para todas las cuentas.
alter table public.usuarios
  add column if not exists onboarding_completado boolean not null default false;

update public.usuarios
set onboarding_completado = false
where onboarding_completado is distinct from false;
