import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useEditorialFollow(editorial) {
  const { user } = useAuth();
  const editorialId = typeof editorial === 'object' ? editorial?.id : null;
  const selloEditorial = typeof editorial === 'object' ? editorial?.nombre : editorial;
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!selloEditorial) return;

    const { data: countData } = editorialId
      ? await supabase.rpc('get_editorial_followers_count_by_id', { p_editorial_id: editorialId })
      : await supabase.rpc('get_editorial_followers_count', { p_sello: selloEditorial });
    setFollowersCount(Number(countData) || 0);

    if (!user?.id) {
      setIsFollowing(false);
      return;
    }

    let followQuery = supabase
      .from('editoriales_seguidas')
      .select('notificar')
      .eq('usuario_id', user.id);
    followQuery = editorialId
      ? followQuery.eq('editorial_id', editorialId)
      : followQuery.eq('sello_editorial', selloEditorial);
    const { data, error } = await followQuery.maybeSingle();

    if (!error) {
      setIsFollowing(Boolean(data));
      setNotificationsEnabled(data?.notificar ?? true);
    }
  }, [editorialId, selloEditorial, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleFollow = async () => {
    if (!user?.id || !selloEditorial || loading) return false;
    setLoading(true);
    const previous = isFollowing;
    setIsFollowing(!previous);
    setFollowersCount(count => Math.max(0, count + (previous ? -1 : 1)));

    let query;
    if (previous) {
      query = supabase.from('editoriales_seguidas').delete().eq('usuario_id', user.id);
      query = editorialId ? query.eq('editorial_id', editorialId) : query.eq('sello_editorial', selloEditorial);
    } else {
      query = supabase.from('editoriales_seguidas').insert({
        usuario_id: user.id,
        editorial_id: editorialId,
        sello_editorial: selloEditorial,
        notificar: true
      });
    }
    const { error } = await query;

    if (error) {
      setIsFollowing(previous);
      setFollowersCount(count => Math.max(0, count + (previous ? 1 : -1)));
      setLoading(false);
      return false;
    }

    setLoading(false);
    return true;
  };

  const toggleNotifications = async () => {
    if (!user?.id || !isFollowing || loading) return;
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    let updateQuery = supabase
      .from('editoriales_seguidas')
      .update({ notificar: next })
      .eq('usuario_id', user.id);
    updateQuery = editorialId ? updateQuery.eq('editorial_id', editorialId) : updateQuery.eq('sello_editorial', selloEditorial);
    const { error } = await updateQuery;
    if (error) setNotificationsEnabled(!next);
  };

  return { isFollowing, notificationsEnabled, followersCount, loading, toggleFollow, toggleNotifications };
}
