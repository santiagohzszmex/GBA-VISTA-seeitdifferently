import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createImageUploader} from '../../src/workspace/imageUploadClient.mjs';
const cfg=JSON.parse(await fs.readFile('/private/tmp/workspace-lapis-phase4-secrets.json','utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy'||cfg.gateway_url!=='https://workspace-lapis-phase4-test.gba-vista.workers.dev')throw Error('Isolated test only');
const rpc=async(name,args)=>{const r=await fetch(`${cfg.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.sessions[1].access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args)});const b=await r.json();if(!r.ok)throw Error(b.message);return b;};
const results=await fs.readFile('/private/tmp/workspace-lapis-cpu-ab-results.json','utf8').then(JSON.parse).catch(()=>[]);
// Interleave A/B at each size, three repetitions. No real collaborator data.
for(let rep=1;rep<=3;rep++)for(const [size,name] of [['typical','original.png'],['limit','near-limit.png']])for(const variant of ['A','B']){
 const trial=`${variant}-${size}-${rep}`;if(results.some(x=>x.trial===trial))continue;const bytes=await fs.readFile(`/private/tmp/workspace-lapis-phase3-fixtures/${name}`),file=new File([bytes],`SYNTHETIC-${trial}.png`,{type:'image/png'});
 let task=await rpc('workspace_command',{p_action:'task.create',p_data:{unit_id:cfg.scenario.unit,project_id:cfg.scenario.project.id,area_id:cfg.scenario.area,title:`SYNTHETIC CPU ${trial}`,responsible_id:cfg.sessions[2].user_id},p_revision:null});
 task=await rpc('workspace_image_command',{p_action:'spec.save',p_deliverable_id:task.id,p_data:{layer_policy:'if_present'},p_revision:task.revision});
 const events=[];
 const uploader=createImageUploader({gateway:cfg.gateway_url,authorization:async()=>`Bearer ${cfg.sessions[2].access_token}`,hashFile:async f=>createHash('sha256').update(Buffer.from(await f.arrayBuffer())).digest('hex'),fetcher:async(url,options)=>{
  const start=performance.now(),r=await fetch(url,{...options,headers:{...options.headers,'X-Lapis-Variant':variant,'X-Lapis-Trial':trial}});
  events.push({phase:options.method==='PUT'?'part':String(url).endsWith('/complete')?'complete':'open',started_at:new Date(Date.now()-(performance.now()-start)).toISOString(),wall_ms:Math.round(performance.now()-start),status:r.status});return r;
 }});
 const plan=await uploader.prepare(file,{ownerId:cfg.sessions[2].user_id,deliverableId:task.id,role:'png',format:'png'});
 const out=await uploader.upload(plan,file,{ownerId:cfg.sessions[2].user_id});
 results.push({trial,bytes:bytes.length,task_id:task.id,asset_id:out.asset_id,verification:out.verification,events});
 await fs.writeFile('/private/tmp/workspace-lapis-cpu-ab-results.json',JSON.stringify(results,null,2),{mode:0o600});
 console.log(JSON.stringify({trial,bytes:bytes.length,events}));
}
