-- Safe rollback of feature use, NEVER restore the bundle that hid retained data.
begin;
update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false,revision=revision+1 where singleton;
-- Keep the sixth migration and its read RPC in place. No data/schema deletion.
notify pgrst,'reload schema';
commit;
