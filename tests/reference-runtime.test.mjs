import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'workspace-r2-runtime-'));
const reference='11111111-1111-4111-8111-111111111111';
const originals=new Map(),sessions=new Map();let sequence=0,kind='moodboard';
const descriptor=row=>({...row,policy:{part_bytes:8388608,png_max_bytes:18874368,max_pixels:40000000,max_dimension:32768},parts:row.parts||[],received_bytes:row.received_bytes||0});
const backend=createServer(async(request,response)=>{
 try {
  let input='';for await(const chunk of request)input+=chunk;
  const data=JSON.parse(input);response.setHeader('Content-Type','application/json');
  if((request.headers.authorization!=='Bearer local-runtime-user' && !['workspace_image_file','workspace_image_maintenance'].includes(request.url.split('/').pop())) || data.p_gateway_key!=='local-runtime-gateway'){response.writeHead(403);response.end(JSON.stringify({message:'Sin permiso'}));return;}
  const rpc=request.url.split('/').pop();
  if(rpc==='workspace_image_storage'){
   const d=data.p_data;let row=sessions.get(d.session_id);
   if(data.p_action==='open'){const id=`33333333-3333-4333-8333-${String(++sequence).padStart(12,'0')}`;row={id,state:'reserved',parts:[],expires_at:new Date(Date.now()+86400000).toISOString(),asset:{id,deliverable_id:d.deliverable_id,object_key:`runtime-images/${id}`,mime_type:d.format==='png'?'image/png':'application/octet-stream',...d}};sessions.set(id,row);}
   if(!row)throw Error('Unknown session');
   if(data.p_action==='lock'){row.lease_id=crypto.randomUUID();if(d.operation==='cancel')row.state='cleaning';}
   if(data.p_action==='attach'){row.upload_id=d.upload_id;row.state='receiving';}
   if(data.p_action==='part'){row.parts=row.parts.filter(p=>p.partNumber!==d.part_number);row.parts.push({partNumber:d.part_number,etag:d.etag,size_bytes:d.size_bytes,sha256:d.sha256});row.parts.sort((a,b)=>a.partNumber-b.partNumber);row.received_bytes=row.parts.reduce((n,p)=>n+p.size_bytes,0);}
   if(data.p_action==='verified'){row.state='ready';row.asset.verification=d.verification;}
   if(data.p_action==='failed')row.state='failed';
   response.end(JSON.stringify(descriptor(row)));return;
  }
  if(rpc==='workspace_image_maintenance'){
   if(data.p_action==='cleanup.claim'){const row=[...sessions.values()].find(x=>x.state==='failed'&&(!data.p_data.session_id||x.id===data.p_data.session_id));response.end(JSON.stringify(row?descriptor(row):null));return;}
   if(data.p_action==='cleanup.confirm'){sessions.get(data.p_data.session_id).state='cancelled';response.end('{"cleaned":true}');return;}
   if(data.p_action==='preview.claim'){response.end('null');return;}
   throw Error('Unknown image machine action');
  }
  if(rpc==='workspace_image_file'){
   const d=data.p_data,row=[...sessions.values()].find(x=>x.asset.id===d.asset_id&&x.state==='ready');if(!row){response.writeHead(403);response.end('{"message":"No access"}');return;}
   response.end(JSON.stringify({available:true,asset_id:row.asset.id,file_id:row.asset.id,operation:d.operation,object_key:row.asset.object_key,file_name:row.asset.file_name,mime_type:row.asset.mime_type,size_bytes:row.asset.size_bytes,sha256:row.asset.sha256,user_id:'fixture',session_id:'fixture',ttl:300}));return;
  }
  if(rpc==='workspace_original_gate'){response.end(JSON.stringify({kind,limit:26214400}));return;}
  if(rpc==='workspace_original_begin'){
   const id=`22222222-2222-4222-8222-${String(++sequence).padStart(12,'0')}`;
   const row={id,object_key:`${reference}/${id}`,file_name:data.p_name,mime_type:data.p_mime,size_bytes:data.p_size,sha256:data.p_sha256,status:'reserved'};originals.set(id,row);response.end(JSON.stringify(row));return;
  }
  if(rpc==='workspace_original_finish'){originals.get(data.p_id).status=data.p_success?'ready':'failed';response.end(JSON.stringify({id:data.p_id}));return;}
  if(rpc==='workspace_original_access'){const row=originals.get(data.p_id);if(row?.status!=='ready'){response.writeHead(403);response.end(JSON.stringify({message:'Original no autorizado'}));return;}response.end(JSON.stringify(row));return;}
  throw Error('Unexpected RPC');
 }catch{response.writeHead(500);response.end('{}');}
});
await new Promise(resolve=>backend.listen(0,'127.0.0.1',resolve));
const backendPort=backend.address().port;
async function freePort(){const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));return port;}
const workerPort=await freePort(), inspectorPort=await freePort();
const cli=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','cloudflare/workspace-originals/wrangler.jsonc','--local','--port',String(workerPort),'--inspector-port',String(inspectorPort),'--persist-to',directory,'--show-interactive-dev-session=false','--var',`SUPABASE_URL:http://127.0.0.1:${backendPort}`,'--var','SUPABASE_PUBLISHABLE_KEY:local-public-fixture','--var','GATEWAY_KEY:local-runtime-gateway'],{env:{...process.env,WRANGLER_SEND_METRICS:'false'},stdio:['ignore','pipe','pipe']});
let output='';cli.stdout.on('data',chunk=>output+=chunk);cli.stderr.on('data',chunk=>output+=chunk);
try {
 const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local Worker did not start: '+output.slice(-1500))),30000);const inspect=chunk=>{if(String(chunk).includes('Ready on')){clearTimeout(timer);resolve(true);}};cli.stdout.on('data',inspect);cli.on('exit',code=>{clearTimeout(timer);reject(Error(`Worker stopped (${code}): ${output.slice(-1500)}`));});});
 assert.equal(ready,true);
 const host=`http://127.0.0.1:${workerPort}`;
 const png=await fs.readFile('src-tauri/icons/64x64.png');
 const pdf=Buffer.from('%PDF-1.7\nprivate runtime fixture');
 for(const [bytes,mime,category] of [[png,'image/png','moodboard'],...['concept','creative_direction','moodboard','instructions'].map(k=>[pdf,'application/pdf',k])]){
  kind=category;
  const digest=createHash('sha256').update(bytes).digest('hex');
  const response=await fetch(`${host}/references/${reference}`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user','Content-Type':mime,'X-File-Name':'runtime-fixture','X-File-Size':String(bytes.length),'X-File-Sha256':digest},body:bytes});
  const result=await response.json();assert.equal(response.status,201,JSON.stringify(result));assert.equal(result.sha256,digest);
  const returned=await fetch(`${host}/originals/${result.id}?download=1`,{headers:{Authorization:'Bearer local-runtime-user'}});
  assert.equal(returned.status,200);assert.deepEqual(Buffer.from(await returned.arrayBuffer()),bytes);assert.equal(returned.headers.get('X-Original-Sha256'),digest);
 }
 const invalid=await fetch(`${host}/references/${reference}`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user','Content-Type':'image/png','X-File-Name':'checksum-failure','X-File-Size':String(png.length),'X-File-Sha256':'f'.repeat(64)},body:png});
 assert.equal(invalid.status,502);assert.equal([...originals.values()].at(-1).status,'failed');
 assert.equal((await fetch(`${host}/originals/${[...originals.keys()][0]}`)).status,401);
 // Real workerd + R2 multipart, native DigestStream and light PNG headers.
 for(const [bytes,format]of [[png,'png'],[Buffer.alloc(8388608+333,7),'afphoto']]){
  const digest=createHash('sha256').update(bytes).digest('hex'),headers={Authorization:'Bearer local-runtime-user'};
  const open=await fetch(`${host}/images/uploads`,{method:'POST',headers,body:JSON.stringify({request_id:crypto.randomUUID(),deliverable_id:reference,file_name:`synthetic.${format}`,format,role:format==='png'?'png':'layered',size_bytes:bytes.length,sha256:digest})});const session=await open.json();assert.equal(open.status,201,JSON.stringify(session));assert.equal(JSON.stringify(session).includes('object_key'),false);
  for(let n=1;n<=Math.ceil(bytes.length/8388608);n++){const r=await fetch(`${host}/images/uploads/${session.id}/parts/${n}`,{method:'PUT',headers,body:bytes.subarray((n-1)*8388608,n*8388608)});assert.equal(r.status,200,await r.text());}
  const finish=await fetch(`${host}/images/uploads/${session.id}/complete`,{method:'POST',headers}),done=await finish.json();assert.equal(finish.status,200,JSON.stringify(done));assert.equal(done.verification,format==='png'?'header':'unverified');
  const signed=await fetch(`${host}/images/files/${session.asset_id}/original/link`,{method:'POST',headers}).then(x=>x.json());const dl=await fetch(signed.url);assert.equal(dl.status,200,await dl.clone().text());assert.deepEqual(Buffer.from(await dl.arrayBuffer()),bytes);
  const range=await fetch(signed.url,{headers:{Range:'bytes=4-31'}});assert.equal(range.status,206);assert.equal(range.headers.get('Content-Range'),`bytes 4-31/${bytes.length}`);assert.equal(range.headers.get('Accept-Ranges'),'bytes');assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(4,32));
  const invalidRange=await fetch(signed.url,{headers:{Range:`bytes=${bytes.length}-`}});assert.equal(invalidRange.status,416);
 }
 const corruptOpen=await fetch(`${host}/images/uploads`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user'},body:JSON.stringify({request_id:crypto.randomUUID(),deliverable_id:reference,file_name:'corrupt.png',format:'png',role:'png',size_bytes:png.length,sha256:'f'.repeat(64)})}).then(r=>r.json());
 await fetch(`${host}/images/uploads/${corruptOpen.id}/parts/1`,{method:'PUT',headers:{Authorization:'Bearer local-runtime-user'},body:png});
 const corruptFinish=await fetch(`${host}/images/uploads/${corruptOpen.id}/complete`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user'}});assert.equal(corruptFinish.status,400,await corruptFinish.text());assert.equal(sessions.get(corruptOpen.id).state,'cancelled','Completed multipart abort must allow confirmed invalid-file cleanup');
 const cancel=await fetch(`${host}/images/uploads`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user'},body:JSON.stringify({request_id:crypto.randomUUID(),deliverable_id:reference,file_name:'cancel.afphoto',format:'afphoto',role:'layered',size_bytes:100,sha256:'a'.repeat(64)})}).then(r=>r.json());
 const cancelled=await fetch(`${host}/images/uploads/${cancel.id}`,{method:'DELETE',headers:{Authorization:'Bearer local-runtime-user'}});assert.equal(cancelled.status,200,await cancelled.text());
 console.log('PASS: actual workerd multipart 8 MiB + final part, SHA-256 DigestStream, light PNG headers, opaque layers, signed full/range downloads and invalid/cancelled multipart cleanup.');
 console.log('PASS: actual workerd + private local R2 preserve exact PNG/PDF bytes, validate service SHA-256, reject corruption and deny anonymous reads. No production files or paid resources were used.');
}finally{
 cli.kill('SIGTERM');backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));
 await new Promise(resolve=>{if(cli.exitCode!==null)resolve();else{cli.once('exit',resolve);setTimeout(()=>{cli.kill('SIGKILL');resolve();},2000).unref();}});
 await fs.rm(directory,{recursive:true,force:true});
}
