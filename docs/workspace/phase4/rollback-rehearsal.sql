begin;
create temp table lapis_counts as select (select count(*) from workspace_private.image_versions) versions,(select count(*) from workspace_private.image_assets) assets;
update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false where singleton;
select set_config('request.jwt.claims',jsonb_build_object('sub','86000000-0000-4000-8000-000000000002','session_id',(select id from auth.sessions where user_id='86000000-0000-4000-8000-000000000002' order by created_at desc limit 1))::text,true);
set local role authenticated;
do $$declare b jsonb;begin
 b:=public.workspace_image_bundle('3ce22cdc-0fb7-4daa-abbd-4da77f39e5d9');
 if not (b->>'enabled')::boolean or (b->>'uploads_enabled')::boolean or not (b->'assets' ? '39a2d861-b11f-48de-a286-6b88203cfa58') or not (b->'versions' ? '8ab18802-addb-4b22-9f34-75ac35bfc51e') then raise exception 'Retained authorized reads failed';end if;
 begin perform public.workspace_image_command('draft.save','665051e1-be9f-41f2-8957-2e90a237f687','{}',null);raise exception 'Writes unexpectedly allowed';exception when raise_exception then if sqlerrm not like '%todavía no está habilitado%' then raise;end if;end;
 begin perform * from workspace_private.image_assets limit 1;raise exception 'Private direct access unexpectedly allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
-- Explicit rollback only: restores the previous broader U reads.
-- This widens access. Prefer fixing a missing project assignment instead.

update workspace_private.role_permissions set mode='U' where role='gimg_workspace_coordinator' and permission in('project.read','task.read','content.read');

-- Non-destructive feature rollback. Submitted assets and versions remain frozen.

update workspace_private.upload_policy set images_enabled=false,revision=revision+1 where singleton;
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
-- Keep legacy command guard: old clients must not submit text into image tasks.
-- Re-enable only after review: GRANT EXECUTE then enable the policy flag.
notify pgrst,'reload schema';

-- Reverse after 1b is disabled. Keep all data and policy RPC for new clients.

update workspace_private.upload_policy set images_enabled=false,reference_max_bytes=26214400,revision=revision+1 where singleton;
do $$declare f record;begin
 for f in select definition from workspace_private.lapis_function_backups loop execute f.definition;end loop;
end;$$;
-- Intentionally retain the positive-size constraint: never invalidate files
-- already accepted under a larger configured limit. Restored RPCs enforce 25MiB.
notify pgrst,'reload schema';

-- Non-destructive Phase 2 rollback; reviewed file, NOT executed in production.
-- Keep the Phase 2 gateway with its download/cleanup handlers and cron, and
-- apply the flag below to reject new writes. Do NOT revert to the pre-image Worker
-- while multipart sessions/reservations remain, or their cleanup would be lost.

update workspace_private.upload_policy set images_enabled=false,revision=revision+1 where singleton;
-- Also blocks direct gateway opens and writes; signed downloads and cleanup stay.
-- No need to revoke storage RPC: the flag permits status and explicit cancellation.
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
notify pgrst,'reload schema';

-- Keep workspace_image_storage/file/maintenance, private evaluators, RLS, schema,
-- pressure notices, quota and audit. Sessions expire after 24h; continue cron until
-- no pending sessions or reserved derived objects remain. No draft/version removal.
-- images_enabled=false does not revoke links to already authorized retained files;
-- session, membership and RBAC checks still apply at every redemption.
-- Re-enabling requires review: GRANT EXECUTE on workspace_image_command, then flag.

do $$begin
 if (select images_enabled from workspace_private.upload_policy where singleton) then raise exception 'Rollback flag failed';end if;
 if has_function_privilege('authenticated','public.workspace_image_command(text,uuid,jsonb,integer)','execute') then raise exception 'Rollback command privilege failed';end if;
 if (select count(*) from workspace_private.image_versions)<>(select versions from lapis_counts) or (select count(*) from workspace_private.image_assets)<>(select assets from lapis_counts) then raise exception 'Rollback removed retained files';end if;
end;$$;
set local role authenticated;
do $$declare b jsonb;begin b:=public.workspace_image_bundle('3ce22cdc-0fb7-4daa-abbd-4da77f39e5d9');if not (b->'versions' ? '8ab18802-addb-4b22-9f34-75ac35bfc51e') then raise exception 'Rollback retained version missing';end if;end;$$;
reset role;
update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false,revision=revision+1 where singleton;
revoke execute on function public.workspace_image_command(text,uuid,jsonb,integer) from authenticated;
select 'PASS: authenticated retained reads, paused writes, private-table denial and five non-destructive reversal steps; no files or versions removed' result;
rollback;