import React, { useRef } from 'react';
import VideoCover from './VideoCover';
import { isVideoContent, videoCategoryLabel } from '../utils/contentTypes';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function ContentRow({ title, items = [], onSelect }) {
  const rowRef = useRef(null);

  const handleScroll = (direction) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;
      const scrollTo = direction === 'left' 
        ? scrollLeft - clientWidth * 0.75 
        : scrollLeft + clientWidth * 0.75;
      
      rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4 relative group/row">
      {/* Título de la Categoría */}
      <h3 className="font-sans font-medium tracking-tight text-2xl text-[#1d1d1f] px-1">
        {title}
      </h3>
      
      <div className="relative">
        {/* Botón de Desplazamiento Izquierdo */}
        <button 
          onClick={() => handleScroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 bg-white/80 backdrop-blur-md border border-[#d2d2d7] text-[#1d1d1f] p-3 rounded-full shadow-md opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hover:bg-white -left-5 hidden md:flex items-center justify-center"
        >
          <ChevronLeft size={20} strokeWidth={2} />
        </button>

        {/* Contenedor Deslizante Horizontal */}
        <div 
          ref={rowRef}
          className="flex gap-6 overflow-x-auto scrollbar-none px-1 py-4 scroll-smooth snap-x snap-mandatory"
        >
          {items.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelect && onSelect(item)}
              className={`flex-none ${item.es_comunidad && isVideoContent(item) ? 'w-[min(82vw,360px)] sm:w-[420px]' : 'w-56 sm:w-64'} snap-start group/card cursor-pointer`}
            >
              {/* Tarjeta de Contenido */}
              <div className={`relative ${item.es_comunidad && isVideoContent(item) ? 'aspect-video' : 'aspect-[4/5]'} bg-[#f5f5f7] rounded-2xl overflow-hidden shadow-sm group-hover/card:shadow-xl transition-all duration-500 ease-out border border-[#d2d2d7]/30`}>
                <VideoCover
                  item={item}
                  alt={item.titulo}
                  className="w-full h-full object-cover group-hover/card:scale-105 transition-all duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
              </div>
              
              {/* Metadatos de la Publicación */}
              <h4 className="mt-3 font-serif italic text-lg text-[#1d1d1f] group-hover/card:text-[#0066FF] transition-colors truncate px-1">
                {item.titulo}
              </h4>
              <p className="text-[10px] font-bold text-[#86868b] mt-0.5 px-1 tracking-widest uppercase">
                {item.es_comunidad && isVideoContent(item) ? [item.sello_editorial, videoCategoryLabel(item.categoria)].filter(Boolean).join(' · ') : [item.año || item.anio, videoCategoryLabel(item.categoria)].filter(Boolean).join(' · ')}
              </p>
            </div>
          ))}
        </div>

        {/* Botón de Desplazamiento Derecho */}
        <button 
          onClick={() => handleScroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 bg-white/80 backdrop-blur-md border border-[#d2d2d7] text-[#1d1d1f] p-3 rounded-full shadow-md opacity-0 group-hover/row:opacity-100 transition-opacity duration-300 hover:bg-white -right-5 hidden md:flex items-center justify-center"
        >
          <ChevronRight size={20} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}