import assert from 'node:assert/strict';
import {createPushHandler,validPushEndpoint} from '../api/workspace-push.js';
// Servicio de envío de avisos de Workspace (servidor de gba.software). El cliente y el trabajador se prueban en el repo gba-workspace.
for(const host of ['https://fcm.googleapis.com/fcm/send/valid','https://web.push.apple.com/x','https://a.push.apple.com/x','https://updates.push.services.mozilla.com/x','https://wns2.notify.windows.com/x'])assert.equal(validPushEndpoint(host),true,host);
for(const host of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.example/x','https://evil.push.apple.com.evil.example/x','https://web.push.apple.com@127.0.0.1/x','https://127.0.0.1/x','https://fcm.googleapis.com:8080/x','file:///etc/passwd'])assert.equal(validPushEndpoint(host),false,host);
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only',WORKSPACE_VAPID_PUBLIC_KEY:'public',WORKSPACE_VAPID_PRIVATE_KEY:'private'};
const token='a'.repeat(64);const request=(method='POST',auth=`Bearer ${token}`)=>({method,headers:{authorization:auth}});
const response=()=>({code:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(body){this.body=body;return this;}});
let apiCalls=[],payloads=[],simultaneous=0,max=0;
const jobs=Array.from({length:14},(_,i)=>({id:`job${i}`,owner:'owner',notificationId:'notice',subscription:{endpoint:i===1?'https://127.0.0.1/':'https://fcm.googleapis.com/x'}}));
const handler=createPushHandler({env,makeClient:()=>({rpc:async(name,args)=>{apiCalls.push({name,args});return {data:name==='workspace_push_batch'?jobs:null};}}),send:async(sub,payload,options)=>{simultaneous++;max=Math.max(max,simultaneous);await new Promise(r=>setTimeout(r,1));payloads.push({payload:JSON.parse(payload),options});simultaneous--;}});
let res=response();await handler(request('POST','bad'),res);assert.equal(res.code,401);assert.equal(apiCalls.length,0);
res=response();await handler(request('GET'),res);assert.deepEqual(res.body,{enabled:true,publicKey:'public'});assert.equal(JSON.stringify(res.body).includes('private'),false);
res=response();await handler(request(),res);assert.equal(res.code,200);assert.equal(res.body.processed,12);assert.equal(payloads.length,11);assert.equal(max,3);assert.equal(apiCalls.filter(c=>c.name==='workspace_push_result').length,12);assert.equal(payloads.some(x=>x.payload.title||x.payload.body||x.payload.url),false);assert.equal(payloads[0].options.TTL,3600);
res=response();await createPushHandler({env,makeClient:()=>({rpc:async()=>({error:{code:'42501'}})})})(request(),res);assert.equal(res.code,401);
res=response();await createPushHandler({env,makeClient:()=>{throw Error('private stack');}})(request(),res);assert.equal(res.code,503);assert.equal(JSON.stringify(res.body).includes('private stack'),false);
let dead;res=response();await createPushHandler({env,makeClient:()=>({rpc:async(n,a)=>{if(n==='workspace_push_result')dead=a.p_status;return {data:n==='workspace_push_batch'?[jobs[0]]:null};}}),send:async()=>{throw {statusCode:410};}})(request(),res);assert.equal(dead,410);
console.log('PASS: push gate, SSRF endpoint validation, batch, concurrency and retry of the Workspace push service.');
