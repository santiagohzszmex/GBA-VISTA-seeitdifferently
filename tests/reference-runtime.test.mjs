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
const originals=new Map();let sequence=0;
const backend=createServer(async(request,response)=>{
 try {
  let input='';for await(const chunk of request)input+=chunk;
  const data=JSON.parse(input);response.setHeader('Content-Type','application/json');
  if(request.headers.authorization!=='Bearer local-runtime-user' || data.p_gateway_key!=='local-runtime-gateway'){response.writeHead(403);response.end(JSON.stringify({message:'Sin permiso'}));return;}
  const rpc=request.url.split('/').pop();
  if(rpc==='workspace_original_gate'){response.end(JSON.stringify({kind:'moodboard',limit:26214400}));return;}
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
 for(const [bytes,mime] of [[png,'image/png'],[pdf,'application/pdf']]){
  const digest=createHash('sha256').update(bytes).digest('hex');
  const response=await fetch(`${host}/references/${reference}`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user','Content-Type':mime,'X-File-Name':'runtime-fixture','X-File-Size':String(bytes.length),'X-File-Sha256':digest},body:bytes});
  const result=await response.json();assert.equal(response.status,201,JSON.stringify(result));assert.equal(result.sha256,digest);
  const returned=await fetch(`${host}/originals/${result.id}?download=1`,{headers:{Authorization:'Bearer local-runtime-user'}});
  assert.equal(returned.status,200);assert.deepEqual(Buffer.from(await returned.arrayBuffer()),bytes);assert.equal(returned.headers.get('X-Original-Sha256'),digest);
 }
 const invalid=await fetch(`${host}/references/${reference}`,{method:'POST',headers:{Authorization:'Bearer local-runtime-user','Content-Type':'image/png','X-File-Name':'checksum-failure','X-File-Size':String(png.length),'X-File-Sha256':'f'.repeat(64)},body:png});
 assert.equal(invalid.status,502);assert.equal([...originals.values()].at(-1).status,'failed');
 assert.equal((await fetch(`${host}/originals/${[...originals.keys()][0]}`)).status,401);
 console.log('PASS: actual workerd + private local R2 preserve exact PNG/PDF bytes, validate service SHA-256, reject corruption and deny anonymous reads. No production files or paid resources were used.');
}finally{
 cli.kill('SIGTERM');backend.closeAllConnections();await new Promise(resolve=>backend.close(resolve));
 await new Promise(resolve=>{if(cli.exitCode!==null)resolve();else{cli.once('exit',resolve);setTimeout(()=>{cli.kill('SIGKILL');resolve();},2000).unref();}});
 await fs.rm(directory,{recursive:true,force:true});
}
