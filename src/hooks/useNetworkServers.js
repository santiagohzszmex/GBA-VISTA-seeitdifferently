import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { PREVIEW_PARTNERS, PREVIEW_SERVERS } from '../network/serverData';

export async function networkRpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}
export function useNetworkDirectory(previewMode = false) {
  const [data, setData] = useState({ servers: previewMode ? PREVIEW_SERVERS : [], partners: previewMode ? PREVIEW_PARTNERS : [] });
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (previewMode) return;
    setLoading(true); setError('');
    try { setData(await networkRpc('vista_network_directory')); }
    catch { setError('No se pudo abrir el directorio. Inténtalo de nuevo en un momento.'); }
    finally { setLoading(false); }
  }, [previewMode]);
  useEffect(() => { void refresh(); }, [refresh]);
  const track = useNetworkTracking(previewMode);
  return { ...data, loading, error, refresh, track };
}
export function useNetworkTracking(previewMode = false) {
  const { user } = useAuth();
  const seen = useRef(new Set());
  const track = useCallback(async (serverId, event, source, partnerId = null) => {
    if (previewMode || !user?.id) return;
    const key = [user.id, serverId, event, source, new Date().toISOString().slice(0,10)].join(':');
    if (seen.current.has(key)) return;
    seen.current.add(key);
    try { await networkRpc('vista_track_network_event', { p_server_id:serverId, p_event:event, p_source:source, p_partner_id:partnerId }); }
    catch { seen.current.delete(key); }
  }, [previewMode, user?.id]);
  return track;
}
export function useNetworkImpression(ref, serverId, event, source, partnerId, track) {
  useEffect(() => {
    if (!ref.current || !serverId) return;
    let timer;
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer);
      if (entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5 && document.visibilityState === 'visible') {
        timer = setTimeout(() => { if (document.visibilityState === 'visible') void track(serverId,event,source,partnerId); }, 1000);
      }
    }, { threshold:0.5 });
    observer.observe(ref.current);
    const visible = () => { if (document.visibilityState !== 'visible') clearTimeout(timer); else { observer.unobserve(ref.current); observer.observe(ref.current); } };
    document.addEventListener('visibilitychange', visible);
    return () => { clearTimeout(timer); observer.disconnect(); document.removeEventListener('visibilitychange',visible); };
  }, [ref,serverId,event,source,partnerId,track]);
}
export function useNetworkWorkspace(previewMode = false) {
  const [servers,setServers] = useState(previewMode ? PREVIEW_SERVERS.slice(0,1) : []);
  const [loading,setLoading] = useState(!previewMode);
  const [error,setError] = useState('');
  const request = useRef(0);
  const hasSettled = useRef(previewMode);
  const refresh = useCallback(async () => {
    if (previewMode) return;
    const version = ++request.current;
    setLoading(!hasSettled.current);setError('');
    try {
      const next = await networkRpc('vista_my_network_servers');
      if (version === request.current) setServers(next);
    } catch (e) {
      if (version === request.current) setError(e.message || 'No se pudo abrir Network Studio.');
    } finally {
      if (version === request.current) { hasSettled.current = true; setLoading(false); }
    }
  },[previewMode]);
  useEffect(() => { void refresh(); return () => { request.current++; }; },[refresh]);
  const save = async (id,payload) => {
    const next = previewMode ? { ...servers.find(s=>s.id===id), ...payload, id:id||`preview-${Date.now()}`, owner_id:'preview-owner', estado:'pendiente', slug:payload.nombre.toLowerCase().replaceAll(' ','-') } : await networkRpc('vista_save_network_server',{p_server_id:id||null,p_data:payload});
    next.developer_handle=payload.developer_handle||'';
    // An older list request must not overwrite a successfully saved server.
    request.current++;
    hasSettled.current = true;
    setLoading(false);setError('');
    setServers(current=>[next,...current.filter(s=>s.id!==next.id)]);
    return next;
  };
  return { servers,loading,error,refresh,save };
}
