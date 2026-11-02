import React,{useEffect,useState} from 'react';
import {rpc} from './ui';
import {DEVICE_SETUP_URL,nativeWorkspace,supportsDevicePush,enableDevicePush,disableDevicePush,deviceId} from './devicePush.mjs';
export default function DeviceNotifications({actorId,previewMode}){
 const [expanded,setExpanded]=useState(()=>!previewMode&&new URLSearchParams(location.search).has('device-notifications'));
 const [devices,setDevices]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const native=nativeWorkspace();
 useEffect(()=>{if(!expanded||previewMode)return;let active=true;rpc('workspace_push_preferences',{p_action:'status'}).then(r=>{if(active)setDevices(r.devices||[]);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[actorId,expanded,previewMode]);
 async function run(action){setBusy(true);setError('');setMessage('');try{const text=await action();const result=await rpc('workspace_push_preferences',{p_action:'status'});setDevices(result.devices||[]);setMessage(text);}catch(e){setError(e.message||'No pudimos cambiar los avisos.');}finally{setBusy(false);}}
 const local=deviceId(actorId);
 return <section className="gw-device-notifications"><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(x=>!x)}>Avisos en el dispositivo</button>{expanded&&<div>
  <p>Recibe avisos aunque Workspace esté cerrado. Se activan por navegador y sólo llegan mientras la sesión y tus accesos sigan vigentes.</p>
  <p>En Mac usa Safari para recibirlos también con el navegador cerrado. En Windows permite los avisos y la actividad en segundo plano de tu navegador. El modo No molestar puede silenciarlos.</p>
  {previewMode?<p>La vista de prueba no activa notificaciones reales.</p>:native?<><button disabled={busy} type="button" onClick={()=>void run(async()=>{const {openUrl}=await import('@tauri-apps/plugin-opener');await openUrl(DEVICE_SETUP_URL);return 'Continúa en Workspace web e inicia sesión para activar este dispositivo.';})}>Configurar en el navegador</button><small>Si usas Mac y tu navegador predeterminado no es Safari, abre esta dirección en Safari:</small><code>{DEVICE_SETUP_URL}</code></>:supportsDevicePush()?<button type="button" disabled={busy} onClick={()=>void run(async()=>{await enableDevicePush(actorId,rpc);return 'Avisos activados en este navegador. Puedes enviar una prueba.';})}>{devices.some(d=>d.id===local&&d.active)?'Renovar este navegador':'Activar en este navegador'}</button>:<p>Este navegador no admite push. Abre Workspace web en un navegador compatible.</p>}
  {devices.length>0&&<ul>{devices.map(d=><li key={d.id}><span>{d.label}{d.id===local?' · Este navegador':''}<small>{d.active?'Activo':'Sesión vencida; vuelve a activarlo'}</small></span><div>{d.id===local&&d.active&&!native&&<button disabled={busy} type="button" onClick={()=>void run(async()=>{await rpc('workspace_push_preferences',{p_action:'test',p_data:{id:d.id}});return 'Prueba en cola. Debe llegar en aproximadamente un minuto.';})}>Probar</button>}<button disabled={busy} type="button" aria-label={`Desactivar ${d.label}`} onClick={()=>void run(async()=>{await disableDevicePush(actorId,d.id,rpc);return 'Avisos desactivados para ese dispositivo.';})}>Desactivar</button></div></li>)}</ul>}
  {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error}</p>}
 </div>}</section>;
}
