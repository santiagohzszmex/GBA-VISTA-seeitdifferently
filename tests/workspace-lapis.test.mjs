import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function runLapisAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const denied=async(fn,re=/permiso|permission|denied|asignaci|versión|válid|imagen|inmutable|revisión|subida|capas|borrador|proporción|Sesión|Membresía|congelada/i)=>{await assert.rejects(fn,re);checks++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const admin=async(q,p=[])=>{await db.exec('reset role');return db.query(q,p);};
 const id=n=>`82000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sid=n=>`83000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id(n),session_id:sid(n)})]);await db.exec('set role authenticated');};
 const cmd=(a,t,d={},r=null)=>scalar('select public.workspace_image_command($1,$2,$3,$4)',[a,t,d,r]);
 const legacy=(a,d,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,d,r]);
 const doc=s=>({type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:s}]}]});
 await db.exec('reset role');
 for(const file of ['20261016113805_workspace_lapis_upload_policy.sql','20261016113806_workspace_lapis_image_data.sql'])await db.exec(fs.readFileSync(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
 await db.exec('update workspace_private.upload_policy set images_enabled=true where singleton');
 const unit=await scalar("select id from public.workspace_units where slug='gimg'");
 for(let n=1;n<=6;n++){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`lapis-${n}@example.invalid`]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(n),id(n)]);
  await db.query("insert into public.usuarios(id,rol,nombre,nombre_publico) values($1,'Usuario',$2,$2)",[id(n),`lapis-${n}`]);
  await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);
 }
 await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_direction',$2,'unit',$2,'Isolated Lapislazuli tests')",[id(1),unit]);
 await actor(1);const p=await legacy('project.create',{unit_id:unit,title:'Día de Muertos · Lapislázuli local'}),p2=await legacy('project.create',{unit_id:unit,title:'Halloween · Lapislázuli local'});
 const a=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[p.id]),a2=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[p2.id]);
 for(const [n,area,project,role] of [[2,a,p.id,'gimg_contributor'],[3,a2,p2.id,'gimg_contributor'],[4,a,p.id,'gimg_area_lead'],[5,a,p.id,'gimg_viewer']]){
  await admin("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason,expires_at) values($1,$2,$3,'area',$4,'Local scope test',now()+interval '1 day')",[id(n),role,unit,area]);
  await db.query("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by) values($1,'contributor',$2,$3,$4,$5)",[id(n),unit,project,area,id(1)]);
 }
 await actor(1);const task=await legacy('task.create',{unit_id:unit,project_id:p.id,area_id:a,title:'Ilustración',responsible_id:id(2)}),other=await legacy('task.create',{unit_id:unit,project_id:p2.id,area_id:a2,title:'Otra edición',responsible_id:id(3)});
 const revision=()=>scalar('select revision from public.workspace_deliverables where id=$1',[task.id]);
 await cmd('spec.save',task.id,{min_width:8000,min_height:8000,layer_policy:'if_present'},await revision());
 eq(await scalar('select kind from public.workspace_deliverables where id=$1',[task.id]),'image');
 eq((await scalar('select public.workspace_upload_policy()')).png_max_bytes,18874368);
 await admin('update workspace_private.upload_policy set reference_max_bytes=1234567 where singleton');await actor(1);
 eq((await scalar('select public.workspace_reference_bundle($1)',[p.id])).storage.file_limit_bytes,1234567);
 await admin('update workspace_private.upload_policy set reference_max_bytes=26214400 where singleton');
 const asset=async(taskId,owner,role='png',format='png',verification='decoded',width=4000,height=5000,size=1000)=>{
  await db.exec('reset role');return scalar("insert into workspace_private.image_assets(deliverable_id,owner_id,role,object_key,file_name,size_bytes,sha256,mime_type,format,status,verification,width,height) values($1,$2,$3,gen_random_uuid()::text,$4,$10,repeat('a',64),$5,$6,'validated',$7,$8,$9) returning id",[taskId,owner,role,`synthetic.${format}`,role==='png'?'image/png':'application/octet-stream',format,verification,width,height,size]);
 };
 const png=await asset(task.id,id(2)),foreign=await asset(other.id,id(3)),layer=await asset(task.id,id(2),'layered','afphoto','unverified');
 const allocated=await scalar('select allocated_bytes::text from workspace_private.original_limits where singleton');
 await denied(asset(task.id,id(2),'png','png','decoded',4000,5000,18874369),/límite/);
 eq(await scalar('select allocated_bytes::text from workspace_private.original_limits where singleton'),allocated);
 await admin('update workspace_private.original_limits set capacity_bytes=allocated_bytes+500 where singleton');
 await denied(asset(task.id,id(2)),/capacidad/);
 await admin('update workspace_private.original_limits set capacity_bytes=10000000000 where singleton');
 eq(await scalar("select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='workspace_private' and c.relname like 'image_%' and c.relkind='r' and not c.relrowsecurity"),0);
 eq(await scalar("select has_function_privilege('anon','public.workspace_image_command(text,uuid,jsonb,integer)','execute')"),false);
 await actor(2);await denied(cmd('spec.save',task.id,{},await revision()));
 await denied(cmd('draft.save',task.id,{base_version:0,png_asset_id:foreign},0));
 let draft=await cmd('draft.save',task.id,{base_version:0,png_asset_id:png,has_layers:true,note_document:doc('Prueba privada')},0);
 eq(draft.author_id,id(2));eq(await scalar('select count(*)::int from public.workspace_versions where deliverable_id=$1',[task.id]),0);
 await denied(db.query("update workspace_private.image_drafts set credits='bypass' where deliverable_id=$1",[task.id]));
 await actor(4);eq(await scalar('select count(*)::int from workspace_private.image_drafts where deliverable_id=$1',[task.id]),0);
 await actor(3);eq(await scalar('select count(*)::int from workspace_private.image_specs where deliverable_id=$1',[task.id]),0);
 await denied(cmd('draft.save',task.id,{base_version:0,png_asset_id:png},0));
 await actor(2);await denied(cmd('version.submit',task.id,{base_version:0,png_asset_id:png,has_layers:true},draft.revision));
 await denied(legacy('version.submit',{unit_id:unit,project_id:p.id,deliverable_id:task.id,content_markdown:'bypass'},await revision()));
 await denied(cmd('version.submit',task.id,{base_version:0},draft.revision));
 const version=await cmd('version.submit',task.id,{base_version:0,png_asset_id:png,layered_asset_id:layer,has_layers:true,note_document:doc('Nota de entrega')},draft.revision);
 eq(version.kind,'image');eq(version.version_number,1);eq(await scalar('select count(*)::int from workspace_private.image_drafts where deliverable_id=$1',[task.id]),0);
 // Deliberately below the 8000px minimum: quality warnings do not block submission.
 eq(await scalar('select state from public.workspace_deliverables where id=$1',[task.id]),'review');
 await denied(admin("update workspace_private.image_assets set object_key='changed' where id=$1",[png]));
 await denied(admin("delete from workspace_private.image_versions where version_id=$1",[version.id]));
 await denied(admin("insert into workspace_private.image_version_files values($1,'layered',$2)",[version.id,layer]),/congelada|duplicate|inmutable|versión/i);
 await actor(4);const note=await cmd('note.add',task.id,{version_id:version.id,kind:'pin',x:.25,y:.75,body_document:doc('Corregir contorno')});
 await denied(cmd('note.add',task.id,{version_id:version.id,kind:'box',x:.9,y:.9,width:.5,height:.5,body_document:doc('Fuera')}),/constraint/);
 const box=await cmd('note.add',task.id,{version_id:version.id,kind:'box',x:.1,y:.2,width:.3,height:.2,body_document:doc('Revisar área')});eq(box.kind,'box');
 await actor(3);eq(await scalar('select count(*)::int from workspace_private.image_notes where version_id=$1',[version.id]),0);
 await denied(cmd('note.reply',other.id,{note_id:note.id,body_document:doc('Otra edición')}));
 await actor(2);const reply=await cmd('note.reply',task.id,{note_id:note.id,body_document:doc('Lo reviso')});eq(reply.note_id,note.id);
 await cmd('note.resolve',task.id,{note_id:note.id});
 await actor(4);await legacy('review.changes',{unit_id:unit,project_id:p.id,deliverable_id:task.id,body:'Cambios de prueba local'},await revision());
 const png2=await asset(task.id,id(2));await actor(2);const v2=await cmd('version.submit',task.id,{base_version:1,png_asset_id:png2,has_layers:false},0);eq(v2.version_number,2);
 await denied(cmd('note.verify',task.id,{note_id:note.id,verified_version_id:v2.id}));
 await actor(4);const verified=await cmd('note.verify',task.id,{note_id:note.id,verified_version_id:v2.id});eq(verified.verified_version_id,v2.id);
 eq(await scalar('select count(*)::int from workspace_private.image_notes where id=$1',[note.id]),1);
 const newerNote=await cmd('note.add',task.id,{version_id:v2.id,kind:'pin',x:.5,y:.5,body_document:doc('Nota de v2')});
 await denied(cmd('note.verify',task.id,{note_id:newerNote.id,verified_version_id:version.id}),/anterior/);
 await actor(1);await legacy('review.extra_round',{unit_id:unit,project_id:p.id,deliverable_id:task.id,reason:'Otra ronda para comprobar cambio de proporción'},await revision());
 await actor(4);await legacy('review.changes',{unit_id:unit,project_id:p.id,deliverable_id:task.id,body:'Comprobar proporción diferente'},await revision());
 const png3=await asset(task.id,id(2),'png','png','decoded',3000,5000);await actor(2);
 const v3=await cmd('version.submit',task.id,{base_version:2,png_asset_id:png3},0);
 await actor(4);await denied(cmd('note.verify',task.id,{note_id:note.id,verified_version_id:v3.id}),/proporción/);
 const otherVersion=await admin("insert into public.workspace_versions(deliverable_id,version_number,kind,change_summary,author_id) values($1,1,'image','fixture',$2) returning id",[other.id,id(3)]);
 const oid=otherVersion.rows[0].id;await admin("insert into workspace_private.image_versions values($1,$2,'{}','{}',false,false,now())",[oid,other.id]);
 await actor(4);await denied(cmd('note.verify',task.id,{note_id:note.id,verified_version_id:oid}));
 // Authenticated clients cannot declare files validated or acquire original keys.
 await denied(db.query('select * from workspace_private.image_assets'));
 await denied(db.query("insert into workspace_private.image_notes(version_id,author_id,kind,x,y,body_document) values($1,$2,'pin',0,0,$3)",[version.id,id(4),doc('bypass')]));
 // A user outside both assignments cannot read their versions, even by stable ID.
 await actor(6);eq(await scalar('select count(*)::int from workspace_private.image_versions where version_id=$1',[v2.id]),0);
 // Text work remains on its existing command + draft + immutable-version path.
 await actor(1);const text=await legacy('task.create',{unit_id:unit,project_id:p.id,area_id:a,title:'Documento de regresión',responsible_id:id(2)});
 await actor(2);eq(text.kind,'document');const saved=await scalar('select public.workspace_save_draft($1,$2,$3,$4)',[text.id,{editor_version:2,base_version:0,content_document:doc('Texto Cuarzo'),credits:'Autor'},0,0]);eq(Boolean(saved),true);
 const textVersion=await scalar('select public.workspace_submit_draft($1,$2,$3,$4)',[text.id,saved.revision,text.revision,'Regresión Cuarzo']);eq(textVersion.current_version,1);
 await legacy('comment.add',{unit_id:unit,project_id:p.id,deliverable_id:text.id,body_document:doc('Comentario normal')},textVersion.revision);
 eq(await scalar('select count(*)::int from public.workspace_comments where deliverable_id=$1',[text.id]),1);
 await admin('update workspace_private.upload_policy set images_enabled=false where singleton');await actor(4);await denied(cmd('note.reply',task.id,{note_id:note.id,body_document:doc('Disabled')}),/habilitado/);
 await admin('update workspace_private.upload_policy set images_enabled=true where singleton');
 await admin("update public.workspace_unit_memberships set membership_status='suspended' where user_id=$1",[id(4)]);await actor(4);eq(await scalar('select count(*)::int from workspace_private.image_notes where version_id=$1',[version.id]),0);
 await admin('delete from auth.sessions where id=$1',[sid(2)]);await actor(2);await denied(cmd('draft.save',task.id,{base_version:2},0));
 console.log(`PASS: ${checks} Lapislázuli assertions (local database only).`);await db.exec('reset role');return checks;
}
