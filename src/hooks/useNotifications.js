import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (options = {}) => {
    const silent = options?.silent === true;
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error) setNotifications(data || []);
    if (!silent) setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(`vista-notifications-${user.id}-${instanceId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notificaciones',
        filter: `usuario_id=eq.${user.id}`
      }, () => fetchNotifications({ silent: true }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'hidden') {
        fetchNotifications({ silent: true });
      }
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchNotifications, user?.id]);

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, leida: true } : item));
    await supabase.from('notificaciones').update({ leida: true }).eq('id', id).eq('usuario_id', user.id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(item => ({ ...item, leida: true })));
    await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', user.id).eq('leida', false);
  };

  return {
    notifications,
    unreadCount: notifications.filter(item => !item.leida).length,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}
