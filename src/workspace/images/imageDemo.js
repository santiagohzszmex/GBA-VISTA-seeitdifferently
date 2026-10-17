// Development-only synthetic fixtures. Never imported/initialized in production.
import {DEMO_ACTORS,demoPermissions} from '../workflowDemo';
import {emptyNote,hashFile,qualityChecks} from './imageFiles.mjs';
const document=text=>({type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text}]}]});
const blobs=new Map(),faults=new Set();
export async function initializeImageDemo(state){
 if(state.lapis)return;
 const response=await fetch('/__lapis/manifest.json'+(new URLSearchParams(location.search).get('lapis-corrupt')==='1'?'?corrupt=1':''));if(!response.ok)throw Error('Faltan los archivos sintéticos de desarrollo de Lapislázuli.');const fixture=await response.json();if(state.lapis)return;
 DEMO_ACTORS.artLead={id:'demo-art-lead',name:'Responsable de Ilustración',role:'gimg_area_lead',area:'art-demo',projects:['halloween-demo']};
 state.members.push({user_id:'demo-art-lead',display_name:'Responsable de Ilustración',membership_status:'active'});
 state.lapis={policy:{...fixture.policy,images_enabled:true,derivatives_enabled:false},specs:{},drafts:{},versions:{},assets:{},notes:[],replies:[],resolutions:[],approvals:[]};
 const create=(id,project,area,title,version)=>{const task={id,project_id:project,area_id:area,unit_id:'gimg-demo',title,kind:'image',state:version?'review':'assigned',responsible_id:'demo-artist',collaborator_ids:[],current_version:version,revision:1,priority:'normal',round:0,extra_rounds:0,due_at:new Date(Date.now()+3*86400000).toISOString(),description:'Imagen de prueba sintética. Mantener la relación con el concepto y conservar el original.'};state.tasks.unshift(task);state.lapis.specs[id]={deliverable_id:id,min_width:4000,min_height:5000,background:'transparent',layer_policy:'if_present',layer_formats:['psd','tiff','kra','procreate','afphoto','clip'],offer_to_documents:false};return task;};
 create('lapis-upload-demo','halloween-demo','art-demo','Ilustración de apertura',0);
 const task=create('lapis-review-demo','halloween-demo','art-demo','La luz que permanece',2);
 for(let n=1;n<=2;n++){const id=`lapis-version-${n}`,asset={id:`lapis-original-${n}`,deliverable_id:task.id,owner_id:'demo-artist',role:'png',file_name:`SYNTHETIC-ilustracion-v${n}.png`,format:'png',verification:'header',status:'validated',...fixture.asset};state.lapis.assets[asset.id]=asset;state.versions.unshift({id,deliverable_id:task.id,kind:'image',version_number:n,author_id:'demo-artist',credits:'Muestra sintética de desarrollo',created_at:new Date().toISOString()});state.lapis.versions[id]={version_id:id,deliverable_id:task.id,spec_snapshot:state.lapis.specs[task.id],files:{png:asset.id},note_document:document('Ejemplo de versión para revisar.'),quality:qualityChecks(asset,state.lapis.specs[task.id],{decoded:true,has_transparency:true,color_profile:'sin perfil declarado'})};}
 state.lapis.notes=[{id:'lapis-note-1',version_id:'lapis-version-1',author_id:'demo-art-lead',kind:'pin',x:.34,y:.35,width:0,height:0,body_document:document('Revisa la relación de luz en este punto antes de la siguiente entrega.'),created_at:new Date().toISOString()},{id:'lapis-note-2',version_id:'lapis-version-2',author_id:'demo-art-lead',kind:'box',x:.57,y:.55,width:.25,height:.24,body_document:document('Dar más espacio a este detalle de la composición.'),created_at:new Date().toISOString()}];
 create('lapis-muertos-demo','muertos-demo','muertos-art-demo','La memoria del altar',0);
}
export function imageDemoBundle(state,actor,projectId){
 if(!state.lapis)return {enabled:false};const source=state.lapis,tasks=state.tasks.filter(t=>t.project_id===projectId&&demoPermissions(actor,projectId,t.area_id,t)['content.read']),ids=new Set(tasks.map(t=>t.id)),versions=Object.fromEntries(Object.entries(source.versions).filter(([,v])=>ids.has(v.deliverable_id))),vids=new Set(Object.keys(versions));
 return {...source,enabled:true,specs:Object.fromEntries(Object.entries(source.specs).filter(([id])=>ids.has(id))),versions,drafts:Object.fromEntries(Object.entries(source.drafts).filter(([id,d])=>ids.has(id)&&d.author_id===actor.id)),assets:Object.fromEntries(Object.entries(source.assets).filter(([id,a])=>ids.has(a.deliverable_id)&&(a.owner_id===actor.id||Object.values(versions).some(v=>Object.values(v.files).includes(id))))),notes:source.notes.filter(n=>vids.has(n.version_id)),replies:source.replies.filter(r=>source.notes.some(n=>n.id===r.note_id&&vids.has(n.version_id))),resolutions:source.resolutions.filter(r=>vids.has(r.verified_version_id))};
}
export async function imageDemoApi(state,actor,action,task,value,revision){
 const s=state.lapis,perms=task?demoPermissions(actor,task.project_id,task.area_id,task):{},owner=`${actor.id}:${task?.id}:${value.role}`,plans=state.lapisPlans||={};
 if(action==='plan.get')return plans[owner]||null;
 if(action==='link'){const a=s.assets[value.assetId],t=state.tasks.find(t=>t.id===a?.deliverable_id);if(!a||!t||!demoPermissions(actor,t.project_id,t.area_id,t)['asset.download_source']||a.owner_id!==actor.id&&!Object.values(s.versions).some(v=>Object.values(v.files).includes(a.id)))throw Object.assign(Error('Archivo fuera de tu acceso'),{status:403});return {available:true,url:blobs.has(a.id)?URL.createObjectURL(blobs.get(a.id)):'/__lapis/original.png'+(new URLSearchParams(location.search).get('lapis-corrupt')==='1'?'?corrupt=1':'')};}
 const reviewer=Object.entries(perms).some(([k,v])=>v&&(k.startsWith('review.')||['qa.approve','publication.approve_final'].includes(k)));
 if(action==='upload'){
  if(!perms['content.edit_assigned'])throw Error('No puedes subir en esta asignación.');
  const fault=new URLSearchParams(location.search).get('lapis-case'),faultKey=`${fault}:${task.id}:${value.role}`;
  if(fault&&!faults.has(faultKey)){faults.add(faultKey);if(fault==='paused')throw new DOMException('Pausado','AbortError');if(fault==='quota')throw Error('No hay espacio disponible en Workspace; avisa a Dirección');if(fault==='expired')throw Error('La sesión de subida venció');if(fault==='offline')throw new TypeError('Failed to fetch');if(fault==='failed')throw Error('El almacenamiento no está disponible. Reintenta la subida.');}
  const sha256=await hashFile(value.file,{signal:value.signal,onProgress:p=>value.onProgress?.({...p,state:'hashing'})}),totalParts=Math.ceil(value.file.size/s.policy.part_bytes);plans[owner]={owner_id:actor.id,deliverable_id:task.id,role:value.role,completed:false};
  value.signal?.throwIfAborted();value.onProgress?.({received:0,total:value.file.size,parts:0,totalParts,state:'receiving'});
  for(let number=1;number<=totalParts;number++){value.signal?.throwIfAborted();await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,3000);value.signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Pausado','AbortError'));},{once:true});});value.onProgress?.({received:Math.min(number*s.policy.part_bytes,value.file.size),total:value.file.size,parts:number,totalParts,state:'receiving'});}
  value.signal?.throwIfAborted();
  const asset={id:crypto.randomUUID(),deliverable_id:task.id,owner_id:actor.id,role:value.role,format:value.format,file_name:value.file.name,size_bytes:value.file.size,sha256,status:'validated',verification:value.role==='png'?'header':['procreate','afphoto','clip'].includes(value.format)?'unverified':value.format==='kra'?'zip_manifest':'header',width:value.client?.width,height:value.client?.height};s.assets[asset.id]=asset;blobs.set(asset.id,value.file);plans[owner]={...plans[owner],asset_id:asset.id,completed:true};return {asset,plan:plans[owner]};
 }
 if(action==='cancel'){plans[owner]=null;return {cancelled:true};}
 if(action==='spec.save'){if(!perms['task.assign'])throw Error('No puedes modificar esta ficha.');if(task.current_version&&value.kind!==task.kind)throw Error('El tipo no cambia después de enviar una versión.');task.kind=value.kind;task.revision++;s.specs[task.id]={...s.specs[task.id],...value,deliverable_id:task.id};return task;}
 if(['draft.save','version.submit'].includes(action)){
  if(!perms['content.edit_assigned'])throw Error('No puedes editar esta entrega.');
  if(action==='draft.save'){const result={...value,author_id:actor.id,revision:(s.drafts[task.id]?.revision||0)+1};s.drafts[task.id]=result;return result;}
  const version={id:crypto.randomUUID(),deliverable_id:task.id,kind:'image',version_number:++task.current_version,author_id:actor.id,credits:value.credits,created_at:new Date().toISOString()};state.versions.unshift(version);task.state='review';task.revision++;s.versions[version.id]={version_id:version.id,deliverable_id:task.id,files:{png:value.png_asset_id,...(value.layered_asset_id?{layered:value.layered_asset_id}:{})},spec_snapshot:{...s.specs[task.id]},note_document:value.note_document,quality:qualityChecks(s.assets[value.png_asset_id],s.specs[task.id],value.client_checks)};delete s.drafts[task.id];return version;
 }
 if(action==='note.add'){if(!reviewer)throw Error('Solo quienes revisan pueden publicar notas.');const result={...value,id:crypto.randomUUID(),author_id:actor.id,created_at:new Date().toISOString()};s.notes.push(result);return result;}
 const n=s.notes.find(n=>n.id===value.note_id);if(!n)throw Error('Nota no disponible');
 if(action==='note.reply'){if(!reviewer&&task.responsible_id!==actor.id)throw Error('No puedes responder aquí');const result={...value,id:crypto.randomUUID(),author_id:actor.id,created_at:new Date().toISOString()};s.replies.push(result);return result;}
 if(['note.resolve','note.verify'].includes(action)){if(!reviewer&&n.author_id!==actor.id)throw Error('No puedes resolver esta nota');const result={...value,id:crypto.randomUUID(),actor_id:actor.id,created_at:new Date().toISOString()};s.resolutions.push(result);return result;}
 throw Error('Acción de demostración no disponible');
}
