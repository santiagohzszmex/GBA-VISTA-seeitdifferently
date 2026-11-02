-- A server scheduler delivers messages independently of a running WebView.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
revoke all on schema net,cron from public,anon,authenticated;
revoke all on all tables in schema net,cron from public,anon,authenticated;
revoke all on all functions in schema net,cron from public,anon,authenticated;

do $$declare secret text;created_secret_id uuid;begin
 if not exists(select 1 from workspace_private.push_settings where secret_id is not null) then
  secret:=encode(extensions.gen_random_bytes(32),'hex');
  created_secret_id:=vault.create_secret(secret,'workspace-push-delivery','Autoriza sólo el vaciado de la cola de avisos de Workspace');
  update workspace_private.push_settings set secret_id=created_secret_id,gate_hash=sha256(convert_to(secret,'UTF8'));
 end if;
end;$$;

create function workspace_private.push_tick() returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous text:=current_setting('request.jwt.claims',true);s workspace_private.push_subscriptions;secret text;
begin
 -- Deadline generation retains the same per-person permission checks as the inbox.
 for s in select distinct on(user_id) x.* from workspace_private.push_subscriptions x where revoked_at is null and workspace_private.push_allowed(x) order by user_id,enabled_at desc loop
  if workspace_private.push_allowed(s) then
   perform set_config('request.jwt.claims',jsonb_build_object('sub',s.user_id,'session_id',s.session_id,'role','authenticated')::text,true);
   perform workspace_private.queue_deadline_notices();
  end if;
 end loop;
 perform set_config('request.jwt.claims',coalesce(previous,''),true);
 if exists(select 1 from workspace_private.push_jobs where status='pending' and next_attempt_at<=now() and (leased_until is null or leased_until<now())) then
  select v.decrypted_secret into secret from vault.decrypted_secrets v join workspace_private.push_settings p on p.secret_id=v.id;
  if secret is not null then
   perform net.http_post(url:='https://gba.software/api/workspace-push',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||secret),body:='{}',timeout_milliseconds:=10000);
  end if;
 end if;
 delete from workspace_private.push_jobs where status<>'pending' and finished_at<now()-interval '7 days';
 delete from workspace_private.push_subscriptions where revoked_at<now()-interval '30 days';
 delete from cron.job_run_details where jobid in(select jobid from cron.job where jobname='workspace-device-notifications') and end_time<now()-interval '7 days';
exception when others then
 perform set_config('request.jwt.claims',coalesce(previous,''),true);raise;
end;$$;
revoke all on function workspace_private.push_tick() from public,anon,authenticated,service_role;
select cron.schedule('workspace-device-notifications','* * * * *','select workspace_private.push_tick();');
