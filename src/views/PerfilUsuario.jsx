import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Edit3, Eye, Heart, Newspaper, Save, Server, Share2, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import NewsCard from '../components/news/NewsCard';
import Estadisticas from './Estadisticas';

export default function PerfilUsuario({ publicHandle = null, setActiveTab, initialSection = 'profile' }) {
  const { user, isDueño, refreshUser } = useAuth();
  const handle = publicHandle || user?.nombre;
  const isOwnProfile = Boolean(user?.nombre && handle && user.nombre.toLowerCase() === handle.replace(/^@/, '').toLowerCase());
  const canViewAnalytics = isOwnProfile && (user?.rol === 'Editor' || isDueño);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [publications, setPublications] = useState([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [draft, setDraft] = useState({ nombre_publico: '', bio: '', servidor: '', nacion: '', discord_id: '', perfil_publico: true });

  useEffect(() => {
    const load = async () => {
      if (!handle) {
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      const { data } = await supabase.rpc('get_public_profile', { p_handle: handle });
      const ownFallback = isOwnProfile ? {
        id: user.id,
        handle: user.nombre,
        nombre_publico: user.nombre_publico || user.nombre,
        bio: user.bio || '',
        servidor: user.servidor,
        nacion: user.nacion,
        rol: user.rol,
        sello_editorial: user.sello_editorial,
        publicaciones: 0,
        vistas: 0,
        likes: 0
      } : null;
      const resolved = data || ownFallback;
      setProfile(resolved);
      if (!resolved?.id) {
        setLoadingProfile(false);
        return;
      }

      const { data: content } = await supabase
        .from('contenido')
        .select('*')
        .eq('autor_id', resolved.id)
        .eq('estado_publicacion', 'aprobado')
        .eq('es_comunidad', true)
        .order('created_at', { ascending: false });
      setPublications(content || []);
      setLoadingProfile(false);
    };
    load();
  }, [handle, isOwnProfile, user]);

  useEffect(() => {
    if (!profile) return;
    setDraft({
      nombre_publico: profile.nombre_publico || profile.handle || '',
      bio: profile.bio || '',
      servidor: profile.servidor || '',
      nacion: profile.nacion || '',
      discord_id: isOwnProfile ? (user?.discord_id || '') : '',
      perfil_publico: user?.perfil_publico ?? true
    });
  }, [isOwnProfile, profile, user?.discord_id, user?.perfil_publico]);

  const initials = useMemo(() => (profile?.nombre_publico || profile?.handle || 'GB').slice(0, 2).toUpperCase(), [profile]);

  const saveProfile = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase.from('usuarios').update(draft).eq('id', user.id);
    if (!error) {
      await refreshUser();
      setProfile(prev => ({ ...prev, ...draft }));
      setEditing(false);
    }
    setSaving(false);
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}${window.location.pathname}?profile=${encodeURIComponent(profile.handle)}`;
    if (navigator.share) {
      await navigator.share({ title: profile.nombre_publico, url });
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  if (loadingProfile) {
    return <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center text-[#86868b] font-medium">Cargando perfil GBA ID...</div>;
  }

  if (!profile) {
    return <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center text-[#86868b] font-medium">Este perfil no está disponible públicamente.</div>;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] pb-32">
      <div className="max-w-[1500px] mx-auto px-6 md:px-12 pt-10">
        {publicHandle && (
          <button type="button" onClick={() => { window.history.replaceState({}, '', window.location.pathname); window.location.reload(); }} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#86868b] hover:text-[#1d1d1f] mb-10">
            <ArrowLeft size={15}/> Entrar a VISTA
          </button>
        )}

        <header className="grid md:grid-cols-[180px_1fr_auto] gap-7 md:gap-10 items-center border-b border-[#d2d2d7]/60 pb-12">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-2xl overflow-hidden bg-[#1d1d1f] text-white flex items-center justify-center text-4xl font-black shadow-xl">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#0066FF] text-[10px] font-black uppercase tracking-widest mb-3"><UserRound size={15}/> Perfil GBA ID</div>
            <h1 className="font-serif italic text-4xl md:text-6xl tracking-tight leading-none">{profile.nombre_publico}</h1>
            <p className="text-[#0066FF] font-bold mt-3">@{profile.handle}</p>
            <p className="text-[#86868b] max-w-2xl mt-5 leading-relaxed whitespace-pre-wrap">{profile.bio || 'Este usuario todavía no ha escrito una biografía.'}</p>
            <div className="flex flex-wrap gap-3 mt-5 text-xs font-bold text-[#86868b]">
              {profile.servidor && <span className="flex items-center gap-1.5"><Server size={14}/> {profile.servidor}</span>}
              {profile.nacion && <span>{profile.nacion}</span>}
              {profile.sello_editorial && <span className="text-[#1d1d1f]">{profile.sello_editorial}</span>}
            </div>
          </div>
          <div className="flex md:flex-col gap-2">
            <button type="button" onClick={shareProfile} className="px-5 py-3 bg-[#1d1d1f] text-white rounded-xl font-bold flex items-center justify-center gap-2"><Share2 size={16}/>{copied ? 'Copiado' : 'Compartir'}</button>
            {isOwnProfile && <button type="button" onClick={() => setEditing(true)} className="px-5 py-3 bg-white border border-[#d2d2d7] rounded-xl font-bold flex items-center justify-center gap-2"><Edit3 size={16}/>Editar</button>}
          </div>
        </header>

        <section className="grid grid-cols-3 gap-4 py-8 border-b border-[#d2d2d7]/60">
          {[
            ['Publicaciones', profile.publicaciones || publications.length, Newspaper],
            ['Lecturas', profile.vistas || 0, Eye],
            ['Likes', profile.likes || 0, Heart]
          ].map(([label, value, Icon]) => (
            <div key={label} className="text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 text-[#86868b] text-[10px] font-black uppercase tracking-widest"><Icon size={13}/>{label}</div>
              <p className="text-2xl md:text-3xl font-bold mt-2">{value}</p>
            </div>
          ))}
        </section>

        {canViewAnalytics && (
          <div className="pt-8" role="tablist" aria-label="Secciones del perfil">
            <div className="inline-flex w-full sm:w-auto rounded-xl bg-[#e8e8ed] p-1">
              <button type="button" role="tab" aria-selected={activeSection === 'profile'} onClick={() => setActiveSection('profile')} className={`min-h-10 flex-1 sm:flex-none px-5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors ${activeSection === 'profile' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}>
                <Newspaper size={15}/> Publicaciones
              </button>
              <button type="button" role="tab" aria-selected={activeSection === 'analytics'} onClick={() => setActiveSection('analytics')} className={`min-h-10 flex-1 sm:flex-none px-5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-colors ${activeSection === 'analytics' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#1d1d1f]'}`}>
                <BarChart3 size={15}/> Estadísticas
              </button>
            </div>
          </div>
        )}

        {canViewAnalytics && activeSection === 'analytics' ? (
          <Estadisticas embedded />
        ) : (
          <section className="pt-12">
            <h2 className="text-2xl font-serif italic font-bold mb-8">Aportaciones públicas</h2>
            {publications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {publications.map(item => <NewsCard key={item.id} item={item} onRead={() => {}} onNavigateProfile={null}/>) }
              </div>
            ) : <div className="py-20 border border-dashed border-[#d2d2d7] rounded-2xl text-center text-[#86868b]">Este perfil todavía no tiene aportaciones públicas.</div>}
          </section>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[2000] bg-black/45 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-[#d2d2d7] shadow-2xl p-7 space-y-4">
            <div className="flex items-center justify-between"><h2 className="text-2xl font-serif italic font-bold">Editar perfil público</h2><button onClick={() => setEditing(false)} className="w-9 h-9 rounded-full bg-[#f5f5f7] flex items-center justify-center"><X size={16}/></button></div>
            <input value={draft.nombre_publico} onChange={e => setDraft(prev => ({ ...prev, nombre_publico: e.target.value }))} placeholder="Nombre público" className="w-full border border-[#d2d2d7] rounded-xl p-3 outline-none focus:border-[#0066FF]"/>
            <textarea value={draft.bio} onChange={e => setDraft(prev => ({ ...prev, bio: e.target.value }))} rows="4" placeholder="Biografía" className="w-full border border-[#d2d2d7] rounded-xl p-3 resize-none outline-none focus:border-[#0066FF]"/>
            <div className="grid grid-cols-2 gap-3"><input value={draft.servidor} onChange={e => setDraft(prev => ({ ...prev, servidor: e.target.value }))} placeholder="Servidor" className="border border-[#d2d2d7] rounded-xl p-3 outline-none"/><input value={draft.nacion} onChange={e => setDraft(prev => ({ ...prev, nacion: e.target.value }))} placeholder="Nación" className="border border-[#d2d2d7] rounded-xl p-3 outline-none"/></div>
            <div><input value={draft.discord_id} onChange={e => setDraft(prev => ({ ...prev, discord_id: e.target.value }))} placeholder="Usuario de Discord (opcional)" className="w-full border border-[#d2d2d7] rounded-xl p-3 outline-none"/><p className="text-[10px] text-[#86868b] mt-1.5 px-1">Dato privado para contacto y administración; no aparece en tu perfil público.</p></div>
            <label className="flex items-center justify-between gap-4 p-3 bg-[#f5f5f7] rounded-xl font-medium text-sm">Perfil visible mediante enlace<input type="checkbox" checked={draft.perfil_publico} onChange={e => setDraft(prev => ({ ...prev, perfil_publico: e.target.checked }))}/></label>
            <button type="button" onClick={saveProfile} disabled={saving} className="w-full py-4 bg-[#1d1d1f] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"><Save size={17}/>Guardar perfil</button>
          </div>
        </div>
      )}
    </div>
  );
}
