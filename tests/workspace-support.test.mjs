import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
export async function runSupportAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},denied=async p=>{await assert.rejects(p);checks++;};
 const id=n=>`72000000-0000-0000-0000-${String(n).padStart(12,'0')}`,ses=n=>`73000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
 const scalar=async(q,args=[])=>Object.values((await db.query(q,args)).rows[0])[0];
 const admin=async(q,args=[])=>{await db.exec('reset role');return db.query(q,args);};
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false),set_config('test.uid',$2,false),set_config('test.session',$3,false)",[JSON.stringify({sub:id(n),session_id:ses(n),role:'authenticated'}),id(n),ses(n)]);await db.exec('set role authenticated');};
 const cmd=(a,p,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,p,r]);
 const doc=text=>({type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:text?[{type:'text',text}]:[]} ]});
 const bundle=p=>scalar('select public.workspace_support_bundle($1)',[p]);
 const save=(p,data,r=0)=>scalar('select public.workspace_save_support($1,$2,$3)',[p,{...data,editor_version:2},r]);
 const action=(s,a,data={})=>scalar('select public.workspace_support_action($1,$2,$3,$4)',[s.id,a,data,s.revision]);
 await db.exec('reset role');
 try{
  const unit=await scalar("select id from public.workspace_units where slug='gimg'");
  for(let n=1;n<=5;n++){await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`support${n}@example.invalid`]);await db.query("insert into public.usuarios(id,rol,nombre,nombre_publico) values($1,'Usuario',$2,$2) on conflict(id) do update set nombre=excluded.nombre,nombre_publico=excluded.nombre_publico",[id(n),`support${n}`]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[ses(n),id(n)]);await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);}
  await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,granted_by,reason) values($1,'gimg_direction',$2,'unit',$2,$1,'Isolated support fixture')",[id(1),unit]);
  await actor(1);const p=await cmd('project.create',{unit_id:unit,title:'Apoyo local 1.6.5'}),areas=(await db.query('select * from public.workspace_areas where project_id=$1',[p.id])).rows,a=areas.find(x=>x.specialty==='research'),other=areas.find(x=>x.specialty==='text');
  for(const [n,role,area] of [[2,'gimg_area_lead',a],[3,'gimg_contributor',a],[4,'gimg_contributor',a],[5,'gimg_contributor',other]]){
   await admin("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,granted_by,reason) values($1,$2,$3,'area',$4,$5,'Local support fixture')",[id(n),role,unit,area.id,id(1)]);
   await admin("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by) values($1,'researcher',$2,$3,$4,$5)",[id(n),unit,p.id,area.id,id(1)]);
  }
  await actor(3);let s=await save(p.id,{title:'Entrevista sin entrega',area_id:a.id,document_kind:'interview',content_document:doc('Testimonio'),credits:'Autora 3',palette:['#663399']});
  eq(await scalar('select count(*)::integer from public.workspace_deliverables where project_id=$1',[p.id]),0);eq(s.share_scope,'private');eq((await bundle(p.id)).documents.length,1);eq((await bundle(p.id)).creation_areas,[a.id]);
  await denied(save(p.id,{...s,area_id:other.id},s.revision));await denied(save(p.id,{...s,content_document:doc('Conflicto')},0));
  for(const n of [1,2,4,5]){await actor(n);eq((await bundle(p.id)).documents.length,0);await denied(scalar('select public.workspace_support_history($1)',[s.id]));await denied(action(s,'share',{share_scope:'area'}));}
  await actor(3);const media=await scalar('select public.workspace_prepare_support_original($1,$2)',[s.id,'Entrevista.pdf']);
  await admin("insert into workspace_private.reference_originals(id,reference_id,file_name,mime_type,size_bytes,sha256,object_key,status,uploaded_by) values($1,$2,'entrevista.pdf','application/pdf',8,repeat('e',64),'support-local-original','ready',$3)",[id(100),media.id,id(3)]);
  await admin("update workspace_private.original_limits set enabled=true,gateway_key_hash=encode(extensions.digest('support-local-gateway','sha256'),'hex') where singleton");
  await actor(3);eq((await scalar('select public.workspace_original_gate($1,$2)',[media.id,'support-local-gateway'])).kind,'instructions');
  const uploaded=await scalar('select public.workspace_original_begin($1,$2,$3,8,$4,$5)',[media.id,'second.pdf','application/pdf','f'.repeat(64),'support-local-gateway']);
  await scalar('select public.workspace_original_finish($1,true,$2)',[uploaded.id,'support-local-gateway']);eq((await scalar('select public.workspace_original_descriptor($1)',[uploaded.id])).mime_type,'application/pdf');
  await actor(4);await denied(scalar('select public.workspace_original_gate($1,$2)',[media.id,'support-local-gateway']));
  await actor(3);eq((await scalar('select public.workspace_reference_bundle($1)',[p.id])).references.some(r=>r.id===media.id),false);eq((await scalar('select public.workspace_original_descriptor($1)',[id(100)])).can_download,true);
  await actor(4);await denied(scalar('select public.workspace_original_descriptor($1)',[id(100)]));
  await actor(3);s=await save(p.id,{...s,content_document:{type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Testimonio'},{type:'mention',attrs:{id:id(4),label:'support4',anchorId:id(104)}}]}]}},s.revision);
  await actor(4);eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.event_type==='support.mention'),false);
  await actor(3);s=await action(s,'share',{share_scope:'area'});
  await actor(4);let read=(await bundle(p.id)).documents[0];eq(read.title,s.title);eq(read.can_edit,false);eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.event_type==='support.mention' && x.support_id===s.id),true);eq(read.originals.some(x=>x.id===id(100)),true);eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.support_id===s.id),true);await denied(save(p.id,{...s,content_document:doc('Edición ajena')},s.revision));
  await actor(5);eq((await bundle(p.id)).documents.length,0);eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.support_id===s.id),false);
  await actor(3);s=await action(s,'share',{share_scope:'private'});
  await actor(4);eq((await bundle(p.id)).documents.length,0);await denied(scalar('select public.workspace_original_descriptor($1)',[id(100)]));eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.support_id===s.id),false);
  await actor(2);let t=await cmd('task.create',{project_id:p.id,area_id:a.id,title:'Fuentes del equipo',responsible_id:id(3),collaborator_ids:[]});
  await actor(3);s=await action(s,'link',{linked_task_id:t.id});eq(s.share_scope,'private');
  let linked=(await scalar('select public.workspace_opal_bundle($1)',[p.id])).task_references[t.id][0];eq(linked.snapshot.content_document,s.content_document);eq(linked.originals.some(x=>x.id===id(100)),true);
  s=await save(p.id,{...s,content_document:doc('Testimonio corregido')},s.revision);linked=(await scalar('select public.workspace_opal_bundle($1)',[p.id])).task_references[t.id][0];eq(linked.snapshot.content_document.content[0].content[0].text,'Testimonio');
  const converted=await action(s,'convert');eq(converted.state,'assigned');eq(converted.current_version,0);const draft=await scalar('select public.workspace_draft($1)',[converted.id]);eq(draft.content_document,doc('Testimonio corregido'));eq(draft.credits,'Autora 3');eq((await bundle(p.id)).documents[0].converted_task_id,converted.id);eq((await scalar('select public.workspace_opal_bundle($1)',[p.id])).task_references[converted.id][0].originals.length,2);
  const team=await scalar('select public.workspace_team_bundle($1)',[p.id]);eq(team.members.some(x=>x.user_id===id(4)),true);eq(team.members.some(x=>x.user_id===id(5)),false);
  const history=await scalar('select public.workspace_support_history($1)',[s.id]);eq(history.length>=5,true);
  await actor(1);let ref=await scalar('select public.workspace_save_reference($1,$2,0)',[p.id,{kind:'instructions',area_id:a.id,title:'Guía de entrevista',category:'interview_guide',content_document:doc('Preguntas'),editor_version:2}]);eq(ref.category,'interview_guide');await denied(scalar('select public.workspace_save_reference($1,$2,$3)',[p.id,{...ref,category:'not-a-category',editor_version:2},ref.revision]));
  await actor(3);s=(await bundle(p.id)).documents[0];s=await action(s,'share',{share_scope:'area'});
  await admin("update public.workspace_unit_memberships set membership_status='suspended' where unit_id=$1 and user_id=$2",[unit,id(4)]);await actor(4);await denied(bundle(p.id));eq((await scalar('select public.workspace_notifications()')).items.some(x=>x.support_id===s.id),false);
  await actor(3);await denied(db.query('select * from workspace_private.support_documents'));await denied(db.query('select * from workspace_private.support_history'));await denied(scalar('select workspace_private.support_for((select s from workspace_private.support_documents s limit 1),$1)',[id(3)]));
  const token='wsc_'+('c'.repeat(64));await scalar('select public.workspace_connector_register($1,$2)',[createHash('sha256').update(token).digest('hex'),'Local support acceptance']);
  const request=randomUUID(),args={project_id:p.id,revision:0,data:{title:'Importación privada',area_id:a.id,document_kind:'notes',content_document:doc('Importado'),editor_version:2}};
  const imported=await scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.save',args,request]);
  eq((await scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.save',args,request])).id,imported.id);
  await denied(scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.save',{...args,data:{...args.data,title:'Otro contenido'}},request]));
  const archiveKey=randomUUID(),archiveArgs={id:imported.id,action:'archive',revision:imported.revision};
  await scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.action',archiveArgs,archiveKey]);
  eq((await scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.action',archiveArgs,archiveKey])).id,imported.id);
  await denied(scalar('select public.workspace_connector_call($1,$2,$3,$4)',[token,'support.save',args,request]));
  s=await action(s,'archive');eq((await bundle(p.id)).documents.length,0);eq((await scalar('select public.workspace_support_history($1)',[s.id])).length>=6,true);
  await admin('select 1');eq((await db.query("select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='workspace_private' and relname in('support_documents','support_history')")).rows.every(x=>x.relrowsecurity),true);
  console.log(`PASS: ${checks} support/team assertions: private creation, scoped sharing/revocation, frozen links, PDF originals, conversion, categories, directory and denial.`);return checks;
 }finally{await db.exec('reset role');}
}
