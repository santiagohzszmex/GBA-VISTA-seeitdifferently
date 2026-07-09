import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronUp, Film, Heart, Image as ImageIcon, Layers, Music, Newspaper } from 'lucide-react';
import { useCampaigns } from '../../hooks/useCampaigns';

export const getCampaignPrimaryAsset = (campaign) => (
  campaign.assets?.find(asset => asset.tipo === 'banner')
  || campaign.assets?.find(asset => asset.tipo === 'poster')
);

export const getCampaignVideoAsset = (campaign) => campaign.assets?.find(asset => asset.tipo === 'video');
export const getCampaignAudioAsset = (campaign) => campaign.assets?.find(asset => asset.tipo === 'audio');

export function CampaignLikeButton({ campaign }) {
  const { checkCampaignLikeStatus, toggleCampaignLike } = useCampaigns();
  const [likesCount, setLikesCount] = useState(campaign.likes_count || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setLikesCount(campaign.likes_count || 0);
    setIsLiked(false);

    checkCampaignLikeStatus(campaign.id).then((liked) => {
      if (!cancelled) setIsLiked(liked);
    });

    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaign.likes_count, checkCampaignLikeStatus]);

  const handleLike = async (e) => {
    e.stopPropagation();
    if (saving) return;

    setSaving(true);
    const prevLiked = isLiked;
    const prevCount = likesCount;
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    const result = await toggleCampaignLike(campaign.id, nextLiked);
    if (!result.success) {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    } else if (typeof result.likesCount === 'number') {
      setLikesCount(result.likesCount);
    }

    setSaving(false);
  };

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={saving}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-widest transition-colors ${
        isLiked
          ? 'bg-red-500/20 text-red-300 border-red-500/40'
          : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
      }`}
    >
      <Heart size={14} className={isLiked ? 'fill-red-400 text-red-400' : ''} />
      {likesCount}
    </button>
  );
}

export function CampaignDetailInline({ campaign, onClose }) {
  const { trackCampaignEvent } = useCampaigns();
  const videoAsset = getCampaignVideoAsset(campaign);
  const audioAsset = getCampaignAudioAsset(campaign);

  const handleAssetClick = (asset) => {
    if (asset.tipo === 'video') {
      trackCampaignEvent(campaign.id, 'play', asset.id);
    } else {
      trackCampaignEvent(campaign.id, 'click', asset.id);
    }
  };

  return (
    <section className="relative z-30 px-6 md:px-12 -mt-4 mb-16 animate-in slide-in-from-top-4 fade-in duration-500">
      <div className="w-full bg-[#101010] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="p-6 md:p-10 border-b border-white/10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0066FF] mb-3">Campaña VISTA</p>
            <h2 className="text-3xl md:text-5xl font-serif italic tracking-tight">{campaign.titulo}</h2>
            <div className="mt-5">
              <CampaignLikeButton campaign={campaign} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="self-start px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-all border border-white/10 active:scale-95"
          >
            <ChevronUp size={16} strokeWidth={3} /> Cerrar
          </button>
          {campaign.descripcion && (
            <p className="text-neutral-400 md:max-w-2xl text-base leading-relaxed">{campaign.descripcion}</p>
          )}
        </div>

        {videoAsset && (
          <div className="p-6 md:p-10 border-b border-white/10">
            <video
              src={videoAsset.url}
              poster={videoAsset.thumbnail_url || undefined}
              controls
              className="w-full rounded-2xl bg-black shadow-2xl"
              onPlay={() => handleAssetClick(videoAsset)}
            />
          </div>
        )}

        {audioAsset && (
          <div className="px-6 md:px-10 pb-6 md:pb-10 border-b border-white/10">
            <div className="flex items-center gap-3 mb-3 text-neutral-400">
              <Music size={16} className="text-[#0066FF]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Audio de campaña</span>
            </div>
            <audio
              src={audioAsset.url}
              controls
              className="w-full"
              onPlay={() => handleAssetClick(audioAsset)}
            />
          </div>
        )}

        <div className="p-6 md:p-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(campaign.assets || []).filter(asset => asset.id !== videoAsset?.id).map((asset) => (
            <a
              key={asset.id}
              href={asset.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => handleAssetClick(asset)}
              className="group block rounded-2xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/30 transition-colors"
            >
              {asset.tipo === 'poster' || asset.tipo === 'banner' ? (
                <img src={asset.url} alt={asset.titulo || campaign.titulo} className="w-full aspect-[4/5] object-cover group-hover:scale-105 transition-transform duration-700" />
              ) : (
                <div className="aspect-[4/5] flex flex-col items-center justify-center text-neutral-400 gap-3">
                  <Layers size={34} />
                  <span className="text-xs font-bold uppercase tracking-widest">{asset.tipo}</span>
                </div>
              )}
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold truncate">{asset.titulo || asset.tipo}</span>
                <ArrowUpRight size={16} className="text-neutral-500 group-hover:text-white" />
              </div>
            </a>
          ))}
        </div>

        {campaign.linkedContent?.length > 0 && (
          <div className="p-6 md:p-10 border-t border-white/10 bg-white/[0.02]">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Newspaper size={18} className="text-[#0066FF]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0066FF]">Cobertura editorial</p>
                </div>
                <h3 className="text-3xl md:text-5xl font-serif italic tracking-tight">Lee la campaña como edición.</h3>
              </div>
              <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
                Piezas periodísticas vinculadas para seguir el contexto, los actores y las consecuencias de esta campaña.
              </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.9fr] gap-5">
              {campaign.linkedContent.slice(0, 1).map((item) => (
                <a
                  key={item.id}
                  href="#news"
                  onClick={() => trackCampaignEvent(campaign.id, 'click')}
                  className="group relative min-h-[420px] overflow-hidden rounded-3xl bg-black border border-white/10 hover:border-white/30 transition-colors"
                >
                  {item.banner_url || item.poster_url ? (
                    <img src={item.banner_url || item.poster_url} alt={item.titulo} className="absolute inset-0 w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20">
                      <Newspaper size={70} strokeWidth={1.2} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                    <span className="inline-flex items-center gap-2 bg-white text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                      Edición principal <ArrowUpRight size={13} />
                    </span>
                    <h4 className="text-3xl md:text-5xl font-serif italic leading-tight text-white max-w-3xl">{item.titulo}</h4>
                    {item.descripcion && (
                      <p className="text-sm md:text-base text-white/75 line-clamp-3 mt-4 max-w-2xl leading-relaxed">{item.descripcion}</p>
                    )}
                  </div>
                </a>
              ))}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4">
                {campaign.linkedContent.slice(1, 5).map((item, idx) => (
                  <a
                    key={item.id}
                    href="#news"
                    onClick={() => trackCampaignEvent(campaign.id, 'click')}
                    className="group flex gap-4 rounded-2xl bg-white/5 border border-white/10 p-3 hover:bg-white/10 hover:border-white/30 transition-colors"
                  >
                    <div className="w-24 h-28 rounded-xl overflow-hidden bg-black flex-shrink-0">
                      {item.poster_url || item.banner_url ? (
                        <img src={item.poster_url || item.banner_url} alt={item.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30">
                          <Newspaper size={24} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#0066FF] mb-2">
                        Capítulo {idx + 2}
                      </span>
                      <h4 className="font-bold text-white line-clamp-2 leading-snug">{item.titulo}</h4>
                      {item.descripcion && (
                        <p className="text-xs text-neutral-500 line-clamp-2 mt-2">{item.descripcion}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default function CampaignShowcase({ campaigns = [] }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const { trackCampaignEvent } = useCampaigns();
  const viewedCampaignsRef = useRef(new Set());

  const visibleCampaigns = useMemo(() => (
    campaigns.filter(campaign => campaign.ubicaciones?.includes('home_banner') || campaign.ubicaciones?.includes('home_hero')).slice(0, 4)
  ), [campaigns]);

  useEffect(() => {
    visibleCampaigns.forEach((campaign) => {
      if (viewedCampaignsRef.current.has(campaign.id)) return;
      viewedCampaignsRef.current.add(campaign.id);
      trackCampaignEvent(campaign.id, 'view');
    });
  }, [visibleCampaigns, trackCampaignEvent]);

  if (visibleCampaigns.length === 0) return null;

  const openCampaign = (campaign) => {
    trackCampaignEvent(campaign.id, 'click');
    setSelectedCampaign(campaign);
  };

  return (
    <section className="relative z-20 px-6 md:px-12 mt-8">
      <div className="flex items-end justify-between mb-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0066FF] mb-2">Campañas Activas</p>
          <h2 className="font-serif italic text-3xl text-[#1d1d1f]">Lanzamientos y señales GIMG</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visibleCampaigns.map((campaign) => {
          const asset = getCampaignPrimaryAsset(campaign);
          const videoAsset = getCampaignVideoAsset(campaign);
          const hasVideo = Boolean(videoAsset);

          return (
            <button
              key={campaign.id}
              onClick={() => openCampaign(campaign)}
              className="group relative min-h-[280px] md:min-h-[340px] overflow-hidden rounded-3xl bg-[#101010] text-left shadow-sm border border-black/5"
            >
              {asset?.url ? (
                <img src={asset.url} alt={campaign.titulo} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
              ) : videoAsset?.url ? (
                <video
                  src={videoAsset.url}
                  className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/40"><ImageIcon size={46} /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-white text-black px-3 py-1 rounded-full">
                    Campaña
                  </span>
                  {hasVideo && (
                    <span className="text-[10px] font-black uppercase tracking-widest bg-[#0066FF] text-white px-3 py-1 rounded-full flex items-center gap-1.5">
                      <Film size={12} /> Video
                    </span>
                  )}
                </div>
                <h3 className="text-3xl md:text-4xl font-serif italic leading-tight">{campaign.titulo}</h3>
                {campaign.descripcion && (
                  <p className="text-sm text-white/75 line-clamp-2 mt-3 max-w-xl">{campaign.descripcion}</p>
                )}
                <span className="inline-flex items-center gap-2 mt-5 text-sm font-bold uppercase tracking-widest">
                  {campaign.cta_texto || 'Ver campaña'} <ArrowUpRight size={16} />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedCampaign && (
        <CampaignDetailInline campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}
    </section>
  );
}
