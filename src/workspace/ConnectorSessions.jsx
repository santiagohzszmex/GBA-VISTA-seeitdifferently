import React, { useEffect, useState } from 'react';
import { rpc } from './ui';
import { dateLabel } from './gimgModel';

export default function ConnectorSessions({previewMode,onNotice}) {
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[pending,setPending]=useState('');
 async function load(){try{setRows(previewMode?[]:await rpc('workspace_connector_sessions'));}catch(failure){setError(failure.message);}}
 useEffect(()=>{let current=true;if(previewMode){setRows([]);return;}rpc('workspace_connector_sessions').then(result=>{if(current)setRows(result);}).catch(failure=>{if(current)setError(failure.message);});return()=>{current=false;};},[previewMode]);
 async function revoke(row){setPending(row.id);setError('');try{await rpc('workspace_connector_revoke',{p_id:row.id});await load();onNotice('Conexión revocada. Codex ya no puede operar Workspace con esa sesión.');}catch(failure){setError(failure.message);}finally{setPending('');}}
 return <section><h2>Conexiones con Codex</h2><p>Organiza archivos y actividades desde Codex con tus permisos editoriales. Cada conexión dura 7 días y puedes revocarla aquí.</p><p>Para conectar esta Mac, pide en Codex «conecta mi GBA ID con Workspace» e inicia sesión en la ventana de autorización.</p>{error&&<p role="alert" className="gw-error">{error}</p>}{rows===null?<p role="status">Consultando conexiones…</p>:!rows.length?<div className="gw-empty"><h3>Aún no hay conexiones.</h3><p>Las conexiones autorizadas aparecerán aquí.</p></div>:<div className="gw-list">{rows.map(row=>{const active=!row.revoked_at&&new Date(row.expires_at)>new Date();return <article key={row.id}><h3>{row.name}</h3><p>{row.revoked_at?'Revocada':active?'Activa':'Vencida'} · Hasta {dateLabel(row.expires_at)}</p>{active&&<button type="button" disabled={Boolean(pending)} onClick={()=>void revoke(row)}>{pending===row.id?'Revocando…':'Revocar conexión'}</button>}</article>;})}</div>}</section>;
}
