import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Globe2, MapPin, Monitor, PenTool, Search, ShieldCheck } from 'lucide-react';
import { useNetworkDirectory, useNetworkImpression } from '../hooks/useNetworkServers';
import { activePartners, EDITIONS, GAME_STATUS, safeUrl, STYLES } from '../network/serverData';
import ServerDetail from '../components/network/ServerDetail';
import PartnerPlans from '../components/network/PartnerPlans';
import SurveyInvitation from '../components/survey/SurveyInvitation';
import Mothership from './Mothership';
import NetworkServerStudio from '../components/studio/NetworkServerStudio';
import NetworkAdminTab from '../mothership/NetworkAdminTab';
import '../components/network/network.css';

function ServerCard({server,partner,onOpen,track,blocked}){
  const ref=useRef(null);
  useNetworkImpression(ref,blocked?null:server.id,'directory_view','directory',partner?.id||null,track);
  return <button ref={ref} className="vn-card" type="button" onClick={()=>onOpen(server,partner?.id)} aria-label={`Ver servidor ${server.nombre}`}>
    <div className="vn-card-image">{safeUrl(server.portada_url)?<img loading="lazy" src={safeUrl(server.portada_url)} alt=""/>:<span className="vn-card-initial">{server.nombre.slice(0,2).toUpperCase()}</span>}{partner&&<span className="vn-sponsored">GBA Partner · Patrocinado</span>}</div>
    <div className="vn-card-body"><div className="vn-card-title">{safeUrl(server.logo_url)?<img className="vn-logo" src={safeUrl(server.logo_url)} alt="" loading="lazy"/>:<span className="vn-logo">{server.nombre.slice(0,2).toUpperCase()}</span>}<div><h3>{server.nombre}{server.verificada&&<ShieldCheck size={14} className="vn-verified" aria-label="Administración verificada"/>}</h3><p>{server.estilo} · {server.idioma}</p></div></div><p className="vn-card-description">{server.headline||server.descripcion}</p><div className="vn-card-footer"><span>{EDITIONS[server.edition]}</span><span className="vn-status"><i className="vn-dot" style={server.game_status!=='activo'?{background:'#ac9665'}:undefined}/>{GAME_STATUS[server.game_status]}<ArrowUpRight size={13}/></span></div></div>
  </button>;
}
function NetworkHero({heroes,onOpen,onStudio,onDiscover,track,previewMode,blocked}){
  const [index,setIndex]=useState(0);
  const [paused,setPaused]=useState(false);
  const ref=useRef(null);
  const current=heroes[index%Math.max(heroes.length,1)];
  useNetworkImpression(ref,blocked?null:current?.server.id,'hero_view','hero',current?.partner.id,track);
  useEffect(()=>{
    if(heroes.length<2||paused||blocked||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const timer=setInterval(()=>{if(document.visibilityState==='visible')setIndex(i=>(i+1)%heroes.length);},10000);
    return()=>clearInterval(timer);
  },[heroes.length,paused,blocked]);
  const server=current?.server,partner=current?.partner;
  const cover=safeUrl(partner?.hero_image_url)||safeUrl(server?.portada_url);
  return <section ref={ref} className={`vn-hero${server?' vn-hero-sponsored':''}`} aria-label={server?`Patrocinio de ${server.nombre}`:'Bienvenida a Network'} onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocusCapture={()=>setPaused(true)} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setPaused(false);}}>
    <div className="vn-atmosphere"/>{cover&&<img key={cover} className="vn-cover" src={cover} alt=""/>}<div className="vn-shade"/>
    <header className="vn-top"><div className="vn-brand"><Globe2 size={22} className="text-[#0066ff]"/><span>VISTA NETWORK</span><span className="vn-eyebrow">Piloto</span></div><button className="vn-link" onClick={onStudio}><PenTool size={15}/><span className="hidden sm:inline">Tu servidor en</span> Network<ArrowUpRight size={14}/></button></header>
    {previewMode&&<div className="vn-demo">Vista de desarrollo · Servidores y patrocinios de muestra</div>}
    <div className="vn-hero-body"><div className="vn-hero-copy"><p className="vn-eyebrow">{server?'GBA Partners · Espacio patrocinado':'Geopolíticos de Minecraft'}</p><h1>{partner?.hero_title||server?.nombre||'Muchos mundos.\nUna misma comunidad.'}</h1><p className="vn-hero-desc">{partner?.hero_description||server?.headline||'Descubre comunidades donde las naciones, la diplomacia y las decisiones de sus jugadores construyen el mundo.'}</p>
      {server&&<div className="vn-hero-meta"><span><Globe2 size={13}/>{server.nombre}</span><span><Monitor size={13}/>{EDITIONS[server.edition]}</span><span><MapPin size={13}/>{server.idioma}</span></div>}
      <div className="vn-actions">{server?<button className="vn-button vn-button-light" onClick={()=>onOpen(server,partner.id)}>Explorar servidor<ArrowUpRight size={16}/></button>:<button className="vn-button vn-button-light" onClick={onDiscover}>Descubrir servidores<ArrowDown size={16}/></button>}<button className="vn-button vn-button-outline" onClick={onStudio}>{server?'Registrar mi servidor':'Registrar gratis'}<ArrowRight size={15}/></button></div>
    </div></div>
    <footer className="vn-hero-bottom"><div className="vn-slide-controls">{heroes.length>1?<><button className="vn-round" aria-label="Patrocinio anterior" onClick={()=>setIndex(i=>(i+heroes.length-1)%heroes.length)}><ChevronLeft size={16}/></button><div className="vn-progress">{heroes.map((item,i)=><button key={item.partner.id} aria-label={`Ver patrocinio de ${item.server.nombre}`} aria-current={i===index%heroes.length} onClick={()=>setIndex(i)}/>)}</div><button className="vn-round" aria-label="Siguiente patrocinio" onClick={()=>setIndex(i=>(i+1)%heroes.length)}><ChevronRight size={16}/></button><button className="vn-slide-name" onClick={()=>setPaused(p=>!p)} aria-pressed={paused}>{paused?'Reanudar':'Pausar'}</button></>:<span className="vn-eyebrow text-[#b6c5b5]">{server?server.nombre:'Una comunidad. Muchos mundos.'}</span>}</div><button className="vn-link" onClick={onDiscover}>Todos los servidores<ArrowDown size={15}/></button></footer>
  </section>;
}
export default function NetworkPreview({previewMode=false,onOpenStudio}){
  const {servers,partners,loading,error,refresh,track}=useNetworkDirectory(previewMode);
  const [search,setSearch]=useState('');const [edition,setEdition]=useState('');const [style,setStyle]=useState('');const [language,setLanguage]=useState('');
  const [selected,setSelected]=useState(null);const [previewStudio,setPreviewStudio]=useState(false);const [tick,setTick]=useState(Date.now());
  const directory=useRef(null);
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const livePartners=useMemo(()=>activePartners(partners,tick),[partners,tick]);
  const heroPartners=livePartners.filter(p=>['hero','both'].includes(p.placement)).map(partner=>({partner,server:servers.find(s=>s.id===partner.server_id)})).filter(item=>item.server);
  const directoryPartners=useMemo(()=>new Map(livePartners.filter(p=>['directory','both'].includes(p.placement)).map(p=>[p.server_id,p])),[livePartners]);
  const visible=useMemo(()=>servers.filter(s=>(!edition||s.edition===edition)&&(!style||s.estilo===style)&&(!language||s.idioma===language)&&`${s.nombre} ${s.headline} ${s.descripcion} ${s.estilo} ${s.region}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a,b)=>Number(directoryPartners.has(b.id))-Number(directoryPartners.has(a.id))||a.nombre.localeCompare(b.nombre)),[servers,search,edition,style,language,directoryPartners]);
  const open=useCallback((server,partnerId=null)=>{setSelected({server,partnerId});const url=new URL(window.location.href);url.searchParams.set('network','1');url.searchParams.set('server',server.slug);window.history.replaceState(null,'',url);},[]);
  const close=useCallback(()=>{setSelected(null);const url=new URL(window.location.href);url.searchParams.delete('server');window.history.replaceState(null,'',url);},[]);
  useEffect(()=>{const slug=new URLSearchParams(window.location.search).get('server');if(slug){const server=servers.find(s=>s.slug===slug);if(server)setSelected(current=>current?.server.id===server.id?current:{server,partnerId:null});}},[servers]);
  const studio=()=>{if(onOpenStudio)onOpenStudio();else if(previewMode)setPreviewStudio(true);};
  const discover=()=>directory.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  if(previewMode && new URLSearchParams(window.location.search).get('mothership-preview')==='1') return <Mothership previewMode/>;
  if(previewMode && new URLSearchParams(window.location.search).get('network-admin-preview')==='1') return <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12"><NetworkAdminTab previewMode/></div>;
  if(previewStudio)return <div className="vn p-6 md:p-10 min-h-screen"><button className="vn-button vn-button-quiet mb-8" onClick={()=>setPreviewStudio(false)}>Volver a Network</button><NetworkServerStudio previewMode userId="preview-owner"/></div>;
  return <div className="vn"><NetworkHero heroes={heroPartners} onOpen={open} onStudio={studio} onDiscover={discover} track={track} previewMode={previewMode} blocked={Boolean(selected)}/>
    <section className="vn-directory" ref={directory}><div className="vn-section-heading"><div><p className="vn-eyebrow">Explora Network</p><h2>Encuentra tu próximo mundo.</h2><p>Servidores geopolíticos de Minecraft, reunidos en VISTA.</p></div><span className="vn-count">{servers.length} {servers.length===1?'servidor publicado':'servidores publicados'} · Piloto con GBA ID</span></div>
      <div className="vn-filters"><label className="vn-search"><span className="sr-only">Buscar servidores</span><Search size={16}/><input className="vn-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Busca un servidor o una comunidad"/></label><select className="vn-input" aria-label="Filtrar por edición" value={edition} onChange={e=>setEdition(e.target.value)}><option value="">Todas las ediciones</option>{Object.entries(EDITIONS).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select><select className="vn-input" aria-label="Filtrar por enfoque" value={style} onChange={e=>setStyle(e.target.value)}><option value="">Todos los enfoques</option>{STYLES.map(s=><option key={s}>{s}</option>)}</select><select className="vn-input" aria-label="Filtrar por idioma" value={language} onChange={e=>setLanguage(e.target.value)}><option value="">Todos los idiomas</option>{[...new Set(servers.map(s=>s.idioma))].sort().map(s=><option key={s}>{s}</option>)}</select></div>
      {loading?<div className="vn-empty" role="status">Abriendo Network…</div>:error?<div className="vn-error" role="alert">{error}<button className="vn-button vn-button-quiet ml-4" onClick={refresh}>Reintentar</button></div>:visible.length?<div className="vn-grid">{visible.map(server=><ServerCard server={server} key={server.id} partner={directoryPartners.get(server.id)} onOpen={open} track={track} blocked={Boolean(selected)}/>)}</div>:<div className="vn-empty"><Globe2 size={30} className="mx-auto text-[#0066ff]"/><h3>{servers.length?'Todavía hay mundos por descubrir.':'El siguiente mundo puede ser el tuyo.'}</h3><p>{servers.length?'Prueba con otro idioma, enfoque o nombre.':'Registra la ficha gratuita de tu servidor. Las primeras comunidades de Network aparecerán aquí después de su revisión.'}</p><div className="vn-actions"><button className="vn-button" onClick={servers.length?()=>{setSearch('');setEdition('');setStyle('');setLanguage('');}:studio}>{servers.length?'Limpiar filtros':'Registrar mi servidor'}<ArrowRight size={15}/></button></div></div>}
      <p className="vn-note">Los espacios pagados se identifican como patrocinados. El estado de cada servidor es declarado por su administración.</p>
    </section>
    {!previewMode&&<SurveyInvitation dark/>}
    <PartnerPlans onChoose={studio}/>
    {selected&&<ServerDetail server={selected.server} partnerId={selected.partnerId} track={track} onClose={close} previewMode={previewMode}/>}
  </div>;
}
