import React, { useEffect, useRef, useState } from 'react';
import VideoCover from '../VideoCover';

// Only the visible hero plays. Off-screen YouTube players are unmounted and
// native videos pause, including when the browser tab is hidden.
export default function ImmersiveMedia({ image, item, videoUrl, youtubeId, alt = '' }) {
  const host = useRef(null);
  const video = useRef(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let intersecting = false;
    const update = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting && entry.intersectionRatio >= 0.3; update(); }, { threshold: [0, 0.3] });
    observer.observe(host.current);
    document.addEventListener('visibilitychange', update);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  useEffect(() => {
    setReady(false);
    if (!visible || reducedMotion) { video.current?.pause(); return; }
    video.current?.play().catch(() => {});
    const timer = setTimeout(() => setReady(true), 3000);
    return () => { clearTimeout(timer); video.current?.pause(); };
  }, [visible, reducedMotion, videoUrl, youtubeId]);
  return <div ref={host} className="vh-media" aria-hidden="true">
    {item ? <VideoCover item={item} prefer="banner" className="vh-image" alt=""/> : image ? <img className="vh-image" src={image} alt={alt} onError={e => { e.currentTarget.style.visibility = 'hidden'; }}/> : <div className="vh-atmosphere"/>}
    {videoUrl && <video ref={video} key={videoUrl} src={videoUrl} poster={image || undefined} muted loop playsInline preload={visible ? "metadata" : "none"} className="vh-image" style={{ opacity: ready ? 1 : 0 }} onError={() => setReady(false)}/>}
    {!videoUrl && youtubeId && visible && !reducedMotion && <div className="vh-youtube" style={{ opacity: ready ? 1 : 0 }}><iframe tabIndex={-1} title="Video de fondo" src={`https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?autoplay=1&mute=1&controls=0&loop=1&playlist=${encodeURIComponent(youtubeId)}&rel=0&disablekb=1&playsinline=1`} allow="autoplay; encrypted-media"/></div>}
  </div>;
}
