import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })
      .limit(80);
    if (!error) setNotifications(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
