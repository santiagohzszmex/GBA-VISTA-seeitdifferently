import React, { useEffect, useRef, useState } from 'react';
import { useCampaignShare } from '../../hooks/useCampaignShare';
import { CampaignLikeButton, getCampaignAudioAsset, getCampaignPrimaryAsset, getCampaignVideoAsset } from '../campaigns/CampaignShowcase';
import { ArrowUpRight, ChevronDown, Check, Film, Music, Share2, Volume2, VolumeX } from 'lucide-react';
import ImmersiveMedia from './ImmersiveMedia';
import './home.css';

export default function CampaignHero ({ campaign, onOpen, onScrollNext, isOpen }) {
  const imageAsset = getCampaignPrimaryAsset(campaign);
  const videoAsset = getCampaignVideoAsset(campaign);
  const audioAsset = getCampaignAudioAsset(campaign);
  const { shareCampaign, shareStatus } = useCampaignShare(campaign);
  const heroRef = useRef(null);
  const audioRef = useRef(null);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (!audioAsset?.url || !heroRef.current || !audioRef.current) return undefined;

    const audio = audioRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && entry.intersectionRatio > 0.45) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    }, { threshold: [0, 0.45, 0.8] });

    observer.observe(heroRef.current);

    return () => {
      observer.disconnect();
      audio.pause();
    };
  }, [audioAsset?.url]);

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    const nextEnabled = !audioEnabled;
    audioRef.current.muted = !nextEnabled;
    setAudioEnabled(nextEnabled);
    if (nextEnabled) audioRef.current.play().catch(() => {});
  };

  if (!campaign) return null;

  return (
    <div ref={heroRef} className="vh-hero" aria-label="Campaña principal de VISTA">
      <ImmersiveMedia image={videoAsset?.thumbnail_url || imageAsset?.url} videoUrl={videoAsset?.url} alt={campaign.titulo} />

      {isOpen && (
        <div className="absolute inset-0 bg-black/20 pointer-events-none transition-opacity duration-500 z-10" />
      )}

      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,.75), transparent 55%)' }} data-vista-shade="bottom" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.55), transparent 70%)' }} data-vista-shade="text" />

      <div className="absolute top-8 left-6 md:left-32 z-20 pointer-events-none">
        <h2
          className="text-3xl md:text-4xl italic tracking-tight text-white/90 drop-shadow-xl"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          See it differently.
        </h2>
      </div>

      <div className="vh-copy z-20 animate-in slide-in-from-bottom-8 fade-in duration-700">
        {isOpen && (
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-white text-[#1d1d1f] text-[10px] font-black uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
            <Check size={14} strokeWidth={3} /> Campaña abierta
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <span className="bg-[#0066FF] text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
            Campaña Oficial
          </span>
          {videoAsset && (
            <span className="bg-white/15 backdrop-blur-md text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Film size={12} /> Video
            </span>
          )}
          {campaign.linkedContent?.length > 0 && (
            <span className="bg-white/15 backdrop-blur-md text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
              {campaign.linkedContent.length} edición(es)
            </span>
          )}
          {audioAsset && (
            <span className="bg-white/15 backdrop-blur-md text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <Music size={12} /> Audio
            </span>
          )}
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-5 text-white drop-shadow-2xl leading-[1.05]">
          {campaign.titulo}
        </h1>

        {campaign.descripcion && (
          <p className="text-lg md:text-xl text-neutral-300 mb-9 line-clamp-3 font-medium drop-shadow-md max-w-2xl leading-relaxed">
            {campaign.descripcion}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onOpen}
            className={`px-8 md:px-10 py-4 rounded-full font-bold inline-flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] ${
              isOpen ? 'bg-[#0066FF] text-white' : 'bg-white text-[#1d1d1f]'
            }`}
          >
            {isOpen ? 'Campaña abierta' : (campaign.cta_texto || 'Ver campaña')} <ArrowUpRight size={18} />
          </button>
          <CampaignLikeButton campaign={campaign} />
          <button
            type="button"
            onClick={shareCampaign}
            className="bg-white/10 text-white border border-white/20 p-4 rounded-full hover:bg-white/20 transition-colors"
            title={shareStatus === 'idle' ? 'Compartir campaña y video' : 'Campaña lista para compartir'}
            aria-label={shareStatus === 'idle' ? 'Compartir campaña y video' : 'Campaña lista para compartir'}
          >
            {shareStatus === 'idle' ? <Share2 size={18} /> : <Check size={18} className="text-green-300" />}
          </button>
          {audioAsset && (
            <button
              type="button"
              onClick={toggleAudio}
              className="bg-white/10 text-white border border-white/20 px-5 py-4 rounded-full font-bold inline-flex items-center gap-2 hover:bg-white/20 transition-colors"
            >
              {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              {audioEnabled ? 'Audio activo' : 'Activar audio'}
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onScrollNext}
        className="vh-next absolute bottom-7 left-1/2 z-20 -translate-x-1/2 inline-flex flex-col items-center gap-2 text-white/80 hover:text-white transition-colors"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">Desliza para ver VISTA</span>
        <ChevronDown size={24} className="animate-bounce" />
      </button>

      {audioAsset && (
        <audio ref={audioRef} src={audioAsset.url} loop muted preload="metadata" />
      )}
    </div>
  );
};
