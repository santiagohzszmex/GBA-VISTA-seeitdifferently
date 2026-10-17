import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function runLapisPilotAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=async(p,re=/no están habilitadas/)=>{await assert.rejects(p,re);checks++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const admin=async(q,p=[])=>{await db.exec('reset role');return db.query(q,p);};
 const uid='86000000-0000-4000-8000-000000000001',sid='87000000-0000-4000-8000-000000000001';
 const actor=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,session_id:sid})]);await db.exec('set role authenticated');};
 await admin('select 1');await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261017130000_workspace_lapis_pilot_allowlist.sql',import.meta.url),'utf8'));
 const old=(await db.query("select t.* from public.workspace_deliverables t where t.created_by=$1 and t.kind='image' and t.current_version=2 limit 1",[uid])).rows[0];
 const other=(await db.query("select a.* from public.workspace_areas a where a.project_id<>$1 and a.specialty='art' limit 1",[old.project_id])).rows[0];
 const count=await scalar('select count(*)::int from workspace_private.image_assets');
 await admin('update workspace_private.upload_policy set images_enabled=true where singleton');
 await actor();
 const cmd=(a,d,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,d,r]);
 const image=(t)=>scalar("select public.workspace_image_command('spec.save',$1,'{}',$2)",[t.id,t.revision]);
 const fresh=await cmd('task.create',{unit_id:old.unit_id,project_id:old.project_id,area_id:old.area_id,title:'Pilot allowed',responsible_id:old.responsible_id});
 const foreign=await cmd('task.create',{unit_id:old.unit_id,project_id:other.project_id,area_id:other.id,title:'Pilot forbidden',responsible_id:uid});
 await bad(image(fresh));
 await admin('update workspace_private.upload_policy set image_project_ids=array[$1::uuid] where singleton',[old.project_id]);await actor();
 const task=await image(fresh);eq(task.kind,'image');await bad(image(foreign));
 eq((await scalar('select public.workspace_image_bundle($1)',[old.project_id])).uploads_enabled,true);
 // Reject a direct type conversion even from a path outside image_command.
 await bad(admin("update public.workspace_deliverables set kind='image' where id=$1",[foreign.id]));
 // Opening and resuming are both gated; status/cancel/reads are retained.
 await admin('update workspace_private.upload_policy set image_project_ids=\'{}\' where singleton');await actor();
 await bad(scalar("select public.workspace_image_command('draft.save',$1,'{}',0)",[task.id]));
 await bad(scalar("select public.workspace_image_command('version.submit',$1,'{}',0)",[task.id]));
 await bad(scalar("select public.workspace_image_storage('open',$1,'local-phase2-only')",[{deliverable_id:task.id}]));
 const retained=await scalar('select public.workspace_image_bundle($1)',[old.project_id]);
 eq(retained.enabled,true);eq(retained.uploads_enabled,false);eq(Object.keys(retained.versions).length>=2,true);eq(Object.keys(retained.assets).length>0,true);
 await admin('select 1');eq(await scalar('select count(*)::int from workspace_private.image_assets'),count);
 eq(await scalar("select has_function_privilege('authenticated','workspace_private.image_storage_before_pilot(text,jsonb,text)','execute')"),false);
 eq(await scalar("select has_function_privilege('anon','public.workspace_image_command(text,uuid,jsonb,integer)','execute')"),false);
 console.log(`PASS: ${checks} pilot allowlist assertions (local SQL), retained files and ACL.`);return checks;
}
