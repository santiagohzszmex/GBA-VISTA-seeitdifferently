alter table public.gimg_recruitment_cycles
  add column remaining_places jsonb not null default '{}'::jsonb
  check (jsonb_typeof(remaining_places) = 'object');

update public.gimg_recruitment_cycles
set closed_areas = array(select distinct unnest(closed_areas || array['writing']::text[])),
    remaining_places = remaining_places || '{"design":2,"research":1}'::jsonb
where key = 'gimg-otono-2026';

create or replace function gimg_recruitment_private.guard_closed_area()
returns trigger language plpgsql security invoker
set search_path = pg_catalog, pg_temp as $$
declare blocked text[]; blocked_area text; area_label text;
begin
  if new.phase <> 'submitted' then return new; end if;
  if tg_op = 'UPDATE' then
    if old.phase = 'submitted' then return new; end if;
  end if;
  select closed_areas into blocked
    from public.gimg_recruitment_cycles where key = new.cycle_key;
  if new.answers->>'area' = any(blocked) then
    blocked_area := new.answers->>'area';
  elsif new.answers->>'secondary' = any(blocked) then
    blocked_area := new.answers->>'secondary';
  end if;
  if blocked_area is not null then
    area_label := case blocked_area when 'illustration' then 'Ilustración' when 'writing' then 'Redacción' else blocked_area end;
    raise exception '% ya no recibe nuevas postulaciones. Elige un área disponible. Las postulaciones ya enviadas se conservan para revisión y selección.', area_label;
  end if;
  return new;
end;
$$;
revoke all on function gimg_recruitment_private.guard_closed_area() from public;
