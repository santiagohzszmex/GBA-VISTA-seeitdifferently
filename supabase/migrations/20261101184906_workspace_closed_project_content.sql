-- The legacy concept lives in workspace_projects.brief, outside reference rows.
-- Keep administration (close/archive/reopen/remove/restore) available, but require
-- reopening before changing editorial metadata or the legacy concept.
set lock_timeout='5s';
create function workspace_private.guard_closed_project_content() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$begin
 if OLD.status in('closed','archived') and NEW.status in('closed','archived')
 and row(OLD.title,OLD.brief,OLD.starts_at,OLD.ends_at) is distinct from row(NEW.title,NEW.brief,NEW.starts_at,NEW.ends_at) then
  raise exception 'La edición está cerrada. Debes reabrirla antes de cambiar su concepto, título o fechas.' using errcode='55000';
 end if;
 return NEW;
end;$$;
revoke all on function workspace_private.guard_closed_project_content() from public,anon,authenticated;
create trigger closed_edition_content before update of title,brief,starts_at,ends_at on public.workspace_projects for each row execute function workspace_private.guard_closed_project_content();
reset lock_timeout;
