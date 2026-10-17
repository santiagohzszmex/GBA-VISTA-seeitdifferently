-- Non-destructive Phase 2 rollback; reviewed file, NOT executed in production.
-- Keep the Phase 2 gateway with its download/cleanup handlers and cron, and
-- apply the flag below to reject new writes. Do NOT revert to the pre-image Worker
-- while multipart sessions/reservations remain, or their cleanup would be lost.
begin;
update workspace_private.upload_policy set images_enabled=false,revision=revision+1 where singleton;
-- Also blocks direct gateway opens and writes; signed downloads and cleanup stay.
-- No need to revoke storage RPC: the flag permits status and explicit cancellation.
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
notify pgrst,'reload schema';
commit;
-- Keep workspace_image_storage/file/maintenance, private evaluators, RLS, schema,
-- pressure notices, quota and audit. Sessions expire after 24h; continue cron until
-- no pending sessions or reserved derived objects remain. No draft/version removal.
-- images_enabled=false does not revoke links to already authorized retained files;
-- session, membership and RBAC checks still apply at every redemption.
-- Re-enabling requires review: GRANT EXECUTE on workspace_image_command, then flag.
