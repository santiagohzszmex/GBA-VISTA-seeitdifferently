import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { VIDEO_CATEGORIES } from '../utils/contentTypes';

export function useContent() {
  const [loading, setLoading] = useState(false);

  const getAllContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contenido')
        .select('*')
        .eq('estado_publicacion', 'aprobado')
        .in('categoria', VIDEO_CATEGORIES)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error en useContent al recopilar catálogo:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getTop10 = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contenido')
        .select('*')
        .eq('estado_publicacion', 'aprobado')
        .in('categoria', VIDEO_CATEGORIES)
        .order('vistas', { ascending: false }) // Ajustado para ordenar por vistas reales
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error en useContent al recopilar tendencias:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { getAllContent, getTop10, loading };
}
