import React, { useEffect } from 'react';
import { youtubeId as parseYoutubeId } from '../../utils/publishing';
import { X, Maximize2, Volume2 } from 'lucide-react';

export default function VideoPlayer({ youtubeId, onClose }) {
  
  // Bloqueamos el scroll del body cuando el reproductor esté abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const videoId = parseYoutubeId(youtubeId);
  if (!videoId) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center animate-in fade-in duration-300">
      
      {/* Botón de cierre minimalista */}
      <button 
        onClick={onClose}
        className="absolute top-8 right-8 z-50 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10"
      >
        <X size={24} />
      </button>

      {/* Contenedor del reproductor */}
      <div className="w-full h-full md:h-[80vh] aspect-video relative group">
        <iframe
          className="w-full h-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&showinfo=0&iv_load_policy=3`}
          title="Video Player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        
        {/* Overlay de controles sutiles */}
        <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
           <div className="flex items-center justify-between text-white/70">
              <span className="text-sm font-medium tracking-wider">VISTA PLAYER • 4K HDR</span>
              <div className="flex gap-4">
                 <Volume2 size={20} />
                 <Maximize2 size={20} />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}