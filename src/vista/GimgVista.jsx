import React,{useEffect,useState} from 'react';
import {ArrowDown,ArrowUpRight,Loader2} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {isPublicPublication} from './catalog.mjs';
import EditionReader from './EditionReader';
import NewsCoverflow from '../components/news/NewsCoverflow';
import HalloweenScene from '../components/seasonal/HalloweenScene';
import {isHalloweenSeason} from '../utils/season';
import '../components/seasonal/halloween.css';
import './vista.css';

export default function GimgVista({preview=false}){
 const [items,setItems]=useState([]),[focusedId,setFocusedId]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  async function load(){
   try{
    const {data,error}=await supabase.from('contenido').select('id,titulo,descripcion,poster_url,enlace_pdf,calidad_json,paginas_i18n,categoria,created_at,estado_publicacion,catalog_origin,archived_at,sello_editorial,edition_credits,es_comunidad,vistas,likes_count,titulo_i18n,descripcion_i18n,poster_i18n,idioma_original,publicar_at,gimg_video_url,gimg_video_portada_url,gimg_video_titulo,gimg_video_descripcion,gimg_video_estreno_at').eq('catalog_origin','gimg').eq('estado_publicacion','aprobado').is('archived_at',null).order('created_at',{ascending:false}).abortSignal(controller.signal);
    if(error)throw error;if(!live)return;
    const publications=(data||[]).filter(isPublicPublication);setItems(publications);
    const params=new URLSearchParams(location.search),id=params.get('content')||params.get('edition');
    if(id){const item=publications.find(p=>p.id===id);if(item)setFocusedId(item.id);else setError('Esta publicación ya no está disponible en VISTA.');}
   }catch(e){if(live&&!controller.signal.aborted)setError('No pudimos cargar las publicaciones. Vuelve a intentarlo en unos momentos.');}
   finally{if(live)setLoading(false);}
  }
  if(preview){setItems([{id:'preview',titulo:'Edición de prueba',descripcion:'Muestra sintética para comprobar el lector y los créditos.',poster_url:'/gba/workspace/workspace-icon.png',enlace_pdf:JSON.stringify(['https://gba.software/gba/workspace/workspace-icon.png']),edition_credits:[{role:'Investigación',name:'Persona de ejemplo',detail:'Contenido de prueba, sin autoría real.'}],categoria:'Revista',catalog_origin:'gimg',estado_publicacion:'aprobado'}]);setLoading(false);}else void load();
  return()=>{live=false;controller.abort();};
 },[preview]);
 function open(item){const url=new URL(location.href);url.searchParams.delete('edition');url.searchParams.set('content',item.id);history.replaceState(null,'',url);}
 function close(){const url=new URL(location.href);url.searchParams.delete('content');url.searchParams.delete('edition');history.replaceState(null,'',url);}
 return <div className={`gv${isHalloweenSeason()?' vista-halloween':''}`}>
  <div className="gv-body"><header className="gv-header" id="inicio"><a className="gv-wordmark" href="https://vista.gba.software/" aria-label="VISTA, inicio">VISTA<span>Global Insight Media Group</span></a><a className="gv-gba-link" href="https://gba.software/#gimg">See it differently. <ArrowUpRight size={14}/></a></header>
  <main>
    <section className="gv-hero">{items[0]?.poster_url&&<img className="gv-hero-image" src={items[0].poster_url} alt="" aria-hidden="true"/>}<div className="gv-hero-copy"><p className="gv-kicker">GLOBAL INSIGHT MEDIA GROUP</p><h1>Una nueva forma<br/>de ver el mundo.</h1><p>Historias, cultura e ideas con una mirada propia. Descubre las publicaciones de GIMG, ahora en VISTA.</p><a className="gv-action" href="#publicaciones">Explorar publicaciones <ArrowDown size={16}/></a></div><HalloweenScene/></section>
    <section id="publicaciones" className="gv-catalog"><div className="gv-section-head"><div><p className="gv-kicker">EL KIOSCO DE GIMG</p><h2>Nuestras publicaciones.</h2></div><span>{items.length} {items.length===1?'edición':'ediciones'}</span></div>
     {loading?<p role="status"><Loader2 className="gv-spin" size={18}/>Cargando publicaciones…</p>:<NewsCoverflow news={items} focusedNewsId={focusedId} onOpenPublication={open} onClosePublication={close} renderExpandedPanel={(item,content,onClose)=><EditionReader item={item} content={content} onClose={onClose}/>}/>}
     {error&&<p className="gv-error" role="alert">{error}</p>}{!loading&&!error&&!items.length&&<p>Estamos preparando nuestras próximas publicaciones.</p>}
    </section><section className="gv-about"><p className="gv-kicker">UNA MIRADA EDITORIAL PROPIA</p><h2>GIMG crea.<br/>VISTA lo comparte.</h2><div><p>Global Insight Media Group reúne el trabajo de investigación, escritura, ilustración y edición de nuestro equipo. Aquí encuentras sus publicaciones terminadas.</p><a href="mailto:prensa@gba.software">Contacto editorial <ArrowUpRight size={16}/></a></div></section>

  </main><footer className="gv-footer"><a href="https://gba.software/">GBA · See it differently.</a><span>VISTA es una plataforma de GIMG.</span><a href="https://gba.software/gba/privacy/">Privacidad</a><a href="/mothership/">Administración</a></footer>
 </div></div>;
}
