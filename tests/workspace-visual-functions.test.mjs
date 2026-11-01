import assert from 'node:assert/strict';import fs from 'node:fs';
export async function runVisualFunctionsAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const uid=n=>`86000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sid=n=>`87000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:uid(n),session_id:sid(n)})]);await db.exec('set role authenticated');};
 await db.exec('reset role');const before=await scalar('select workspace_private.cargo_catalog()');const matrix=await scalar('select jsonb_agg(to_jsonb(r) order by role,permission) from workspace_private.role_permissions r');
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261101193756_workspace_visual_functions.sql',import.meta.url),'utf8'));
 const after=await scalar('select workspace_private.cargo_catalog()');eq(after.map(c=>c.key),before.map(c=>c.key));eq(after.filter(c=>c.key!=='contributor'),before.filter(c=>c.key!=='contributor'));eq(await scalar('select jsonb_agg(to_jsonb(r) order by role,permission) from workspace_private.role_permissions r'),matrix);
 const unit=await scalar("select id from public.workspace_units where slug='gimg'");await actor(1);const project=await scalar("select public.workspace_command('project.create',$1,null)",[{unit_id:unit,title:'Local new visual functions'}]);
 for(const key of ['video_editing','animation_2d','animation_3d']){
  const grant=await scalar("select public.workspace_people_action($1,'assign',$2)",[unit,{userId:uid(2),cargoKey:'contributor',projectId:project.id,functionKey:key,reason:'Local function acceptance'}]);eq(Boolean(grant.id),true);
 }
 await db.exec('reset role');const rows=(await db.query('select a.function_key,a.assignment_role,g.access_role,ar.specialty from public.workspace_assignments a join public.workspace_access_grants g on g.id=a.grant_id join public.workspace_areas ar on ar.id=a.area_id where a.project_id=$1 order by a.function_key',[project.id])).rows;
 eq(rows.length,3);eq(rows.every(r=>r.access_role==='gimg_contributor'&&r.specialty==='art'),true);eq(rows.map(r=>r.function_key),['animation_2d','animation_3d','video_editing']);
 await actor(2);const perms=await scalar('select public.workspace_permissions($1,$2,$3)',[unit,project.id,(await db.query('select id from public.workspace_areas where project_id=$1 and specialty=\'art\'',[project.id])).rows[0].id]);eq(perms['unit.roles.grant'],false);eq(perms['publication.approve_final'],false);eq(perms['task.assign'],false);
 await assert.rejects(scalar("select public.workspace_people_action($1,'assign',$2)",[unit,{userId:uid(2),cargoKey:'direction',reason:'Escalation attempt'}]),/permiso|Dirección|autoriza/i);checks++;
 await db.exec('reset role');eq(await scalar("select has_function_privilege('authenticated','workspace_private.cargo_catalog()','execute')"),false);
 console.log(`PASS: ${checks} visual function checks: assign all profiles, same area/role, unchanged matrix, no escalation.`);return checks;
}
