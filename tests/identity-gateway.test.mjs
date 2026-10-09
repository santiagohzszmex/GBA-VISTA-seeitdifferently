import assert from 'node:assert/strict';
import { createIdentityHandler } from '../api/gba-id.js';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const env={SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',VERCEL:'1'};
function setup({answer={user_id:'user-1',email:'person@gba.com'},rpcError=null,sessionError=null,linkUser='user-1',createError=null}={}){
 const calls=[],deleted=[];const client={rpc:async(name,args)=>{calls.push(args);return args.p_action==='prepare'?{data:{prepared:true},error:rpcError}:{data:answer,error:rpcError};},auth:{admin:{createUser:async()=>({data:{user:{id:'user-1'}},error:createError}),deleteUser:async id=>deleted.push(id),generateLink:async()=>({data:{properties:{hashed_token:'hash'},user:{id:linkUser}},error:null})},verifyOtp:async()=>({data:{session:{access_token:'access',refresh_token:'refresh'}},error:sessionError})}};
 const handler=createIdentityHandler({env,makeClient:()=>client,random:()=>Buffer.alloc(32,1)});
 async function run(body={action:'login',handle:'person',pin:'1234',device:'12345678-1234-1234'},headers={origin:'https://gba.software','x-vercel-forwarded-for':'10.0.0.1','x-forwarded-for':'spoofed'},method='POST'){
  const result={headers:{},status:0,body:null};const response={setHeader(k,v){result.headers[k]=v;},status(s){result.status=s;return response;},json(b){result.body=b;return response;},end(){return response;}};await handler({method,body,headers,socket:{remoteAddress:'127.0.0.1'}},response);return result;
 }return {run,calls,deleted};
}
{
 const t=setup();const r=await t.run();eq(r.status,200);eq(r.body.session,{access_token:'access',refresh_token:'refresh'});eq(t.calls[0].p_origin.includes('spoofed'),false);eq(r.headers['Cache-Control'],'no-store');eq('email' in r.body,false);
}
{
 const t=setup();eq((await t.run(undefined,{origin:'https://evil.example'})).status,403);eq(t.calls.length,0);eq((await t.run({action:'login',handle:'person',pin:'12',device:'12345678-1234-1234'})).status,400);eq(t.calls.length,0);eq((await t.run(undefined,undefined,'GET')).status,405);
}
{
 const t=setup({answer:{error:'Espera',retry_after:60}});const r=await t.run();eq(r.status,429);eq(r.headers['Retry-After'],'60');eq(r.body.session,undefined);
}
{
 const t=setup({linkUser:'wrong'});eq((await t.run()).status,503);eq((await t.run()).body.session,undefined);
}
{
 const t=setup();eq((await t.run({action:'register',handle:'person',pin:'1234',device:'12345678-1234-1234',recovery:'a long private phrase'})).status,200);eq(t.calls.map(x=>x.p_action),['prepare','register']);eq(t.calls[1].p_user_id,'user-1');
}
{
 const t=setup({answer:{error:'Initialization failed'}});eq((await t.run({action:'register',handle:'person',pin:'1234',device:'12345678-1234-1234',recovery:'private phrase'})).status,401);eq(t.deleted,['user-1']);
}
console.log(`PASS: ${checks} identity gateway assertions: server IP, origin, validation, throttling, tokens, correct account and registration cleanup.`);
for(const origin of ['https://vista.gba.software','tauri://localhost','http://tauri.localhost','https://tauri.localhost']) {
 const t=setup();const preflight=await t.run(undefined,{origin},'OPTIONS');
 eq(preflight.status,204);eq(preflight.headers['Access-Control-Allow-Origin'],origin);eq(t.calls.length,0);
 const login=await t.run(undefined,{origin});eq(login.status,200);eq(login.headers['Access-Control-Allow-Origin'],origin);
}
for(const origin of ['null','https://tauri.localhost.evil.example','http://localhost:1420']) eq((await setup().run(undefined,{origin})).status,403);
console.log(`PASS: ${checks} total gateway assertions including VISTA and native CORS preflights.`);
