-- Non-destructive feature rollback. Submitted assets and versions remain frozen.
begin;
update workspace_private.upload_policy set images_enabled=false,revision=revision+1 where singleton;
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
-- Keep legacy command guard: old clients must not submit text into image tasks.
-- Re-enable only after review: GRANT EXECUTE then enable the policy flag.
notify pgrst,'reload schema';
commit;
