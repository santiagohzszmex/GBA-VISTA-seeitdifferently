import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, Heart, Newspaper, Play, Sparkles, UserRound, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useEditorialFollow } from '../../hooks/useEditorialFollow';

const engagementScore = (item) => (Number(item.vistas) || 0) + ((Number(item.likes_count) || 0) * 5);
const formatMetric = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });

function SuggestedEditorial({ editorial }) {
  const { isFollowing, loading, toggleFollow } = useEditorialFollow(editorial.name);
  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading}
      className={`w-full flex items-center justify-between gap-4 px-4 py-3 border rounded-xl text-left transition-colors ${
        isFollowing ? 'border-green-200 bg-green-50' : 'border-[#d2d2d7] hover:border-[#0066FF]/40 bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="font-bold text-sm text-[#1d1d1f] truncate">{editorial.name}</p>
        <div className="flex items-center gap-3 text-[10px] font-bold text-[#86868b] mt-1.5">
          <span className="flex items-center gap-1"><Eye size={11}/>{formatMetric.format(editorial.views)}</span>
          <span className="flex items-center gap-1"><Heart size={11}/>{formatMetric.format(editorial.likes)}</span>
          <span>{editorial.editions} ed.</span>
        </div>
      </div>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isFollowing ? 'bg-green-500 text-white' : 'bg-[#f5f5f7] text-[#0066FF]'}`}>
        {isFollowing ? <Check size={15}/> : <span className="text-lg leading-none">+</span>}
      </span>
    </button>
  );
}

export default function WelcomeOverlay({ onClose, setActiveTab, onSelectContent }) {
  const { user, refreshUser } = useAuth();
  const [suggestions, setSuggestions] = useState([]);
  const [featuredGimg, setFeaturedGimg] = useState(null);

  useEffect(() => {
    const loadSuggestions = async () => {
      const [{ data: communityData }, { data: gimgData }] = await Promise.all([
        supabase
        .from('contenido')
        .select('sello_editorial,vistas,likes_count')
        .eq('estado_publicacion', 'aprobado')
        .eq('es_comunidad', true)
        .not('sello_editorial', 'is', null)
        .limit(500),
        supabase
          .from('contenido')
          .select('id,titulo,descripcion,poster_url,banner_url,vistas,likes_count,categoria,created_at')
          .eq('estado_publicacion', 'aprobado')
          .eq('es_comunidad', false)
          .limit(80)
      ]);

      const editorials = new Map();
      (communityData || []).forEach(item => {
        const name = item.sello_editorial?.trim();
        if (!name) return;
        const key = name.toLocaleLowerCase('es-MX');
        const current = editorials.get(key) || { name, views: 0, likes: 0, editions: 0 };
        current.views += Number(item.vistas) || 0;
        current.likes += Number(item.likes_count) || 0;
        current.editions += 1;
        editorials.set(key, current);
      });
      setSuggestions(
        [...editorials.values()]
          .sort((a, b) => (b.views + b.likes * 5) - (a.views + a.likes * 5))
          .slice(0, 3)
      );

      const rankedGimg = [...(gimgData || [])]
        .filter(item => item.banner_url || item.poster_url)
        .sort((a, b) => {
          const scoreDifference = engagementScore(b) - engagementScore(a);
          return scoreDifference || (new Date(b.created_at) - new Date(a.created_at));
        });
      setFeaturedGimg(rankedGimg[0] || null);
    };
    loadSuggestions();
  }, []);

  const finish = async (destination = 'home') => {
    window.localStorage.removeItem('vista_show_welcome');
    if (user?.id) {
      await supabase.from('usuarios').update({ onboarding_completado: true }).eq('id', user.id);
      await refreshUser();
    }
    setActiveTab(destination);
    onClose();
  };

  const openGimgContent = async () => {
    if (!featuredGimg) return;
    await finish('home');
    onSelectContent?.(featuredGimg);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/45 backdrop-blur-md p-4 flex items-center justify-center">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#fbfbfd] border border-white rounded-2xl shadow-2xl p-7 md:p-10 text-[#1d1d1f]">
        <button type="button" onClick={() => finish('home')} className="absolute top-5 right-5 w-9 h-9 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] flex items-center justify-center" title="Cerrar"><X size={17}/></button>

        <div className="w-14 h-14 bg-[#1d1d1f] text-white rounded-2xl flex items-center justify-center font-black text-lg mb-7">
          {user?.nombre?.slice(0, 2).toUpperCase() || 'GB'}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0066FF] mb-3">GBA ID creado</p>
        <h1 className="font-serif italic text-4xl md:text-5xl tracking-tight leading-none mb-4">
          Bienvenido a VISTA, {user?.nombre_publico || user?.nombre}.
        </h1>
        <p className="text-[#86868b] font-medium max-w-2xl leading-relaxed mb-8">
          Tu GBA ID ya puede seguir la actualidad de Empyria, guardar ediciones y construir un perfil público con tus aportaciones.
        </p>

        {featuredGimg && (
          <section className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={16} className="text-[#0066FF]"/>
              <h2 className="text-xs font-black uppercase tracking-widest">Selección esencial de GIMG</h2>
            </div>
            <button type="button" onClick={openGimgContent} className="group relative w-full min-h-40 md:min-h-48 overflow-hidden rounded-xl bg-[#111] text-white text-left">
              <img src={featuredGimg.banner_url || featuredGimg.poster_url} alt={featuredGimg.titulo} className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-700"/>
              <span className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10"/>
              <span className="relative min-h-40 md:min-h-48 p-5 md:p-7 flex flex-col justify-end items-start">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-300 mb-2">GIMG Original</span>
                <span className="font-serif italic text-2xl md:text-3xl leading-tight max-w-xl">{featuredGimg.titulo}</span>
                <span className="flex items-center gap-4 mt-3 text-[10px] font-bold text-white/70">
                  <span className="flex items-center gap-1"><Eye size={12}/>{formatMetric.format(featuredGimg.vistas || 0)}</span>
                  <span className="flex items-center gap-1"><Heart size={12}/>{formatMetric.format(featuredGimg.likes_count || 0)}</span>
                  <span className="flex items-center gap-1 text-white"><Play size={12} fill="currentColor"/> Abrir selección</span>
                </span>
              </span>
            </button>
          </section>
        )}

        {suggestions.length > 0 && (
          <section className="border-y border-[#d2d2d7]/60 py-6 mb-7">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper size={17} className="text-[#0066FF]"/>
              <h2 className="text-sm font-black uppercase tracking-widest">Editoriales más destacadas</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {suggestions.map(editorial => <SuggestedEditorial key={editorial.name} editorial={editorial}/>) }
            </div>
          </section>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={() => finish('news')} className="flex-1 bg-[#1d1d1f] hover:bg-black text-white px-5 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            Explorar noticias <ArrowRight size={17}/>
          </button>
          <button type="button" onClick={() => finish('profile')} className="flex-1 bg-white hover:bg-[#f5f5f7] border border-[#d2d2d7] px-5 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            <UserRound size={17}/> Completar perfil
          </button>
        </div>
      </div>
    </div>
  );
}
