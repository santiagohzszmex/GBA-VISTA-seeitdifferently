import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import fs from 'node:fs';
export async function runConnectorAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const denies=async promise=>{await assert.rejects(promise);checks++;};
 const id=n=>`82000000-0000-0000-0000-${String(n).padStart(12,'0')}`,session=n=>`83000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const scalar=async(q,args=[])=>Object.values((await db.query(q,args)).rows[0])[0];
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[n?JSON.stringify({sub:id(n),session_id:session(n),role:'authenticated'}):'{}']);await db.exec(n?'set role authenticated':'set role anon');};
 const admin=async(q,args=[])=>{await db.exec('reset role');return db.query(q,args);};
 const token=n=>`wsc_${String(n).repeat(64)}`;const hash=x=>createHash('sha256').update(x).digest('hex');const rpc=(n,method,args={},key=null)=>scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token(n),method,args,key]);
 await db.exec(`reset role;
 create or replace function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 grant usage on schema auth to anon;grant execute on function auth.uid(),auth.jwt() to anon;`);
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261013000619_workspace_connector.sql',import.meta.url),'utf8'));
 try{
  const unit=await scalar("select id from public.workspace_units where slug='gimg'");
  for(const n of [1,2]){await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`connector${n}@example.invalid`]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session(n),id(n)]);await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);}
  await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,granted_by,reason) values($1,'gimg_direction',$2,'unit',$2,$1,'Local connector acceptance')",[id(1),unit]);
  await actor(1);const project=await scalar("select public.workspace_command('project.create',$1,null)",[{unit_id:unit,title:'Conector local aislado'}]);const registration=await scalar('select public.workspace_connector_register($1,$2)',[hash(token(1)),'Fixture']);eq(registration.actor_id,id(1));eq((await scalar('select public.workspace_connector_sessions()'))[0].token_hash,undefined);
  await actor(2);await scalar('select public.workspace_connector_register($1,$2)',[hash(token(2)),'Sin cargo']);await denies(scalar('select public.workspace_connector_revoke($1)',[registration.id]));
  await actor(0);await denies(scalar('select public.workspace_connector_register($1,$2)',[hash(token(3)),'Anon']));await denies(db.query('select * from workspace_private.connector_sessions'));await denies(db.query("select workspace_private.connector_dispatch('context','{}')"));
  await denies(rpc(3,'context'));await denies(rpc(1,'grant.save'));await denies(rpc(1,'workspace_issue_license'));await denies(rpc(1,'workspace_command',{action:'grant.save'}));eq((await rpc(1,'context')).actor_id,id(1));eq((await rpc(2,'context')).projects.length,0);await denies(rpc(2,'context',{project_id:project.id}));eq(await scalar('select auth.uid()'),null);
  const ctx=await rpc(1,'context',{project_id:project.id});eq(ctx.projects.some(p=>p.id===project.id),true);const area=ctx.areas[0];const doc={type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Paleta original'}]}]};const args={project_id:project.id,revision:0,data:{title:'Paleta',kind:'concept',content_document:doc,editor_version:2}};const key=randomUUID();await denies(rpc(1,'reference.save',args));const ref=await rpc(1,'reference.save',args,key);eq((await rpc(1,'reference.save',args,key)).id,ref.id);await denies(rpc(1,'reference.save',{...args,data:{...args.data,title:'Otros datos'}},key));await denies(rpc(2,'reference.save',args,randomUUID()));
  const taskArgs={data:{project_id:project.id,unit_id:unit,area_id:area.id,title:'Trabajo del conector',responsible_id:id(1)},schedule:{due_at:'2026-11-01T18:00:00Z',priority:'high'},reference_ids:[ref.id]};const taskKey=randomUUID(),task=await rpc(1,'task.create',taskArgs,taskKey);eq((await rpc(1,'task.create',taskArgs,taskKey)).id,task.id);eq((await rpc(1,'context',{project_id:project.id})).materials.task_references[task.id][0].reference_id,ref.id);
  await admin('select 1');eq(await scalar('select count(*)::integer from public.workspace_deliverables where id=$1',[task.id]),1);await actor(0);
  const draftArgs={deliverable_id:task.id,revision:0,base_version:0,data:{content_document:doc,editor_version:2}},draftKey=randomUUID();const draft=await rpc(1,'draft.save',draftArgs,draftKey);eq((await rpc(1,'draft.save',draftArgs,draftKey)).revision,draft.revision);await denies(rpc(2,'draft.get',{deliverable_id:task.id}));
  const eventKey=randomUUID(),eventArgs={data:{project_id:project.id,title:'Hito',kind:'milestone',starts_at:'2026-11-01T18:00:00Z'}};const event=await rpc(1,'event.save',eventArgs,eventKey);eq((await rpc(1,'event.save',eventArgs,eventKey)).id,event.id);
  const material=await rpc(1,'task.material',{deliverable_id:task.id,title:'Texto privado para encargo',content_document:doc},randomUUID());eq(material.content_document,doc);
  await admin("insert into workspace_private.reference_originals(reference_id,file_name,mime_type,size_bytes,sha256,object_key,status,uploaded_by) values($1,'test.png','image/png',8,repeat('a',64),'connector-local-test','ready',$2)",[ref.id,id(1)]);await actor(0);await denies(rpc(2,'original.status',{reference_id:ref.id,sha256:'a'.repeat(64)}));
  // Underlying RBAC is re-evaluated even on cached results after a scope change.
  await admin('update public.workspace_access_grants set revoked_at=now() where user_id=$1',[id(1)]);await actor(0);await denies(rpc(1,'reference.save',args,key));await denies(rpc(1,'task.create',taskArgs,taskKey));
  await admin('update public.workspace_access_grants set revoked_at=null where user_id=$1',[id(1)]);await actor(1);eq(await scalar('select public.workspace_connector_revoke($1)',[registration.id]),true);await actor(0);await denies(rpc(1,'context'));
  await admin("update workspace_private.connector_sessions set expires_at=now()-interval '1 second' where actor_id=$1",[id(2)]);await actor(0);await denies(rpc(2,'context'));
 }finally{await db.exec('reset role');await db.query("select set_config('request.jwt.claims','',false)");}return checks;
}
