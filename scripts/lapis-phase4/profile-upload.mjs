import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createImageUploader} from '../../src/workspace/imageUploadClient.mjs';
const cfg=JSON.parse(await fs.readFile('/private/tmp/workspace-lapis-phase4-secrets.json','utf8')),auth=JSON.parse(await fs.readFile('/private/tmp/workspace-lapis-phase4-cloudflare-auth.json','utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy')throw Error('Isolated test only');
const results=[];
for(const name of ['original.png','near-limit.png']){
 const bytes=await fs.readFile(`/private/tmp/workspace-lapis-phase3-fixtures/${name}`),file=new File([bytes],`SYNTHETIC-profile-${name}`,{type:'image/png'});let profile;
 const uploader=createImageUploader({gateway:cfg.gateway_url,authorization:async()=>`Bearer ${cfg.sessions[2].access_token}`,hashFile:async f=>createHash('sha256').update(Buffer.from(await f.arrayBuffer())).digest('hex'),fetcher:async(url,o)=>{
  const complete=new URL(url).pathname.endsWith('/complete'),start=performance.now();
  if(complete)profile=fetch('https://api.cloudflare.com/client/v4/accounts/4334afb560574c76fa5054127dcd9b0b/workers/workers/workspace-lapis-phase4-test/versions/d4c8b68a-ae84-44c0-aa1d-1534b3a2f0de/profile',{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({duration_ms:5000,profile_type:'cpu'})});
  const r=await fetch(url,o);if(complete)results.push({file:name,bytes:bytes.length,status:r.status,completionWallMs:Number((performance.now()-start).toFixed(1))});return r;
 }});
 const plan=await uploader.prepare(file,{ownerId:cfg.sessions[2].user_id,deliverableId:cfg.scenario.task.id,role:'png',format:'png'});
 const out=await uploader.upload(plan,file,{ownerId:cfg.sessions[2].user_id});
 const p=await profile;if(!p.ok){results.at(-1).profileStatus=p.status;}else{const raw=Buffer.from(await p.arrayBuffer());await fs.writeFile(`/private/tmp/workspace-lapis-phase4-${name}.pprof`,raw);results.at(-1).profileBytes=raw.length;}
 results.at(-1).verification=out.verification;
}
await fs.writeFile('docs/workspace/phase4/worker-upload-profile.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
