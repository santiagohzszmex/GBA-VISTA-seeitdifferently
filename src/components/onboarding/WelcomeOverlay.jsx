import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  Eye,
  Heart,
  Loader2,
  Newspaper,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { useEditorialFollow } from '../../hooks/useEditorialFollow';
import { useLibrary } from '../../hooks/useLibrary';
import { useLikes } from '../../hooks/useLikes';

const engagementScore = item => (Number(item.vistas) || 0) + ((Number(item.likes_count) || 0) * 5);
const formatMetric = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const ONBOARDING_STEPS = ['Tu identidad', 'Tus medios', 'Tu primera selección'];

function SuggestedEditorial({ editorial, onStatusChange }) {
  const { isFollowing, loading, toggleFollow } = useEditorialFollow(editorial.name);

  useEffect(() => {
    onStatusChange(editorial.name, isFollowing);
  }, [editorial.name, isFollowing, onStatusChange]);

  return (
    <button
      type="button"
      onClick={toggleFollow}
      disabled={loading}
      aria-pressed={isFollowing}
      className={`group min-h-[112px] w-full rounded-md border p-4 text-left transition-colors ${
        isFollowing
          ? 'border-emerald-300 bg-emerald-50'
          : 'border-[#d2d2d7] bg-white hover:border-[#0066FF]/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#f1f1f3] text-xs font-black text-[#1d1d1f]">
          {editorial.name.slice(0, 2).toUpperCase()}
        </div>
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isFollowing ? 'bg-emerald-600 text-white' : 'bg-[#f1f1f3] text-[#0066FF]'}`}>
          {loading ? <Loader2 size={14} className="animate-spin"/> : isFollowing ? <Check size={15}/> : <span className="text-lg leading-none">+</span>}
        </span>
      </div>
      <p className="mt-3 truncate text-sm font-bold text-[#1d1d1f]">{editorial.name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-bold text-[#86868b]">
        <span className="flex items-center gap-1"><Eye size={11}/>{formatMetric.format(editorial.views)}</span>
        <span className="flex items-center gap-1"><Heart size={11}/>{formatMetric.format(editorial.likes)}</span>
        <span>{editorial.editions} ed.</span>
      </div>
    </button>
  );
}

function DiscoveryEdition({ item, onOpen }) {
  const { isLiked, likesCount, checking, toggleLike } = useLikes(item.id);
  const { isInLibrary, toggleLibrary, loading: libraryLoading } = useLibrary(item);
  const image = item.poster_url || item.banner_url;

  return (
    <article className="grid min-h-[148px] grid-cols-[104px_minmax(0,1fr)] overflow-hidden rounded-md border border-[#d2d2d7] bg-white sm:grid-cols-1">
      <button type="button" onClick={() => onOpen(item)} className="h-full min-h-[148px] overflow-hidden bg-[#e8e8ed] sm:aspect-[16/10] sm:min-h-0" aria-label={`Abrir ${item.titulo}`}>
        {image ? <img src={image} alt="" className="h-full w-full object-cover"/> : <span className="flex h-full items-center justify-center text-[#86868b]"><Newspaper size={25}/></span>}
      </button>
      <div className="flex min-w-0 flex-col p-3.5">
        <p className="text-[9px] font-black uppercase text-[#0066FF]">{item.es_comunidad ? item.sello_editorial : 'GIMG'}</p>
        <button type="button" onClick={() => onOpen(item)} className="mt-1 line-clamp-2 text-left font-serif text-base font-bold leading-tight text-[#1d1d1f] hover:text-[#0066FF]">
          {item.titulo}
        </button>
        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={toggleLike}
            disabled={checking}
            className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold transition-colors ${isLiked ? 'bg-red-50 text-red-600' : 'bg-[#f5f5f7] text-[#68686d] hover:text-red-600'}`}
          >
            <Heart size={14} className={isLiked ? 'fill-current' : ''}/> {likesCount}
          </button>
          <button
            type="button"
            onClick={toggleLibrary}
            disabled={libraryLoading}
            className={`flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold transition-colors ${isInLibrary ? 'bg-blue-50 text-[#0066FF]' : 'bg-[#f5f5f7] text-[#68686d] hover:text-[#0066FF]'}`}
          >
            {isInLibrary ? <Check size={14}/> : <Bookmark size={14}/>} {isInLibrary ? 'Guardada' : 'Guardar'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function WelcomeOverlay({ onClose, setActiveTab, onSelectContent }) {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [editions, setEditions] = useState([]);
  const [followed, setFollowed] = useState(() => new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const contentRef = useRef(null);
  const [profile, setProfile] = useState({
    bio: user?.bio || '',
    servidor: user?.servidor || '',
    nacion: user?.nacion || '',
  });

  useEffect(() => {
    const loadSuggestions = async () => {
      setLoadingSuggestions(true);
      const { data } = await supabase
        .from('contenido')
        .select('id,titulo,descripcion,poster_url,banner_url,vistas,likes_count,categoria,created_at,sello_editorial,es_comunidad')
        .eq('estado_publicacion', 'aprobado')
        .or('categoria.eq.Noticia,categoria.eq.Periódico')
        .order('created_at', { ascending: false })
        .limit(120);

      const available = (data || []).filter(item => item.poster_url || item.banner_url);
      const independent = new Map();
      available.filter(item => item.es_comunidad).forEach(item => {
        const name = item.sello_editorial?.trim();
        if (!name) return;
        const key = name.toLocaleLowerCase('es-MX');
        const current = independent.get(key) || { name, views: 0, likes: 0, editions: 0, items: [] };
        current.views += Number(item.vistas) || 0;
        current.likes += Number(item.likes_count) || 0;
        current.editions += 1;
        current.items.push(item);
        independent.set(key, current);
      });

      const gimgItems = available.filter(item => !item.es_comunidad);
      const gimg = {
        name: 'GIMG',
        views: gimgItems.reduce((sum, item) => sum + (Number(item.vistas) || 0), 0),
        likes: gimgItems.reduce((sum, item) => sum + (Number(item.likes_count) || 0), 0),
        editions: gimgItems.length,
        items: gimgItems,
      };
      const rankedEditorials = [...independent.values()]
        .sort((a, b) => (b.views + (b.likes * 5)) - (a.views + (a.likes * 5)))
        .slice(0, 3);
      const editorialSuggestions = [gimg, ...rankedEditorials].filter(editorial => editorial.editions > 0);
      setSuggestions(editorialSuggestions);

      const selected = editorialSuggestions
        .map(editorial => [...editorial.items].sort((a, b) => engagementScore(b) - engagementScore(a))[0])
        .filter(Boolean);
      const selectedIds = new Set(selected.map(item => item.id));
      const remaining = [...available]
        .filter(item => !selectedIds.has(item.id))
        .sort((a, b) => engagementScore(b) - engagementScore(a));
      setEditions([...selected, ...remaining].slice(0, 4));
      setLoadingSuggestions(false);
    };

    loadSuggestions();
  }, []);

  const handleFollowStatus = useCallback((name, isFollowing) => {
    setFollowed(current => {
      const next = new Set(current);
      if (isFollowing) next.add(name);
      else next.delete(name);
      return next;
    });
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [step]);

  const saveIdentity = async () => {
    if (!user?.id) {
      setStep(1);
      return;
    }
    setSavingProfile(true);
    setProfileError('');
    const payload = {
      bio: profile.bio.trim(),
      servidor: profile.servidor.trim(),
      nacion: profile.nacion.trim(),
    };
    const { error } = await supabase.from('usuarios').update(payload).eq('id', user.id);
    if (error) {
      setProfileError('No pudimos guardar tu perfil. Intenta de nuevo.');
      setSavingProfile(false);
      return;
    }
    await refreshUser();
    setSavingProfile(false);
    setStep(1);
  };

  const finish = async (destination = 'home') => {
    window.localStorage.removeItem('vista_show_welcome');
    if (user?.id) {
      await supabase.from('usuarios').update({ onboarding_completado: true }).eq('id', user.id);
      await refreshUser();
    }
    setActiveTab(destination);
    onClose();
  };

  const openContent = async item => {
    await finish('home');
    onSelectContent?.(item);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-3 backdrop-blur-md md:p-6">
      <div className="relative flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-white/70 bg-[#fbfbfd] text-[#1d1d1f] shadow-2xl">
        <header className="flex items-center gap-4 border-b border-[#d2d2d7]/70 px-5 py-4 md:px-8">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(current => current - 1)} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#e8e8ed]" title="Volver">
              <ArrowLeft size={18}/>
            </button>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#1d1d1f] text-xs font-black text-white">
              {user?.nombre?.slice(0, 2).toUpperCase() || 'GB'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">@{user?.nombre || 'gba-id'}</p>
            <p className="text-[10px] text-[#86868b]">{ONBOARDING_STEPS[step]}</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex" aria-label={`${step + 1} de ${ONBOARDING_STEPS.length}`}>
            {ONBOARDING_STEPS.map((label, index) => <span key={label} className={`h-1.5 w-10 rounded-full ${index <= step ? 'bg-[#0066FF]' : 'bg-[#d2d2d7]'}`}/>) }
          </div>
          <button type="button" onClick={() => finish('home')} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#e8e8ed]" title="Continuar después">
            <X size={17}/>
          </button>
        </header>

        <div ref={contentRef} className="overflow-y-auto px-5 py-7 md:px-10 md:py-9">
          {step === 0 && (
            <section className="mx-auto max-w-2xl">
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-blue-50 text-[#0066FF]"><UserRound size={21}/></div>
              <p className="mb-2 text-[10px] font-black uppercase text-[#0066FF]">Tu GBA ID ya está listo</p>
              <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl">Haz que te reconozcan.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#68686d]">Cuenta qué haces en Empyria. Esto aparecerá cuando publiques, colabores o alguien visite tu perfil.</p>

              <div className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase text-[#68686d]">Descripción</span>
                  <textarea
                    value={profile.bio}
                    onChange={event => setProfile(current => ({ ...current, bio: event.target.value.slice(0, 180) }))}
                    rows="4"
                    placeholder="Periodista, constructor, administrador, creador de contenido..."
                    className="w-full resize-none rounded-md border border-[#d2d2d7] bg-white p-4 text-sm leading-6 outline-none focus:border-[#0066FF]"
                  />
                  <span className="mt-1 block text-right text-[10px] text-[#86868b]">{profile.bio.length}/180</span>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label><span className="mb-2 block text-[10px] font-black uppercase text-[#68686d]">Servidor</span><input value={profile.servidor} onChange={event => setProfile(current => ({ ...current, servidor: event.target.value.slice(0, 60) }))} placeholder="Empyria" className="h-12 w-full rounded-md border border-[#d2d2d7] bg-white px-4 text-sm outline-none focus:border-[#0066FF]"/></label>
                  <label><span className="mb-2 block text-[10px] font-black uppercase text-[#68686d]">Nación o comunidad</span><input value={profile.nacion} onChange={event => setProfile(current => ({ ...current, nacion: event.target.value.slice(0, 60) }))} placeholder="Opcional" className="h-12 w-full rounded-md border border-[#d2d2d7] bg-white px-4 text-sm outline-none focus:border-[#0066FF]"/></label>
                </div>
              </div>

              {profileError && <p className="mt-4 text-xs font-bold text-red-600">{profileError}</p>}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setStep(1)} className="h-12 px-5 text-sm font-bold text-[#68686d] hover:text-[#1d1d1f]">Ahora no</button>
                <button type="button" onClick={saveIdentity} disabled={savingProfile} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#1d1d1f] px-6 text-sm font-bold text-white disabled:opacity-50">
                  {savingProfile ? <Loader2 size={17} className="animate-spin"/> : <ArrowRight size={17}/>} Elegir mis medios
                </button>
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><Newspaper size={21}/></div>
              <p className="mb-2 text-[10px] font-black uppercase text-emerald-700">Tu inicio, a tu manera</p>
              <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl">¿A quién quieres leer?</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68686d]">Sigue tus noticieros favoritos para encontrar sus ediciones y novedades primero.</p>

              {loadingSuggestions ? (
                <div className="flex min-h-52 items-center justify-center text-[#86868b]"><Loader2 className="animate-spin" size={24}/></div>
              ) : (
                <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {suggestions.map(editorial => <SuggestedEditorial key={editorial.name} editorial={editorial} onStatusChange={handleFollowStatus}/>) }
                </div>
              )}

              <div className="mt-8 flex flex-col gap-3 border-t border-[#d2d2d7]/70 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-bold text-[#86868b]">{followed.size > 0 ? `${followed.size} ${followed.size === 1 ? 'medio siguiendo' : 'medios siguiendo'}` : 'Puedes cambiar esto cuando quieras'}</p>
                <button type="button" onClick={() => setStep(2)} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#1d1d1f] px-6 text-sm font-bold text-white">
                  Ver mi primera selección <ArrowRight size={17}/>
                </button>
              </div>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-md bg-amber-50 text-amber-700"><Sparkles size={21}/></div>
              <p className="mb-2 text-[10px] font-black uppercase text-amber-700">Una selección para comenzar</p>
              <h1 className="font-serif text-4xl font-bold leading-tight md:text-5xl">Guarda lo que te interese.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#68686d]">Un like mejora tus recomendaciones. Guardar conserva la edición en tu Biblioteca para leerla después.</p>

              {loadingSuggestions ? (
                <div className="flex min-h-52 items-center justify-center text-[#86868b]"><Loader2 className="animate-spin" size={24}/></div>
              ) : (
                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {editions.map(item => <DiscoveryEdition key={item.id} item={item} onOpen={openContent}/>) }
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#d2d2d7]/70 pt-6 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => finish('news')} className="h-12 px-5 text-sm font-bold text-[#68686d] hover:text-[#1d1d1f]">Explorar el Kiosco</button>
                <button type="button" onClick={() => finish('home')} className="flex h-12 items-center justify-center gap-2 rounded-md bg-[#0066FF] px-6 text-sm font-bold text-white hover:bg-[#0052cc]">
                  Entrar a mi VISTA <ArrowRight size={17}/>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
