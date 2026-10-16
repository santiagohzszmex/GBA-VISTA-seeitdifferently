-- Reverse after 1b is disabled. Keep all data and policy RPC for new clients.
begin;
update workspace_private.upload_policy set images_enabled=false,reference_max_bytes=26214400,revision=revision+1 where singleton;
do $$declare f record;begin
 for f in select definition from workspace_private.lapis_function_backups loop execute f.definition;end loop;
end;$$;
-- Intentionally retain the positive-size constraint: never invalidate files
-- already accepted under a larger configured limit. Restored RPCs enforce 25MiB.
notify pgrst,'reload schema';
commit;
