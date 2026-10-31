import React, {useEffect, useId, useRef} from 'react';
import {ChevronUp, Share2, Check} from 'lucide-react';
import {getGimgPremiereState} from '../utils/editionRelease';
import {useEditionShare} from '../hooks/useEditionShare';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import EditionCredits from './EditionCredits';
import {publicationPages} from './catalog.mjs';

export default function EditionReader({item, content, onClose}) {
  const release = getGimgPremiereState(item), titleId = useId(), closeRef = useRef(null);
  const pages = publicationPages({...item, paginas_i18n:{es:item.paginas_i18n?.[content.lang] || item.paginas_i18n?.[item.idioma_original || 'es']}});
  const {shareEdition, shareStatus} = useEditionShare(item, content);
  useEffect(()=>{
    closeRef.current?.focus({preventScroll:true});
    const escape = event=>{if(event.key==='Escape')onClose(event);};
    document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
  },[onClose]);
  return <article className="gv-inline-reader" aria-labelledby={titleId}>
    <header className="gv-reader-toolbar"><div><p className="gv-kicker">VISTA · GIMG</p><h3 id={titleId}>{content.titulo}</h3></div><div className="gv-reader-actions">
      <LanguageSwitcher availableLangs={content.availableLangs} lang={content.lang} setLang={content.setLang} langLabel={content.langLabel}/>
      <a href={`#credits-${item.id}`}>Créditos</a>
      <button type="button" onClick={shareEdition}>{shareStatus==='idle'?<Share2 size={16}/>:<Check size={16}/>} {shareStatus==='copied'?'Enlace copiado':shareStatus==='shared'?'Compartida':'Compartir'}</button>
      <button ref={closeRef} type="button" onClick={onClose}><ChevronUp size={17}/>Plegar edición</button>
    </div></header>
    <div className="gv-reader-content"><p className="gv-description">{content.descripcion}</p>
      <div id={`credits-${item.id}`} className="gv-reader-credits"><EditionCredits credits={item.edition_credits}/></div>
      {release.hasPremiere && release.videoReleased && /^https:\/\//i.test(item.gimg_video_url || '') && <video src={item.gimg_video_url} poster={item.gimg_video_portada_url || undefined} controls playsInline preload="metadata"/>}
      {release.isPremierePhase && <p className="gv-release-note">La edición completa estará disponible el {new Date(item.publicar_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City',dateStyle:'long',timeStyle:'short'})}, hora de Ciudad de México.</p>}
      {release.coverAnnouncement && content.poster && <img className="gv-announced-cover" src={content.poster} alt={`Portada de ${content.titulo}`}/>}
      {release.editionReleased && <div className="gv-pages">{pages.map((url,index)=>/\.pdf(?:[?#]|$)/i.test(url)?<div key={url} className="gv-pdf-document"><iframe title={`${content.titulo} · PDF ${index+1}`} src={url} loading="lazy"/><a className="gv-pdf" href={url} target="_blank" rel="noopener noreferrer">Abrir PDF en otra pestaña si tu navegador no lo muestra</a></div>:<figure key={url}><img src={url} alt={`${content.titulo}, página ${index+1}`} loading={index?'lazy':'eager'}/><figcaption>Página {index+1}</figcaption></figure>)}</div>}
      {release.editionReleased && !pages.length && <p>Las páginas estarán disponibles próximamente.</p>}
      <button type="button" className="gv-fold-bottom" onClick={onClose}><ChevronUp size={18}/>Plegar edición</button>
    </div>
  </article>;
}
