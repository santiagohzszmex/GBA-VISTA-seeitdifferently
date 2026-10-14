import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function runCuarzoAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},denied=async promise=>{await assert.rejects(promise);checks++;};
 const id=n=>`76000000-0000-0000-0000-${String(n).padStart(12,'0')}`,session=n=>`77000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const scalar=async(q,args=[])=>Object.values((await db.query(q,args)).rows[0])[0];
 const admin=async(q,args=[])=>{await db.exec('reset role');return db.query(q,args);};
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false),set_config('test.uid',$2,false),set_config('test.session',$3,false)",[JSON.stringify({sub:id(n),session_id:session(n),role:'authenticated'}),id(n),session(n)]);await db.exec('set role authenticated');};
 const cmd=(a,p,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,p,r]);
 const save=(p,data,r=0)=>scalar('select public.workspace_save_support($1,$2,$3)',[p,{...data,editor_version:2},r]);
 const send=(s,people)=>scalar('select public.workspace_send_document($1,$2,$3)',[s.id,people,s.revision]);
 const inbox=(u,sent=false)=>scalar('select public.workspace_document_inbox($1,$2)',[u,sent]);
 const read=d=>scalar('select public.workspace_read_document_delivery($1)',[d]);
 await db.exec('reset role');
 try{
  const unit=await scalar("select id from public.workspace_units where slug='gimg'");
  for(let n=1;n<=9;n++){
   await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`cuarzo${n}@example.invalid`]);
   await db.query("insert into public.usuarios(id,rol,nombre,nombre_publico) values($1,'Usuario',$2,$2) on conflict(id) do update set nombre=excluded.nombre,nombre_publico=excluded.nombre_publico",[id(n),`cuarzo${n}`]);
   await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session(n),id(n)]);
   if(n!==8)await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);
  }
  await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_direction',$2,'unit',$2,'Isolated Cuarzo acceptance')",[id(1),unit]);
  await actor(1);const p=await cmd('project.create',{unit_id:unit,title:'Cuarzo source edition'}),q=await cmd('project.create',{unit_id:unit,title:'Cuarzo other edition'});
  await admin('select 1');const area=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='research'",[p.id]),other=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='text'",[q.id]);
  for(const [n,role,project,scope] of [[2,'gimg_area_lead',p.id,area],[3,'gimg_contributor',p.id,area],[4,'gimg_contributor',q.id,other],[9,'gimg_contributor',p.id,area]]){
   await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,$2,$3,'area',$4,'Cuarzo scoped fixture')",[id(n),role,unit,scope]);
   await db.query("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by) values($1,'researcher',$2,$3,$4,$5)",[id(n),unit,project,scope,id(1)]);
  }
  await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_quality_manager',$2,'unit',$2,'QA fixture'),($3,'gimg_viewer',$2,'project',$4,'Consulta fixture')",[id(5),unit,id(6),q.id]);
  await db.query("insert into public.workspace_delegations(delegate_user_id,delegated_by,unit_id,scope_type,scope_id,permission_keys,starts_at,expires_at,reason) values($1,$2,$3,'project',$4,array['reference.read'],now(),now()+interval '1 day','Explicitly shared reading')",[id(6),id(1),unit,q.id]);
  const anchor=randomUUID(),doc={type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Preguntas para revisar',marks:[{type:'bold'}]},{type:'mention',attrs:{id:id(4),label:'cuarzo4',anchorId:anchor}}]}]};
  await actor(3);let s=await save(p.id,{area_id:area,title:'Preguntas',document_kind:'research',content_document:doc,credits:'Autor de las preguntas',palette:['#123456']});
  eq(s.share_scope,'private');eq((await db.query('select id from public.workspace_deliverables where project_id=$1',[p.id])).rows.length,0);
  const people=await scalar('select public.workspace_document_recipients($1)',[s.id]);
  for(const n of [1,2,4,5,6,9])eq(people.some(person=>person.user_id===id(n)),true);
  for(const n of [3,7,8])eq(people.some(person=>person.user_id===id(n)),false);
  eq((await scalar('select public.workspace_support_mention_candidates($1)',[s.id])).some(person=>person.user_id===id(4)),true);
  await actor(4);eq((await scalar('select public.workspace_notifications()')).items.some(n=>n.support_id===s.id),false);
  await denied(scalar('select public.workspace_document_recipients($1)',[s.id]));await denied(save(p.id,s,s.revision));
  await actor(3);await denied(send(s,[id(4),id(8)]));eq((await inbox(unit,true)).length,0);
  await denied(send({...s,revision:0},[id(4)]));
  // Original catalog uses the normal authorized upload lifecycle; no external service is contacted.
  const gateway='isolated-cuarzo-gateway';await admin("update workspace_private.original_limits set enabled=true,gateway_key_hash=encode(extensions.digest($1,'sha256'),'hex') where singleton",[gateway]);
  await actor(3);const ref=await scalar('select public.workspace_prepare_support_original($1,$2)',[s.id,'Preguntas.pdf']);
  await scalar('select public.workspace_original_gate($1,$2)',[ref.id,gateway]);
  const file=await scalar('select public.workspace_original_begin($1,$2,$3,$4,$5,$6)',[ref.id,'Preguntas.pdf','application/pdf',8,'c'.repeat(64),gateway]);
  await scalar('select public.workspace_original_finish($1,true,$2)',[file.id,gateway]);
  await actor(9);const privateSource=await save(p.id,{area_id:area,title:'Original de otra persona',content_document:{type:'doc',content:[{type:'paragraph'}]}});
  const imageRef=await scalar('select public.workspace_prepare_support_original($1,$2)',[privateSource.id,'Referencia.png']);
  const borrowed=await scalar('select public.workspace_original_begin($1,$2,$3,$4,$5,$6)',[imageRef.id,'Referencia.png','image/png',8,'e'.repeat(64),gateway]);await scalar('select public.workspace_original_finish($1,true,$2)',[borrowed.id,gateway]);
  await actor(1);const readOnlyTask=await cmd('task.create',{unit_id:unit,project_id:p.id,area_id:area,title:'Material con lectura delegada',responsible_id:id(9)});
  await admin("insert into public.workspace_delegations(delegate_user_id,delegated_by,unit_id,scope_type,scope_id,permission_keys,starts_at,expires_at,reason) values($1,$2,$3,'deliverable',$4,array['content.read','task.read'],now(),now()+interval '1 day','Read-only material fixture')",[id(3),id(1),unit,readOnlyTask.id]);
  await actor(9);await cmd('comment.add',{project_id:p.id,deliverable_id:readOnlyTask.id,body:'Imagen para consultar',editor_version:2,body_document:{type:'doc',content:[{type:'paragraph',content:[{type:'originalImage',attrs:{assetId:borrowed.id,caption:'Imagen para consultar'}}]}]}},readOnlyTask.revision);
  await actor(3);eq((await scalar('select public.workspace_original_descriptor($1)',[borrowed.id])).can_download,false);
  doc.content.push({type:'paragraph',content:[{type:'originalImage',attrs:{assetId:borrowed.id,caption:'Referencia autorizada para lectura'}}]});
  s=await save(p.id,{...s,content_document:doc},s.revision);
  eq((await send(s,[id(4),id(4),id(6)])).sent,2);eq((await send(s,[id(4)])).sent,0);
  const sent=await inbox(unit,true);eq(sent.length,2);const delivery=sent.find(d=>d.recipient_id===id(4)),viewerDelivery=sent.find(d=>d.recipient_id===id(6));
  const older=await scalar('select public.workspace_document_inbox($1,true,$2,$3)',[unit,sent[0].created_at,sent[0].id]);eq(older.map(d=>d.id),sent.slice(1).map(d=>d.id));
  await actor(4);eq((await inbox(unit)).length,1);await denied(scalar('select public.workspace_support_bundle($1)',[p.id]));
  const copy=await read(delivery.id);eq(copy.content_document,doc);eq(copy.palette,['#123456']);eq(copy.credits,'Autor de las preguntas');eq(copy.can_edit,false);eq(Boolean(copy.read_at),true);eq(copy.originals.find(x=>x.id===file.id).sha256,'c'.repeat(64));eq(copy.originals.find(x=>x.id===file.id).can_download,true);
  eq((await scalar('select public.workspace_original_access($1,false,$2)',[file.id,gateway])).id,file.id);
  eq((await scalar('select public.workspace_original_access($1,true,$2)',[file.id,gateway])).sha256,'c'.repeat(64));
  eq(copy.originals.find(x=>x.id===borrowed.id).can_download,false);
  eq((await scalar('select public.workspace_original_access($1,false,$2)',[borrowed.id,gateway])).id,borrowed.id);
  await denied(scalar('select public.workspace_original_access($1,true,$2)',[borrowed.id,gateway]));
  const notices=(await scalar('select public.workspace_notifications()')).items.filter(n=>n.delivery_id===delivery.id);eq(notices.length,1);eq(notices[0].anchor_id,anchor);
  const target=await scalar('select public.workspace_read_notification($1,null)',[notices[0].id]);eq(target.delivery_id,delivery.id);eq(target.anchor_id,anchor);
  await denied(db.query('select * from workspace_private.document_deliveries'));await denied(read(viewerDelivery.id));
  await actor(6);eq((await read(viewerDelivery.id)).can_edit,false);await denied(save(p.id,s,s.revision));
  await actor(9);eq((await inbox(unit)).length,0);await denied(read(delivery.id));await denied(scalar('select public.workspace_original_descriptor($1)',[file.id]));
  await actor(3);const changed={...doc,content:[{type:'paragraph',content:[{type:'text',text:'Nueva revisión privada'}]}]};s=await save(p.id,{...s,content_document:changed},s.revision);
  // Future attachments in the same container must not become readable through an old copy.
  const future=await scalar('select public.workspace_original_begin($1,$2,$3,$4,$5,$6)',[ref.id,'Privado.pdf','application/pdf',8,'d'.repeat(64),gateway]);await scalar('select public.workspace_original_finish($1,true,$2)',[future.id,gateway]);
  await actor(4);eq((await read(delivery.id)).content_document,doc);await denied(scalar('select public.workspace_original_descriptor($1)',[future.id]));
  await actor(3);eq((await send(s,[id(4)])).sent,1);await scalar("select public.workspace_support_action($1,'archive','{}',$2)",[s.id,s.revision]);
  await actor(4);eq((await read(delivery.id)).content_document,doc);eq((await scalar('select public.workspace_original_descriptor($1)',[file.id])).sha256,'c'.repeat(64));
  await admin("update public.workspace_assignments set starts_at=now()-interval '2 days',expires_at=now()-interval '1 second' where user_id=$1",[id(4)]);await actor(4);await denied(inbox(unit));await denied(read(delivery.id));await denied(scalar('select public.workspace_original_descriptor($1)',[file.id]));
  await admin("update public.workspace_unit_memberships set membership_status='suspended' where user_id=$1 and unit_id=$2",[id(6),unit]);await actor(6);await denied(read(viewerDelivery.id));
  await admin('delete from auth.sessions where id=$1',[session(3)]);await actor(3);await denied(inbox(unit,true));
  await admin('select 1');eq(await scalar("select relrowsecurity from pg_class where oid='workspace_private.document_deliveries'::regclass"),true);
  eq(await scalar("select has_function_privilege('anon','public.workspace_send_document(uuid,uuid[],integer)','execute')"),false);
  console.log(`PASS: ${checks} Cuarzo inbox assertions: cross-edition recipients, no task creation, private sources, immutable copies, explicit PDF access, no sibling leaks, deduplication, mention anchors, stale revisions, roles and revocation.`);
  return checks;
 }finally{await db.exec('reset role');}
}
