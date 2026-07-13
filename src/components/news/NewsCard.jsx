import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { Heart, Eye, ShieldCheck, FileText, ChevronUp, Layers, Bookmark, Check } from 'lucide-react';
import { useLikes } from '../../hooks/useLikes';
import { useLibrary } from '../../hooks/useLibrary';
import { useContentLanguage } from '../../hooks/useContentLanguage';
import LanguageSwitcher from '../common/LanguageSwitcher';
import { getEditorialCategoryLabel } from '../../utils/editorialCategories';

const FLIP_DURATION = 700; // ms — una sola fuente de verdad para JS y CSS

export default function NewsCard({ item, onRead, onNavigateProfile }) {
  const { isLiked, likesCount, toggleLike } = useLikes(item.id);
  const { isInLibrary, toggleLibrary, loading: libraryLoading } = useLibrary(item);
  const { lang, setLang, availableLangs, langLabel, titulo, descripcion, poster, paginas } = useContentLanguage(item);
  const [isFlipped, setIsFlipped] = useState(false);
  const [contentHeight, setContentHeight] = useState(480);

  const cardRef = useRef(null);   // wrapper completo (para scroll)
  const backRef = useRef(null);   // contenido trasero (para medir su altura real)

  // Mide la altura REAL del contenido trasero en vez de usar un max-height arbitrario.
  // Así el grid solo recalcula una vez, con el valor final correcto, sin "temblores".
  useLayoutEffect(() => {
    if (!isFlipped || !backRef.current) return;

    const el = backRef.current;
    const updateHeight = () => setContentHeight(el.scrollHeight);

    updateHeight();

    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFlipped]);

  const handleLikeClick = async (e) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handleProfileClick = (e) => {
    e.stopPropagation();
    if (onNavigateProfile && item.sello_editorial) {
      onNavigateProfile(item.sello_editorial);
    }
  };

  const handleLibraryClick = async (e) => {
    e.stopPropagation();
    await toggleLibrary();
  };

  const openCard = () => {
    if (!isFlipped) {
      setIsFlipped(true);
      onRead(item);
    }
  };

  const closeCard = useCallback((e) => {
    e.stopPropagation();
    setIsFlipped(false);
    // Esperamos a que TERMINE la transición (no un valor arbitrario menor)
    // antes de hacer scroll, para no apuntar a una posición que aún se mueve.
    setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, FLIP_DURATION + 50);
  }, []);

  return (
    <div
      ref={cardRef}
      // isolate + contain evita que la transformación 3D "se escape" y provoque
      // scrollbars horizontales fantasma o interfiera con el layout de otras tarjetas.
      className={`group w-full [perspective:2000px] isolate [contain:layout] transition-[transform] duration-500 ${
        isFlipped ? 'col-span-1 sm:col-span-2 lg:col-span-3 z-10' : 'cursor-pointer hover:-translate-y-2'
      }`}
      style={{ overflowAnchor: 'none' }} // evita saltos de scroll cuando cargan las imágenes
      onClick={openCard}
    >
      <div
        className="relative w-full [transform-style:preserve-3d] transition-[transform,height] ease-[cubic-bezier(0.25,1,0.5,1)]"
        style={{
          height: isFlipped ? contentHeight : 480,
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transitionDuration: `${FLIP_DURATION}ms`,
        }}
      >

        {/* ==========================================
            CARA FRONTAL: PORTADA (Cerrada)
        ========================================== */}
        <div
          className={`absolute inset-0 w-full h-[480px] bg-white border border-[#d2d2d7] rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-500 flex flex-col ${
            isFlipped ? 'pointer-events-none' : ''
          }`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="relative h-[65%] bg-[#f5f5f7] overflow-hidden">
            <img
              src={poster}
              alt={titulo}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-out"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-90" />

            <button
              onClick={handleLikeClick}
              className="absolute top-5 right-5 w-11 h-11 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white hover:text-black transition-all z-10 shadow-xl"
            >
              <Heart size={20} className={isLiked ? 'fill-red-500 text-red-500' : 'text-white'} />
            </button>

            {availableLangs.length > 1 && (
              <div className="absolute top-5 left-5 z-10 rounded-xl bg-black/55 backdrop-blur-md border border-white/10 p-2 shadow-xl">
                <LanguageSwitcher availableLangs={availableLangs} lang={lang} setLang={setLang} langLabel={langLabel} variant="dark" />
              </div>
            )}

            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between">
              <button
                onClick={handleProfileClick}
                className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md text-white border border-white/20 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-white hover:text-black transition-colors shadow-lg"
              >
                <ShieldCheck size={14} className="text-blue-400" />
                <span className="truncate max-w-[140px]">{item.sello_editorial}</span>
              </button>
              <button onClick={handleLibraryClick} disabled={libraryLoading} className={`w-10 h-10 rounded-xl border flex items-center justify-center backdrop-blur-md transition-colors ${isInLibrary ? 'bg-green-500/90 border-green-400 text-white' : 'bg-black/60 border-white/20 text-white hover:bg-white hover:text-black'}`} title={isInLibrary ? 'Quitar de guardados' : 'Guardar edición'}>
                {isInLibrary ? <Check size={16}/> : <Bookmark size={16}/>}
              </button>
            </div>
          </div>

          <div className="p-6 flex flex-col flex-1 bg-white">
            <div className="flex items-center justify-between text-[10px] text-[#86868b] font-black uppercase tracking-widest mb-3">
              <span>{new Date(item.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><Eye size={13} /> {item.vistas || 0}</span>
                <span className="flex items-center gap-1"><Heart size={13} className={isLiked ? "fill-red-500 text-red-500" : ""} /> {likesCount}</span>
              </div>
            </div>

            <span className="text-[9px] font-black uppercase tracking-widest text-[#0066FF] mb-2">{getEditorialCategoryLabel(item.categoria_editorial)}</span>
            <h3 className="font-serif font-bold text-xl md:text-2xl text-[#1d1d1f] leading-tight mb-2 line-clamp-2 group-hover:text-[#0066FF] transition-colors">
              {titulo}
            </h3>

            <div className="mt-auto pt-4 border-t border-[#d2d2d7]/50 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
               <span className="text-xs font-bold text-[#0066FF] uppercase tracking-widest">Abrir y Leer</span>
               <Layers size={18} className="text-[#0066FF]" />
            </div>
          </div>
        </div>

        {/* ==========================================
            CARA TRASERA: DESPLIEGUE EN LÍNEA (Abierta)
        ========================================== */}
        <div
          ref={backRef}
          className={`w-full bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-2xl [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col ${
            isFlipped ? 'relative opacity-100' : 'absolute inset-0 h-[480px] opacity-0 pointer-events-none'
          }`}
        >
          <div className="sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-xl border-b border-white/10 px-6 md:px-8 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 block mb-1">
                Lector VISTA • {item.sello_editorial}
              </span>
              <h3 className="font-serif italic font-bold text-2xl text-white/95 pr-4">
                {titulo}
              </h3>
            </div>
            <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
              <LanguageSwitcher availableLangs={availableLangs} lang={lang} setLang={setLang} langLabel={langLabel} variant="dark" />
              <button onClick={handleLibraryClick} disabled={libraryLoading} className={`h-11 px-4 rounded-xl border flex items-center gap-2 text-xs font-bold transition-colors ${isInLibrary ? 'bg-green-500/15 border-green-500/30 text-green-400' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`} title={isInLibrary ? 'Quitar de guardados' : 'Guardar edición'}>
                {isInLibrary ? <Check size={16}/> : <Bookmark size={16}/>}<span className="hidden md:inline">{isInLibrary ? 'Guardada' : 'Guardar'}</span>
              </button>
              <button
                onClick={closeCard}
                className="px-5 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-all border border-red-500/20 active:scale-95 flex-shrink-0"
              >
                <ChevronUp size={16} strokeWidth={3} /> Cerrar Edición
              </button>
            </div>
          </div>

          {/* Cuerpo Extendido */}
          <div className="p-8 flex flex-col gap-8">

            {/* Portada de la edición */}
            {poster && (
              <div className="max-w-3xl mx-auto w-full">
                <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#1d1d1f]">
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/10 z-10">
                    Portada
                  </div>
                  <img
                    src={poster}
                    alt={`Portada de ${titulo}`}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                    onLoad={() => backRef.current && setContentHeight(backRef.current.scrollHeight)}
                  />
                </div>
              </div>
            )}

            <div className="max-w-4xl mx-auto w-full text-center">
              <p className="text-base md:text-lg text-neutral-400 leading-relaxed font-medium">
                {descripcion}
              </p>
              <div className="h-px w-32 bg-white/10 mx-auto mt-8"></div>
            </div>

            {/* Cascada de Páginas a lo ancho */}
            {paginas.length > 0 ? (
              <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full items-center">
                {paginas.map((url, idx) => (
                  <div
                    key={idx}
                    className="w-full aspect-[3/4] bg-[#1d1d1f] rounded-xl overflow-hidden border border-white/5 shadow-lg relative"
                  >
                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/80 border border-white/10 z-10">
                      Página {idx + 1}
                    </div>
                    <img
                      src={url}
                      alt={`Página ${idx + 1}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                      onLoad={() => backRef.current && setContentHeight(backRef.current.scrollHeight)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-neutral-500 gap-4">
                <FileText size={48} className="opacity-50" />
                <p className="text-sm font-mono uppercase font-bold">Documento sin archivos digitales anexos</p>
              </div>
            )}

            {/* Botón de Cierre Inferior (Para no tener que subir todo el scroll) */}
            <div className="flex justify-center pt-8 border-t border-white/10 mt-8">
              <button
                onClick={closeCard}
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase tracking-widest text-sm flex items-center gap-3 transition-all border border-white/10"
              >
                <ChevronUp size={20} strokeWidth={3} /> Plegar Edición
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
