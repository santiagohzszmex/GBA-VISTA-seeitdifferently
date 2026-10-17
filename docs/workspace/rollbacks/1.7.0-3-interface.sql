-- Phase 3/4 client rollback: retain read RPC, schemas, originals and cleanup.
-- Do not restore the old bundle implementation that hid retained image data.
begin;
update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false,revision=revision+1 where singleton;
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
notify pgrst,'reload schema';
commit;
