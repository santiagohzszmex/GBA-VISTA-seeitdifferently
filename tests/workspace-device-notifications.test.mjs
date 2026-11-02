import assert from 'node:assert/strict';import fs from 'node:fs';
export async function runDeviceNotificationAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];const bad=async(p,re=/permiso|acceso|sesión|válid|activar|dispositivo/i)=>{await assert.rejects(p,re);checks++;};
 const uid=n=>`86000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sid=n=>`87000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const admin=()=>db.exec('reset role');const actor=async n=>{await admin();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid(n),session_id:sid(n),role:'authenticated'})]);await db.exec('set role authenticated');};
 await admin();const matrix=await scalar('select jsonb_agg(to_jsonb(r) order by role,permission) from workspace_private.role_permissions r');
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101202046_workspace_device_notifications.sql',import.meta.url),'utf8'));
 const unit=await scalar("select id from public.workspace_units where slug='gimg'");
 const subscription={endpoint:'https://web.push.apple.com/local-fixture',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,1).toString('base64url')}};
 const pref=(action,data={})=>scalar('select public.workspace_push_preferences($1,$2)',[action,data]);
 await actor(1);const registered=await pref('register',{subscription,label:'Local Mac'});eq(registered.active,true);
 eq((await pref('status')).devices.length,1);eq(JSON.stringify(await pref('status')).includes('endpoint'),false);
 await bad(pref('register',{subscription:{...subscription,endpoint:'https://127.0.0.1/unsafe'},label:'x'}),/válida/i);
 await actor(2);await bad(pref('register',{subscription,label:'Takeover'}),/Vuelve a activar/i);eq((await pref('status')).devices.length,0);
 await pref('disable',{id:registered.id});await actor(1);eq((await pref('status')).devices.length,1);
 const extras=[];for(let i=1;i<=7;i++)extras.push(await pref('register',{subscription:{...subscription,endpoint:subscription.endpoint+'-'+i},label:'Local '+i}));
 eq((await pref('status')).devices.length,8);
 await bad(pref('register',{subscription:{...subscription,endpoint:subscription.endpoint+'-ninth'},label:'Ninth'}),/Retira un dispositivo/i);
 await pref('disable',{id:extras[0].id});await pref('register',{subscription:{...subscription,endpoint:subscription.endpoint+'-ninth'},label:'Ninth'});
 await bad(pref('register',{subscription:{...subscription,endpoint:subscription.endpoint+'-1'},label:'Reactivation'}),/Retira un dispositivo/i);
 await admin();await db.exec('alter table auth.sessions add column not_after timestamptz');
 await db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sid(1)]);await actor(1);eq((await pref('status')).devices.every(d=>!d.active),true);
 await admin();await db.query('update auth.sessions set not_after=null where id=$1',[sid(1)]);await actor(1);
 await admin();eq(await scalar("select has_table_privilege('authenticated','workspace_private.push_subscriptions','select')"),false);eq(await scalar("select has_function_privilege('authenticated','public.workspace_push_batch(text,uuid)','execute')"),false);eq(await scalar("select has_function_privilege('anon','public.workspace_push_preferences(text,jsonb)','execute')"),false);eq(await scalar("select has_function_privilege('authenticated','workspace_private.push_allowed(workspace_private.push_subscriptions,workspace_private.notifications)','execute')"),false);
 // Synthetic data only in this in-memory database; production tests are read-only.
 const notice=async(key,created='now()')=>scalar(`insert into workspace_private.notifications(recipient_id,unit_id,event_key,event_type,title,body,personal,created_at) values($1,$2,$3,'test','Local title','Local body',true,${created}) returning id`,[uid(1),unit,key]);
 const id=await notice('push-local-1');eq(await scalar('select count(*)::int from workspace_private.push_jobs where notification_id=$1',[id]),8);
 const old=await notice('push-local-old',"now()-interval '1 day'");eq(await scalar('select count(*)::int from workspace_private.push_jobs where notification_id=$1',[old]),0);
 const gate='b'.repeat(64),lease='88000000-0000-4000-8000-000000000001';await db.query("update workspace_private.push_settings set gate_hash=sha256(convert_to($1,'UTF8'))",[gate]);
 const batch=(token=gate)=>scalar('select public.workspace_push_batch($1,$2)',[token,lease]);
 await bad(batch('bad'),/Acceso/i);const claim=await batch();eq(claim.some(j=>j.notificationId===id),true);eq((await batch()).length,0);
 const job=claim.find(j=>j.notificationId===id&&j.subscription.endpoint===subscription.endpoint);await scalar('select public.workspace_push_result($1,$2,$3,201)',[gate,job.id,lease]);eq(await scalar('select status from workspace_private.push_jobs where id=$1',[job.id]),'sent');
 await actor(1);const snapshot=await scalar('select public.workspace_notifications()');const ack=await scalar('select public.workspace_read_notification($1,null)',[id]);eq(ack.inbox.items.find(n=>n.id===id).read_at!==null,true);eq(ack.inbox.unread_count,snapshot.unread_count-1);
 await bad(scalar('select public.workspace_read_notification(null,$1)',[new Date(Date.now()+86400000).toISOString()]),/fecha|corte|futuro|válid|Selecciona los avisos/i);
 await admin();const cancel=await notice('push-local-cancel');await actor(1);await scalar('select public.workspace_read_notification($1,null)',[cancel]);await admin();eq(await scalar('select status from workspace_private.push_jobs where notification_id=$1 limit 1',[cancel]),'cancelled');
 // Enrollment is tied to the actual session, not any later session for this user.
 const pending=await notice('push-local-revoked');await db.query('delete from auth.sessions where id=$1',[sid(1)]);eq((await batch()).length,0);eq(await scalar('select count(*)::int from workspace_private.push_subscriptions where id=$1',[registered.id]),0);
 eq(await scalar('select jsonb_agg(to_jsonb(r) order by role,permission) from workspace_private.role_permissions r'),matrix);
 // Exercise the runtime function locally; external extension APIs are deliberate stubs.
 await db.exec(`create schema net;create schema cron;
 create table net.local_requests(url text,headers jsonb,body jsonb);
 create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$begin insert into net.local_requests values(url,headers,body);return 1;end;$$;
 create table cron.job(jobid bigint primary key,jobname text,schedule text,command text,active boolean default true);
 create table cron.job_run_details(jobid bigint,end_time timestamptz);
 create function cron.schedule(jobname text,schedule text,command text) returns bigint language sql as $$insert into cron.job values(1,jobname,schedule,command,true);select 1::bigint;$$;`);
 const runtime=fs.readFileSync(new URL('../supabase/migrations/20261101202048_workspace_push_runtime.sql',import.meta.url),'utf8').replace(/^create extension.*;$/gm,'');
 await db.exec(runtime);eq(await scalar("select active from cron.job where jobname='workspace-device-notifications'"),true);
 eq(await scalar("select gate_hash is not null and secret_id is not null from workspace_private.push_settings"),true);
 await actor(2);const second=await pref('register',{subscription:{...subscription,endpoint:subscription.endpoint+'-second'},label:'Local second'});await pref('test',{id:second.id});
 await bad(pref('test',{id:second.id}),/Espera un minuto/i);
 await admin();const beforeClaims=await scalar("select current_setting('request.jwt.claims',true)");await scalar('select workspace_private.push_tick()');
 eq(await scalar("select current_setting('request.jwt.claims',true)"),beforeClaims);
 eq(await scalar('select count(*)::int from net.local_requests'),1);
 eq(await scalar("select url='https://gba.software/api/workspace-push' and headers->>'Authorization' like 'Bearer %' from net.local_requests limit 1"),true);
 eq(await scalar("select has_function_privilege('authenticated','workspace_private.push_tick()','execute')"),false);
 eq(await scalar("select has_schema_privilege('authenticated','net','usage')"),false);
 console.log(`PASS: ${checks} device notification SQL checks: private subscriptions, live sessions, owner isolation, queue leases, read cancellation and unchanged RBAC.`);return checks;
}
