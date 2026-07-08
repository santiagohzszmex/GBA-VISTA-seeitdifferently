import React, { useEffect } from 'react';
import { X, Play, Plus, Check } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { isVideoContent } from '../../utils/contentTypes';

export default function ContentDetailModal({ movie, onClose, onPlay }) {
  // Conectamos el hook de biblioteca para que el botón "+" funcione aquí también
  const { isInLibrary, toggleLibrary, loading } = useLibrary(movie);

  // Bloqueamos el scroll de la página de fondo
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!movie) return null;

  const canPlay = isVideoContent(movie) && Boolean(movie.youtube_id);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-6 font-sans">
      
      {/* Fondo oscuro con desenfoque */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Contenedor principal del Modal */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#121212] rounded-[2rem] overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-300">
        
        {/* Botón de Cerrar */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-white hover:text-black transition-colors border border-white/10"
        >
          <X size={20} />
        </button>

        {/* CABECERA: Banner de la película */}
        <div className="relative w-full h-64 md:h-96 flex-shrink-0 bg-black">
          <img 
            src={movie.banner_url || movie.poster_url} 
            alt={movie.titulo}
            className="w-full h-full object-cover opacity-70"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent" />
          
          <div className="absolute bottom-6 left-6 md:left-10 pr-6">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4 drop-shadow-lg">
              {movie.titulo}
            </h2>
            
            {/* Botones de Acción dentro del modal */}
            <div className="flex items-center gap-3">
              {canPlay && (
                <button
                  onClick={() => {
                    onClose(); // Cerramos el modal
                    if (onPlay) onPlay(movie.youtube_id); // Y disparamos el video
                  }}
                  className="bg-white text-black px-6 py-2.5 rounded-full font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
                >
                  <Play fill="currentColor" size={18} /> Reproducir
                </button>
              )}
              
              <button 
                onClick={toggleLibrary} 
                disabled={loading} 
                className={`p-2.5 rounded-full transition-all border ${
                  isInLibrary 
                  ? 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30' 
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                }`}
              >
                {isInLibrary ? <Check size={18} /> : <Plus size={18} />}
              </button>
            </div>
          </div>
        </div>

        {/* CUERPO: Información y Reparto (Habilitamos Scroll aquí adentro) */}
        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            
            {/* Columna Izquierda: Sinopsis y Datos */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Metadatos (Año, Duración, Clasificación) */}
              <div className="flex items-center gap-4 text-sm font-bold text-[#86868b]">
                <span className="text-white">{movie.año}</span>
                <span>{movie.duracion}</span>
                <span className="border border-[#86868b] px-2 py-0.5 rounded text-[10px] uppercase tracking-wider text-white">
                  {movie.calificacion}
                </span>
                {movie.generos && movie.generos.length > 0 && (
                  <span className="text-[#0066FF]">{movie.generos.join(', ')}</span>
                )}
              </div>

              {/* Descripción */}
              <p className="text-neutral-300 text-lg leading-relaxed font-medium">
                {movie.descripcion}
              </p>
            </div>

            {/* Columna Derecha: Créditos Rápidos */}
            <div className="space-y-4 text-sm">
              <div>
                <span className="text-[#86868b] block mb-1 font-bold">Productora:</span>
                <span className="text-white">{movie.sello_editorial || 'GIMG Studios'}</span>
              </div>
              <div>
                <span className="text-[#86868b] block mb-1 font-bold">Estado:</span>
                <span className="text-white">{canPlay ? 'Disponible' : 'Lectura'}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN DE REPARTO (CAST) */}
          {movie.reparto && movie.reparto.length > 0 && (
            <div className="mt-10 pt-8 border-t border-white/10">
              <h3 className="text-xl font-bold text-white mb-6 font-serif italic">El Reparto</h3>
              
              <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar snap-x">
                {movie.reparto.map((actor) => (
                  <div key={actor.id} className="flex flex-col items-center min-w-[120px] snap-start">
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-neutral-800 overflow-hidden mb-3 border-2 border-white/10">
                      <img 
                        src={actor.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(actor.nombre_real)}&background=1d1d1f&color=fff`} 
                        alt={actor.nombre_real}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <p className="text-white text-sm font-bold text-center leading-tight">
                      {actor.nombre_real}
                    </p>
                    <p className="text-[#86868b] text-[10px] text-center uppercase tracking-wider mt-1">
                      {actor.nombre_personaje}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
