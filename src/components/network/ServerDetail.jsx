import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Check, Copy, Map, ShieldCheck, X } from 'lucide-react';
import { profileLink,studioLink } from '../../studios/studioData';
import '../../studios/studios.css';
import { EDITIONS, GAME_STATUS, safeUrl } from '../../network/serverData';

export default function ServerDetail({ server, partnerId = null, track, onClose, previewMode }) {
  const [copied,setCopied]=useState(false);
  const [notice,setNotice]=useState('');
  const dialog=useRef(null);
  useEffect(()=>{
    const previousFocus=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog.current?.querySelector('button')?.focus();
    void track(server.id,'profile_view','profile',partnerId);
    const keys=event=>{
      if(event.key==='Escape') onClose();
      if(event.key==='Tab'){
        const nodes=dialog.current?.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]');
        if(!nodes?.length) return;
        const first=nodes[0],last=nodes[nodes.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',keys);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keys);previousFocus?.focus?.();};
  },[server.id,partnerId,track,onClose]);
  const copy=async()=>{
    if(previewMode){setNotice('Vista de muestra: esta dirección no corresponde a un servidor real.');return;}
    try{await navigator.clipboard.writeText(server.ip);setCopied(true);void track(server.id,'copy_ip','profile',partnerId);}
    catch{setNotice('Puedes seleccionar y copiar la dirección que aparece abajo.');}
  };
  const link=(url,label,event,icon)=>(safeUrl(url)&&<a className="vn-button vn-button-quiet" href={safeUrl(url)} target="_blank" rel="noopener noreferrer" onClick={()=>{if(!previewMode) void track(server.id,event,'profile',partnerId);}}>{icon}{label}<ArrowUpRight size={14}/></a>);
  return createPortal(<div className="vn vn-overlay" onClick={onClose}><section className="vn-modal" role="dialog" aria-modal="true" aria-labelledby="vn-server-name" ref={dialog} onClick={e=>e.stopPropagation()}>
    <header className="vn-modal-header"><span className="vn-eyebrow">VISTA Network · Ficha del servidor</span><button type="button" className="vn-round" aria-label="Cerrar ficha" onClick={onClose}><X size={18}/></button></header>
    {safeUrl(server.portada_url)&&<img className="vn-modal-cover" src={safeUrl(server.portada_url)} alt={`Portada de ${server.nombre}`}/>}
    <div className="vn-modal-body"><span className="vn-eyebrow">{server.estilo} · {EDITIONS[server.edition]}</span><h2 id="vn-server-name">{server.nombre}</h2>
      {server.verificada&&<p className="vn-link vn-verified"><ShieldCheck size={15}/>Administración verificada por GBA</p>}
      {server.headline&&<p className="vn-note">{server.headline}</p>}<p className="vn-modal-copy">{server.descripcion}</p>
      <div className="vn-detail-grid">{[['Idioma',server.idioma],['Edición',EDITIONS[server.edition]],['Versión',server.version||'Consultar con el servidor'],['Comunidad',server.region||'Global'],['Enfoque',server.estilo],['Estado declarado',GAME_STATUS[server.game_status]]].map(([label,value])=><div key={label}><small>{label}</small>{value}</div>)}</div>
      {server.developer&&<div className="ds-developer"><div><small className="vn-eyebrow block mb-2">Desarrollado por</small><a className="vn-link" href={server.developer.type==='studio'?studioLink(server.developer.slug):profileLink(server.developer.handle)}>{server.developer.name}<ArrowUpRight size={14}/></a></div></div>}
      {server.access_instructions&&<p className="vn-note whitespace-pre-wrap">{server.access_instructions}</p>}
      <div className="vn-actions">{link(server.access_url,server.access_type==='modpack'?'Obtener modpack':'Solicitar acceso','access_click')}{server.ip&&<button className="vn-button" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'Dirección copiada':'Copiar IP'}</button>}{link(server.discord_url,'Discord','discord_click')}{link(server.website_url,'Sitio web','website_click')}{link(server.map_url,'Ver mapa','map_click',<Map size={15}/>)}{link(server.support_url,'Apoyar el proyecto','support_click')}</div>
      {server.ip&&<div className="vn-ip mt-4">{server.ip}</div>}{notice&&<p className="vn-alert" role="status">{notice}</p>}
      {server.support_url&&<p className="vn-note">El apoyo se gestiona en una plataforma externa y llega al proyecto.</p>}
      <p className="vn-note">Información proporcionada por la administración del servidor. La ficha gratuita está disponible durante el piloto de Network.</p>
    </div>
  </section></div>,document.body);
}
