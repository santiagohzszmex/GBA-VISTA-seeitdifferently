import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';
 
// Código estándar de Postgres para violación de restricción única/llave primaria.
// Lo usamos para detectar "este usuario ya había visto esta noticia" sin
// tratarlo como un error real.
const PG_UNIQUE_VIOLATION = '23505';
 
export function useNews() {
  const [loading, setLoading] = useState(false);
  const [allNews, setAllNews] = useState([]);
  const [editorialContent, setEditorialContent] = useState([]);
  const [editorialProfile, setEditorialProfile] = useState(null);
  const [editorialStats, setEditorialStats] = useState({ totalVistas: 0, totalLikes: 0 });

  useEffect(() => {
    const syncLikes = (event) => {
      const detail = event.detail || {};
      if (!detail.contenidoId) return;

      const updateItem = item => item.id === detail.contenidoId
        ? { ...item, likes_count: Number(detail.likesCount) || 0 }
        : item;
      setAllNews(current => current.map(updateItem));
      setEditorialContent(current => current.map(updateItem));
    };

    window.addEventListener('vista:likes-updated', syncLikes);
    return () => window.removeEventListener('vista:likes-updated', syncLikes);
  }, []);
 
  // 1. Cargar todas las noticias aprobadas para el feed general y Coverflow
  const fetchGlobalNews = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contenido')
        .select('*')
        .eq('estado_publicacion', 'aprobado')
        .or('categoria.eq.Noticia,categoria.eq.Periódico')
        .order('created_at', { ascending: false });
 
      if (error) throw error;
      setAllNews(data || []);
    } catch (err) {
      console.error("Error al obtener el feed global de prensa:", err);
    } finally {
      setLoading(false);
    }
  }, []);
 
  // 2. Cargar el contenido y calcular métricas públicas de un Sello Editorial específico
  const fetchEditorialProfile = useCallback(async (editorialKey) => {
    if (!editorialKey) return;
    setLoading(true);
    try {
      const normalizedKey = editorialKey.trim();
      let { data: profile, error: profileError } = await supabase
        .from('editoriales')
        .select('*')
        .eq('slug', normalizedKey)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        const fallback = await supabase
          .from('editoriales')
          .select('*')
          .ilike('nombre', normalizedKey)
          .maybeSingle();
        if (fallback.error) throw fallback.error;
        profile = fallback.data;
      }

      setEditorialProfile(profile || null);

      let query = supabase
        .from('contenido')
        .select('*')
        .eq('estado_publicacion', 'aprobado');

      query = profile?.id
        ? query.eq('editorial_id', profile.id)
        : query.eq('sello_editorial', normalizedKey);

      const { data, error } = await query.order('created_at', { ascending: false });
 
      if (error) throw error;
 
      const docs = data || [];
      setEditorialContent(docs);
 
      const totalVistas = docs.reduce((sum, item) => sum + (item.vistas || 0), 0);
      const totalLikes = docs.reduce((sum, item) => sum + (item.likes_count || 0), 0);
 
      setEditorialStats({ totalVistas, totalLikes });
    } catch (err) {
      console.error(`Error al compilar el perfil de ${editorialKey}:`, err);
    } finally {
      setLoading(false);
    }
  }, []);
 
  // 3. Registrar +1 vista, pero UNA SOLA VEZ POR USUARIO por noticia.
  //
  // Si hay sesión iniciada: intentamos insertar (usuario_id, contenido_id) en
  // "vistas_usuario". Esa tabla tiene una llave primaria compuesta, así que si
  // el usuario ya había visto esta noticia (desde este u otro dispositivo), el
  // insert falla con el código 23505 y simplemente no volvemos a incrementar
  // el contador. Solo cuando el insert es exitoso (primera vez) llamamos al RPC
  // que suma +1 en el contador global de "contenido".
  //
  // Si NO hay sesión (usuario anónimo), no hay forma confiable de identificarlo
  // a nivel de base de datos, así que incrementamos el contador directamente
  // (el filtro por navegador vía localStorage en Noticias.jsx sigue cubriendo
  // ese caso para evitar spam accidental de un mismo dispositivo).
  const registrarVisita = async (itemId) => {
    if (!itemId) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
 
      if (user) {
        const { error: insertError } = await supabase
          .from('vistas_usuario')
          .insert({ usuario_id: user.id, contenido_id: itemId });
 
        if (insertError) {
          if (insertError.code === PG_UNIQUE_VIOLATION) {
            // Ya la había visto este usuario: no sumamos de nuevo.
            return;
          }
          throw insertError;
        }
      }
 
      const { error } = await supabase.rpc('increment_vistas_contenido', {
        contenido_id: itemId
      });
 
      if (error) throw error;
 
      setAllNews(prev => prev.map(item => item.id === itemId ? { ...item, vistas: (item.vistas || 0) + 1 } : item));
      setEditorialContent(prev => prev.map(item => item.id === itemId ? { ...item, vistas: (item.vistas || 0) + 1 } : item));
    } catch (err) {
      console.error("No se pudo registrar la métrica de lectura:", err);
    }
  };
 
  return {
    loading,
    allNews,
    editorialContent,
    editorialProfile,
    editorialStats,
    fetchGlobalNews,
    fetchEditorialProfile,
    registrarVisita
  };
}
