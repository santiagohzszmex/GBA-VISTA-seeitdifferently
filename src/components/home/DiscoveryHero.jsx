import React, { useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import ImmersiveMedia from './ImmersiveMedia';
import { useNetworkImpression } from '../../hooks/useNetworkServers';
import { safeUrl } from '../../network/serverData';

const labels = { video:'Video', newspaper:'Periódico', server:'Servidor' };
export default function DiscoveryHero({ mode, entries, loading, error, onRetry, onOpen, onPlay, onStudio, track }) {
  const [index, setIndex] = useState(0);
  const hero = useRef(null);
  const isPartner = mode === 'partners';
  const position = Math.min(index, Math.max(entries.length - 1, 0));
  const entry = entries[position];
  const item = isPartner ? entry?.server : entry?.item;
  const partner = entry?.partner;
  const title = isPartner ? partner?.hero_title || item?.nombre : item?.titulo || item?.nombre;
  const kind = isPartner ? 'server' : entry?.kind;
  // Top 10 exposure is not a profile visit. Only paid impressions are tracked here.
  useNetworkImpression(hero, isPartner ? item?.id : null, 'hero_view', 'hero', partner?.id, track);
  const change = direction => setIndex((position + direction + entries.length) % entries.length);
  return <section ref={hero} className="vh-hero" aria-label={isPartner ? 'GBA Partners en Inicio' : 'Top 10 de VISTA'}>
    <ImmersiveMedia key={entry?.id || partner?.id || 'empty'} image={isPartner ? safeUrl(partner?.hero_image_url) || safeUrl(item?.portada_url) : kind === 'server' ? safeUrl(item?.portada_url) : item?.banner_url || item?.poster_url} item={kind === 'video' ? item : undefined} videoUrl={isPartner ? safeUrl(partner?.hero_video_url) : undefined} youtubeId={kind === 'video' ? item?.youtube_id : undefined}/>
    <div className="vh-shade"/>
    {!isPartner && entry && <span className="vh-rank" aria-hidden="true">{position + 1}</span>}
    <header className="vh-topline"><span className="vh-brand">{isPartner ? 'GBA Partners.' : 'Top 10.'}</span><span className="vh-label">{isPartner ? entry ? 'Publicidad' : 'Promoción de proyectos' : 'Popular en VISTA'}</span></header>
    <div className="vh-copy">
      <p className="vh-label">{entry ? isPartner ? 'Contenido patrocinado' : `N.º ${position + 1} · ${labels[kind]}` : loading ? 'Cargando' : isPartner ? 'Tu comunidad, en primer plano' : 'Servidores · Periódicos · Videos'}</p>
      <h2 className="vh-title">{title || (loading ? 'Un momento.' : isPartner ? 'Un lugar para\nlo que viene.' : 'Las historias que\nnos reúnen.')}</h2>
      <p className="vh-description">{entry ? isPartner ? partner?.hero_description || item?.headline || item?.descripcion : item?.headline || item?.descripcion : isPartner ? 'Dale visibilidad a tu proyecto con un espacio de GBA Partners en Inicio. Consulta las opciones disponibles para tu comunidad.' : 'Los diez más visitados por la comunidad, en un mismo lugar. Cada GBA ID cuenta una vez por publicación o servidor.'}</p>
      {error && <p className="vh-error" role="alert">{error}</p>}
      <div className="vh-actions">{entry ? <>
        <button className="vh-button" type="button" onClick={() => onOpen(entry)}>{kind === 'server' ? 'Descubrir servidor' : kind === 'newspaper' ? 'Leer periódico' : 'Ver video'}<ArrowUpRight size={18}/></button>
        {kind === 'video' && item?.youtube_id && <button className="vh-button vh-button-quiet" type="button" onClick={() => onPlay?.(item.youtube_id, item)}><Play size={17}/>Reproducir</button>}
      </> : error ? <button className="vh-button" type="button" onClick={onRetry}>Reintentar</button> : !loading && isPartner ? <button className="vh-button" type="button" onClick={onStudio}>Conocer GBA Partners<ArrowUpRight size={18}/></button> : null}</div>
      {!isPartner && entry && <p className="vh-label mt-6 text-white/60">{Number(entry.reach).toLocaleString('es-MX')} GBA ID únicos · Histórico</p>}
    </div>
    <nav className="vh-pager" aria-label={isPartner ? 'Campañas de Partners' : 'Posiciones del Top 10'}>
      {entries.length > 1 && <><button type="button" className="vh-arrow" aria-label="Anterior" onClick={() => change(-1)}><ChevronLeft size={18}/></button><div className="vh-pages">{entries.map((value, i) => <button type="button" key={value.id || value.partner.id} aria-current={i === position} aria-label={`${isPartner ? 'Patrocinado' : 'Puesto'} ${i + 1}: ${value.item?.titulo || value.item?.nombre || value.server?.nombre}`} onClick={() => setIndex(i)}>{String(i + 1).padStart(2, '0')}</button>)}</div><button type="button" className="vh-arrow" aria-label="Siguiente" onClick={() => change(1)}><ChevronRight size={18}/></button></>}
      <span className="vh-caption">{isPartner ? entry ? 'Promoción pagada · GBA Partners' : 'Espacio disponible' : 'Visitas únicas · Sin impresiones publicitarias'}</span>
    </nav>
  </section>;
}
