import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCampaigns } from '../hooks/useCampaigns';
import { useKeynotes } from '../hooks/useKeynotes';
import { supabase } from '../supabaseClient';
import { useNetworkTracking } from '../hooks/useNetworkServers';
import CampaignHero from '../components/home/CampaignHero';
import DiscoveryHero from '../components/home/DiscoveryHero';
import KeynoteSpotlight from '../components/keynotes/KeynoteSpotlight';
import { CampaignDetailInline } from '../components/campaigns/CampaignShowcase';
import ServerDetail from '../components/network/ServerDetail';
import SurveyInvitation from '../components/survey/SurveyInvitation';
import ActivityFeed from '../components/social/ActivityFeed';
import HomeRadioStrip from '../components/radio/HomeRadioStrip';
import { Compass, Users } from 'lucide-react';
import '../components/home/home.css';
import '../components/network/network.css';

export default function Home({ onSelectMovie, onPlay, onNavigateNews, onNavigateKeynotes, onOpenRadio, onOpenNetworkStudio, initialCampaignId = null, initialUpdateId = null }) {
  const { fetchActiveCampaigns, trackCampaignEvent } = useCampaigns();
  const { fetchPublishedKeynotes } = useKeynotes();
  const track = useNetworkTracking();
  const [campaigns, setCampaigns] = useState([]);
  const [latestKeynote, setLatestKeynote] = useState(null);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [serverSelection, setServerSelection] = useState(null);
  const [discovery, setDiscovery] = useState({ partners: [], ranking: [] });
  const [loading, setLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState('');
  const [homeMode, setHomeMode] = useState(initialUpdateId ? 'following' : 'featured');
  const [focusedUpdateId, setFocusedUpdateId] = useState(initialUpdateId);
  const partnerAnchor = useRef(null);
  const campaignAnchor = useRef(null);
  const campaignReader = useRef(null);
  const lastRefresh = useRef(0);
  const discoveryRequest = useRef(0);
  const refreshDiscovery = useCallback(async () => {
    const request = ++discoveryRequest.current;
    const { data, error } = await supabase.rpc('vista_home_discovery');
    if (request !== discoveryRequest.current) return;
    if (error) setDiscoveryError('No se pudo actualizar este espacio. Inténtalo de nuevo.');
    else { setDiscovery(data || { partners: [], ranking: [] }); setDiscoveryError(''); lastRefresh.current = Date.now(); }
    setLoading(false);
  }, []);
  useEffect(() => {
    let active = true;
    fetchActiveCampaigns().then(items => {
      if (!active) return;
      const shared = items.find(item => item.id === initialCampaignId);
      setCampaigns(shared ? [shared, ...items.filter(item => item.id !== shared.id)] : items);
      if (shared) setExpandedCampaign(shared);
    });
    fetchPublishedKeynotes().then(items => { if (active) setLatestKeynote(items[0] || null); });
    void refreshDiscovery();
    const refresh = () => { if (!document.hidden && Date.now() - lastRefresh.current > 55000) void refreshDiscovery(); };
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => { active = false; discoveryRequest.current++; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [initialCampaignId, fetchActiveCampaigns, fetchPublishedKeynotes, refreshDiscovery]);
  useEffect(() => {
    if (!expandedCampaign) return;
    // Match the newspaper reader: unfold in the document, then scroll to it.
    const timer = window.setTimeout(() => {
      campaignReader.current?.focus({ preventScroll: true });
      campaignReader.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [expandedCampaign?.id]);
  const closeCampaign = useCallback(() => {
    setExpandedCampaign(null);
    window.requestAnimationFrame(() => {
      campaignAnchor.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      campaignAnchor.current?.querySelector('[aria-controls="vista-home-campaign-reader"]')?.focus({ preventScroll: true });
    });
  }, []);
  const openCampaign = campaign => {
    if (expandedCampaign?.id === campaign.id) {
      campaignReader.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      campaignReader.current?.focus({ preventScroll: true });
      return;
    }
    void trackCampaignEvent(campaign.id, 'click');
    setExpandedCampaign(campaign);
  };
  const closeServer = useCallback(() => setServerSelection(null), []);
  const openEntry = entry => {
    if (entry.server || entry.kind === 'server') setServerSelection({ server:entry.server || entry.item, partnerId:entry.partner?.id || null });
    else if (entry.kind === 'newspaper') onNavigateNews?.(entry.item);
    else onSelectMovie?.(entry.item);
  };
  return <div className="relative font-sans pb-20">
    <div className="vh-stack vh-fullbleed" data-home-stack>
      <div ref={campaignAnchor}>{campaigns[0] ? <CampaignHero campaign={campaigns[0]} onOpen={() => openCampaign(campaigns[0])} onScrollNext={() => partnerAnchor.current?.scrollIntoView({ behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} isOpen={Boolean(expandedCampaign)}/> : <section className="vh-hero" aria-label="Campañas de VISTA"><div className="vh-atmosphere"/><div className="vh-topline"><span className="vh-brand">See it differently.</span></div><div className="vh-copy"><p className="vh-label">VISTA · Campañas</p><h1 className="vh-title">Una nueva forma\nde ver tu mundo.</h1><p className="vh-description">Historias, comunidades y proyectos de Minecraft. Las próximas campañas aparecerán aquí.</p></div></section>}</div>
      {expandedCampaign && <div ref={campaignReader} id="vista-home-campaign-reader" className="vh-campaign-reader" role="region" aria-label={`Campaña: ${expandedCampaign.titulo}`} tabIndex={-1}><CampaignDetailInline campaign={expandedCampaign} onClose={closeCampaign} onNavigateNews={item => { setExpandedCampaign(null); onNavigateNews?.(item); }}/></div>}
      <div ref={partnerAnchor}><DiscoveryHero mode="partners" entries={discovery.partners} loading={loading} error={discoveryError} onRetry={refreshDiscovery} onOpen={openEntry} onStudio={onOpenNetworkStudio} track={track}/></div>
      <DiscoveryHero mode="ranking" entries={discovery.ranking} loading={loading} error={discoveryError} onRetry={refreshDiscovery} onOpen={openEntry} onPlay={onPlay} track={track}/>
    </div>
    <KeynoteSpotlight keynote={latestKeynote} onOpen={onNavigateKeynotes}/>
    <SurveyInvitation/>
    <HomeRadioStrip onOpen={onOpenRadio}/>
      <section className="max-w-[1500px] mx-auto px-6 md:px-12 pt-12 md:pt-16 relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-end gap-5 pb-5 border-b border-[#d2d2d7]">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#0066FF]">Actividad VISTA</p>
            <h2 className="font-serif italic text-3xl md:text-4xl mt-2">Ahora en la comunidad.</h2>
          </div>
          <div className="sm:ml-auto inline-flex self-start rounded-md bg-[#e8e8ed] p-1" role="tablist" aria-label="Feed de Inicio">
            <button type="button" role="tab" aria-selected={homeMode === 'featured'} onClick={() => { setHomeMode('featured'); setFocusedUpdateId(null); }} className={`h-10 px-4 rounded flex items-center gap-2 text-xs font-bold transition-colors ${homeMode === 'featured' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73]'}`}><Compass size={15}/>Destacado</button>
            <button type="button" role="tab" aria-selected={homeMode === 'following'} onClick={() => { setHomeMode('following'); setFocusedUpdateId(null); }} className={`h-10 px-4 rounded flex items-center gap-2 text-xs font-bold transition-colors ${homeMode === 'following' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73]'}`}><Users size={15}/>Siguiendo</button>
          </div>
        </div>
      </section>

      <section className="max-w-[1500px] mx-auto px-6 md:px-12 py-8 relative z-20">
        <ActivityFeed
          mode={homeMode}
          focusId={focusedUpdateId}
          showComposer={homeMode === 'following'}
        />
      </section>


    {serverSelection && <ServerDetail {...serverSelection} track={track} onClose={closeServer}/>}
  </div>;
}
