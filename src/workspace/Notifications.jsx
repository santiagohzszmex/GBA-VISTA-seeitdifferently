import React, { useEffect, useRef, useState } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { rpc } from './ui';
import { dateLabel } from './gimgModel';

export default function Notifications({ actorId, previewMode, previewItems = [], onOpen, blocked }) {
  const [open,setOpen]=useState(false), [unreadOnly,setUnreadOnly]=useState(false);
  const [inbox,setInbox]=useState({items:[],unread_count:0}), [error,setError]=useState('');
  const [reading,setReading]=useState(false), [previewRead,setPreviewRead]=useState([]);
  const refresh=useRef(null), trigger=useRef(null), panel=useRef(null);
  useEffect(()=>{
    if(previewMode){setPreviewRead([]);return;}
    let active=true, pending=false;
    async function fetchInbox(){
      if(!active || pending || document.hidden) return;
      pending=true;
      try {const result=await rpc('workspace_notifications');if(active){setInbox(result);setError('');}}
      catch(failure){if(active)setError(failure.message || 'No pudimos consultar tus notificaciones.');}
      finally{pending=false;}
    }
    setInbox({items:[],unread_count:0});setError('');setOpen(false);
    refresh.current=fetchInbox;void fetchInbox();
    const timer=setInterval(fetchInbox,45000);
    window.addEventListener('focus',fetchInbox);document.addEventListener('visibilitychange',fetchInbox);
    return ()=>{active=false;clearInterval(timer);window.removeEventListener('focus',fetchInbox);document.removeEventListener('visibilitychange',fetchInbox);refresh.current=null;};
  },[actorId,previewMode]);
  useEffect(()=>{if(open)panel.current?.focus();},[open]);
  const items=previewMode ? previewItems.map(item=>({...item,read_at:previewRead.includes(item.id) ? 'read' : null})) : inbox.items;
  const unread=previewMode ? items.filter(item=>!item.read_at).length : inbox.unread_count;
  const close=()=>{setOpen(false);trigger.current?.focus();};
  async function mark(item){
    if(previewMode){setPreviewRead(rows=>[...rows,item.id]);return item;}
    const target=await rpc('workspace_read_notification',{p_id:item.id});
    await refresh.current?.();return target;
  }
  async function readAll(){
    setReading(true);setError('');
    try {if(previewMode)setPreviewRead(items.map(item=>item.id));else {await rpc('workspace_read_notification',{p_before:inbox.fetched_at});await refresh.current?.();}}
    catch(failure){setError(failure.message);}finally{setReading(false);}
  }
  function visit(item){onOpen(async()=>{try{const target=await mark(item);if(target){close();return target;}}catch(failure){setError(failure.message);}return null;},item);}
  return <div className="gw-notifications">
    <button ref={trigger} type="button" aria-label={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} aria-expanded={open} aria-controls="workspace-notifications" disabled={blocked} onClick={()=>{setOpen(value=>!value);void refresh.current?.();}}><Bell size={17} aria-hidden="true"/>{unread>0 && <span className="gw-notification-badge">{unread>99 ? '99+' : unread}</span>}</button>
    {open && <aside ref={panel} tabIndex={-1} id="workspace-notifications" className="gw-notification-panel" aria-label="Tus notificaciones" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();close();}}}>
      <header><div><h2>Notificaciones</h2><p>{unread ? `${unread} sin leer` : 'Estás al día'}</p></div><button type="button" aria-label="Cerrar notificaciones" onClick={close}><X size={18}/></button></header>
      <div className="gw-notification-tools"><label><input type="checkbox" checked={unreadOnly} onChange={event=>setUnreadOnly(event.target.checked)}/>Sólo sin leer</label><button type="button" disabled={reading || !unread || (!previewMode && !inbox.fetched_at)} onClick={()=>void readAll()}><CheckCheck size={15}/>Marcar leídas</button></div>
      {error && <div className="gw-notification-error"><p role="alert">{error}</p><button type="button" onClick={()=>void refresh.current?.()}>Reintentar</button></div>}
      <div className="gw-notification-list">{items.filter(item=>!unreadOnly || !item.read_at).map(item=><button type="button" key={item.id} className={!item.read_at ? 'gw-notification-unread' : ''} onClick={()=>visit(item)}><strong>{item.title}</strong><span>{item.body}</span><small>{item.project_title ? `${item.project_title} · ` : ''}{dateLabel(item.created_at)}</small>{!item.read_at && <span className="gw-sr-only">Sin leer</span>}</button>)}{!items.some(item=>!unreadOnly || !item.read_at) && <p className="gw-notification-empty">{unreadOnly ? 'No tienes notificaciones pendientes.' : 'Aquí aparecerán tus asignaciones, revisiones y avisos de la edición.'}</p>}</div>
      <footer>Los avisos corresponden a tus funciones y accesos vigentes en GIMG.</footer>
    </aside>}
  </div>;
}
