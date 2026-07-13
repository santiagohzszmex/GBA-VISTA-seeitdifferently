import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useEditorialFollow(selloEditorial) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!selloEditorial) return;

    const { data: countData } = await supabase.rpc('get_editorial_followers_count', {
      p_sello: selloEditorial
    });
    setFollowersCount(Number(countData) || 0);

    if (!user?.id) {
      setIsFollowing(false);
      return;
    }

    const { data, error } = await supabase
      .from('editoriales_seguidas')
      .select('notificar')
      .eq('usuario_id', user.id)
      .eq('sello_editorial', selloEditorial)
      .maybeSingle();

    if (!error) {
      setIsFollowing(Boolean(data));
      setNotificationsEnabled(data?.notificar ?? true);
    }
  }, [selloEditorial, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleFollow = async () => {
    if (!user?.id || !selloEditorial || loading) return false;
    setLoading(true);
    const previous = isFollowing;
    setIsFollowing(!previous);
    setFollowersCount(count => Math.max(0, count + (previous ? -1 : 1)));

    const query = previous
      ? supabase.from('editoriales_seguidas').delete().eq('usuario_id', user.id).eq('sello_editorial', selloEditorial)
      : supabase.from('editoriales_seguidas').insert({ usuario_id: user.id, sello_editorial: selloEditorial, notificar: true });
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
    const { error } = await supabase
      .from('editoriales_seguidas')
      .update({ notificar: next })
      .eq('usuario_id', user.id)
      .eq('sello_editorial', selloEditorial);
    if (error) setNotificationsEnabled(!next);
  };

  return { isFollowing, notificationsEnabled, followersCount, loading, toggleFollow, toggleNotifications };
}
