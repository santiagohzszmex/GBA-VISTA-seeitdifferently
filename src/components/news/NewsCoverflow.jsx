import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, Eye, ArrowUpRight, Heart, ChevronUp, FileText, Bookmark, Check } from 'lucide-react';
import { useLikes } from '../../hooks/useLikes';
import { useLibrary } from '../../hooks/useLibrary';

// IMPORTAMOS LOS MÓDULOS DE I18N
import { useContentLanguage } from '../../hooks/useContentLanguage';
import LanguageSwitcher from '../common/LanguageSwitcher';

const FLIP_DURATION = 700; // ms — misma referencia usada en NewsCard, para consistencia visual

// ==========================================
// PANEL DESPLEGADO (equivalente a la "cara trasera" del Kiosco)
// ==========================================
function ExpandedPanel({ item, content, onClose }) {
  const { isLiked, likesCount, toggleLike } = useLikes(item.id);
  const { isInLibrary, toggleLibrary, loading: libraryLoading } = useLibrary(item);
  const panelRef = useRef(null);
  const [height, setHeight] = useState(0);

  // Extraemos el contenido traducido
  const { lang, setLang, availableLangs, langLabel, titulo, descripcion, poster, paginas } = content;

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const el = panelRef.current;
    const update = () => setHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paginas]); // Recalcular si las páginas cambian de idioma

  return (
    <div
      className="w-full overflow-hidden transition-[height] ease-[cubic-bezier(0.25,1,0.5,1)]"
      style={{ height, transitionDuration: `${FLIP_DURATION}ms` }}
    >
      <div
        ref={panelRef}
        className="w-full bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in duration-500"
      >
        {/* Cabecera Adaptada con Selector de Idiomas */}
        <div className="sticky top-0 z-30 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 px-6 md:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
          <div className="flex-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 block mb-1">
              Lector VISTA • {item.sello_editorial}
            </span>
            <h3 className="font-serif italic font-bold text-xl md:text-2xl text-white/95 pr-4 line-clamp-2">
              {titulo} {/* Título traducido */}
            </h3>
          </div>
          
          <div className="flex items-center gap-4 flex-shrink-0">
            <LanguageSwitcher 
              availableLangs={availableLangs} 
              lang={lang} 
              setLang={setLang} 
              langLabel={langLabel} 
              variant="dark" 
            />
            <button
              onClick={onClose}
              className="px-4 md:px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-all border border-red-500/20 active:scale-95"
            >
              <ChevronUp size={16} strokeWidth={3} /> <span className="hidden sm:inline">{lang === 'en' ? 'Close' : 'Cerrar Edición'}</span>
            </button>
          </div>
        </div>

        <div className="p-6 md:p-8 flex flex-col gap-8">

          {/* Portada Traducida + Like */}
          {poster && (
            <div className="max-w-3xl mx-auto w-full flex flex-col items-center gap-4">
              <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#1d1d1f]">
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/10 z-10">
                  {lang === 'en' ? 'Cover' : 'Portada'}
                </div>
                <img
                  src={poster}
                  alt={`Portada de ${titulo}`}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>

              <div className="flex items-center gap-4">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLike(); }}
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-2.5 rounded-full transition-all active:scale-95"
                >
                  <Heart size={16} className={isLiked ? 'fill-red-500 text-red-500' : 'text-white'} />
                  <span className="text-xs font-bold text-white/90">{likesCount}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleLibrary(); }}
                  disabled={libraryLoading}
                  className={`flex items-center gap-2 border px-4 py-2.5 rounded-full transition-all active:scale-95 disabled:opacity-50 ${
                    isInLibrary
                      ? 'bg-blue-500/15 border-blue-400/30 text-blue-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/90'
                  }`}
                >
                  {isInLibrary ? <Check size={16}/> : <Bookmark size={16}/>}
                  <span className="text-xs font-bold">{isInLibrary ? 'Guardada' : 'Guardar'}</span>
                </button>
                <span className="flex items-center gap-1.5 text-xs text-neutral-400 font-bold">
                  <Eye size={14} /> {item.vistas || 0} {lang === 'en' ? 'Reads' : 'Lecturas'}
                </span>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto w-full text-center">
            <p className="text-base md:text-lg text-neutral-400 leading-relaxed font-medium whitespace-pre-wrap">
              {descripcion} {/* Descripción traducida */}
            </p>
            <div className="h-px w-32 bg-white/10 mx-auto mt-8"></div>
          </div>

          {/* Cascada de Páginas Traducidas */}
          {paginas.length > 0 ? (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full items-center">
              {paginas.map((url, idx) => (
                <div key={idx} className="w-full bg-[#1d1d1f] rounded-xl overflow-hidden border border-white/5 shadow-lg relative">
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/10 z-10">
                    {lang === 'en' ? 'Page' : 'Página'} {idx + 1}
                  </div>
                  <img src={url} alt={`Página ${idx + 1}`} className="w-full h-auto object-contain" loading="lazy" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-neutral-500 gap-4">
              <FileText size={48} className="opacity-50" />
              <p className="text-sm font-mono uppercase font-bold">
                {lang === 'en' ? 'Document without digital assets' : 'Documento sin archivos digitales anexos'}
              </p>
            </div>
          )}

          <div className="flex justify-center pt-8 border-t border-white/10 mt-8">
            <button
              onClick={onClose}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all border border-white/10"
            >
              <ChevronUp size={20} strokeWidth={3} /> {lang === 'en' ? 'Fold Edition' : 'Plegar Edición'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PORTADA INDIVIDUAL DEL COVERFLOW (con reflejo estilo Apple)
// ==========================================
function CoverflowSlide({ item, isActive, isPrev, isNext, onOpen }) {
  // Resolvemos el idioma a nivel individual para que las imágenes inactivas también tengan su póster correcto
  const { poster, titulo } = useContentLanguage(item);

  if (!isActive && !isPrev && !isNext) return null; // no renderizamos lo que no se ve

  let transformStyle = 'translateX(0) scale(0.72) rotateY(0deg)';
  let zIndex = 0;
  let opacity = 0;

  if (isActive) {
    transformStyle = 'translateX(0) scale(1) rotateY(0deg)';
    zIndex = 30;
    opacity = 1;
  } else if (isPrev) {
    transformStyle = 'translateX(-58%) scale(0.78) rotateY(38deg)';
    zIndex = 20;
    opacity = 0.55;
  } else if (isNext) {
    transformStyle = 'translateX(58%) scale(0.78) rotateY(-38deg)';
    zIndex = 20;
    opacity = 0.55;
  }

  return (
    <div
      className="absolute w-[210px] md:w-[300px] transition-all duration-700 ease-out"
      style={{ transform: transformStyle, zIndex, opacity, pointerEvents: isActive ? 'auto' : 'none' }}
      onClick={() => isActive && onOpen(item)}
    >
      {/* Portada Traducida */}
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_25px_50px_rgba(0,0,0,0.25)] border border-white/40 cursor-pointer group/cover">
        <img src={poster} alt={titulo} className="w-full h-full object-cover" />
        {isActive && (
          <div className="absolute inset-0 bg-black/0 group-hover/cover:bg-black/20 transition-colors flex items-end justify-center pb-5">
            <span className="bg-white text-[#1d1d1f] text-xs font-bold uppercase tracking-widest px-5 py-2.5 rounded-full flex items-center gap-1.5 shadow-lg opacity-0 group-hover/cover:opacity-100 translate-y-2 group-hover/cover:translate-y-0 transition-all">
              Leer <ArrowUpRight size={14} />
            </span>
          </div>
        )}
      </div>

      {/* Reflejo (estilo Apple CoverFlow) */}
      <div
        className="relative w-full mt-[2px] h-16 md:h-24 overflow-hidden rounded-b-2xl pointer-events-none"
        style={{
          transform: 'scaleY(-1)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent 80%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.4), transparent 80%)',
        }}
        aria-hidden="true"
      >
        <img src={poster} alt="" className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

// ==========================================
// BOTÓN DE LIKE RÁPIDO PARA EL KIOSCO
// ==========================================
// ==========================================
// BOTÓN DE LIKE RÁPIDO PARA EL KIOSCO
// ==========================================
function QuickLikeButton({ itemId }) {
  const { isLiked, toggleLike } = useLikes(itemId);

  return (
    <button
      onClick={(e) => { e.stopPropagation(); toggleLike(); }}
      className={`p-3 rounded-full border transition-all active:scale-95 flex-shrink-0 shadow-sm ${
        isLiked ? 'bg-red-50 border-red-200' : 'bg-white border-[#d2d2d7] hover:bg-[#f5f5f7]'
      }`}
      title="Me gusta"
    >
      <Heart size={20} className={isLiked ? 'fill-red-500 text-red-500' : 'text-[#86868b]'} />
    </button>
  );
}

function QuickSaveButton({ item }) {
  const { isInLibrary, toggleLibrary, loading } = useLibrary(item);

  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); toggleLibrary(); }}
      disabled={loading}
      className={`p-3 rounded-full border transition-all active:scale-95 flex-shrink-0 shadow-sm disabled:opacity-50 ${
        isInLibrary ? 'bg-blue-50 border-blue-200 text-[#0066FF]' : 'bg-white border-[#d2d2d7] text-[#86868b] hover:bg-[#f5f5f7]'
      }`}
      title={isInLibrary ? 'Quitar de la biblioteca' : 'Guardar en la biblioteca'}
    >
      {isInLibrary ? <Check size={20}/> : <Bookmark size={20}/>}
    </button>
  );
}
// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export default function NewsCoverflow({ news = [], onRead, onNavigateProfile, focusedNewsId }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [coverflowItems, setCoverflowItems] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const stageRef = useRef(null);

  // Hook I18N invocado de forma segura en la raíz para compartir el estado activo entre la UI y el Panel Desplegado
  const activeItem = coverflowItems[activeIndex] || null;
  const activeContent = useContentLanguage(activeItem);

  useEffect(() => {
    if (news.length > 0) {
      const sortedNews = [...news].sort((a, b) => {
        if (a.id === focusedNewsId) return -1;
        if (b.id === focusedNewsId) return 1;

        const isGimgA = !a.es_comunidad || (a.sello_editorial && a.sello_editorial.toUpperCase().includes('GIMG'));
        const isGimgB = !b.es_comunidad || (b.sello_editorial && b.sello_editorial.toUpperCase().includes('GIMG'));

        if (isGimgA && !isGimgB) return -1;
        if (!isGimgA && isGimgB) return 1;

        return new Date(b.created_at) - new Date(a.created_at);
      });

      setCoverflowItems(sortedNews.slice(0, 7));
      if (focusedNewsId && sortedNews.some(item => item.id === focusedNewsId)) {
        setActiveIndex(0);
      }
    }
  }, [news, focusedNewsId]);

  const nextSlide = useCallback(() => {
    if (expanded) return; 
    setActiveIndex((current) => (current === coverflowItems.length - 1 ? 0 : current + 1));
  }, [coverflowItems.length, expanded]);

  const prevSlide = useCallback(() => {
    if (expanded) return;
    setActiveIndex((current) => (current === 0 ? coverflowItems.length - 1 : current - 1));
  }, [coverflowItems.length, expanded]);

  const goTo = useCallback((idx) => {
    if (expanded) return;
    setActiveIndex(idx);
  }, [expanded]);

  // Auto-Play
  useEffect(() => {
    if (expanded) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 6000);
    return () => clearInterval(timer);
  }, [nextSlide, expanded]);

  const handleOpen = useCallback((item) => {
    setExpanded(true);
    onRead && onRead(item); 
  }, [onRead]);

  const handleClose = useCallback((e) => {
    e.stopPropagation();
    setExpanded(false);
    setTimeout(() => {
      stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, FLIP_DURATION + 50);
  }, []);

  if (coverflowItems.length === 0) return null;

  const isGimgOfficial = activeItem && (!activeItem.es_comunidad || (activeItem.sello_editorial && activeItem.sello_editorial.toUpperCase().includes('GIMG')));

  return (
    <div ref={stageRef} className="relative w-full flex flex-col items-center bg-gradient-to-b from-[#fbfbfd] to-white">

      {/* Escenario 3D Coverflow */}
      <div className="relative w-full h-[420px] md:h-[560px] flex items-start justify-center pt-4 overflow-hidden group">

        <button
          onClick={prevSlide}
          className={`absolute left-4 md:left-12 z-50 p-4 rounded-full bg-white/50 backdrop-blur-md border border-[#d2d2d7] text-[#1d1d1f] transition-all duration-300 hover:scale-110 hover:bg-white shadow-lg ${expanded ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={nextSlide}
          className={`absolute right-4 md:right-12 z-50 p-4 rounded-full bg-white/50 backdrop-blur-md border border-[#d2d2d7] text-[#1d1d1f] transition-all duration-300 hover:scale-110 hover:bg-white shadow-lg ${expanded ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <ChevronRight size={24} />
        </button>

        <div className="relative w-full max-w-5xl h-full flex items-center justify-center perspective-[1400px]">
          {coverflowItems.map((item, index) => (
            <CoverflowSlide
              key={item.id}
              item={item}
              isActive={index === activeIndex}
              isPrev={index === (activeIndex - 1 + coverflowItems.length) % coverflowItems.length}
              isNext={index === (activeIndex + 1) % coverflowItems.length}
              onOpen={handleOpen}
            />
          ))}
        </div>
      </div>

      {/* Indicadores de progreso */}
      {!expanded && (
        <div className="flex items-center gap-2 mb-6 -mt-2">
          {coverflowItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goTo(idx)}
              className={`h-1.5 rounded-full transition-all duration-500 ${idx === activeIndex ? 'w-8 bg-[#1d1d1f]' : 'w-2 bg-[#d2d2d7] hover:bg-[#86868b]'}`}
            />
          ))}
        </div>
      )}

      {/* Info del ítem activo (Apple Music Style) */}
      {activeItem && !expanded && (
        <div className="w-full max-w-2xl px-6 text-center flex flex-col items-center gap-3 mb-10 animate-in fade-in duration-500">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onNavigateProfile && activeItem.sello_editorial) onNavigateProfile(activeItem.sello_editorial);
            }}
            className="flex items-center gap-1.5 bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7] px-3 py-1.5 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-[#1d1d1f] hover:text-white transition-colors"
          >
            <ShieldCheck size={14} className={isGimgOfficial ? 'text-blue-500' : 'text-[#1d1d1f]'} />
            {isGimgOfficial ? 'GIMG OFICIAL' : (activeItem.sello_editorial || 'Independiente')}
          </button>

          <h2 className="text-2xl md:text-3xl font-serif italic text-[#1d1d1f] leading-tight">
            {activeContent.titulo} {/* Título traducido */}
          </h2>

          <LanguageSwitcher 
            availableLangs={activeContent.availableLangs} 
            lang={activeContent.lang} 
            setLang={activeContent.setLang} 
            langLabel={activeContent.langLabel} 
            variant="light" 
          />

          {/* ESTA ES LA SECCIÓN MODIFICADA: Descripción + Like Button */}
          <div className="flex items-center gap-4 max-w-xl w-full">
            <p className="text-sm md:text-base text-[#86868b] line-clamp-2 font-medium flex-1 text-center md:text-right">
              {activeContent.descripcion} {/* Descripción traducida */}
            </p>
            <QuickLikeButton key={activeItem.id} itemId={activeItem.id} />
            <QuickSaveButton key={`save-${activeItem.id}`} item={activeItem} />
          </div>

          <div className="flex items-center gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-[#86868b] font-bold">
              <Eye size={14} /> {activeItem.vistas || 0} {activeContent.lang === 'en' ? 'Reads' : 'Lecturas'}
            </span>
            <button
              onClick={() => handleOpen(activeItem)}
              className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1 bg-[#0066FF] hover:bg-[#0052cc] px-5 py-2.5 rounded-full transition-colors"
            >
              {activeContent.lang === 'en' ? 'Read' : 'Leer'} <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Panel desplegado */}
      {activeItem && expanded && (
        <div className="w-full px-6 md:px-0 md:max-w-4xl mb-16">
          <ExpandedPanel item={activeItem} content={activeContent} onClose={handleClose} />
        </div>
      )}
    </div>
  );
}
