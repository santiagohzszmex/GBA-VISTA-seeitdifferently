import fs from 'node:fs';import assert from 'node:assert/strict';
export async function runDeadlineAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const uid='86000000-0000-4000-8000-000000000001',sid='87000000-0000-4000-8000-000000000001';
 const admin=async()=>db.exec('reset role');const actor=async()=>{await admin();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,session_id:sid})]);await db.exec('set role authenticated');};
 await admin();await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261017174350_workspace_deadline_receipts.sql',import.meta.url),'utf8'));
 const sample=(await db.query("select * from public.workspace_deliverables where created_by=$1 limit 1",[uid])).rows[0];
 await actor();const command=(a,d,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,d,r]);
 let t=await command('task.create',{unit_id:sample.unit_id,project_id:sample.project_id,area_id:sample.area_id,title:'Deadline acceptance',responsible_id:uid});
 t=await command('task.schedule',{deliverable_id:t.id,project_id:t.project_id,due_at:'2026-11-01T05:59:00Z',due_has_time:false,priority:'normal'},t.revision);eq(t.due_has_time,false);
 t=await command('version.submit',{deliverable_id:t.id,project_id:t.project_id,editor_version:2,content_markdown:'Private local test',change_summary:'First submission'},t.revision);
 let facts=await scalar('select public.workspace_deadline_facts($1)',[t.project_id]);eq(facts[t.id].submitted_deadline_known,true);eq(+new Date(facts[t.id].submitted_due_at),+new Date('2026-11-01T05:59:00Z'));eq(Boolean(facts[t.id].first_submitted_at),true);
 t=await command('task.schedule',{deliverable_id:t.id,project_id:t.project_id,due_at:'2026-12-01T18:00:00Z',due_has_time:true,priority:'high'},t.revision);
 facts=await scalar('select public.workspace_deadline_facts($1)',[t.project_id]);eq(+new Date(facts[t.id].submitted_due_at),+new Date('2026-11-01T05:59:00Z'));eq(facts[t.id].deadline_changes.length,2);eq(facts[t.id].deadline_changes[0].previous_known,true);eq(Boolean(facts[t.id].deadline_changes[0].by),true);eq(Object.keys(facts[t.id]).sort(),['deadline_changes','first_submitted_at','submitted_deadline_known','submitted_due_at']);
 await admin();eq(await scalar("select has_function_privilege('anon','public.workspace_deadline_facts(uuid)','execute')"),false);eq(await scalar("select has_function_privilege('authenticated','workspace_private.command_before_deadlines(text,jsonb,integer)','execute')"),false);
 eq(await scalar('select images_all_projects from workspace_private.upload_policy'),false);
 await db.exec('update workspace_private.upload_policy set images_enabled=true,images_all_projects=true');
 const other=(await db.query('select * from public.workspace_projects where id<>$1 and deleted_at is null limit 1',[t.project_id])).rows[0];
 eq(await scalar('select workspace_private.image_project_enabled($1)',[other.id]),true);eq(await scalar("select workspace_private.image_project_enabled('00000000-0000-4000-8000-000000000099')"),false);
 await db.exec('update workspace_private.upload_policy set images_enabled=false');eq(await scalar('select workspace_private.image_project_enabled($1)',[other.id]),false);
 const outsider='99000000-0000-4000-8000-000000000001',outsideSession='99000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users(id,email) values($1,$2)',[outsider,'deadline-outside@example.invalid']);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[outsideSession,outsider]);
 await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:outsider,session_id:outsideSession})]);await db.exec('set role authenticated');eq(await scalar('select workspace_private.session_active()'),true);await assert.rejects(scalar('select public.workspace_deadline_facts($1)',[t.project_id]),/acceso/);checks++;
 await admin();await db.query("select set_config('request.jwt.claims','{}',false)");await db.exec('set role authenticated');await assert.rejects(scalar('select public.workspace_deadline_facts($1)',[t.project_id]),/acceso/);checks++;
 await admin();console.log(`PASS: ${checks} deadline SQL assertions: server snapshots, schedule history, scoped facts, revoked session, private helpers and all-edition flag.`);return checks;
}
