import { useCallback, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const nowIsWithinRange = (campaign) => {
  const now = Date.now();
  const startsAt = campaign.fecha_inicio ? new Date(campaign.fecha_inicio).getTime() : null;
  const endsAt = campaign.fecha_fin ? new Date(campaign.fecha_fin).getTime() : null;

  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
};

const CAMPAIGNS_WITH_CONTENT_SELECT = '*, campania_assets(*), contenido(*)';
const CAMPAIGNS_BASE_SELECT = '*, campania_assets(*)';

export function useCampaigns() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState('');

  const normalizeCampaigns = (rows = []) => rows.map((campaign) => ({
    ...campaign,
    assets: [...(campaign.campania_assets || [])].sort((a, b) => (a.orden || 0) - (b.orden || 0)),
    linkedContent: [...(campaign.contenido || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }));

  const fetchActiveCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let { data, error: queryError } = await supabase
        .from('campanias')
        .select(CAMPAIGNS_WITH_CONTENT_SELECT)
        .eq('estado', 'activa')
        .order('prioridad', { ascending: false })
        .order('created_at', { ascending: false });

      if (queryError) {
        const fallback = await supabase
          .from('campanias')
          .select(CAMPAIGNS_BASE_SELECT)
          .eq('estado', 'activa')
          .order('prioridad', { ascending: false })
          .order('created_at', { ascending: false });

        data = fallback.data;
        queryError = fallback.error;
      }

      if (queryError) throw queryError;

      const active = normalizeCampaigns(data || []).filter(nowIsWithinRange);
      setCampaigns(active);
      return active;
    } catch (err) {
      console.error('Error al cargar campañas activas:', err);
      setError('No se pudieron cargar las campañas.');
      setCampaigns([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAllCampaigns = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let { data, error: queryError } = await supabase
        .from('campanias')
        .select(CAMPAIGNS_WITH_CONTENT_SELECT)
        .order('created_at', { ascending: false });

      if (queryError) {
        const fallback = await supabase
          .from('campanias')
          .select(CAMPAIGNS_BASE_SELECT)
          .order('created_at', { ascending: false });

        data = fallback.data;
        queryError = fallback.error;
      }

      if (queryError) throw queryError;

      const normalized = normalizeCampaigns(data || []);
      setCampaigns(normalized);
      return normalized;
    } catch (err) {
      console.error('Error al cargar campañas:', err);
      setError('No se pudieron cargar las campañas. Revisa que la migración SQL esté aplicada.');
      setCampaigns([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const trackCampaignEvent = useCallback(async (campaignId, evento, assetId = null) => {
    if (!campaignId || !evento) return;

    try {
      await supabase.from('campania_interacciones').insert({
        campania_id: campaignId,
        asset_id: assetId,
        usuario_id: user?.id || null,
        evento
      });
    } catch (err) {
      console.error('No se pudo registrar interacción de campaña:', err);
    }
  }, [user?.id]);

  return {
    loading,
    error,
    campaigns,
    fetchActiveCampaigns,
    fetchAllCampaigns,
    trackCampaignEvent
  };
}
