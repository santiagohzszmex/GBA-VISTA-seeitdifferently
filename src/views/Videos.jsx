import React, { useEffect, useState } from 'react';
import { useContent } from '../hooks/useContent';
import VideoHero from '../components/home/VideoHero';
import ContentRow from '../components/ContentRow';
import { videoCategoryLabel } from '../utils/contentTypes';

export default function Videos({ onSelectMovie, onPlay }) {
  const { getAllContent, getTop10 } = useContent();
  const [catalog, setCatalog] = useState([]);
  const [top, setTop] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([getAllContent(), getTop10()]).then(([all, popular]) => { if (active) { setCatalog(all); setTop(popular); setLoading(false); } });
    return () => { active = false; };
  }, [getAllContent, getTop10]);
  const selected = catalog.filter(item => item.en_hero);
  const featured = selected.length ? selected : catalog.slice(0, 5);
  useEffect(() => {
    if (featured.length < 2 || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (!document.hidden) setIndex(current => (current + 1) % featured.length); }, 12000);
    return () => clearInterval(timer);
  }, [featured.length, paused, index]);
  const groups = {};
  catalog.filter(item => !item.es_comunidad).forEach(item => {
    const genres = item.generos?.length ? item.generos : [videoCategoryLabel(item.categoria) || 'General'];
    genres.forEach(genre => { (groups[genre] ||= []).push(item); });
  });
  const community = catalog.filter(item => item.es_comunidad);
  const current = featured[Math.min(index, featured.length - 1)];
  return <div className="pb-20 font-sans">
    {current ? <div className="vh-fullbleed relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
      <VideoHero movie={current} onPlay={onPlay} onSelectMovie={onSelectMovie}/>
      {featured.length > 1 && <div className="vh-pager"><div className="vh-pages">{featured.map((item, i) => <button type="button" key={item.id} aria-current={i === index} aria-label={`Ver ${item.titulo}`} onClick={() => setIndex(i)}>{i + 1}</button>)}</div></div>}
    </div> : <div className="vh-fullbleed"><div className="vh-hero"><div className="vh-copy"><span className="vh-brand">VISTA Videos.</span><h1 className="vh-title">{loading ? 'Un momento.' : 'Nuevas historias, pronto.'}</h1></div></div></div>}
    <div className="px-6 md:px-12 pt-12 space-y-16">
      <header><h1 className="text-3xl font-medium tracking-tight">Videos</h1><p className="text-[#86868b] mt-3">Producciones de GIMG y contenido de la comunidad.</p></header>
      {top.some(item => item.vistas > 0) && <ContentRow title="Los videos más vistos" items={top.filter(item => item.vistas > 0)} onSelect={onSelectMovie}/>}
      {community.length > 0 && <ContentRow title="Videos de la comunidad" items={community} onSelect={onSelectMovie}/>}
      {Object.entries(groups).map(([genre, items]) => <ContentRow key={genre} title={genre} items={items} onSelect={onSelectMovie}/>)}
    </div>
  </div>;
}
