import {createClient} from '@supabase/supabase-js';
import webPush from 'web-push';
import {randomUUID} from 'node:crypto';
export function validPushEndpoint(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&u.href.length<=2048&&(
  u.hostname==='fcm.googleapis.com'||/^(?:[a-z0-9-]+\.)+push\.apple\.com$/.test(u.hostname)||/^(?:[a-z0-9-]+\.)?push\.services\.mozilla\.com$/.test(u.hostname)||/^(?:[a-z0-9-]+\.)?notify\.windows\.com$/.test(u.hostname));}catch{return false;}
}
export function createPushHandler({env=process.env,makeClient=createClient,send=webPush.sendNotification,uuid=randomUUID}={}){
 return async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET')return res.status(200).json({enabled:Boolean(env.WORKSPACE_VAPID_PUBLIC_KEY&&env.WORKSPACE_VAPID_PRIVATE_KEY),publicKey:env.WORKSPACE_VAPID_PUBLIC_KEY||null});
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const token=String(req.headers.authorization||'').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token)return res.status(401).json({error:'Acceso no disponible'});
  if(!env.WORKSPACE_VAPID_PUBLIC_KEY||!env.WORKSPACE_VAPID_PRIVATE_KEY||!env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Avisos pendientes de configurar'});
  try{
  const client=makeClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}}),lease=uuid();
  const batch=await client.rpc('workspace_push_batch',{p_token:token,p_lease:lease});
  if(batch.error)return res.status(batch.error.code==='42501'?401:503).json({error:'No se pudo abrir la cola de avisos'});
  const jobs=Array.isArray(batch.data)?batch.data.slice(0,12):[];let sent=0,failed=0;
  for(let offset=0;offset<jobs.length;offset+=3)await Promise.all(jobs.slice(offset,offset+3).map(async job=>{
   let status=400;
   if(validPushEndpoint(job.subscription?.endpoint))try{
    await send(job.subscription,JSON.stringify({v:1,owner:job.owner,notificationId:job.notificationId,test:job.test,deliveryId:job.id}),{TTL:3600,urgency:'normal',timeout:8000,vapidDetails:{subject:'mailto:contacto@gba.software',publicKey:env.WORKSPACE_VAPID_PUBLIC_KEY,privateKey:env.WORKSPACE_VAPID_PRIVATE_KEY}});status=201;sent++;
   }catch(e){status=Number(e.statusCode)||503;failed++;}
   else failed++;
   const result=await client.rpc('workspace_push_result',{p_token:token,p_job:job.id,p_lease:lease,p_status:status});
   if(result.error)failed++; // The lease expires and the same OS tag deduplicates retries.
  }));
  return res.status(200).json({processed:jobs.length,sent,failed});
  }catch{return res.status(503).json({error:'El servicio de avisos no está disponible. Se reintentará el envío.'});}
 };
}
export default createPushHandler();
