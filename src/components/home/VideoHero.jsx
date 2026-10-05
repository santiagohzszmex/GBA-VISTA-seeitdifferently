import React, { useCallback } from 'react';
import { useLibrary } from '../../hooks/useLibrary';
import { Play, Plus, Check, Info } from 'lucide-react';
import ImmersiveMedia from './ImmersiveMedia';
import './home.css';

export default function VideoHero ({ movie, onPlay, onSelectMovie, showBrandLine = true }) {
  const { isInLibrary, toggleLibrary, loading } = useLibrary(movie);

  const handlePlay = useCallback(() => {
    onPlay && onPlay(movie?.youtube_id, movie);
  }, [onPlay, movie]);

  const handleSelect = useCallback(() => {
    onSelectMovie && onSelectMovie(movie);
  }, [onSelectMovie, movie]);

  if (!movie) return null;

  return (
    <div className="vh-hero vh-fullbleed group">

      <ImmersiveMedia image={movie.banner_url || movie.poster_url} item={movie} youtubeId={movie.youtube_id} />

      {/* Degradados Cinemáticos */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,.75), transparent 55%)' }} data-vista-shade="bottom" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(90deg, rgba(0,0,0,.55), transparent 70%)' }} data-vista-shade="text" />

      {/* Título Insignia */}
      {showBrandLine && (
        <div className="absolute top-8 left-6 md:left-32 z-50 pointer-events-none">
           <h2
             className="text-3xl md:text-4xl italic tracking-tight text-white/90 drop-shadow-xl"
             style={{ fontFamily: "'Playfair Display', serif" }}
           >
             See it differently.
           </h2>
        </div>
      )}

      {/* Info del Hero */}
      <div
        key={movie.id} // solo re-dispara la animación de entrada del texto, sin destruir el resto del Hero
        className="vh-copy pointer-events-auto z-20 animate-in slide-in-from-bottom-10 fade-in duration-1000 font-sans"
      >

        <div className="flex items-center gap-3 mb-4">
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
            aria-label={isInLibrary ? "Quitar de mi biblioteca" : "Guardar en mi biblioteca"}
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
            aria-label="Ver información del video"
            className="bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-full hover:bg-white/20 hover:border-white/40 transition-all text-white group"
          >
            <Info size={20} className="group-active:scale-90 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
