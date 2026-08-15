import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../supabaseClient';
 
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
 
  // Registra una lectura única por GBA ID. El servidor rechaza sesiones anónimas.
  const registrarVisita = async (itemId) => {
    if (!itemId) return false;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return false;

      const { data: counted, error } = await supabase.rpc('vista_register_content_view', {
        p_content_id: itemId
      });
      if (error) throw error;

      if (counted) {
        setAllNews(prev => prev.map(item => item.id === itemId ? { ...item, vistas: (item.vistas || 0) + 1 } : item));
        setEditorialContent(prev => prev.map(item => item.id === itemId ? { ...item, vistas: (item.vistas || 0) + 1 } : item));
      }
      return Boolean(counted);
    } catch (err) {
      console.error("No se pudo registrar la métrica de lectura:", err);
      return false;
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
