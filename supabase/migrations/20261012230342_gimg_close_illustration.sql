alter table public.gimg_recruitment_cycles
  add column closed_areas text[] not null default '{}'::text[];

update public.gimg_recruitment_cycles
set closed_areas = array['illustration']::text[]
where key = 'gimg-otono-2026';

create function gimg_recruitment_private.guard_closed_area()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare blocked text[];
begin
  if new.phase <> 'submitted' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.phase = 'submitted' then return new; end if;
  end if;
  select closed_areas into blocked
    from public.gimg_recruitment_cycles where key = new.cycle_key;
  if new.answers->>'area' = any(blocked)
     or new.answers->>'secondary' = any(blocked) then
    raise exception 'Ilustración ya no recibe nuevas postulaciones. Diseño editorial sigue abierto si te interesa la maquetación y la composición de páginas. Las postulaciones ya enviadas se conservan.';
  end if;
  return new;
end;
$$;
revoke all on function gimg_recruitment_private.guard_closed_area() from public;
create trigger gimg_recruitment_closed_area
before insert or update of phase, answers on public.gimg_recruitment_applications
for each row execute function gimg_recruitment_private.guard_closed_area();
