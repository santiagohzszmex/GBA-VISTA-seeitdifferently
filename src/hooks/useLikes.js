import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const LIKES_UPDATED_EVENT = 'vista:likes-updated';

const getRpcLikeResult = (data) => {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
};

const emitLikesUpdate = (contenidoId, isLiked, likesCount) => {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(LIKES_UPDATED_EVENT, {
    detail: { contenidoId, isLiked, likesCount }
  }));
};

export function useLikes(contenidoId) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [checking, setChecking] = useState(true);
  const togglingRef = useRef(false);

  // Verifica el estatus inicial al cargar la tarjeta
  const checkLikeStatus = useCallback(async () => {
    if (!contenidoId) {
      setIsLiked(false);
      setLikesCount(0);
      setChecking(false);
      return;
    }

    setChecking(true);
    
    try {
      if (user) {
        // 1. Consultar si el usuario actual ya le dio like a este contenido
        const { data, error } = await supabase
          .from('likes_contenido')
          .select('id')
          .eq('usuario_id', user.id)
          .eq('contenido_id', contenidoId)
          .limit(1);

        if (error) throw error;
        setIsLiked((data || []).length > 0);
      } else {
        setIsLiked(false);
      }

      // 2. Traer el conteo total actual de la columna optimizada
      const { data: itemData, error: itemError } = await supabase
        .from('contenido')
        .select('likes_count')
        .eq('id', contenidoId)
        .single();

      if (itemError) throw itemError;
      setLikesCount(itemData?.likes_count || 0);

    } catch (err) {
      console.error("Error al inicializar estatus de likes:", err);
    } finally {
      setChecking(false);
    }
  }, [user, contenidoId]);

  useEffect(() => {
    checkLikeStatus();
  }, [checkLikeStatus]);

  useEffect(() => {
    if (!contenidoId || typeof window === 'undefined') return undefined;

    const syncLikes = (event) => {
      const detail = event.detail || {};
      if (detail.contenidoId !== contenidoId) return;

      setIsLiked(Boolean(detail.isLiked));
      setLikesCount(Number(detail.likesCount) || 0);
    };

    window.addEventListener(LIKES_UPDATED_EVENT, syncLikes);
    return () => window.removeEventListener(LIKES_UPDATED_EVENT, syncLikes);
  }, [contenidoId]);

  // Ejecuta la acción del botón (Toggle)
  const toggleLike = useCallback(async () => {
    if (!user || !contenidoId) return { success: false, msg: 'No autenticado' };
    if (togglingRef.current) return { success: false, msg: 'Like en proceso' };

    togglingRef.current = true;

    // Interfaz Optimista: Cambia el estado visual antes de la respuesta del servidor para evitar lag
    const prevIsLiked = isLiked;
    const prevCount = likesCount;
    const nextIsLiked = !prevIsLiked;
    const nextCount = prevIsLiked ? Math.max(0, prevCount - 1) : prevCount + 1;
    
    setIsLiked(nextIsLiked);
    setLikesCount(nextCount);
    emitLikesUpdate(contenidoId, nextIsLiked, nextCount);

    try {
      // Llamada directa a la función RPC segura del servidor
      const { data, error } = await supabase.rpc('toggle_like', {
        p_usuario_id: user.id,
        p_contenido_id: contenidoId
      });

      if (error) throw error;

      // Sincronización final con los datos reales devueltos por el backend
      const result = getRpcLikeResult(data);
      if (result) {
        const parsedLikesCount = Number(result.likes_count);
        const serverIsLiked = typeof result.liked === 'boolean' ? result.liked : nextIsLiked;
        const serverLikesCount = Number.isFinite(parsedLikesCount) ? parsedLikesCount : nextCount;

        setIsLiked(serverIsLiked);
        setLikesCount(serverLikesCount);
        emitLikesUpdate(contenidoId, serverIsLiked, serverLikesCount);
      } else {
        await checkLikeStatus();
      }
      return { success: true };
    } catch (err) {
      console.error("Fallo al procesar interacción de like:", err);
      // Reversión automática si el servidor rechaza la transacción
      setIsLiked(prevIsLiked);
      setLikesCount(prevCount);
      emitLikesUpdate(contenidoId, prevIsLiked, prevCount);
      return { success: false, error: err };
    } finally {
      togglingRef.current = false;
    }
  }, [user, contenidoId, isLiked, likesCount, checkLikeStatus]);

  return {
    isLiked,
    likesCount,
    checking,
    checkLikeStatus,
    toggleLike
  };
}
