import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PREVIEW_PROFILE = {
  id: 'preview-network-business',
  owner_id: 'preview-owner',
  slug: 'libreria-horizonte',
  nombre: 'Libreria Horizonte',
  account_type: 'business',
  categoria: 'Negocios',
  headline: 'Libros escritos dentro de Empyria.',
  descripcion: 'Catalogo de cronicas, ensayos politicos y obras creadas dentro de la comunidad de Empyria.',
  ubicacion: 'Distrito Central, Empyria',
  contacto: '@LibreriaHorizonte',
  logo_url: '',
  portada_url: '',
  tags: ['Libros', 'Cultura', 'Comercio'],
  busca_colaboradores: true,
  oportunidad_titulo: 'Ilustrador para una nueva coleccion',
  oportunidad_descripcion: 'Buscamos una persona que prepare portadas para una serie breve de libros.',
  estado: 'aprobado',
  verificada: true,
  promocionada: true
};

export function useNetworkBusiness(userId, previewMode = false) {
  const previewStartsEmpty = previewMode && new URLSearchParams(window.location.search).get('network-account-preview') === 'request';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (previewMode) {
      setProfile(previewStartsEmpty ? null : PREVIEW_PROFILE);
      setError('');
      setLoading(false);
      return;
    }
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: requestError } = await supabase.rpc('vista_my_network_business');
    if (requestError) {
      setError(requestError.message || 'No se pudo abrir tu cuenta de Network.');
      setLoading(false);
      return;
    }
    setProfile(Array.isArray(data) ? data[0] || null : data || null);
    setLoading(false);
  }, [previewMode, previewStartsEmpty, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestProfile = useCallback(async payload => {
    if (previewMode) {
      const next = {
        ...PREVIEW_PROFILE,
        id: 'preview-request',
        nombre: payload.p_nombre,
        account_type: payload.p_account_type,
        categoria: payload.p_categoria,
        headline: payload.p_headline,
        descripcion: payload.p_descripcion,
        contacto: payload.p_contacto,
        ubicacion: 'Empyria',
        logo_url: '',
        portada_url: '',
        tags: [],
        busca_colaboradores: false,
        oportunidad_titulo: '',
        oportunidad_descripcion: '',
        estado: 'pendiente',
        verificada: false,
        promocionada: false
      };
      setProfile(next);
      return next;
    }
    const { data, error: requestError } = await supabase.rpc('vista_request_network_business', payload);
    if (requestError) throw requestError;
    const next = Array.isArray(data) ? data[0] : data;
    setProfile(next);
    return next;
  }, [previewMode]);

  const updateProfile = useCallback(async payload => {
    if (previewMode) {
      const next = {
        ...profile,
        nombre: payload.p_nombre,
        account_type: payload.p_account_type,
        categoria: payload.p_categoria,
        headline: payload.p_headline,
        descripcion: payload.p_descripcion,
        contacto: payload.p_contacto,
        ubicacion: payload.p_ubicacion,
        logo_url: payload.p_logo_url,
        portada_url: payload.p_portada_url,
        tags: payload.p_tags,
        busca_colaboradores: payload.p_busca_colaboradores,
        oportunidad_titulo: payload.p_oportunidad_titulo,
        oportunidad_descripcion: payload.p_oportunidad_descripcion,
        estado: profile?.estado === 'rechazado' ? 'pendiente' : profile?.estado
      };
      setProfile(next);
      return next;
    }
    const { data, error: updateError } = await supabase.rpc('vista_update_network_business', payload);
    if (updateError) throw updateError;
    const next = Array.isArray(data) ? data[0] : data;
    setProfile(next);
    return next;
  }, [previewMode, profile]);

  return { profile, loading, error, refresh, requestProfile, updateProfile };
}
