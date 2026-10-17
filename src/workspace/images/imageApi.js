import {supabase} from '../../supabaseClient';
import {createImageUploader} from '../imageUploadClient.mjs';
import {hashFile} from './imageFiles.mjs';
const planKey=(actor,task,role)=>`workspace-image-upload:v1:${actor}:${task}:${role}`;
export function readUploadPlan(actor,task,role){try{const p=JSON.parse(localStorage.getItem(planKey(actor,task,role)));return p?.owner_id===actor&&p.deliverable_id===task&&p.role===role?p:null;}catch{return null;}}
export async function imageStorageApi(action,task,value,{actorId,gateway,policy}){
 if(action==='plan.get')return readUploadPlan(actorId,task.id,value.role);
 const authorization=async()=>{const {data,error}=await supabase.auth.getSession();if(error||!data.session?.access_token)throw Error('Inicia sesión para acceder a los archivos.');return `Bearer ${data.session.access_token}`;};
 const uploader=createImageUploader({gateway,authorization,hashFile:file=>hashFile(file,{signal:value.signal,onProgress:p=>value.onProgress?.({...p,state:'hashing'})}),persist:async plan=>{localStorage.setItem(planKey(actorId,task?.id||plan.deliverable_id,plan.role),JSON.stringify(plan));},onProgress:value.onProgress});
 if(action==='link')return uploader.downloadLink(value.assetId,'original');
 const old=readUploadPlan(actorId,task.id,value.role);
 if(action==='cancel'){const result=old?await uploader.cancel(old,{ownerId:actorId}):{cancelled:true};localStorage.removeItem(planKey(actorId,task.id,value.role));return result;}
 if(action==='upload'){
  const plan=old&&!old.completed&&!old.cancelled&&old.size_bytes===value.file.size&&old.file_name===value.file.name&&(!old.expires_at||new Date(old.expires_at).getTime()>Date.now())?old:await uploader.prepare(value.file,{ownerId:actorId,deliverableId:task.id,role:value.role,format:value.format});
  const result=await uploader.upload(plan,value.file,{ownerId:actorId,signal:value.signal});
  return {asset:{id:result.asset_id,deliverable_id:task.id,role:result.role,format:result.format,file_name:result.file_name,size_bytes:result.size_bytes,sha256:result.sha256,width:result.width,height:result.height,status:result.state==='ready'?'validated':'reserved',verification:result.verification},plan:readUploadPlan(actorId,task.id,value.role)};
 }
 throw Error('Operación de imagen no disponible.');
}
