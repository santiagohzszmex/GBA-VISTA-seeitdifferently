import {hashFile} from './imageFiles.mjs';
const jobs=new Map(),memory=new Map(),epochs=new Map();
const key=(owner,sha)=>`${owner}/${sha}`;
const cacheName=owner=>`workspace-originals-v1-${owner}`;
const cacheUrl=(owner,sha,partial=false)=>new URL(`/__workspace_private_images__/${encodeURIComponent(owner)}/${sha}${partial?'.partial':''}`,location.origin).href;
const isDesktop=()=>Boolean(globalThis.__TAURI_INTERNALS__);
const nativeProbe=(operation,error)=>{if(import.meta.env?.DEV&&new URLSearchParams(location.search).get('lapis-preview')==='1')void fetch('/__lapis/metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'native-cache',operation,error:String(error).slice(0,240)})}).catch(()=>{});};
async function storage(owner){try{return await caches.open(cacheName(owner));}catch{return null;}}
async function getStored(owner,sha,partial=false){
 if(!partial&&isDesktop()){try{const {invoke}=await import('@tauri-apps/api/core');const bytes=await invoke('workspace_image_cache_get',{owner,sha});if(bytes.byteLength)return new Blob([bytes],{type:'image/png'});}catch(error){nativeProbe('get',error);}}
 const cache=await storage(owner),response=await cache?.match(cacheUrl(owner,sha,partial)),blob=await response?.blob();if(blob&&!partial&&isDesktop())await putStored(owner,sha,blob);return blob;
}
async function putStored(owner,sha,blob,partial=false){
 if(!partial&&isDesktop()){try{const {invoke}=await import('@tauri-apps/api/core');await invoke('workspace_image_cache_put',new Uint8Array(await blob.arrayBuffer()),{headers:{'x-workspace-owner':owner,'x-workspace-sha':sha}});return;}catch(error){nativeProbe('put',error);}}
 const cache=await storage(owner);try{await cache?.put(cacheUrl(owner,sha,partial),new Response(blob,{headers:{'Content-Type':'image/png'}}));}catch{/* A full local cache must not prevent viewing an authorized original. */}
}
async function remove(owner,sha,partial=false){const cache=await storage(owner);await cache?.delete(cacheUrl(owner,sha,partial));if(!partial){memory.delete(key(owner,sha));if(isDesktop()){try{const {invoke}=await import('@tauri-apps/api/core');await invoke('workspace_image_cache_remove',{owner,sha});}catch{}}}}
export async function clearImageCache(owner){
 if(!owner)return;epochs.set(owner,(epochs.get(owner)||0)+1);const pending=[...jobs.entries()].filter(([id])=>id.startsWith(owner+'/')).map(([,job])=>job.promise);for(const [id,job]of jobs)if(id.startsWith(owner+'/')){job.controller.abort();jobs.delete(id);}for(const id of memory.keys())if(id.startsWith(owner+'/'))memory.delete(id);
 await Promise.allSettled(pending);
 try{await caches.delete(cacheName(owner));}catch{}if(isDesktop()){try{const {invoke}=await import('@tauri-apps/api/core');await invoke('workspace_image_cache_clear',{owner});}catch{}}
}
export async function loadOriginal({asset,owner,link,onProgress=()=>{},signal,fetcher=fetch,hasher=hashFile}){
 // This authorization is mandatory even on a cache hit; cached bytes grant no access.
 let signed;try{signed=await link(asset.id);}catch(error){if(error.status===403){await remove(owner,asset.sha256);await remove(owner,asset.sha256,true);}throw error;}
 if(!signed.available)throw Error('El original no está disponible para tu acceso.');
 const id=key(owner,asset.sha256);let job=jobs.get(id);
 if(!job){
  const controller=new AbortController(),listeners=new Set(),epoch=epochs.get(owner)||0;const active=()=>{if(controller.signal.aborted||epoch!==(epochs.get(owner)||0))throw new DOMException('Cancelado','AbortError');};job={controller,listeners};jobs.set(id,job);
  job.promise=(async()=>{
   const cached=memory.get(id)||await getStored(owner,asset.sha256);
   if(cached&&cached.size===asset.size_bytes&&await hasher(cached,{signal:controller.signal})===asset.sha256){active();memory.set(id,cached);return {blob:cached,cached:true};}
   if(cached)await remove(owner,asset.sha256);
   let partial=await getStored(owner,asset.sha256,true);if(partial?.size>=asset.size_bytes)partial=null;
   let chunks=partial?[partial]:[],received=partial?.size||0;
   for(let attempt=0;attempt<3;attempt++){
    let reader;
    try{
     if(attempt)signed=await link(asset.id);
     const response=await fetcher(signed.url,{headers:received?{Range:`bytes=${received}-`}:{},cache:'no-store',signal:controller.signal});
     if(!response.ok)throw Object.assign(Error(response.status===403?'Tu acceso cambió o el enlace venció.':'La descarga se interrumpió.'),{status:response.status});
     if(received&&response.status===200){chunks=[];received=0;}
     if(response.status===206){const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range')||'');if(!range||Number(range[1])!==received||Number(range[3])!==asset.size_bytes)throw Error('Rango de descarga no válido.');}
     if(response.headers.get('X-Original-Sha256')&&response.headers.get('X-Original-Sha256')!==asset.sha256)throw Error('La huella del original no coincide.');
     reader=response.body.getReader();while(true){const part=await reader.read();if(part.done)break;received+=part.value.length;if(received>asset.size_bytes)throw Error('Original mayor que el registro.');chunks.push(part.value);for(const notify of listeners)notify({received,total:asset.size_bytes,cached:false});}
     if(received!==asset.size_bytes)throw Error('La descarga se interrumpió.');
     const blob=new Blob(chunks,{type:'image/png'});if(await hasher(blob,{signal:controller.signal})!==asset.sha256){await remove(owner,asset.sha256,true);throw Object.assign(Error('El original no coincide con su huella de integridad.'),{integrity:true});}
     active();memory.set(id,blob);while(memory.size>4)memory.delete(memory.keys().next().value);await putStored(owner,asset.sha256,blob);await remove(owner,asset.sha256,true);return {blob,cached:false};
    }catch(error){await reader?.cancel().catch(()=>{});if(epoch===(epochs.get(owner)||0)&&received&&received<asset.size_bytes&&!error.integrity)await putStored(owner,asset.sha256,new Blob(chunks),true);if(controller.signal.aborted||error.integrity||attempt===2)throw error;}
   }
  })().finally(()=>jobs.delete(id));
 }
 job.listeners.add(onProgress);
 const leave=()=>{job.listeners.delete(onProgress);queueMicrotask(()=>{if(!job.listeners.size&&jobs.get(id)===job)job.controller.abort();});};
 try{if(signal?.aborted)throw signal.reason||new DOMException('Cancelado','AbortError');return await Promise.race([job.promise,new Promise((_,reject)=>signal?.addEventListener('abort',()=>reject(new DOMException('Cancelado','AbortError')),{once:true}))]);}finally{leave();}
}
