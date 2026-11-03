// Real GoTrue/PostgREST/Postgres test, strictly limited to the pre-authorized isolated project.
import fs from 'node:fs';import {createServer} from 'node:http';import {generateKeyPairSync,randomUUID,randomBytes,createHmac} from 'node:crypto';import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';import {createSepiaHandler} from '../../server/sepia/service.mjs';import {createIdentityHandler} from '../../api/gba-id.js';import {CONTRACT,ORIGIN,validateOffline} from '../../server/sepia/protocol.mjs';
const file=process.env.SEPIA_STAGING_CONFIG||'/private/tmp/sepia-access-staging-private.json',cfg=JSON.parse(fs.readFileSync(file,'utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy'||cfg.url!=='https://ojlcttpqkyktqpqybbdy.supabase.co'||cfg.users?.length<3||cfg.users.some(u=>!u.handle.startsWith('sepia-test-')))throw Error('Isolated fixtures only');
const evidence=JSON.parse(fs.readFileSync('/private/tmp/sepia-auth-policy-evidence.json','utf8'))[cfg.project];
if(!['sessions_timebox','sessions_inactivity_timeout','sessions_single_per_user'].every(k=>k in evidence))throw Error('Verified Auth policy required');
const {privateKey,publicKey}=generateKeyPairSync('ed25519'),jwk={...publicKey.export({format:'jwk'}),kid:'isolated-ephemeral',alg:'Ed25519',use:'sig'};
const env={NODE_ENV:'test',SEPIA_ACCESS_ENABLED:'1',SEPIA_AUTH_POLICY_VERIFIED:'1',SEPIA_AUTH_TIMEBOX_SECONDS:String(evidence.sessions_timebox),SEPIA_AUTH_INACTIVITY_SECONDS:String(evidence.sessions_inactivity_timeout),SEPIA_AUTH_SINGLE_SESSION:evidence.sessions_single_per_user?'1':'0',SUPABASE_URL:cfg.url,SUPABASE_SERVICE_ROLE_KEY:cfg.service,SUPABASE_ANON_KEY:cfg.anon,SEPIA_OFFLINE_PRIVATE_JWK:JSON.stringify(privateKey.export({format:'jwk'})),SEPIA_OFFLINE_PUBLIC_JWKS:JSON.stringify({keys:[jwk]}),SEPIA_OFFLINE_KID:jwk.kid};
const admin=createClient(cfg.url,cfg.service,{auth:{persistSession:false,autoRefreshToken:false}}),publicClient=()=>createClient(cfg.url,cfg.anon,{auth:{persistSession:false,autoRefreshToken:false}});
const handlers=Object.fromEntries(['native','admin-session','admin','offline-keys','config'].map(r=>[r,createSepiaHandler(r,{env})]));
const wrap=res=>({setHeader:(...a)=>res.setHeader(...a),status(n){res.statusCode=n;return this;},json(o){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));return this;},end(){res.end();return this;}});
const server=createServer(async(req,res)=>{if(req.url==='/api/gba-id'){let b='';for await(const part of req)b+=part;req.body=JSON.parse(b);return createIdentityHandler({env})(req,wrap(res));}const r=req.url==='/api/sepia/v1'?'native':req.url.split('/').pop();return (handlers[r]||handlers.native)(req,wrap(res));});
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function call(route,b,headers={},method='POST'){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...headers},...(method==='GET'?{}:{body:JSON.stringify(b)})});eq(r.headers.get('cache-control'),'no-store');return {status:r.status,b:r.status===204?null:await r.json()};}
const device=randomUUID();
const native=(op,datos={},token,app='ultramar')=>call('/api/sepia/v1',{contrato:CONTRACT,revision:2,op,datos},token?{Authorization:'Bearer '+token,'X-Sepia-Application':app,'X-Sepia-Device':device}:{});
async function authUser(u){const link=await admin.auth.admin.generateLink({type:'magiclink',email:u.handle+'@gba.com'});assert.ok(!link.error);const r=await publicClient().auth.verifyOtp({type:'magiclink',token_hash:link.data.properties.hashed_token});assert.ok(!r.error);return r.data.session;}
const create=(session,app='ultramar')=>native('session.create',{aplicacion:app,versionApp:'test-r2',nombreDispositivo:'Equipo sintético aislado',dispositivoId:device},session.access_token,app);
try{
 const sessions=[];for(const u of cfg.users.slice(0,3))sessions.push(await authUser(u));
 const webHeaders={Origin:ORIGIN,Cookie:'__Host-sepia-auth='+sessions[0].access_token};
 const csrf=await call('/api/sepia/v1/admin-session',null,webHeaders,'GET');eq(csrf.status,200);eq(csrf.b.admin,true);webHeaders['X-Sepia-CSRF']=csrf.b.csrf;
 const web=(action,data={})=>call('/api/sepia/v1/admin',{action,...data},webHeaders);
 const tokens=[];for(const s of sessions){const r=await create(s);eq(r.status,200);eq(r.b.estadoPublico.revision,2);tokens.push(r.b.tokenAplicacion);}
 eq((await native('session.status',{},tokens[0])).b.estadoPublico.estado,'requiere_licencia');
 const workspaceOwner=await create(sessions[0],'workspace');eq(workspaceOwner.status,200);eq(workspaceOwner.b.estadoPublico.acceso.producto,'workspace_owner');
 eq((await native('session.status',{},tokens[1],'workspace')).status,401);
 eq((await native('session.status',{},sessions[1].access_token)).status,401);
 const issue=await web('issue',{durationSeconds:86400,label:'Ensayo real Sepia r2 — canje concurrente'});eq(issue.status,200);
 const races=await Promise.all([native('license.activate',{codigo:issue.b.code},tokens[1]),native('license.activate',{codigo:issue.b.code},tokens[2])]);eq(races.map(r=>r.status).sort(),[200,422]);
 const winner=races[0].status===200?1:2,ok=races[winner-1].b,state=ok.estadoPublico;
 validateOffline(ok.permisoOfflineJws,[jwk],{sub:cfg.users[winner].id,conexionId:state.conexion.id,dispositivoId:device,licenciaId:state.acceso.licenciaId,aplicacion:'ultramar'},Math.floor(Date.now()/1000));checks++;
 const retry=await native('license.activate',{codigo:issue.b.code},tokens[winner]);eq(retry.status,200);eq(retry.b.estadoPublico.acceso.venceEn,state.acceso.venceEn);
 const old=createClient(cfg.url,cfg.anon,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+sessions[winner].access_token}}});const oldStatus=await old.rpc('workspace_license_status');eq(Boolean(oldStatus.error),false);eq(oldStatus.data.active,true);
 const refreshed=await publicClient().auth.refreshSession({refresh_token:sessions[winner].refresh_token});eq(Boolean(refreshed.error),false);eq((await native('session.status',{},tokens[winner])).status,200);
 const revoked=await web('revoke',{id:issue.b.id,reason:'Fin del ensayo real de revisión 2'});eq(revoked.status,200);eq((await native('license.activate',{codigo:issue.b.code},tokens[winner])).status,422);eq('permisoOfflineJws' in (await native('session.status',{},tokens[winner])).b,false);
 // Create one ordinary test GBA ID for the real PIN and MFA paths; never grant it a role.
 if(!cfg.nativeUser){const handle='sepia-test-native-'+Date.now().toString(36),pin=String(randomBytes(2).readUInt16BE()%10000).padStart(4,'0'),recovery=randomBytes(32).toString('hex');const made=await admin.auth.admin.createUser({email:handle+'@gba.com',password:randomBytes(32).toString('base64url'),email_confirm:true,user_metadata:{nombre:handle}});assert.ok(!made.error);cfg.nativeUser={id:made.data.user.id,handle,pin,recovery};fs.writeFileSync(file,JSON.stringify(cfg),{mode:0o600});const profile=await admin.from('usuarios').insert({id:cfg.nativeUser.id,nombre:handle,rol:null});assert.ok(!profile.error);const reg=await admin.rpc('gba_id_gateway',{p_action:'register',p_handle:handle,p_pin:pin,p_recovery:recovery,p_origin:'sepia-native-test',p_device:device,p_user_id:cfg.nativeUser.id});assert.ok(!reg.error&&!reg.data.error);}
 const n=cfg.nativeUser;if(!n.handle.startsWith('sepia-test-native-'))throw Error('Synthetic MFA user required');const priorFactors=await admin.auth.admin.getUserById(n.id);for(const f of priorFactors.data?.user?.factors||[])await admin.auth.admin.mfa.deleteFactor({id:f.id,userId:n.id});const login=await call('/api/gba-id',{action:'login',handle:n.handle,pin:n.pin,device},{Origin:ORIGIN});eq(login.status,200);
 const signedIn=login.b.session;const auth=publicClient();await auth.auth.setSession(signedIn);
 const factor=await auth.auth.mfa.enroll({factorType:'totp',friendlyName:'Sepia isolated test'});eq(Boolean(factor.error),false);
 function totp(secret){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of secret.replace(/=/g,''))bits+=alphabet.indexOf(c).toString(2).padStart(5,'0');const bytes=Buffer.from((bits.match(/.{8}/g)||[]).map(x=>parseInt(x,2)));const time=Buffer.alloc(8);time.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',bytes).update(time).digest();const offset=h[19]&15;return String((h.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');}
 const mfa=await auth.auth.mfa.challengeAndVerify({factorId:factor.data.id,code:totp(factor.data.totp.secret)});eq(Boolean(mfa.error),false);
 eq((await create(signedIn)).status,403);const mfaSession=(await auth.auth.getSession()).data.session;eq((await create(mfaSession)).status,200);
 // Real GBA ID recovery invalidates the native connection and all Auth sessions for that user.
 const nativeBeforeRecovery=await create(mfaSession);eq(nativeBeforeRecovery.status,200);
 const recover=await call('/api/gba-id',{action:'recover',handle:n.handle,pin:n.pin,recovery:n.recovery,device},{Origin:ORIGIN});eq(recover.status,200);eq((await native('session.status',{},nativeBeforeRecovery.b.tokenAplicacion)).status,401);
 await admin.auth.admin.signOut(recover.b.session.access_token,'local');
 const global=await call('/api/sepia/v1/admin-session',{action:'revoke_all'},webHeaders);eq(global.status,200);eq((await native('session.status',{},tokens[0])).status,401);
 const signout=await admin.auth.admin.signOut(refreshed.data.session.access_token,'local');eq(Boolean(signout.error),false);eq((await native('session.status',{},tokens[winner])).status,401);
 const report={timestamp:new Date().toISOString(),project:cfg.project,revision:2,passed:true,checks,verified:['GBA ID/PIN via actual existing gateway','GoTrue getUser/JWT/refresh','native session creation and binding','real TOTP MFA challenge/verification; stale AAL1 rejected','concurrent PostgreSQL redemption across two users','own retry without extension','legacy Workspace RPC','owner exception only Workspace','Ed25519 verification','license revocation','GBA ID recovery','global GBA ID revocation','local Auth signout invalidates bound connection'],policy:evidence,productionChanged:false,nativeClientUI:false};
 fs.writeFileSync('docs/sepia-access/REAL_AUTH_RESULTS.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error('Real isolated test failed after',checks,'checks:',e.message,(e.stack||'').split('\n').find(l=>l.includes('real-acceptance.mjs:'))||'');process.exitCode=1;}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
