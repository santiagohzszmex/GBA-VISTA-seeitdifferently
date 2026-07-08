import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Film, Image as ImageIcon, Layers, X } from 'lucide-react';
import { useCampaigns } from '../../hooks/useCampaigns';

const getPrimaryAsset = (campaign) => (
  campaign.assets?.find(asset => asset.tipo === 'banner')
  || campaign.assets?.find(asset => asset.tipo === 'poster')
  || campaign.assets?.[0]
);

const getVideoAsset = (campaign) => campaign.assets?.find(asset => asset.tipo === 'video');

function CampaignDetail({ campaign, onClose }) {
  const { trackCampaignEvent } = useCampaigns();
  const videoAsset = getVideoAsset(campaign);

  const handleAssetClick = (asset) => {
    if (asset.tipo === 'video') {
      trackCampaignEvent(campaign.id, 'play', asset.id);
    } else {
      trackCampaignEvent(campaign.id, 'click', asset.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-xl flex items-center justify-center p-4 md:p-8">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-50 w-11 h-11 rounded-full bg-white/10 border border-white/10 text-white flex items-center justify-center hover:bg-white hover:text-black transition-colors"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-[#101010] text-white rounded-3xl border border-white/10 shadow-2xl">
        <div className="p-6 md:p-10 border-b border-white/10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0066FF] mb-3">Campaña VISTA</p>
          <h2 className="text-4xl md:text-6xl font-serif italic tracking-tight">{campaign.titulo}</h2>
          {campaign.descripcion && (
            <p className="text-neutral-400 max-w-3xl mt-4 text-base md:text-lg leading-relaxed">{campaign.descripcion}</p>
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
      </div>
    </div>
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
          const asset = getPrimaryAsset(campaign);
          const hasVideo = Boolean(getVideoAsset(campaign));

          return (
            <button
              key={campaign.id}
              onClick={() => openCampaign(campaign)}
              className="group relative min-h-[280px] md:min-h-[340px] overflow-hidden rounded-3xl bg-[#101010] text-left shadow-sm border border-black/5"
            >
              {asset?.url ? (
                <img src={asset.url} alt={campaign.titulo} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
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
        <CampaignDetail campaign={selectedCampaign} onClose={() => setSelectedCampaign(null)} />
      )}
    </section>
  );
}
