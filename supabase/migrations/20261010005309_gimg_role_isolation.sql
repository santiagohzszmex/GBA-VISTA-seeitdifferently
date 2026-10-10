-- Workspace-specific scope constraints; installed with the new Workspace schema.
begin;

alter table public.workspace_access_grants add constraint workspace_role_domain
 check((access_role='gba_platform_owner')=(scope_type='platform'));

create function workspace_private.guard_gimg_role_unit()
returns trigger language plpgsql security definer
set search_path=pg_catalog,pg_temp as $$
begin
 if new.access_role like 'gimg_%' and not exists(
  select 1 from public.workspace_units where id=new.unit_id and slug='gimg'
 ) then raise exception 'Los roles de GIMG requieren la unidad GIMG';end if;
 return new;
end;$$;
revoke all on function workspace_private.guard_gimg_role_unit() from public,anon,authenticated;
create trigger workspace_gimg_role_unit before insert or update on public.workspace_access_grants
for each row execute function workspace_private.guard_gimg_role_unit();

commit;
