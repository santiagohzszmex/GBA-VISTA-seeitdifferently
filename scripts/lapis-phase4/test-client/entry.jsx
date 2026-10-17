import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../../../src/views/Workspace';
import '../../../src/index.css';
history.replaceState(null,'','?workspace-preview=1&lapis-preview=1');
const originalFetch=window.fetch.bind(window),records=JSON.parse(localStorage.getItem('lapis-test-metrics')||'[]');
window.fetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url,location.href);
 if(url.origin!==location.origin)throw Error('La prueba aislada bloquea conexiones externas.');
 if(url.pathname==='/__lapis/metrics'){
  const event=JSON.parse(options.body);records.push({...event,timestamp:new Date().toISOString(),network:localStorage.getItem('lapis-slow')==='1'?'limited-5.24Mbps':'local-bundle'});
  localStorage.setItem('lapis-test-metrics',JSON.stringify(records));return new Response(null,{status:204});
 }
 const response=await originalFetch(input,options);
 if(url.pathname==='/__lapis/original.png'&&localStorage.getItem('lapis-slow')==='1'){
  const bytes=new Uint8Array(await response.arrayBuffer());let at=0;
  return new Response(new ReadableStream({async pull(controller){await new Promise(resolve=>setTimeout(resolve,100));controller.enqueue(bytes.subarray(at,at+65536));at+=65536;if(at>=bytes.length)controller.close();}}),{headers:{'Content-Type':'image/png','Content-Length':String(bytes.length)}});
 }
 return response;
};
function TestApp(){return <><aside style={{padding:'8px 20px',background:'#f0eafd',display:'flex',gap:16,alignItems:'center'}}><strong>PRUEBA AISLADA · datos sintéticos · no se envían archivos</strong><label><input type="checkbox" defaultChecked={localStorage.getItem('lapis-slow')==='1'} onChange={e=>localStorage.setItem('lapis-slow',e.target.checked?'1':'0')}/> Red lenta</label><button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(records,null,2)],{type:'application/json'}));a.download='lapis-metricas.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}}>Exportar métricas</button></aside><Workspace previewMode/></>;}
createRoot(document.getElementById('root')).render(<TestApp/>);
