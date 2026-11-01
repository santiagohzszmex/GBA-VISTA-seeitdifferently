import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function runClosedEditionAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=async(p,re=/edición está cerrada/)=>{await assert.rejects(p,re);checks++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const uid='86000000-0000-4000-8000-000000000001',sid='87000000-0000-4000-8000-000000000001';
 const admin=async()=>db.exec('reset role'),actor=async()=>{await admin();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid,session_id:sid})]);await db.exec('set role authenticated');};
 await admin();await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101183053_workspace_closed_editions.sql',import.meta.url),'utf8'));
 const project=(await db.query("select * from public.workspace_projects where created_by=$1 and title='Phase3 · local A'",[uid])).rows[0];
 const image=(await db.query("select * from public.workspace_deliverables where project_id=$1 and kind='image' and current_version>0 limit 1",[project.id])).rows[0];
 // Existing local fixtures only. No acceptance test executes against production.
 await db.exec('update workspace_private.upload_policy set images_enabled=true,images_all_projects=true');
 await actor();const command=(a,d,r=null)=>scalar('select public.workspace_command($1,$2,$3)',[a,d,r]);
 const before=await scalar('select public.workspace_image_bundle($1)',[project.id]);eq(before.uploads_enabled,true);
 let closed=await command('project.save',{project_id:project.id,title:project.title,brief:project.brief,status:'closed',starts_at:project.starts_at,ends_at:project.ends_at},project.revision);eq(closed.status,'closed');
 const after=await scalar('select public.workspace_image_bundle($1)',[project.id]);eq(after.uploads_enabled,false);eq(after.versions,before.versions);eq(after.assets,before.assets);
 await admin();await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid.replace(/1$/,'4'),session_id:sid.replace(/1$/,'4')})]);await db.exec('set role authenticated');await bad(scalar('select public.workspace_image_bundle($1)',[project.id]),/acceso/);await bad(command('project.save',{project_id:project.id,title:project.title,status:'active'},closed.revision),/permiso|acceso/i);await actor();
 for(const action of ['spec.save','draft.save','version.submit','note.add','note.reply','note.resolve','review.approve'])await bad(scalar('select public.workspace_image_command($1,$2,$3,null)',[action,image.id,{}]));
 await bad(scalar("select public.workspace_image_storage('open',$1,'local-phase2-only')",[{deliverable_id:image.id}]));
 await admin();
 // Exercise every registered trigger boundary even for tables with no existing row:
 // the BEFORE trigger must reject first, before FK/not-null/duplicate constraints.
 const triggers=(await db.query("select n.nspname as s,c.relname as t,encode(t.tgargs,'escape') as args,t.tgtype::int as kind from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where t.tgname='closed_edition_write' order by 1,2")).rows;
 const keyFor={project:project.id,task:image.id,version:null,reference:null,support:null,note:null,comment:null,asset:null};
 keyFor.version=await scalar('select id from public.workspace_versions where deliverable_id=$1 limit 1',[image.id]);
 for(const [rel,table]of [['reference','edition_references'],['support','support_documents']])keyFor[rel]=await scalar(`select id from workspace_private.${table} where project_id=$1 limit 1`,[project.id]).catch(()=>null);
 keyFor.note=await scalar('select id from workspace_private.image_notes where version_id=$1 limit 1',[keyFor.version]).catch(()=>null);
 keyFor.asset=await scalar('select id from workspace_private.image_assets where deliverable_id=$1 limit 1',[image.id]);
 keyFor.comment=await scalar('select id from public.workspace_comments where deliverable_id=$1 limit 1',[image.id]).catch(()=>null);
 let boundaries=0;
 for(const r of triggers){const [rel,key]=r.args.split('\\000');const value=keyFor[rel];if(!value)continue;
  await bad(db.query(`insert into ${r.s}.${r.t} (${key}) values($1)`,[value]));boundaries++;
  if((r.kind&16)&&await scalar(`select count(*)::int from ${r.s}.${r.t} where ${key}=$1`,[value])){await bad(db.query(`update ${r.s}.${r.t} set ${key}=${key} where ${key}=$1`,[value]));await bad(db.query(`delete from ${r.s}.${r.t} where ${key}=$1`,[value]));}
 }
 eq(boundaries>=20,true);
 eq(await scalar("select has_function_privilege('authenticated','workspace_private.require_open_project(uuid)','execute')"),false);
 eq(await scalar("select has_function_privilege('anon','workspace_private.guard_closed_editorial_write()','execute')"),false);
 await actor();const reopened=await command('project.save',{project_id:project.id,title:project.title,brief:project.brief,status:'active',starts_at:project.starts_at,ends_at:project.ends_at},closed.revision);eq(reopened.status,'active');
 eq((await scalar('select public.workspace_image_bundle($1)',[project.id])).uploads_enabled,true);
 await admin();await db.query('update public.workspace_deliverables set title=title where id=$1',[image.id]);checks++;
 await actor();closed=await command('project.save',{project_id:project.id,title:project.title,brief:project.brief,status:'archived'},reopened.revision);eq(closed.status,'archived');await admin();await bad(db.query('update public.workspace_deliverables set title=title where id=$1',[image.id]));
 await actor();await command('project.save',{project_id:project.id,title:project.title,brief:project.brief,status:'active'},closed.revision);
 await admin();console.log(`PASS: ${checks} closed-edition assertions, ${boundaries} write boundaries, retained images and authorized reopening.`);return checks;
}
