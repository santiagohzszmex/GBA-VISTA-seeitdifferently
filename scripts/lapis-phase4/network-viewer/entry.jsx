import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import ImageViewer from '../../../src/workspace/images/ImageViewer';
import {clearImageCache} from '../../../src/workspace/images/originalCache.mjs';
import '../../../src/workspace/images/images.css';
const originalFetch=window.fetch.bind(window);let slow=false;
window.fetch=async(input,options)=>{
 const response=await originalFetch(input,options),url=new URL(typeof input==='string'?input:input.url,location.href);
 if(!slow||!url.pathname.startsWith('/image-downloads/')||!response.ok)return response;
 const reader=response.body.getReader();let pending=new Uint8Array(),done=false;
 return new Response(new ReadableStream({async pull(controller){
  while(pending.length<65536&&!done){const part=await reader.read();done=part.done;if(part.value){const merged=new Uint8Array(pending.length+part.value.length);merged.set(pending);merged.set(part.value,pending.length);pending=merged;}}
  if(!pending.length){controller.close();return;}
  await new Promise(resolve=>setTimeout(resolve,100));controller.enqueue(pending.slice(0,65536));pending=pending.slice(65536);
 },cancel:reason=>reader.cancel(reason)}),{status:response.status,headers:response.headers});
};
const manifest=await originalFetch('/__lapis/network-manifest').then(r=>r.json());
const owner='lapis-network-synthetic-v2';
const api=async(_action,_task,{assetId})=>originalFetch(`/__lapis/network-link/${assetId}`,{method:'POST'}).then(async r=>{const b=await r.json();if(!r.ok)throw Error(b.error);return b;});
function Test(){const [mode,setMode]=useState(0),[generation,setGeneration]=useState(0),[message,setMessage]=useState('App vacía; originales sintéticos en R2 de prueba');return <main style={{padding:24,fontFamily:'system-ui'}}>
 <h2>Lapislázuli · prueba aislada de red y memoria</h2><p>Sin cambios en entregas reales. Origen: Worker/R2 de prueba desplegados.</p>
 <div style={{display:'flex',gap:12}}><button onClick={()=>setMode(0)}>Cerrar imágenes</button><button onClick={()=>setMode(1)}>Abrir original 4000 × 5000</button><button onClick={()=>setMode(2)}>Comparar dos originales distintos</button><button onClick={async()=>{setMode(0);await clearImageCache(owner);setGeneration(n=>n+1);setMessage('Caché vacía; siguiente apertura fría');}}>Vaciar caché de prueba</button><label><input type="checkbox" onChange={e=>{slow=e.target.checked;originalFetch('/__lapis/network-mode',{method:'POST',body:JSON.stringify({slow})});}}/> Limitar lectura a 5,24 Mbps</label></div><p role="status">{message}</p>
 <div style={{display:'grid',gridTemplateColumns:mode===2?'1fr 1fr':'1fr',gap:16}}>{manifest.assets.slice(0,mode).map((asset,i)=><ImageViewer key={`${generation}-${asset.id}`} asset={asset} owner={owner} api={api} label={`Original sintético ${i+1}`}/>)}</div>
 </main>;}
createRoot(document.getElementById('root')).render(<Test/>);
