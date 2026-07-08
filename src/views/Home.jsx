import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useContent } from '../hooks/useContent';
import { useCampaigns } from '../hooks/useCampaigns';
import { useLibrary } from '../hooks/useLibrary';
import ContentRow from '../components/ContentRow';
import CampaignShowcase from '../components/campaigns/CampaignShowcase';
import { Play, Plus, Check, Info } from 'lucide-react';

// ==========================================
// HERO SECTION (Inmersivo, debajo del Sidebar)
// ==========================================
const HeroSection = ({ movie, onPlay, onSelectMovie }) => {
  // Los hooks SIEMPRE se llaman, sin condicionales antes.
  // useLibrary debe tolerar movie undefined/null internamente (id undefined -> no-op).
  const { isInLibrary, toggleLibrary, loading } = useLibrary(movie);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    setShowVideo(false);
    if (!movie) return;
    const timer = setTimeout(() => setShowVideo(true), 3000);
    return () => clearTimeout(timer);
  }, [movie?.id]); // comparamos por id, no por referencia del objeto

  const handlePlay = useCallback(() => {
    onPlay && onPlay(movie?.youtube_id);
  }, [onPlay, movie?.youtube_id]);

  const handleSelect = useCallback(() => {
    onSelectMovie && onSelectMovie(movie);
  }, [onSelectMovie, movie]);

  // El guard va DESPUÉS de declarar todos los hooks.
  if (!movie) return null;

  return (
    <div className="relative w-screen md:w-[100vw] md:-ml-24 h-[85vh] md:h-[95vh] overflow-hidden group bg-[#0a0a0a] shadow-2xl">

      {/* Imagen Fondo */}
      <img
        src={movie.banner_url || movie.poster_url || "https://images.unsplash.com/photo-1495020689067-958852a7765e?auto=format&fit=crop&q=80"}
        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${showVideo ? 'opacity-0' : 'opacity-100'}`}
        alt={movie.titulo || 'Hero VISTA'}
      />

      {/* Video Fondo */}
      {movie.youtube_id && (
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${showVideo ? 'opacity-100' : 'opacity-0'}`}>
           <div className="w-full h-full pointer-events-none scale-[1.35]">
              <iframe
                key={movie.youtube_id}
                className="w-full h-full object-cover"
                src={`https://www.youtube.com/embed/${movie.youtube_id}?autoplay=1&mute=1&controls=0&loop=1&playlist=${movie.youtube_id}&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1&disablekb=1`}
                title="Hero"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                allowFullScreen>
              </iframe>
           </div>
        </div>
      )}

      {/* Degradados Cinemáticos */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#fbfbfd] via-[#0a0a0a]/50 to-transparent pointer-events-none opacity-90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-[#0a0a0a]/30 to-transparent pointer-events-none" />

      {/* Título Insignia */}
      <div className="absolute top-8 left-6 md:left-32 z-50 pointer-events-none">
         <h2
           className="text-3xl md:text-4xl italic tracking-tight text-white/90 drop-shadow-xl"
           style={{ fontFamily: "'Playfair Display', serif" }}
         >
           See it differently.
         </h2>
      </div>

      {/* Info del Hero */}
      <div
        key={movie.id} // solo re-dispara la animación de entrada del texto, sin destruir el resto del Hero
        className="absolute bottom-24 left-6 md:left-32 max-w-3xl pointer-events-auto z-20 animate-in slide-in-from-bottom-10 fade-in duration-1000 font-sans"
      >

        <div className="flex items-center gap-3 mb-4">
           {movie.es_top_10 && (
             <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest text-white border border-white/20 shadow-sm">
               N.º 1 en VISTA
             </span>
           )}
           <span className="text-white/70 text-xs font-bold uppercase tracking-widest drop-shadow-md">
             {movie.categoria || 'Original'}
           </span>
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold tracking-tight mb-4 text-white drop-shadow-2xl cursor-pointer hover:opacity-80 transition-opacity leading-[1.1]"
          onClick={handleSelect}
        >
          {movie.titulo || 'Sin Título'}
        </h1>

        <p className="text-lg md:text-xl text-neutral-300 mb-10 line-clamp-2 md:line-clamp-3 font-medium drop-shadow-md max-w-2xl leading-relaxed">
          {movie.descripcion || 'Descripción no disponible.'}
        </p>

        <div className="flex items-center gap-4">
          <button
            onClick={handlePlay}
            className="bg-white text-[#1d1d1f] px-8 md:px-10 py-4 md:py-4 rounded-full font-bold flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
          >
            <Play fill="currentColor" size={20} /> Reproducir
          </button>

          <button
            onClick={toggleLibrary}
            disabled={loading}
            className={`backdrop-blur-xl border p-4 rounded-full transition-all flex items-center justify-center group ${
              isInLibrary
              ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30'
              : 'bg-white/10 text-white border-white/20 hover:bg-white/20 hover:border-white/40'
            }`}
          >
            {isInLibrary ? <Check size={20} className="group-active:scale-90 transition-transform" /> : <Plus size={20} className="group-active:scale-90 transition-transform" />}
          </button>

          <button
            onClick={handleSelect}
            className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-full hover:bg-white/20 hover:border-white/40 transition-all text-white group"
          >
            <Info size={20} className="group-active:scale-90 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// VISTA HOME PRINCIPAL (Controlador)
// ==========================================
export default function Home({ onSelectMovie, onPlay }) {
  const { getAllContent, getTop10, loading } = useContent();
  const { fetchActiveCampaigns } = useCampaigns();
  const [featuredMovies, setFeaturedMovies] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [top10, setTop10] = useState([]);
  const [moviesByGenre, setMoviesByGenre] = useState({});
  const [campaigns, setCampaigns] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const all = await getAllContent() || [];
        const top = await getTop10() || [];
        const activeCampaigns = await fetchActiveCampaigns();

        setTop10(top.filter(m => m && m.es_comunidad !== true));
        setCampaigns(activeCampaigns);

        const heroContent = all.filter(m => m && m.en_hero === true && m.es_comunidad !== true);

        if (heroContent.length > 0) {
          setFeaturedMovies(heroContent);
        } else if (top.length > 0) {
          setFeaturedMovies(top.slice(0, 5));
        } else {
          setFeaturedMovies(all.slice(0, 5));
        }

        const groups = {};
        all.filter(m => m && m.es_comunidad !== true).forEach(movie => {
          if (Array.isArray(movie.generos) && movie.generos.length > 0) {
            movie.generos.forEach(genero => {
              if (!groups[genero]) groups[genero] = [];
              groups[genero].push(movie);
            });
          } else {
            if (!groups['General']) groups['General'] = [];
            groups['General'].push(movie);
          }
        });
        setMoviesByGenre(groups);
      } catch (error) {
        console.error("Error al cargar datos del Home:", error);
      }
    };
    loadData();
  }, []);

  // Reinicia el temporizador del carrusel (usado por autoplay y por clics manuales)
  const resetInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (featuredMovies.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredMovies.length);
    }, 12000);
  }, [featuredMovies.length]);

  useEffect(() => {
    resetInterval();

    // Pausa el carrusel cuando la pestaña no está visible (ahorra CPU/batería
    // y evita que el índice "salte" varias posiciones al volver a la pestaña).
    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        resetInterval();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [resetInterval]);

  const handleDotClick = useCallback((idx) => {
    setCurrentIndex(idx);
    resetInterval(); // evita que el auto-avance se dispare casi inmediatamente después del clic
  }, [resetInterval]);

  if (loading) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center font-sans">
        <div className="font-serif italic text-4xl text-[#1d1d1f] animate-pulse mb-4">VISTA</div>
        <p className="text-[#86868b] text-[10px] uppercase tracking-widest font-bold">Iniciando Ecosistema</p>
      </div>
    );
  }

  if (featuredMovies.length === 0 && top10.length === 0 && campaigns.length === 0) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center pt-24 px-6 text-center font-sans">
        <h2 className="text-4xl font-serif italic text-[#1d1d1f] mb-4">Ecosistema en preparación.</h2>
        <p className="text-[#86868b] max-w-md font-medium">No hay contenido oficial de GIMG publicado en este momento. La base de datos está inicializada.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000 pb-20 relative font-sans">

      {/* 1. HERO ROTATIVO — sin key en el componente, para no destruir/reconstruir el DOM en cada rotación */}
      {featuredMovies.length > 0 && (
        <HeroSection
          movie={featuredMovies[currentIndex]}
          onPlay={onPlay}
          onSelectMovie={onSelectMovie}
        />
      )}

      <div className="w-screen md:w-[100vw] md:-ml-24 h-48 bg-gradient-to-b from-[#fbfbfd] to-transparent absolute z-0 -translate-y-24 pointer-events-none" />

      {featuredMovies.length > 1 && (
        <div className="flex justify-center gap-2.5 -mt-8 mb-12 relative z-30">
          {featuredMovies.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleDotClick(idx)}
              className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
                idx === currentIndex ? 'w-12 bg-[#1d1d1f]' : 'w-2 bg-[#d2d2d7] hover:bg-[#86868b]'
              }`}
            />
          ))}
        </div>
      )}

      <CampaignShowcase campaigns={campaigns} />

      {/* 2. CONTENIDO (Filas Editoriales) */}
      <div className="px-6 md:px-12 space-y-16 mt-8 relative z-20">
        {top10.length > 0 && (
          <ContentRow title="Top 10: Lo más visto en GIMG" items={top10} onSelect={onSelectMovie} />
        )}

        {Object.entries(moviesByGenre).map(([genero, peliculas]) => (
          peliculas.length > 0 && (
            <ContentRow key={genero} title={genero} items={peliculas} onSelect={onSelectMovie} />
          )
        ))}
      </div>

    </div>
  );
}
