import fs from 'node:fs/promises';
const file='/private/tmp/workspace-lapis-phase4-secrets.json',cfg=JSON.parse(await fs.readFile(file,'utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy')throw Error('Isolated project required');
const rpc=async(n,name,args)=>{const r=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.sessions[n].access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const b=await r.json();if(!r.ok)throw Error(`${name} ${r.status}: ${b.message}`);return b;};
const command=(action,data,revision=null)=>rpc(1,'workspace_command',{p_action:action,p_data:data,p_revision:revision});
const context=await rpc(1,'workspace_context',{}),unit=context.units.find(x=>x.slug==='gimg')?.id||context.units[0].id;
const project=await command('project.create',{unit_id:unit,title:'Día de Muertos · PRUEBA AISLADA Fase 4'});
const other=await command('project.create',{unit_id:unit,title:'Halloween · PRUEBA AISLADA Fase 4'});
const areas=await fetch(`${cfg.url}/rest/v1/workspace_areas?project_id=eq.${project.id}&select=id,specialty`,{headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.sessions[1].access_token}`}}).then(r=>r.json());
const area=areas.find(a=>a.specialty==='art').id;
for(const [n,role,assignment]of [[2,'gimg_contributor','contributor'],[3,'gimg_area_lead','area_lead'],[5,'gimg_quality_manager','qa']]){
 await command('grant.save',{unit_id:unit,user_id:cfg.sessions[n].user_id,access_role:role,scope_type:'area',scope_id:area,reason:'Prueba aislada Fase 4'});
 await command('assignment.save',{unit_id:unit,user_id:cfg.sessions[n].user_id,assignment_role:assignment,project_id:project.id,area_id:area});
}
let task=await command('task.create',{unit_id:unit,project_id:project.id,area_id:area,title:'Original sintético · piloto aislado',responsible_id:cfg.sessions[2].user_id});
cfg.scenario={unit,project,other,area,task};await fs.writeFile(file,JSON.stringify(cfg),{mode:0o600});console.log(JSON.stringify({prepared:true,project:project.id,other:other.id,task:task.id}));
