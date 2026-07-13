import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Newspaper, UserRound, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useEditorialFollow } from '../../hooks/useEditorialFollow';

function SuggestedEditorial({ name }) {
  const { isFollowing, loading, toggleFollow } = useEditorialFollow(name);
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
        <p className="font-bold text-sm text-[#1d1d1f] truncate">{name}</p>
        <p className="text-[10px] uppercase tracking-widest text-[#86868b] mt-1">Editorial de Empyria</p>
      </div>
      <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isFollowing ? 'bg-green-500 text-white' : 'bg-[#f5f5f7] text-[#0066FF]'}`}>
        {isFollowing ? <Check size={15}/> : <span className="text-lg leading-none">+</span>}
      </span>
    </button>
  );
}

export default function WelcomeOverlay({ onClose, setActiveTab }) {
  const { user, refreshUser } = useAuth();
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    const loadSuggestions = async () => {
      const { data } = await supabase
        .from('contenido')
        .select('sello_editorial')
        .eq('estado_publicacion', 'aprobado')
        .eq('es_comunidad', true)
        .not('sello_editorial', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      const unique = [...new Set((data || []).map(item => item.sello_editorial).filter(Boolean))].slice(0, 3);
      setSuggestions(unique);
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

        {suggestions.length > 0 && (
          <section className="border-y border-[#d2d2d7]/60 py-6 mb-7">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper size={17} className="text-[#0066FF]"/>
              <h2 className="text-sm font-black uppercase tracking-widest">Empieza siguiendo editoriales</h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {suggestions.map(name => <SuggestedEditorial key={name} name={name}/>) }
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
