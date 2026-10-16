import assert from 'node:assert/strict';
import fs from 'node:fs';
export async function runCoordinationScopeAcceptance(db) {
  await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261016113804_workspace_lapis_coordination_scope.sql',import.meta.url),'utf8'));
  let checks=0;
  const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
  const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
  await db.exec('reset role;begin');
  try {
    const user='81000000-0000-4000-8000-000000000001', session='81000000-0000-4000-8000-000000000002';
    const unit=await scalar("select id from public.workspace_units where slug='gimg'");
    await db.query('insert into auth.users(id,email) values($1,$2)',[user,'coordination-lapis@example.invalid']);
    await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
    await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,user]);
    await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_workspace_coordinator',$2,'unit',$2,'Local coordination scope test')",[user,unit]);
    const projects=[];
    for(const title of ['Día de Muertos · prueba local','Halloween · prueba local']) {
      const p=await scalar('insert into public.workspace_projects(unit_id,title,created_by) values($1,$2,$3) returning id',[unit,title,user]);
      const area=await scalar("insert into public.workspace_areas(unit_id,project_id,name,specialty) values($1,$2,'Arte','art') returning id",[unit,p]);
      const task=await scalar("insert into public.workspace_deliverables(unit_id,project_id,area_id,title,created_by) values($1,$2,$3,'Ilustración',$4) returning id",[unit,p,area,user]);
      projects.push({p,area,task});
    }
    await db.query("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,assigned_by,starts_at) values($1,'production',$2,$3,$1,now()-interval '1 day')",[user,unit,projects[0].p]);
    const asActor=async()=>{await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,session_id:session})]);await db.exec('set role authenticated');};
    await asActor();
    for(let i=0;i<projects.length;i++) {
      const x=projects[i];
      for(const key of ['project.read','task.read','content.read']) eq(await scalar('select workspace_private.allowed($1,$2,$3,$4,$5)',[key,unit,x.p,x.area,x.task]),i===0);
      eq(await scalar('select count(*)::int from public.workspace_deliverables where id=$1',[x.task]),i===0?1:0);
      eq(await scalar('select workspace_private.can_read_project($1)',[x.p]),i===0);
    }
    eq(await scalar("select workspace_private.allowed('review.approve_art',$1,$2,$3,$4)",[unit,projects[0].p,projects[0].area,projects[0].task]),false);
    await db.exec('reset role');await db.query('update public.workspace_assignments set expires_at=now()-interval \'1 second\' where user_id=$1',[user]);await asActor();
    eq(await scalar('select count(*)::int from public.workspace_deliverables where id=$1',[projects[0].task]),0);
    await db.exec('reset role');await db.query('update public.workspace_assignments set expires_at=null where user_id=$1',[user]);await db.query("update public.workspace_unit_memberships set membership_status='suspended' where user_id=$1",[user]);await asActor();
    eq(await scalar('select workspace_private.can_read_project($1)',[projects[0].p]),false);
  } finally {await db.exec('rollback;reset role');}
  return checks;
}
