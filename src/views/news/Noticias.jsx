import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useNews } from '../../hooks/useNews';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useEditorialFollow } from '../../hooks/useEditorialFollow';
import NewsCoverflow from '../../components/news/NewsCoverflow';
import NewsCard from '../../components/news/NewsCard';
import { CampaignDetailInline, getCampaignPrimaryAsset } from '../../components/campaigns/CampaignShowcase';
import { Radio, Newspaper, Activity, Megaphone, ArrowUpRight, Bell, BellOff, Check, Eye, Heart, Trophy, UserPlus } from 'lucide-react';
import { EDITORIAL_CATEGORIES } from '../../utils/editorialCategories';

// Clave de localStorage donde guardamos qué noticias ya registró este navegador/usuario
const VISTAS_KEY = 'vista_gimg_registradas';
const formatMetric = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

function GimgInstitutionalHeader({ news }) {
  const {
    isFollowing,
    notificationsEnabled,
    followersCount,
    loading,
    toggleFollow,
    toggleNotifications
  } = useEditorialFollow('GIMG');

  const stats = useMemo(() => news.reduce((totals, item) => ({
    views: totals.views + (Number(item.vistas) || 0),
    likes: totals.likes + (Number(item.likes_count) || 0)
  }), { views: 0, likes: 0 }), [news]);
  const backdrop = news.find(item => item.banner_url || item.poster_url);

  return (
    <section className="relative overflow-hidden bg-[#101010] text-white border-y border-white/10">
      {backdrop && (
        <img src={backdrop.banner_url || backdrop.poster_url} alt="" className="absolute inset-y-0 right-0 w-full md:w-[58%] h-full object-cover opacity-25" aria-hidden="true"/>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#101010] via-[#101010]/95 to-[#101010]/45"/>
      <div className="relative max-w-[1800px] mx-auto px-6 md:px-12 py-10 md:py-14 grid lg:grid-cols-[1fr_auto] gap-9 items-end">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-[0.25em] mb-4">
            <Radio size={15}/> Redacción central
          </div>
          <h2 className="font-serif italic text-4xl md:text-6xl leading-none">Global Insight Media Group</h2>
          <p className="text-white/60 max-w-2xl mt-4 leading-relaxed text-sm md:text-base">
            Comunicados, investigaciones y ediciones oficiales producidas por GIMG para comprender Empyria desde otra perspectiva.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            <button type="button" onClick={toggleFollow} disabled={loading} className={`h-12 px-6 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-colors disabled:opacity-50 ${isFollowing ? 'bg-white text-[#1d1d1f]' : 'bg-[#0066FF] hover:bg-[#0052cc] text-white'}`}>
              {isFollowing ? <Check size={17}/> : <UserPlus size={17}/>}
              {isFollowing ? 'Siguiendo GIMG' : 'Seguir GIMG'}
            </button>
            {isFollowing && (
              <button type="button" onClick={toggleNotifications} disabled={loading} className={`h-12 px-4 rounded-lg border flex items-center gap-2 text-xs font-bold transition-colors ${notificationsEnabled ? 'border-blue-400/40 bg-blue-500/15 text-blue-300' : 'border-white/15 bg-white/5 text-white/60'}`}>
                {notificationsEnabled ? <Bell size={17}/> : <BellOff size={17}/>}
                {notificationsEnabled ? 'Avisos activos' : 'Activar avisos'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-x-8 gap-y-5 min-w-full lg:min-w-[360px] border-t lg:border-t-0 lg:border-l border-white/15 pt-6 lg:pt-0 lg:pl-9">
          {[
            ['Ediciones', news.length],
            ['Lecturas', formatMetric.format(stats.views)],
            ['Likes', formatMetric.format(stats.likes)],
            ['Seguidores', formatMetric.format(followersCount)]
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</p>
              <p className="text-2xl md:text-3xl font-bold mt-1">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function KioskRanking({ title, icon: Icon, items, metric }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className={metric === 'vistas' ? 'text-[#0066FF]' : 'text-red-500'}/>
        <h4 className="text-xs font-black uppercase tracking-widest text-[#1d1d1f]">{title}</h4>
      </div>
      <div className="border-y border-[#d2d2d7]/70 divide-y divide-[#d2d2d7]/60">
        {items.map((item, index) => (
          <div key={item.id} className="w-full min-h-20 py-3 flex items-center gap-4 text-left">
            <span className="w-7 text-center font-serif italic text-2xl text-[#86868b]">{index + 1}</span>
            <img src={item.poster_url || item.banner_url} alt="" className="w-12 h-14 rounded-md object-cover bg-[#e8e8ed] flex-shrink-0"/>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-sm text-[#1d1d1f] line-clamp-1">{item.titulo}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#86868b] mt-1 truncate">{item.sello_editorial}</span>
            </span>
            <span className="text-xs font-black text-[#1d1d1f] flex items-center gap-1.5 pr-2">
              <Icon size={13}/>{formatMetric.format(Number(item[metric]) || 0)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function obtenerVistasRegistradas() {
  try {
    const raw = localStorage.getItem(VISTAS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function guardarVistasRegistradas(set) {
  try {
    localStorage.setItem(VISTAS_KEY, JSON.stringify([...set]));
  } catch {
    // Si localStorage no está disponible (modo privado, cuotas, etc.) simplemente no persistimos;
    // la vista se seguirá contando en el servidor cada vez, pero no rompemos la app.
  }
}

export default function Noticias({ setActiveTab, setSelloSeleccionado, focusedNewsId }) {
  const { loading, allNews, fetchGlobalNews, registrarVisita } = useNews();
  const { fetchActiveCampaigns, trackCampaignEvent } = useCampaigns();
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [localFocusedNewsId, setLocalFocusedNewsId] = useState(focusedNewsId || null);
  const [activeCategory, setActiveCategory] = useState('todas');
  const gimgRef = useRef(null);
  const kioskRef = useRef(null);

  useEffect(() => {
    fetchGlobalNews();
  }, [fetchGlobalNews]);

  useEffect(() => {
    if (focusedNewsId) setLocalFocusedNewsId(focusedNewsId);
  }, [focusedNewsId]);

  useEffect(() => {
    let cancelled = false;

    fetchActiveCampaigns().then((campaigns) => {
      if (!cancelled) setActiveCampaigns(campaigns || []);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchActiveCampaigns]);

  const prioritizeFocusedNews = useCallback(
    (items) => {
      if (!localFocusedNewsId) return items;
      return [...items].sort((a, b) => {
        if (a.id === localFocusedNewsId) return -1;
        if (b.id === localFocusedNewsId) return 1;
        return 0;
      });
    },
    [localFocusedNewsId]
  );

  const gimgNews = useMemo(
    () => prioritizeFocusedNews(allNews.filter(item => !item.es_comunidad)),
    [allNews, prioritizeFocusedNews]
  );

  const communityNews = useMemo(
    () =>
      prioritizeFocusedNews(allNews
        .filter(item => item.es_comunidad)
        .map(item => ({
          ...item,
          sello_editorial: item.sello_editorial || 'Editorial Independiente'
        }))),
    [allNews, prioritizeFocusedNews]
  );

  const filteredCommunityNews = useMemo(
    () => activeCategory === 'todas'
      ? communityNews
      : communityNews.filter(item => (item.categoria_editorial || 'comunidad') === activeCategory),
    [activeCategory, communityNews]
  );

  const topViewed = useMemo(
    () => [...communityNews].sort((a, b) => (Number(b.vistas) || 0) - (Number(a.vistas) || 0)).slice(0, 3),
    [communityNews]
  );

  const topLiked = useMemo(
    () => [...communityNews].sort((a, b) => (Number(b.likes_count) || 0) - (Number(a.likes_count) || 0)).slice(0, 3),
    [communityNews]
  );

  const focusedNews = useMemo(
    () => allNews.find(item => item.id === localFocusedNewsId),
    [allNews, localFocusedNewsId]
  );

  useEffect(() => {
    if (!focusedNews || !new URLSearchParams(window.location.search).has('edition')) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = focusedNews.es_comunidad ? kioskRef.current : gimgRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusedNews]);

  const newsCampaigns = useMemo(
    () => activeCampaigns
      .filter(campaign => {
        const locations = campaign.ubicaciones || [];
        return locations.includes('news_banner')
          || locations.includes('news')
          || locations.includes('home_banner')
          || locations.includes('home_hero');
      })
      .slice(0, 4),
    [activeCampaigns]
  );

  const handleNavigateProfile = useCallback(
    (selloNombre) => {
      if (setSelloSeleccionado && setActiveTab) {
        setSelloSeleccionado(selloNombre);
        setActiveTab('perfil_editorial');
      }
    },
    [setSelloSeleccionado, setActiveTab]
  );

  // Registra la visita SOLO la primera vez por usuario/navegador, sin importar
  // cuántas veces vuelva a abrir/voltear la misma tarjeta después.
  const handleRegisterView = useCallback(
    async (item) => {
      const vistos = obtenerVistasRegistradas();
      if (vistos.has(item.id)) return; // ya se contó antes, no volvemos a llamar al backend

      vistos.add(item.id);
      guardarVistasRegistradas(vistos);

      await registrarVisita(item.id);
    },
    [registrarVisita]
  );

  const handleCampaignClick = useCallback(
    (campaign) => {
      trackCampaignEvent(campaign.id, 'click');

      if (campaign.cta_tipo === 'url' && campaign.cta_target) {
        window.open(campaign.cta_target, '_blank', 'noopener,noreferrer');
        return;
      }

      setSelectedCampaign(campaign);
    },
    [trackCampaignEvent]
  );

  const handleCampaignNewsFocus = useCallback((item) => {
    if (!item?.id) return;
    setLocalFocusedNewsId(item.id);
    setSelectedCampaign(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }, []);

  if (loading && allNews.length === 0) {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-[#86868b]">
          <Activity className="animate-spin" size={28} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Sincronizando Servidores de Prensa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#fbfbfd] pb-32 font-sans selection:bg-[#1d1d1f] selection:text-white relative">

      {/* CABECERA GLOBAL */}
      <div className="pt-16 md:pt-24 px-6 md:px-12 max-w-[1800px] mx-auto mb-6">
        <div className="flex items-center gap-2 text-[#0066FF] mb-3 animate-in fade-in duration-700">
          <Radio size={18} />
          <span className="text-[10px] font-bold tracking-widest uppercase">VISTA Media Network</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-serif italic tracking-tighter text-[#1d1d1f] leading-none animate-in slide-in-from-bottom-6 duration-700 delay-75 fill-mode-forwards">
          News & Chronicle.
        </h1>
        {focusedNews && (
          <div className="mt-8 inline-flex max-w-full items-center gap-3 rounded-full bg-[#1d1d1f] text-white px-5 py-3 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <Newspaper size={16} className="text-[#0066FF] flex-shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
              {new URLSearchParams(window.location.search).has('edition') ? 'Enlace compartido' : 'Edición destacada'}
            </span>
            <span className="text-sm font-bold truncate">{focusedNews.titulo}</span>
          </div>
        )}
      </div>

      {newsCampaigns.length > 0 && (
        <section className="px-6 md:px-12 max-w-[1800px] mx-auto mb-14">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-[#1d1d1f]">
              <Megaphone size={18} className="text-[#0066FF]" />
              <h2 className="text-xs font-black uppercase tracking-[0.25em]">Campañas abiertas</h2>
            </div>
            <span className="hidden md:inline text-xs font-bold text-[#86868b]">
              Convocatorias, colaboraciones y señales oficiales
            </span>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {newsCampaigns.map((campaign) => {
              const asset = getCampaignPrimaryAsset(campaign);

              return (
                <button
                  key={campaign.id}
                  type="button"
                  onClick={() => handleCampaignClick(campaign)}
                  className="group relative h-28 md:h-32 min-w-[86vw] md:min-w-[520px] lg:min-w-[620px] overflow-hidden rounded-2xl bg-[#101010] text-left snap-start border border-black/5 shadow-sm"
                >
                  {asset?.url ? (
                    <img
                      src={asset.url}
                      alt={campaign.titulo}
                      className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20">
                      <Megaphone size={42} strokeWidth={1.3} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
                  <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between gap-4 p-5 md:p-6 text-white">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-[#0066FF] text-white px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                          Campaña
                        </span>
                        {campaign.linkedContent?.length > 0 && (
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/60">
                            {campaign.linkedContent.length} edición(es)
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif italic text-2xl md:text-3xl leading-tight truncate">{campaign.titulo}</h3>
                      {campaign.descripcion && (
                        <p className="text-xs md:text-sm text-white/70 line-clamp-1 mt-1 max-w-2xl">{campaign.descripcion}</p>
                      )}
                    </div>
                    <div className="hidden sm:inline-flex items-center gap-2 rounded-full bg-white text-[#1d1d1f] px-4 py-2 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                      {campaign.cta_texto || 'Ver campaña'} <ArrowUpRight size={14} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedCampaign && (
            <div className="mt-6">
              <CampaignDetailInline
                campaign={selectedCampaign}
                onClose={() => setSelectedCampaign(null)}
                onNavigateNews={handleCampaignNewsFocus}
              />
            </div>
          )}
        </section>
      )}

      {/* NIVEL 1: ESCAPARATE OFICIAL */}
      {gimgNews.length > 0 && (
        <div ref={gimgRef} className="mb-24 animate-in fade-in duration-1000 delay-200 fill-mode-forwards scroll-mt-6">
          <GimgInstitutionalHeader news={gimgNews}/>

          <NewsCoverflow
            news={gimgNews}
            onRead={handleRegisterView}
            onNavigateProfile={null}
            focusedNewsId={localFocusedNewsId}
          />
        </div>
      )}

      {/* NIVEL 2: KIOSCO INDEPENDIENTE */}
      <div ref={kioskRef} className="px-6 md:px-12 max-w-[1800px] mx-auto mt-16 pt-16 border-t border-[#d2d2d7]/50 scroll-mt-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Newspaper size={26} className="text-[#1d1d1f]" />
            <h3 className="text-2xl md:text-4xl font-serif italic font-bold text-[#1d1d1f]">Kiosco de la Alianza</h3>
          </div>
          <span className="text-xs text-[#86868b] font-mono md:ml-auto bg-[#f5f5f7] px-4 py-1.5 rounded-full w-fit font-bold">
            {communityNews.length} Ediciones Indexadas
          </span>
        </div>

        {communityNews.length > 0 && (
          <section className="mb-10 py-7 border-y border-[#d2d2d7]/60">
            <div className="flex items-center gap-2 mb-6">
              <Trophy size={18} className="text-yellow-500"/>
              <h3 className="text-sm font-black uppercase tracking-[0.2em]">Top del kiosco</h3>
            </div>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-14">
              <KioskRanking title="Más vistas" icon={Eye} items={topViewed} metric="vistas"/>
              <KioskRanking title="Más likes" icon={Heart} items={topLiked} metric="likes_count"/>
            </div>
          </section>
        )}

        <div className="flex gap-2 overflow-x-auto pb-3 mb-9" role="tablist" aria-label="Categorías editoriales">
          {[{ value: 'todas', label: 'Todas' }, ...EDITORIAL_CATEGORIES].map(category => {
            const selected = activeCategory === category.value;
            return (
              <button
                key={category.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveCategory(category.value)}
                className={`h-10 px-4 rounded-xl whitespace-nowrap text-xs font-bold transition-colors border ${
                  selected
                    ? 'bg-[#1d1d1f] border-[#1d1d1f] text-white'
                    : 'bg-white border-[#d2d2d7] text-[#86868b] hover:text-[#1d1d1f] hover:border-[#86868b]'
                }`}
              >
                {category.label}
              </button>
            );
          })}
        </div>

        {filteredCommunityNews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10 items-start animate-in slide-in-from-bottom-8 duration-700 delay-300 fill-mode-forwards">
            {filteredCommunityNews.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                onRead={handleRegisterView}
                onNavigateProfile={handleNavigateProfile}
              />
            ))}
          </div>
        ) : (
          <div className="py-32 text-center border-2 border-dashed border-[#d2d2d7] rounded-[2.5rem] bg-white shadow-sm">
            <Newspaper size={48} className="text-[#d2d2d7] mx-auto mb-4" />
            <p className="text-[#86868b] font-medium text-lg">
              {communityNews.length > 0 ? 'No hay ediciones en esta categoría todavía.' : 'El Kiosco independiente está despejado de momento.'}
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
