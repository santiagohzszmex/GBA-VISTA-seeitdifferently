import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'vista_active_editorial';
const PREVIEW_EDITORIALS = [
  {
    id: 'preview-liberty-times',
    slug: 'the-liberty-times',
    nombre: 'The Liberty Times',
    descripcion: 'Periodismo internacional, política y sociedad desde Empyria.',
    logo_url: '',
    portada_url: '',
    categorias: ['politica', 'internacional', 'sociedad'],
    idiomas: ['es', 'en'],
    servidor: 'Empyria',
    nacion: 'Empyria',
    discord_url: '',
    acepta_colaboradores: true,
    verificada: true,
    role: 'owner',
    member_count: 4,
    edition_count: 18
  },
  {
    id: 'preview-observador',
    slug: 'observador-internacional',
    nombre: 'Observador Internacional',
    descripcion: 'Cobertura diplomática producida por un equipo independiente.',
    logo_url: '',
    portada_url: '',
    categorias: ['internacional'],
    idiomas: ['es'],
    servidor: 'Empyria',
    nacion: '',
    discord_url: '',
    acepta_colaboradores: false,
    verificada: false,
    role: 'editor',
    member_count: 3,
    edition_count: 6
  }
];

export function useEditorialWorkspace(userId) {
  const previewMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('studio-preview') === '1';
  const [editorials, setEditorials] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [activeEditorialId, setActiveEditorialId] = useState(() => window.localStorage.getItem(STORAGE_KEY));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (previewMode) {
      setEditorials(PREVIEW_EDITORIALS);
      setInvitations([]);
      setActiveEditorialId(current => PREVIEW_EDITORIALS.some(editorial => editorial.id === current) ? current : PREVIEW_EDITORIALS[0].id);
      setError('');
      setLoading(false);
      return;
    }
    if (!userId) {
      setEditorials([]);
      setInvitations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const [editorialsResult, invitationsResult] = await Promise.all([
      supabase.rpc('vista_my_editorials'),
      supabase.rpc('vista_my_editorial_invitations')
    ]);

    const nextError = editorialsResult.error || invitationsResult.error;
    if (nextError) {
      setError(nextError.message || 'No se pudo abrir VISTA Studio.');
      setLoading(false);
      return;
    }

    const nextEditorials = editorialsResult.data || [];
    setEditorials(nextEditorials);
    setInvitations(invitationsResult.data || []);
    setActiveEditorialId(current => {
      const valid = nextEditorials.some(editorial => editorial.id === current);
      const next = valid ? current : nextEditorials[0]?.id || null;
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
      return next;
    });
    setLoading(false);
  }, [previewMode, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selectEditorial = useCallback(editorialId => {
    setActiveEditorialId(editorialId);
    if (editorialId) window.localStorage.setItem(STORAGE_KEY, editorialId);
  }, []);

  const respondToInvitation = useCallback(async (invitationId, accept) => {
    if (previewMode) {
      setInvitations(current => current.filter(invitation => invitation.id !== invitationId));
      return;
    }
    const { error: responseError } = await supabase.rpc('vista_editorial_respond_invitation', {
      p_invitation_id: invitationId,
      p_accept: accept
    });
    if (responseError) throw responseError;
    await refresh();
  }, [previewMode, refresh]);

  const updateEditorial = useCallback(updated => {
    if (!updated?.id) return;
    setEditorials(current => current.map(editorial => editorial.id === updated.id
      ? { ...editorial, ...updated }
      : editorial));
  }, []);

  const activeEditorial = useMemo(
    () => editorials.find(editorial => editorial.id === activeEditorialId) || null,
    [editorials, activeEditorialId]
  );

  return {
    editorials,
    invitations,
    activeEditorial,
    activeEditorialId,
    loading,
    error,
    refresh,
    selectEditorial,
    respondToInvitation,
    updateEditorial,
    previewMode
  };
}
