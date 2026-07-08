import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PlayCircle, Trash2, Info } from 'lucide-react';
import { isVideoContent } from '../utils/contentTypes';

export default function Biblioteca({ onSelectMovie, onPlay }) {
  const { user } = useAuth();
  const [library, setLibrary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Limpiador automático de imágenes (por si guardaron algo con el link sucio de YouTube)
  const getCleanImg = (url) => {
    if (!url) return '';
    if (url.includes('img.youtube.com')) {
      return url.replace(/&[^/]+/, '').replace(/\?[^/]+/, '');
    }
    return url;
  };

  useEffect(() => {
    const fetchLibrary = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Hacemos un JOIN mágico: Buscamos en 'biblioteca' pero le pedimos 
        // que traiga toda la fila de 'contenido' asociada a ese ID
        const { data, error } = await supabase
          .from('biblioteca')
          .select(`
            contenido_id,
            contenido (*)
          `)
          .eq('usuario_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          // Limpiamos los datos para sacar solo el objeto de la película
          // Descartamos los null por si alguna película guardada fue borrada de la base de datos principal
          const cleanMovies = data
            .map(item => item.contenido)
            .filter(movie => movie !== null); 
          
          setLibrary(cleanMovies);
        }
      } catch (error) {
        console.error("Error al cargar la biblioteca:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLibrary();
  }, [user]);

  // Eliminar elemento de la biblioteca
  const removeFromLibrary = async (e, movieId) => {
    e.stopPropagation(); // Evita que al darle al basurero se abra el modal de info
    
    // UI Optimista: Lo quitamos de la pantalla al instante
    setLibrary(prev => prev.filter(movie => movie.id !== movieId));

    try {
      const { error } = await supabase
        .from('biblioteca')
        .delete()
        .eq('usuario_id', user.id)
        .eq('contenido_id', movieId);

      if (error) throw error;
    } catch (error) {
      console.error("Error al borrar de la biblioteca:", error);
      // Podrías recargar la lista aquí si falla, para recuperar la UI
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[80vh] flex flex-col items-center justify-center font-sans">
        <div className="w-12 h-12 border-4 border-[#d2d2d7] border-t-[#0066FF] rounded-full animate-spin mb-4"></div>
        <p className="text-[#86868b] text-[10px] uppercase tracking-widest font-bold">Cargando tu colección</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] pt-24 px-6 md:px-12 max-w-[1800px] mx-auto animate-in fade-in duration-1000 pb-32 font-sans selection:bg-[#1d1d1f] selection:text-white">
      
      {/* CABECERA */}
      <div className="mb-12 border-b border-[#d2d2d7]/50 pb-8">
        <h1 className="text-5xl md:text-7xl font-serif italic tracking-tighter text-[#1d1d1f] leading-none mb-4">
          Mi Biblioteca.
        </h1>
        <p className="text-[#86868b] text-sm font-bold uppercase tracking-widest">
          Colección Personal de {user?.user_metadata?.nombre || 'Usuario'}
        </p>
      </div>

      {/* CUADRÍCULA DE CONTENIDO */}
      {library.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 md:gap-8">
          {library.map((movie) => {
            const canPlay = isVideoContent(movie) && Boolean(movie.youtube_id);

            return (
              <div
                key={movie.id}
                onClick={() => onSelectMovie && onSelectMovie(movie)}
                className="group relative aspect-[4/5] bg-[#f5f5f7] rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl border border-[#d2d2d7]/50 hover:-translate-y-2 transition-all duration-500 cursor-pointer"
              >

                <img
                  src={getCleanImg(movie.poster_url || movie.banner_url)}
                  alt={movie.titulo}
                  className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 z-10"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300 z-20" />

                {/* Botón de Borrar Rápido (Esquina superior derecha) */}
                <button
                  onClick={(e) => removeFromLibrary(e, movie.id)}
                  className="absolute top-4 right-4 z-30 p-2 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:text-red-500 hover:bg-white transition-all opacity-0 group-hover:opacity-100 shadow-md"
                  title="Quitar de mi lista"
                >
                  <Trash2 size={16} />
                </button>

                {/* Botón de Play Overlay */}
                {canPlay && (
                  <div
                    className="absolute inset-0 z-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    onClick={(e) => {
                      e.stopPropagation(); // Evita abrir el modal
                      if (onPlay) onPlay(movie.youtube_id); // Reproduce directo
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 hover:scale-110 hover:bg-white hover:text-black transition-all">
                      <PlayCircle size={32} />
                    </div>
                  </div>
                )}

                {/* Info Inferior */}
                <div className="absolute bottom-0 left-0 w-full p-5 z-30 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                  <p className="text-white font-bold text-lg leading-tight mb-1 drop-shadow-md">
                    {movie.titulo}
                  </p>
                  <div className="flex justify-between items-center">
                     <p className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
                       {movie.categoria || 'Original'}
                     </p>
                     <Info size={14} className="text-white/50 group-hover:text-white transition-colors" />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* ESTADO VACÍO */
        <div className="w-full h-80 border border-dashed border-[#d2d2d7] rounded-[3rem] bg-[#f5f5f7] flex flex-col items-center justify-center text-center p-6">
          <PlayCircle size={48} className="mb-4 text-[#86868b] opacity-50" />
          <p className="font-serif italic text-2xl text-[#1d1d1f] mb-2">Tu biblioteca está vacía.</p>
          <p className="text-[#86868b] font-medium text-sm max-w-sm">
            Usa el botón (+) en el menú de las películas o noticias para guardarlas aquí y verlas más tarde.
          </p>
        </div>
      )}
    </div>
  );
}
