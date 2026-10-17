import assert from 'node:assert/strict';
export async function runLapisInterfaceAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const admin=async(q,p=[])=>{await db.exec('reset role');return db.query(q,p);};
 const id=n=>`86000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sid=n=>`87000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(n?{sub:id(n),session_id:sid(n)}:{})]);await db.exec(`set role ${n?'authenticated':'anon'}`);};
 const cmd=(a,d,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,d,r]),image=(a,t,d={},r=null)=>scalar('select public.workspace_image_command($1,$2,$3,$4)',[a,t.id,d,r]),bundle=p=>scalar('select public.workspace_image_bundle($1)',[p]);
 await admin('update workspace_private.upload_policy set images_enabled=true,derivatives_enabled=false where singleton');await admin('update workspace_private.original_limits set allocated_bytes=100000000 where singleton');
 const unit=await scalar("select id from public.workspace_units where slug='gimg'");
 for(let n=1;n<=6;n++){await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`phase3-${n}@example.invalid`]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(n),id(n)]);await db.query("insert into public.usuarios(id,rol,nombre,nombre_publico) values($1,'Usuario',$2,$2)",[id(n),`phase3-${n}`]);await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);}
 await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_direction',$2,'unit',$2,'Local Phase3')",[id(1),unit]);
 await actor(1);const project=await cmd('project.create',{unit_id:unit,title:'Phase3 · local A'}),other=await cmd('project.create',{unit_id:unit,title:'Phase3 · local B'});
 const area=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[project.id]),area2=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[other.id]);
 for(const [n,a,p,role]of [[2,area,project.id,'gimg_contributor'],[3,area,project.id,'gimg_area_lead'],[4,area2,other.id,'gimg_contributor'],[5,area,project.id,'gimg_quality_manager'],[6,area,project.id,'gimg_viewer']]){await admin("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,$2,$3,'area',$4,'Phase3')",[id(n),role,unit,a]);await db.query("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by) values($1,'contributor',$2,$3,$4,$5)",[id(n),unit,p,a,id(1)]);}
 await actor(1);let task=await cmd('task.create',{unit_id:unit,project_id:project.id,area_id:area,title:'Imagen de prueba',responsible_id:id(2)}),foreign=await cmd('task.create',{unit_id:unit,project_id:other.id,area_id:area2,title:'Otra edición',responsible_id:id(4)});
 task=await image('spec.save',task,{min_width:5000,min_height:5000,background:'transparent',layer_policy:'if_present',offer_to_documents:true},task.revision);await image('spec.save',foreign,{},foreign.revision);
 eq((await bundle(project.id)).enabled,true);eq((await bundle(project.id)).policy.derivatives_enabled,false);
 const asset=await admin("insert into workspace_private.image_assets(deliverable_id,owner_id,role,object_key,file_name,size_bytes,sha256,mime_type,format,status,verification,width,height) values($1,$2,'png','private-phase3-test','local.png',1000,repeat('b',64),'image/png','png','validated','header',4000,5000) returning id",[task.id,id(2)]).then(x=>x.rows[0].id);
 await actor(3);eq(Object.keys((await bundle(project.id)).assets).includes(asset),false);
 const note={type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Revisar '},{type:'mention',attrs:{id:id(1),label:'Dirección',anchorId:id(90)}}]}]};
 const values={base_version:0,png_asset_id:asset,has_layers:false,note_document:note,client_checks:{sha256:'b'.repeat(64),decoded:true,has_transparency:true,color_profile:'sRGB'}};
 await actor(2);await image('draft.save',task,values,0);eq(await admin("select count(*)::int from workspace_private.notifications where recipient_id=$1 and image_version_id is not null",[id(1)]).then(x=>x.rows[0].count),0);
 await actor(2);const version=await image('version.submit',task,values,1);eq(version.kind,'image');
 let b=await bundle(project.id);eq(b.assets[asset].verification,'header');eq(JSON.stringify(b).includes('object_key'),false);eq(b.versions[version.id].quality.all_passed,false);eq(b.versions[version.id].quality.checks.find(c=>c.key==='dimensions').passed,false);
 await bad(image('note.add',task,{version_id:version.id,kind:'general',body_document:note}),/quienes revisan/);
 await actor(4);await bad(bundle(project.id),/acceso/);await bad(image('note.reply',task,{note_id:id(99),body_document:note}),/acceso/);
 await actor(3);const general=await image('note.add',task,{version_id:version.id,kind:'general',body_document:note});eq(general.x,0);eq(general.y,0);
 await actor(2);await image('note.reply',task,{note_id:general.id,body_document:note});await bad(image('note.resolve',task,{note_id:general.id}),/quien publicó/);
 await actor(1);const inbox=await scalar('select public.workspace_notifications()');const mention=inbox.items.find(n=>n.event_type==='mention'&&n.deliverable_id===task.id);eq(Boolean(mention),true);const target=await scalar('select public.workspace_read_notification($1)',[mention.id]);eq(target.image_version_id,version.id);
 const anchored=await admin("select id from workspace_private.notifications where recipient_id=$1 and image_note_id=$2 order by created_at limit 1",[id(1),general.id]).then(x=>x.rows[0].id);await actor(1);eq((await scalar('select public.workspace_read_notification($1)',[anchored])).image_note_id,general.id);
 await actor(3);await image('note.resolve',task,{note_id:general.id,resolved:true});
 // A spec edit during review changes only future submissions.
 const before=await scalar('select spec_snapshot from workspace_private.image_versions where version_id=$1',[version.id]);
 task=await image('spec.save',task,{min_width:2000,min_height:2000,background:'any',offer_to_documents:true},await scalar('select revision from public.workspace_deliverables where id=$1',[task.id]));eq(await scalar('select spec_snapshot from workspace_private.image_versions where version_id=$1',[version.id]),before);
 await bad(image('spec.save',task,{kind:'document'},task.revision),/contiene imágenes/);
 task=await cmd('task.transition',{project_id:project.id,deliverable_id:task.id,state:'area_approved'},task.revision);
 eq(await admin('select count(*)::int n from workspace_private.image_approval_warnings where version_id=$1',[version.id]).then(x=>x.rows[0].n),1);await actor(3);
 eq((await scalar('select public.workspace_edition_documents($1)',[project.id])).some(d=>d.deliverable_id===task.id),false);
 task=await cmd('task.transition',{project_id:project.id,deliverable_id:task.id,state:'in_qa'},task.revision);
 await actor(5);task=await cmd('task.transition',{project_id:project.id,deliverable_id:task.id,state:'qa_approved'},task.revision);
 await actor(2);await bad(cmd('publication.approve',{project_id:project.id,deliverable_id:task.id},task.revision),/permiso|autoridad/);
 await actor(1);task=await cmd('publication.approve',{project_id:project.id,deliverable_id:task.id},task.revision);eq(task.final_approved_by,id(1));
 task=await cmd('review.reopen',{project_id:project.id,deliverable_id:task.id,reason:'Local reopen for image second version'},task.revision);eq(task.state,'in_progress');
 task=await cmd('qa.block',{project_id:project.id,deliverable_id:task.id,reason:'Local critical issue for regression'},task.revision);eq(task.qa_blocked,true);
 task=await cmd('qa.release',{project_id:project.id,deliverable_id:task.id,reason:'Local correction verified for regression'},task.revision);eq(task.qa_blocked,false);
 await bad(admin('update workspace_private.image_notes set body_document=$1 where id=$2',[note,general.id]),/inmutable/);
 await actor(2);await image('draft.save',task,{...values,base_version:1},0);let second=await image('version.submit',task,{...values,base_version:1},1);eq(second.version_number,2);
 await actor(3);await image('note.verify',task,{note_id:general.id,verified_version_id:second.id,resolved:true});eq((await bundle(project.id)).resolutions.some(r=>r.note_id===general.id&&r.verified_version_id===second.id),true);
 await admin("update public.workspace_unit_memberships set membership_status='suspended' where user_id=$1",[id(3)]);await actor(3);await bad(bundle(project.id),/acceso/);
 await actor(0);await bad(bundle(project.id),/permission/);
 await admin('update workspace_private.upload_policy set images_enabled=false where singleton');
 console.log(`PASS: ${checks} Phase 3 RBAC, notes, anchored mentions, private drafts, header validation, immutable quality and unchanged editorial chain (local only).`);return checks;
}
