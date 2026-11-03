import {createClient} from '@supabase/supabase-js';
import {createPrivateKey,createPublicKey,randomUUID} from 'node:crypto';
import {createIdentityHandler} from '../../api/gba-id.js';
import {CONTRACT,ORIGIN,UUID,OPAQUE,validateRequest,normalizeLicense,opaque,symbols,hashSecret,signOffline,strict,text,fail} from './protocol.mjs';
// Native GBA ID authentication; no pairing or browser consent in revision 2.
export const IMPLEMENTED_ACCESS_REVISION=2;
const MESSAGES={invalid_request:'Revisa los datos de la solicitud.',contract_unsupported:'Esta revisión de acceso no es compatible.',session_invalid:'La conexión venció o fue revocada. Vuelve a conectar.',access_denied:'No se autorizó esta operación.',account_suspended:'Esta cuenta no está habilitada.',license_invalid_or_used:'Código inválido, vencido o no disponible.',license_required:'Necesitas una licencia vigente.',rate_limited:'Espera antes de volver a intentarlo.',service_unavailable:'El acceso de Sepia todavía no está disponible.'};
const STATUS={invalid_request:400,contract_unsupported:400,session_invalid:401,access_denied:403,account_suspended:403,license_invalid_or_used:422,license_required:422,rate_limited:429,service_unavailable:503};
const header=(req,name)=>{const v=req.headers[name];return typeof v==='string'?v:'';};
function cookie(req,name){const matches=header(req,'cookie').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));if(matches.length>1)fail('session_invalid',401);return matches[0]?.slice(name.length+1)||'';}
async function body(req){
 if(!/^application\/json(?:\s*;.*)?$/i.test(header(req,'content-type')))fail();
 const len=header(req,'content-length');if(len&&(!/^\d+$/.test(len)||Number(len)>16384))fail();
 let value=req.body;
 if(value===undefined){let chunks=[],n=0;for await(const b of req){n+=b.length;if(n>16384)fail();chunks.push(b);}value=Buffer.concat(chunks).toString('utf8');}
 if(typeof value==='string'){if(Buffer.byteLength(value)>16384)fail();try{value=JSON.parse(value);}catch{fail();}}
 if(Buffer.byteLength(JSON.stringify(value)||'')>16384)fail();return value;
}
function policy(env){
 if(env.SEPIA_AUTH_POLICY_VERIFIED!=='1')fail('service_unavailable',503);
 const p={timebox:Number(env.SEPIA_AUTH_TIMEBOX_SECONDS),inactivity:Number(env.SEPIA_AUTH_INACTIVITY_SECONDS),single:env.SEPIA_AUTH_SINGLE_SESSION==='1'};
 if([env.SEPIA_AUTH_TIMEBOX_SECONDS,env.SEPIA_AUTH_INACTIVITY_SECONDS].some(x=>x===undefined||x==='')||![p.timebox,p.inactivity].every(n=>Number.isSafeInteger(n)&&n>=0)||!['0','1'].includes(env.SEPIA_AUTH_SINGLE_SESSION))fail('service_unavailable',503);
 return p;
}
function signing(env){
 try{
  const kid=env.SEPIA_OFFLINE_KID;if(!/^[a-zA-Z0-9._-]{1,80}$/.test(kid||''))throw Error();
  const jwk=JSON.parse(env.SEPIA_OFFLINE_PRIVATE_JWK),list=JSON.parse(env.SEPIA_OFFLINE_PUBLIC_JWKS);
  if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||!jwk.d||!Array.isArray(list.keys)||!list.keys.length||list.keys.some(k=>k.d||k.kty!=='OKP'||k.crv!=='Ed25519'||k.alg!=='Ed25519'||!k.kid))throw Error();
  if(new Set(list.keys.map(k=>k.kid)).size!==list.keys.length)throw Error();
  const key=createPrivateKey({key:jwk,format:'jwk'}),pub=createPublicKey(key).export({format:'jwk'});
  if(!list.keys.some(k=>k.kid===kid&&k.x===pub.x))throw Error();
  return {kid,key,keys:list.keys.map(k=>({kty:k.kty,crv:k.crv,x:k.x,kid:k.kid,alg:'Ed25519',use:'sig'}))};
 }catch{fail('service_unavailable',503);}
}
export function createSepiaHandler(route,{env=process.env,makeClient=createClient,identityFactory=createIdentityHandler}={}){
 return async(req,res)=>{
  const requestId=randomUUID();res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const testOrigin=env.NODE_ENV==='test'&&env.VERCEL!=='1'&&/^http:\/\/127\.0\.0\.1:\d+$/.test(env.SEPIA_TEST_ORIGIN||'')?env.SEPIA_TEST_ORIGIN:null;
  const origin=testOrigin||ORIGIN;
  const clearCookie=()=>res.setHeader('Set-Cookie','__Host-sepia-auth=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0');
  try{
   if(env.SEPIA_ACCESS_ENABLED!=='1'||IMPLEMENTED_ACCESS_REVISION!==2)fail('service_unavailable',503);
   const authPolicy=policy(env),url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY,anon=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
   if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url||'')||!secret||!anon)fail('service_unavailable',503);
   const keys=signing(env);
   const db=makeClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
   async function call(op,data){const r=await db.rpc('sepia_access_gateway',{p_op:op,p_data:data});if(r.error||r.data===null)fail('service_unavailable',503);if(r.data?.error){const code=Object.hasOwn(STATUS,r.data.error)?r.data.error:'service_unavailable';fail(code,STATUS[code]);}return r.data;}
   async function verifiedAuth(jwt){
    if(!jwt||jwt.length>12000||jwt.split('.').length!==3)fail('session_invalid',401);
    const auth=makeClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const checked=await auth.auth.getUser(jwt);
    if(checked.error){if(checked.error.status>=500)fail('service_unavailable',503);fail('session_invalid',401);}
    if(!checked.data?.user?.id)fail('session_invalid',401);
    let claims;try{claims=JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));}catch{fail('session_invalid',401);}
    const now=Math.floor(Date.now()/1000);
    if(claims.sub!==checked.data.user.id||claims.iss!==url+'/auth/v1'||claims.aud!=='authenticated'||!UUID.test(claims.session_id)||!Number.isSafeInteger(claims.exp)||claims.exp<=now||!Number.isSafeInteger(claims.iat)||claims.iat>now+30)fail('session_invalid',401);
    if((checked.data.user.factors||[]).some(f=>f.status==='verified')&&claims.aal!=='aal2')fail('access_denied',403);
    return {context:{verified:true,user_id:checked.data.user.id,session_id:claims.session_id,jwt_exp:claims.exp,policy:authPolicy},now};
   }
   const ip=env.VERCEL==='1'?header(req,'x-vercel-forwarded-for'):req.socket?.remoteAddress;
   const originHash=hashSecret(String(ip||'unknown').split(',')[0].trim());
   if(route==='offline-keys'){
    if(req.method!=='GET')fail('invalid_request',405);
    await call('runtime.status',{});
    return res.status(200).json({contrato:CONTRACT,keys:keys.keys});
   }
   if(route==='admin-session'||route==='admin'){
    await call('runtime.status',{});
    // No cross-origin administration, wildcard CORS, URL secrets or GET mutations.
    if(header(req,'origin')&&header(req,'origin')!==origin)fail('access_denied',403);
    if(req.method==='POST'&&header(req,'origin')!==origin)fail('access_denied',403);
    if(header(req,'sec-fetch-site')&&!['same-origin','none'].includes(header(req,'sec-fetch-site')))fail('access_denied',403);
    if(!['GET','POST'].includes(req.method))fail('invalid_request',405);
    const b=req.method==='POST'?await body(req):{action:'session'};
    strict(b,route==='admin'?['action','durationSeconds','label','assignedHandle','redeemBefore','id','reason']:['action','handle','pin','device','id']);
    let jwt=cookie(req,'__Host-sepia-auth');
    if(route==='admin-session'&&b.action==='login'){
     strict(b,['action','handle','pin','device']);text(b.handle,64,3);if(!/^\d{4}$/.test(b.pin)||!UUID.test(b.device))fail();
     let result,status=500;const capture={setHeader(){},status(n){status=n;return this;},json(value){result=value;return this;},end(){return this;}};
     await identityFactory({env,makeClient})({...req,method:'POST',body:{action:'login',handle:b.handle,pin:b.pin,device:b.device},headers:{...req.headers,origin:ORIGIN}},capture);
     if(status!==200||!result?.session?.access_token)fail(status===429?'rate_limited':'session_invalid',status===429?429:401);
     jwt=result.session.access_token;
    }
    const {context:web,now}=await verifiedAuth(jwt);
    if(b.action==='session'||b.action==='login'){
     if(route!=='admin-session')fail();const csrf=opaque();
     const out=await call('web.session',{web,new_csrf_hash:hashSecret(csrf)});
     if(b.action==='login')res.setHeader('Set-Cookie',`__Host-sepia-auth=${jwt}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0,web.jwt_exp-now)}`);
     return res.status(200).json({...out,csrf});
    }
    const csrf=header(req,'x-sepia-csrf');if(!OPAQUE.test(csrf))fail('access_denied',403);
    const data={web,csrf_hash:hashSecret(csrf)};
    if(route==='admin'){
     if(b.action==='issue'){
      strict(b,['action','durationSeconds','label','assignedHandle','redeemBefore']);text(b.label,120);
      if(!Number.isSafeInteger(b.durationSeconds)||b.durationSeconds<1||b.durationSeconds>315360000||(b.assignedHandle!=null&&(typeof b.assignedHandle!=='string'||b.assignedHandle.length>64))||(b.redeemBefore!=null&&(!/^\d{4}-\d\d-\d\dT.*Z$/.test(b.redeemBefore)||!Number.isFinite(Date.parse(b.redeemBefore))||Date.parse(b.redeemBefore)<=Date.now())))fail();
      const code=symbols(32),out=await call('web.issue',{...data,code_hash:hashSecret(code),duration_seconds:b.durationSeconds,label:b.label,assigned_handle:b.assignedHandle||null,redeem_before:b.redeemBefore||null});
      return res.status(200).json({...out,code:code.match(/.{4}/g).join('-')});
     }
     if(b.action==='revoke'){strict(b,['action','id','reason']);if(!UUID.test(b.id))fail();text(b.reason,500,10);return res.status(200).json(await call('web.revoke',{...data,id:b.id,reason:b.reason}));}
     if(b.action==='list'){strict(b,['action']);return res.status(200).json(await call('web.licenses',data));}fail();
    }
    if(b.action==='connections'){strict(b,['action']);return res.status(200).json(await call('web.connections',data));}
    if(b.action==='revoke_connection'){strict(b,['action','id']);if(!UUID.test(b.id))fail();return res.status(200).json(await call('web.revoke_connection',{...data,id:b.id}));}
    if(b.action==='revoke_all'){strict(b,['action']);const out=await call('web.revoke_all',data);clearCookie();return res.status(200).json(out);}
    if(b.action==='logout'){strict(b,['action']);await call('web.connections',data);const signedOut=await db.auth.admin.signOut(jwt,'local');if(signedOut.error)fail('service_unavailable',503);clearCookie();return res.status(204).end();}
    fail();
   }
   if(route!=='native'||req.method!=='POST')fail('invalid_request',405);
   if(header(req,'origin')&&header(req,'origin')!==ORIGIN)fail('access_denied',403);
   const b=validateRequest(await body(req));
   if(b.op==='session.create'){
    const jwt=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(header(req,'authorization'))?.[1];
    const {context}=await verifiedAuth(jwt),token=opaque(),d=b.datos;
    const out=await call('session.create',{auth:context,token_hash:hashSecret(token),app:d.aplicacion,device_id:d.dispositivoId,device_name:d.nombreDispositivo,app_version:d.versionApp,origin_hash:originHash});
    return res.status(200).json({tokenAplicacion:token,estadoPublico:out.estadoPublico});
   }
   const bearer=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(header(req,'authorization'))?.[1];
   const app=header(req,'x-sepia-application'),device=header(req,'x-sepia-device');
   if(!bearer||!['workspace','ultramar'].includes(app)||!UUID.test(device))fail('session_invalid',401);
   const data={token_hash:hashSecret(bearer),app,device_id:device,policy:authPolicy};
   if(b.op==='license.activate')data.code_hash=hashSecret(normalizeLicense(b.datos.codigo));
   const out=await call(b.op,data);
   if(b.op==='session.logout')return res.status(204).end();
   const result={estadoPublico:out.estadoPublico};
   if(out.estadoPublico?.estado==='autorizado'&&out.estadoPublico.acceso.producto==='sepia'){
    const state=out.estadoPublico;result.permisoOfflineJws=signOffline({sub:state.cuenta.id,conexionId:state.conexion.id,dispositivoId:out.device_id,licenciaId:state.acceso.licenciaId,aplicacion:state.aplicacion,iat:Math.floor(Date.parse(state.servidorUtc)/1000),licencia_exp:Math.floor(Date.parse(state.acceso.venceEn)/1000)},keys.key,keys.kid);
   }
   return res.status(200).json(result);
  }catch(e){
   const code=Object.hasOwn(MESSAGES,e.code)?e.code:'service_unavailable';
   if(code==='rate_limited')res.setHeader('Retry-After','60');
   if(code==='session_invalid'&&(route==='admin-session'||route==='admin'))clearCookie();
   // No request body, account, token, PIN, code, key or raw exception enters logs.
   return res.status(e.status||STATUS[code]).json({error:{code,message:MESSAGES[code],retryable:['rate_limited','service_unavailable'].includes(code),requestId}});
  }
 };
}
