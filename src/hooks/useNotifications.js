import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');
  const requestId = React.useRef(0);
  const reading = React.useRef(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async (options = {}) => {
    const request = ++requestId.current;
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
    if (request !== requestId.current) return;
    setError(error ? 'No pudimos cargar las notificaciones. Vuelve a intentarlo.' : '');
    if (!error) setNotifications(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    setNotifications([]); setError(''); fetchNotifications();
    return () => { requestId.current += 1; };
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
    if (!user?.id) return false;
    const { error: readError } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id).eq('usuario_id', user.id);
    if (readError) { setError('No pudimos marcar el aviso como leído.'); return false; }
    setNotifications(prev => prev.map(item => item.id === id ? { ...item, leida: true } : item));
    return true;
  };

  const markAllAsRead = async () => {
    if (!user?.id || reading.current) return;
    reading.current = true; setMarkingRead(true); setError('');
    const ids = notifications.filter(item => !item.leida).map(item => item.id);
    const { error: readError } = await supabase.from('notificaciones').update({ leida: true }).eq('usuario_id', user.id).eq('leida', false).in('id', ids);
    if (readError) setError('No pudimos marcar los avisos como leídos. Vuelve a intentarlo.');
    else setNotifications(prev => prev.map(item => ids.includes(item.id) ? { ...item, leida: true } : item));
    reading.current = false; setMarkingRead(false);
  };

  return {
    notifications,
    unreadCount: notifications.filter(item => !item.leida).length,
    loading, error, markingRead,
    fetchNotifications,
    markAsRead,
    markAllAsRead
  };
}
