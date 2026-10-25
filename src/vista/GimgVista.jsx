import React,{useEffect,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowUpRight,BookOpen,Loader2,Home,PanelsTopLeft,Shield,Globe} from 'lucide-react';
import {supabase} from '../supabaseClient';
import {useAuth} from '../context/AuthContext';
import {isPublicPublication,publicationPages} from './catalog.mjs';
import {getGimgPremiereState} from '../utils/editionRelease';
import NewsCoverflow from '../components/news/NewsCoverflow';
import './vista.css';

export default function GimgVista({preview=false}){
 const {isDueño}=useAuth();
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{
  let live=true;const controller=new AbortController();
  async function load(){
   try{
    const {data,error}=await supabase.from('contenido').select('id,titulo,descripcion,poster_url,enlace_pdf,calidad_json,paginas_i18n,categoria,created_at,estado_publicacion,catalog_origin,archived_at,sello_editorial,es_comunidad,vistas,likes_count,titulo_i18n,descripcion_i18n,poster_i18n,idioma_original,publicar_at,gimg_video_url,gimg_video_portada_url,gimg_video_titulo,gimg_video_descripcion,gimg_video_estreno_at').eq('catalog_origin','gimg').eq('estado_publicacion','aprobado').is('archived_at',null).order('created_at',{ascending:false}).abortSignal(controller.signal);
    if(error)throw error;if(!live)return;
    const publications=(data||[]).filter(isPublicPublication);setItems(publications);
    const params=new URLSearchParams(location.search),id=params.get('content')||params.get('edition');
    if(id){const item=publications.find(p=>p.id===id);if(item)setSelected(item);else setError('Esta publicación ya no está disponible en VISTA.');}
   }catch(e){if(live&&!controller.signal.aborted)setError('No pudimos cargar las publicaciones. Vuelve a intentarlo en unos momentos.');}
   finally{if(live)setLoading(false);}
  }
  if(preview){setItems([{id:'preview',titulo:'Ahuautle',descripcion:'Una mirada a la gastronomía de México.',categoria:'Revista',catalog_origin:'gimg',estado_publicacion:'aprobado'}]);setLoading(false);}else void load();
  return()=>{live=false;controller.abort();};
 },[preview]);
 const premiere=getGimgPremiereState(selected);
 function open(item){setSelected(item);const url=new URL(location.href);url.search='';url.searchParams.set('content',item.id);history.replaceState(null,'',url);window.scrollTo({top:0,behavior:'instant'});}
 function close(){setSelected(null);const url=new URL(location.href);url.search='';history.replaceState(null,'',url);}
 return <div className="gv">
  <aside className="gv-sidebar" aria-label="Navegación de VISTA"><a className="gv-side-brand" href="https://vista.gba.software/" aria-label="VISTA, inicio">V.</a><nav><a href="#inicio" onClick={close} aria-label="Inicio"><Home size={22}/><span>Inicio</span></a><a href="#publicaciones" onClick={close} aria-label="Publicaciones"><BookOpen size={22}/><span>Publicaciones</span></a><a href="/keynotes/" aria-label="Keynotes"><PanelsTopLeft size={22}/><span>Keynotes</span></a><a href="/workspace/web/" aria-label="Workspace"><PanelsTopLeft size={22}/><span>Workspace</span></a>{isDueño&&<a href="/mothership/" aria-label="Mothership"><Shield size={22}/><span>Mothership</span></a>}</nav><a className="gv-side-gba" href="https://gba.software/" aria-label="Ir a GBA"><Globe size={22}/><span>GBA</span></a></aside>
  <div className="gv-body"><header className="gv-header" id="inicio"><a className="gv-wordmark" href="https://vista.gba.software/" aria-label="VISTA, inicio">VISTA<span>Global Insight Media Group</span></a><a className="gv-gba-link" href="https://gba.software/#gimg">See it differently. <ArrowUpRight size={14}/></a></header>
  <main>
   {selected?<article className="gv-reader"><button type="button" onClick={close}><ArrowLeft size={16}/>Todas las publicaciones</button><p className="gv-kicker">GIMG · PUBLICACIÓN</p><h1>{selected.titulo}</h1><p className="gv-description">{selected.descripcion}</p><div className="gv-pages">{premiere.hasPremiere&&premiere.videoReleased&&/^https:\/\//i.test(selected.gimg_video_url||'')&&<video src={selected.gimg_video_url} poster={selected.gimg_video_portada_url||undefined} controls playsInline preload="metadata" style={{width:'100%',borderRadius:12}}/>}{premiere.isPremierePhase&&<p>La edición estará disponible el {new Date(selected.publicar_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City',dateStyle:'long',timeStyle:'short'})} (hora de Ciudad de México).</p>}{(premiere.editionReleased?publicationPages(selected):[]).map((url,i)=>/\.pdf(?:[?#]|$)/i.test(url)?<a className="gv-pdf" key={url} href={url} target="_blank" rel="noopener noreferrer"><BookOpen size={20}/>Abrir documento PDF <ArrowUpRight size={16}/></a>:<figure key={url}><img src={url} alt={`${selected.titulo}, página ${i+1}`} loading={i?'lazy':'eager'}/><figcaption>Página {i+1}</figcaption></figure>)}</div>{premiere.editionReleased&&!publicationPages(selected).length&&<p>La publicación estará disponible para lectura próximamente.</p>}</article>:<>
    <section className="gv-hero">{items[0]?.poster_url&&<img className="gv-hero-image" src={items[0].poster_url} alt="" aria-hidden="true"/>}<div className="gv-hero-copy"><p className="gv-kicker">GLOBAL INSIGHT MEDIA GROUP</p><h1>Una nueva forma<br/>de ver el mundo.</h1><p>Historias, cultura e ideas con una mirada propia. Descubre las publicaciones de GIMG, ahora en VISTA.</p><a className="gv-action" href="#publicaciones">Explorar publicaciones <ArrowDown size={16}/></a></div></section>
    <section id="publicaciones" className="gv-catalog"><div className="gv-section-head"><div><p className="gv-kicker">EL KIOSCO DE GIMG</p><h2>Nuestras publicaciones.</h2></div><span>{items.length} {items.length===1?'edición':'ediciones'}</span></div>
     {loading?<p role="status"><Loader2 className="gv-spin" size={18}/>Cargando publicaciones…</p>:<NewsCoverflow news={items} onOpenPublication={open}/>}
     {error&&<p className="gv-error" role="alert">{error}</p>}{!loading&&!error&&!items.length&&<p>Estamos preparando nuestras próximas publicaciones.</p>}
    </section><section className="gv-about"><p className="gv-kicker">UNA MIRADA EDITORIAL PROPIA</p><h2>GIMG crea.<br/>VISTA lo comparte.</h2><div><p>Global Insight Media Group reúne el trabajo de investigación, escritura, ilustración y edición de nuestro equipo. Aquí encuentras sus publicaciones terminadas.</p><a href="mailto:prensa@gba.software">Contacto editorial <ArrowUpRight size={16}/></a></div></section>
   </>}
  </main><footer className="gv-footer"><a href="https://gba.software/">GBA · See it differently.</a><span>VISTA es una plataforma de GIMG.</span><a href="https://gba.software/gba/privacy/">Privacidad</a><a href="/mothership/">Administración</a></footer>
 </div></div>;
}
