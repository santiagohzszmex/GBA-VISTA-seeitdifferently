import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Search as SearchIcon, X, Film, Newspaper, Globe, ChevronRight } from 'lucide-react';
import { isVideoContent } from '../utils/contentTypes';

export default function Buscar({ onSelectMovie }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Categorización de resultados
  const [videosResult, setVideosResult] = useState([]);
  const [noticiasResult, setNoticiasResult] = useState([]);
  const [kioscoResult, setKioscoResult] = useState([]);

  // Motor de búsqueda con Debounce (espera a que termines de teclear)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 1) {
        setLoading(true);
        
        try {
          // Buscamos coincidencias en Título o Descripción
          const { data, error } = await supabase
            .from('contenido')
            .select('*')
            .or(`titulo.ilike.%${query}%,descripcion.ilike.%${query}%`)
            .order('created_at', { ascending: false })
            .limit(50);

          if (error) throw error;

          if (data) {
            // Filtro de Inteligencia: Clasificamos los resultados por su origen y tipo
            setVideosResult(data.filter(item => 
              isVideoContent(item)
            ));
            
            setNoticiasResult(data.filter(item => 
              !item.es_comunidad && (item.categoria === 'Noticia' || item.categoria === 'Periódico')
            ));
            
            setKioscoResult(data.filter(item => 
              item.es_comunidad && item.estado_publicacion === 'aprobado'
            ));
          }
        } catch (err) {
          console.error("Error en la red de búsqueda:", err);
        } finally {
          setLoading(false);
        }
      } else {
        // Limpiar resultados si el buscador está vacío
        setVideosResult([]);
        setNoticiasResult([]);
        setKioscoResult([]);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Constante para saber si hay resultados en total
  const hasResults = videosResult.length > 0 || noticiasResult.length > 0 || kioscoResult.length > 0;

  return (
    <div className="w-full min-h-screen bg-[#fbfbfd] pt-8 px-4 md:px-12 pb-32 font-sans selection:bg-[#0066FF] selection:text-white">
      
      {/* 🔍 BARRA DE BÚSQUEDA SPOTLIGHT */}
      <div className="sticky top-6 z-50 max-w-3xl mx-auto mb-16">
        <div className="relative group shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2rem] bg-white/70 backdrop-blur-3xl border border-white/80 transition-all duration-500 ring-4 ring-transparent focus-within:ring-[#0066FF]/20 focus-within:border-[#0066FF]/30">
          
          <SearchIcon 
            className="absolute left-6 top-1/2 -translate-y-1/2 text-[#86868b] group-focus-within:text-[#0066FF] transition-colors duration-300" 
            size={28} 
            strokeWidth={2}
          />
          
          <input 
            type="text" 
            placeholder="Películas, noticias, sellos editoriales..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent py-6 pl-20 pr-16 text-2xl md:text-3xl font-medium tracking-tight text-[#1d1d1f] placeholder:text-[#86868b]/60 outline-none rounded-[2rem]"
            autoFocus
          />
          
          {query && (
            <button 
              onClick={() => setQuery('')} 
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-[#e8e8ed] hover:bg-[#d2d2d7] text-[#1d1d1f] p-1.5 rounded-full transition-colors"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          )}
        </div>
        
        {/* Indicador de carga sutil */}
        <div className={`absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-widest text-[#0066FF] transition-opacity duration-300 ${loading ? 'opacity-100' : 'opacity-0'}`}>
          Rastreando...
        </div>
      </div>

      {/* 📊 ESCENARIO DE RESULTADOS */}
      <div className="max-w-6xl mx-auto">
        
        {!loading && query.length > 1 && !hasResults ? (
          <div className="text-center py-20 animate-in fade-in">
            <SearchIcon className="mx-auto mb-6 text-[#d2d2d7]" size={64} strokeWidth={1} />
            <p className="text-2xl font-serif italic text-[#1d1d1f] mb-2">Ningún resultado para "{query}"</p>
            <p className="text-[#86868b] font-medium">Revisa la ortografía o intenta con términos más generales.</p>
          </div>
        ) : query.length <= 1 ? (
          <div className="text-center py-32 opacity-40 select-none pointer-events-none">
             <p className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-[#86868b] uppercase">Spotlight</p>
             <p className="text-[#86868b] font-medium text-lg">Escribe para explorar todo el ecosistema VISTA.</p>
          </div>
        ) : (
          <div className="space-y-16 animate-in slide-in-from-bottom-8 duration-700 fade-in">
            
            {/* SECCIÓN 1: VIDEOS Y PELÍCULAS */}
            {videosResult.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-6 text-[#1d1d1f] flex items-center gap-2 border-b border-[#d2d2d7]/50 pb-4">
                  <Film size={20} className="text-[#0066FF]"/> Contenido Multimedia
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {videosResult.map(movie => (
                    <div key={movie.id} onClick={() => onSelectMovie && onSelectMovie(movie)} className="group cursor-pointer">
                      <div className="aspect-[2/3] bg-[#f5f5f7] rounded-2xl overflow-hidden mb-3 shadow-sm group-hover:shadow-xl transition-all duration-500 relative border border-black/5">
                        <img 
                          src={movie.poster_url || movie.banner_url} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                          alt={movie.titulo}
                        />
                        {movie.en_hero && (
                          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest text-[#1d1d1f] shadow-sm">
                            Hero
                          </div>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-[#1d1d1f] group-hover:text-[#0066FF] transition-colors line-clamp-1">{movie.titulo}</h4>
                      <p className="text-xs text-[#86868b] font-medium mt-0.5">{movie.año} • {movie.categoria}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 2: NOTICIAS OFICIALES GIMG */}
            {noticiasResult.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-6 text-[#1d1d1f] flex items-center gap-2 border-b border-[#d2d2d7]/50 pb-4">
                  <Globe size={20} className="text-[#0066FF]"/> Reportes GIMG
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {noticiasResult.map(news => (
                    <div key={news.id} onClick={() => onSelectMovie && onSelectMovie(news)} className="group cursor-pointer flex bg-white border border-[#d2d2d7] rounded-2xl p-3 hover:shadow-lg hover:border-[#0066FF]/30 transition-all duration-300">
                      <div className="w-20 h-24 bg-[#f5f5f7] rounded-xl overflow-hidden flex-shrink-0 relative">
                        <img src={news.poster_url} className="w-full h-full object-cover" alt="Cover"/>
                      </div>
                      <div className="ml-4 flex flex-col justify-center pr-2">
                        <h4 className="font-bold text-[#1d1d1f] text-sm line-clamp-2 group-hover:text-[#0066FF] transition-colors">{news.titulo}</h4>
                        <p className="text-xs text-[#86868b] line-clamp-1 mt-1 font-medium">{news.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECCIÓN 3: KIOSCO CIUDADANO */}
            {kioscoResult.length > 0 && (
              <div>
                <h3 className="text-xl font-bold mb-6 text-[#1d1d1f] flex items-center gap-2 border-b border-[#d2d2d7]/50 pb-4">
                  <Newspaper size={20} className="text-[#0066FF]"/> Kiosco de la Alianza
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {kioscoResult.map(kiosco => (
                    <div key={kiosco.id} onClick={() => onSelectMovie && onSelectMovie(kiosco)} className="group cursor-pointer flex bg-white border border-[#d2d2d7] rounded-2xl p-3 hover:shadow-lg hover:border-[#0066FF]/30 transition-all duration-300">
                      <div className="w-16 h-20 bg-[#f5f5f7] rounded-xl overflow-hidden flex-shrink-0 relative shadow-inner">
                        <img src={kiosco.poster_url} className="w-full h-full object-cover" alt="Cover"/>
                      </div>
                      <div className="ml-4 flex flex-col justify-center flex-1 pr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest bg-[#f5f5f7] text-[#86868b] px-2 py-0.5 rounded-md truncate max-w-[100px]">
                            {kiosco.sello_editorial || 'Externo'}
                          </span>
                        </div>
                        <h4 className="font-bold text-[#1d1d1f] text-sm line-clamp-1 group-hover:text-[#0066FF] transition-colors">{kiosco.titulo}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-[#0066FF] font-bold uppercase tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Leer Documento <ChevronRight size={10} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
