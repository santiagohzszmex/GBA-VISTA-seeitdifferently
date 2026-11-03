// Isolated HTTP + actual supabase-js + PostgreSQL/WASM integration.
// Auth is a local signed-token fixture, NOT GoTrue: real Auth acceptance is reported separately.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {generateKeyPairSync,createHmac,timingSafeEqual,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {createSepiaHandler} from '../../server/sepia/service.mjs';
import {CONTRACT,ORIGIN,hashSecret,validateOffline} from '../../server/sepia/protocol.mjs';
import {fixture,id,sid} from './fixture.mjs';
let count=0;
const eq=(a,b)=>{assert.deepEqual(a,b);count++;};
const f=await fixture(),servers=[];
const listen=async s=>{servers.push(s);await new Promise(r=>s.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+s.address().port;};
const authSecret=randomBytes(32),url='https://synthetic.supabase.co';
const jwt=(n,extra={})=>{const p=[{alg:'HS256',typ:'JWT'},{iss:url+'/auth/v1',aud:'authenticated',sub:id(n),session_id:sid(n),iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...extra}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return p+'.'+createHmac('sha256',authSecret).update(p).digest('base64url');};
const parse=async r=>{let s='';for await(const b of r)s+=b;return JSON.parse(s||'{}');};
const wrap=res=>({setHeader:(...x)=>res.setHeader(...x),status(n){res.statusCode=n;return this;},json(x){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(x));return this;},end(){res.end();return this;}});
try{
 const bridge=await listen(createServer(async(req,res)=>{try{
  if(req.url==='/auth/v1/user'){
   const token=req.headers.authorization?.slice(7)||'',[h,p,s]=token.split('.');const valid=s&&timingSafeEqual(Buffer.from(s),Buffer.from(createHmac('sha256',authSecret).update(h+'.'+p).digest('base64url')));const claims=valid?JSON.parse(Buffer.from(p,'base64url')):{};
   if(!valid||claims.exp<=Date.now()/1000){res.statusCode=401;res.end(JSON.stringify({message:'Invalid JWT'}));return;}
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:claims.sub,aud:'authenticated',role:'authenticated',factors:(await f.db.query('select id,status from auth.mfa_factors where user_id=$1',[claims.sub])).rows}));return;
  }
  if(req.url==='/rest/v1/rpc/sepia_access_gateway'){
   if(req.headers.apikey!=='synthetic-service'){res.statusCode=403;res.end('{}');return;}
   const b=await parse(req),out=await f.gateway(b.p_op,b.p_data);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));return;
  }
  res.statusCode=404;res.end('{}');
 }catch(e){res.statusCode=500;res.end(JSON.stringify({message:e.message}));}}));
 const {privateKey,publicKey}=generateKeyPairSync('ed25519'),pub={...publicKey.export({format:'jwk'}),kid:'test-ephemeral',alg:'Ed25519',use:'sig'};
 const env={NODE_ENV:'test',SEPIA_ACCESS_ENABLED:'1',SEPIA_AUTH_POLICY_VERIFIED:'1',SEPIA_AUTH_TIMEBOX_SECONDS:'0',SEPIA_AUTH_INACTIVITY_SECONDS:'0',SEPIA_AUTH_SINGLE_SESSION:'0',SUPABASE_URL:url,SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',SUPABASE_ANON_KEY:'synthetic-publishable',SEPIA_OFFLINE_PRIVATE_JWK:JSON.stringify(privateKey.export({format:'jwk'})),SEPIA_OFFLINE_PUBLIC_JWKS:JSON.stringify({keys:[pub]}),SEPIA_OFFLINE_KID:pub.kid};
 const makeClient=(_url,key,opts)=>createClient(bridge,key,opts);
 const identityFactory=()=>async(req,res)=>res.status(200).json({session:{access_token:jwt(Number(req.body.handle.replace(/^test/,''))),refresh_token:'not-exposed'}});
 const handlers=Object.fromEntries(['native','admin-session','offline-keys','admin','config'].map(route=>[route,createSepiaHandler(route,{env,makeClient,identityFactory})]));
 const base=await listen(createServer((req,res)=>{const route=req.url==='/api/sepia/v1'?'native':req.url.split('/').pop();(handlers[route]||handlers.native)(req,wrap(res));}));
 const request=async(route,b,opts={})=>{
  const headers={'Content-Type':'application/json',...(opts.cookie?{Cookie:opts.cookie}:{}),...(opts.csrf?{'X-Sepia-CSRF':opts.csrf}:{}),...(route!=='native'&&route!=='offline-keys'?{Origin:ORIGIN}:{}),...opts.headers};
  const r=await fetch(base+'/api/sepia/v1'+(route==='native'?'':'/'+route),{method:opts.method||'POST',headers,...((opts.method||'POST')==='GET'?{}:{body:JSON.stringify(b)})});
  eq(r.headers.get('cache-control'),'no-store');
  return {status:r.status,b:r.status===204?null:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
 };
 const native=async(op,datos={},token,app='ultramar',device=id(80))=>request('native',{contrato:CONTRACT,revision:2,op,datos},{headers:token?{Authorization:'Bearer '+token,'X-Sepia-Application':app,'X-Sepia-Device':device}:{}});
 const login=async n=>{const r=await request('admin-session',{action:'login',handle:'test'+n,pin:'1234',device:id(90)});eq(r.status,200);assert.ok(r.cookie.includes('__Host-sepia-auth='));assert.equal(JSON.stringify(r.b).includes('access_token'),false);return {cookie:r.cookie,csrf:r.b.csrf};};
 eq((await native('session.create',{aplicacion:'ultramar',versionApp:'1',nombreDispositivo:'Test',dispositivoId:id(80)},jwt(1))).status,503);
 await f.db.exec('update sepia_private.runtime set enabled=true');
 const owner=await login(1),person=await login(2),other=await login(3);
 async function createConnection(web=person,app='ultramar',device=id(80)){
  const authJwt=web.cookie.slice('__Host-sepia-auth='.length);
  const created=await native('session.create',{aplicacion:app,versionApp:'1.0',nombreDispositivo:'Equipo sintético',dispositivoId:device},authJwt);
  eq(created.status,200);eq(created.b.estadoPublico.revision,2);
  assert.ok(created.b.tokenAplicacion);assert.equal('verification_uri' in created.b,false);
  return created.b.tokenAplicacion;
 }
 const token=await createConnection();
 eq((await native('session.status',{},token)).b.estadoPublico.estado,'requiere_licencia');
 eq((await native('session.status',{},token,'workspace')).status,401);
 eq((await native('session.status',{},token,'ultramar',id(81))).status,401);
 eq((await request('admin-session',{action:'connections'},{...person,csrf:undefined})).status,403);
 eq((await request('admin-session',{action:'connections'}, {...person,headers:{Origin:'https://evil.invalid'}})).status,403);
 eq((await request('admin',{action:'issue',durationSeconds:86400,label:'forbidden'},person)).status,403);
 const issued=await request('admin',{action:'issue',durationSeconds:86400,label:'Licencia sintética',assignedHandle:'Persona sintética 2'},owner);eq(issued.status,200);
 const first=await native('license.activate',{codigo:issued.b.code},token);eq(first.status,200);eq(first.b.estadoPublico.acceso.producto,'sepia');assert.ok(first.b.permisoOfflineJws);
 const state=first.b.estadoPublico;
 const claims=validateOffline(first.b.permisoOfflineJws,[pub],{sub:id(2),conexionId:state.conexion.id,dispositivoId:id(80),licenciaId:state.acceso.licenciaId,aplicacion:'ultramar'},Math.floor(Date.now()/1000));
 assert.ok(claims.exp-claims.iat<=86400);count++;
 const retry=await native('license.activate',{codigo:issued.b.code},token);eq(retry.b.estadoPublico.acceso.venceEn,state.acceso.venceEn);
 const parallel=await Promise.all([native('license.activate',{codigo:issued.b.code},token),native('license.activate',{codigo:issued.b.code},token)]);for(const p of parallel)eq(p.b.estadoPublico.acceso.licenciaId,state.acceso.licenciaId);
 eq(await f.scalar('select count(*)::integer from sepia_private.licenses'),1);
 const otherToken=await createConnection(other);eq((await native('license.activate',{codigo:issued.b.code},otherToken)).status,422);
 // Current installed client RPC stays compatible and sees the new license without a client change.
 async function oldStatus(n){return f.db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id(n),session_id:sid(n)})]);await tx.exec('set local role authenticated');return (await tx.query('select public.workspace_license_status() value')).rows[0].value;});}
 eq((await oldStatus(2)).active,true);eq((await oldStatus(1)).owner_access,true);
 const ownerUltramar=await createConnection(owner);eq((await native('session.status',{},ownerUltramar)).b.estadoPublico.estado,'requiere_licencia');
 const ownerWorkspace=await createConnection(owner,'workspace');eq((await native('session.status',{},ownerWorkspace,'workspace')).b.estadoPublico.acceso.producto,'workspace_owner');
 const revoked=await request('admin',{action:'revoke',id:issued.b.id,reason:'Revocación de prueba aislada'},owner);eq(revoked.status,200);
 const denied=await native('session.status',{},token);eq(denied.b.estadoPublico.motivo,'revocada');eq('permisoOfflineJws' in denied.b,false);
 eq((await native('license.activate',{codigo:issued.b.code},token)).status,422);
 // A global GBA ID revocation goes through the real existing RPC and its audit trigger.
 eq((await request('admin-session',{action:'revoke_all'},other)).status,200);eq((await native('session.status',{},otherToken)).status,401);
 eq(await f.scalar('select count(*)::integer from auth.sessions where user_id=$1',[id(3)]),0);
 // Suspension, recovery audit, token expiry and local logout are independent invalidations.
 await f.db.query("insert into workspace_private.accounts(user_id,suspended_at,reason) values($1,now(),'Synthetic suspension')",[id(2)]);
 eq((await native('session.status',{},token)).status,403);
 await f.db.query('update workspace_private.accounts set suspended_at=null where user_id=$1',[id(2)]);
 const web4=await login(4),t4=await createConnection(web4);
 await f.db.query("insert into workspace_private.id_audit(user_id,action) values($1,'recover_succeeded')",[id(4)]);
 eq((await native('session.status',{},t4)).status,401);
 const web5=await login(5),t5=await createConnection(web5);
 eq((await native('session.logout',{},t5)).status,204);eq((await native('session.status',{},t5)).status,401);
 const keyResult=await request('offline-keys',null,{method:'GET'});eq(keyResult.status,200);eq(keyResult.b.keys[0].alg,'Ed25519');eq('d' in keyResult.b.keys[0],false);
 // Revision 1/pairing and Auth-vs-app token confusion are rejected.
 eq((await request('native',{contrato:CONTRACT,revision:1,op:'session.create',datos:{}})).b.error.code,'contract_unsupported');
 eq((await request('native',{contrato:CONTRACT,revision:2,op:'pairing.start',datos:{}})).status,400);
 eq((await native('session.status',{},owner.cookie.slice('__Host-sepia-auth='.length))).status,401);
 eq((await native('session.create',{aplicacion:'ultramar',versionApp:'1',nombreDispositivo:'Test',dispositivoId:id(80)},token)).status,401);
 // A native connection is invalid if its source Auth session disappears.
 const t6=await createConnection(await login(6));await f.db.query('delete from auth.sessions where id=$1',[sid(6)]);
 eq((await native('session.status',{},t6)).status,401);
 await f.db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(6),id(6)]);
 // Browser and app roles cannot invoke the service gateway or inspect private records.
 for(const role of ['anon','authenticated']){
  await f.db.exec('set role '+role);
  await assert.rejects(f.db.query('select * from sepia_private.licenses'),/permission denied/);count++;
  await assert.rejects(f.db.query("select public.sepia_access_gateway('web.issue','{}')"),/permission denied/);count++;
  await f.db.exec('reset role');
 }
 // Runtime policies: JWT expiry, Auth session timebox and inactivity are independently enforced.
 const expired=jwt(6,{exp:1});eq((await request('admin-session',null,{method:'GET',cookie:'__Host-sepia-auth='+expired})).status,401);
 env.SEPIA_AUTH_TIMEBOX_SECONDS='60';await f.db.query("update auth.sessions set created_at=now()-interval '2 minutes' where user_id=$1",[id(6)]);eq((await request('admin-session',null,{method:'GET',cookie:'__Host-sepia-auth='+jwt(6)})).status,401);
 env.SEPIA_AUTH_TIMEBOX_SECONDS='0';env.SEPIA_AUTH_INACTIVITY_SECONDS='60';await f.db.query("update auth.sessions set refreshed_at=now()-interval '2 minutes' where user_id=$1",[id(7)]);eq((await request('admin-session',null,{method:'GET',cookie:'__Host-sepia-auth='+jwt(7)})).status,401);
 // Existing verified MFA is mandatory; an incomplete sign-in never creates app authorization.
 env.SEPIA_AUTH_INACTIVITY_SECONDS='0';
 await f.db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')",[id(8)]);
 const nativeInput={aplicacion:'ultramar',versionApp:'1',nombreDispositivo:'Native MFA',dispositivoId:id(80)};
 eq((await native('session.create',nativeInput,jwt(8))).status,403);
 await f.db.query("update auth.sessions set aal='aal2' where id=$1",[sid(8)]);
 const mfaSession=await native('session.create',nativeInput,jwt(8,{aal:'aal2'}));eq(mfaSession.status,200);
 await f.db.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[sid(8)]);
 eq((await native('session.status',{},mfaSession.b.tokenAplicacion)).status,401);
 env.SUPABASE_ANON_KEY='sb_publishable_SyntheticPublic123';const publicConfig=await request('config',null,{method:'GET'});eq(publicConfig.status,200);eq(publicConfig.b.auth.url,url);eq(JSON.stringify(publicConfig.b).includes('synthetic-service'),false);
 env.SUPABASE_ANON_KEY='sb_secret_SyntheticPrivate123';eq((await request('config',null,{method:'GET'})).status,503);
 // No private grants or foreign principals introduced into existing editorial tables.
 eq(await f.scalar("select count(*)::integer from pg_tables where schemaname='sepia_private' and not rowsecurity"),0);
 console.log(`PASS: ${count} isolated HTTP/SDK/PostgreSQL assertions. Auth fixture, NOT production/GoTrue; native client and real multi-session contention NOT VERIFIED.`);
}finally{for(const s of servers){s.closeAllConnections();await new Promise(r=>s.close(r));}await f.db.close();}
