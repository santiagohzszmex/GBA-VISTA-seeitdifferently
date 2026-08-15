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
  promocionada: true,
  editorial_id: 'preview-liberty-times'
};

const PREVIEW_EDITORIALS = [
  { id: 'preview-liberty-times', slug: 'the-liberty-times', nombre: 'The Liberty Times', role: 'owner' },
  { id: 'preview-observador', slug: 'observador-internacional', nombre: 'Observador Internacional', role: 'editor' }
];

export function useNetworkBusiness(userId, previewMode = false) {
  const previewStartsEmpty = previewMode && new URLSearchParams(window.location.search).get('network-account-preview') === 'request';
  const [profile, setProfile] = useState(null);
  const [editorials, setEditorials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (previewMode) {
      setProfile(previewStartsEmpty ? null : PREVIEW_PROFILE);
      setEditorials(PREVIEW_EDITORIALS);
      setError('');
      setLoading(false);
      return;
    }
    if (!userId) {
      setProfile(null);
      setEditorials([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const [profileResult, editorialsResult] = await Promise.all([
      supabase.rpc('vista_my_network_business'),
      supabase.rpc('vista_my_editorials')
    ]);
    const requestError = profileResult.error || editorialsResult.error;
    if (requestError) {
      setError(requestError.message || 'No se pudo abrir tu cuenta de Network.');
      setLoading(false);
      return;
    }
    setProfile(Array.isArray(profileResult.data) ? profileResult.data[0] || null : profileResult.data || null);
    setEditorials(editorialsResult.data || []);
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

  const linkEditorial = useCallback(async (businessId, editorialId) => {
    if (previewMode) {
      let next;
      setProfile(current => {
        next = { ...current, editorial_id: editorialId || null };
        return next;
      });
      return next;
    }
    const { data, error: linkError } = await supabase.rpc('vista_link_network_editorial', {
      p_business_id: businessId,
      p_editorial_id: editorialId || null
    });
    if (linkError) throw linkError;
    const next = Array.isArray(data) ? data[0] : data;
    setProfile(next);
    return next;
  }, [previewMode, profile]);

  return { profile, editorials, loading, error, refresh, requestProfile, updateProfile, linkEditorial };
}
