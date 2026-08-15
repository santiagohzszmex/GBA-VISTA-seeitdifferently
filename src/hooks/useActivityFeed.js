import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const PREVIEW_IDENTITIES = [
  { identity_type: 'profile', identity_id: 'preview-user', display_name: 'Santiago', handle: 'santiago', image_url: null },
  { identity_type: 'editorial', identity_id: 'preview-editorial', display_name: 'Global Insight Media Group', handle: 'global-insight', image_url: null }
];

const PREVIEW_ITEMS = [
  {
    item_kind: 'update', item_id: 'preview-update-1', subject_type: 'update', subject_id: 'preview-update-1',
    actor_type: 'profile', actor_id: 'preview-user', actor_name: 'Santiago', actor_handle: 'santiago', actor_image: null,
    title: null, body: 'Estamos preparando la Edición 1 de Global Insight. Esta semana abrimos conversaciones con nuevas naciones de Empyria.',
    image_url: null, link_url: null, action_url: '/?update=preview-update-1', likes_count: 12, conversation_count: 4,
    is_liked: false, can_delete: true, created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString()
  },
  {
    item_kind: 'edition', item_id: 'preview-edition', subject_type: 'content', subject_id: 'preview-edition',
    actor_type: 'editorial', actor_id: 'preview-editorial', actor_name: 'The Liberty Times', actor_handle: 'the-liberty-times', actor_image: null,
    title: 'Nuevas naciones, nuevos líderes', body: 'Una edición sobre los cambios diplomáticos que están definiendo la semana.',
    image_url: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1400&q=80', link_url: null,
    action_url: '/?edition=preview-edition', likes_count: 24, conversation_count: 7, is_liked: true, can_delete: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
  }
];

export function useActivityFeed({ mode = 'featured', profileId = null, focusId = null, previewMode = false } = {}) {
  const [items, setItems] = useState(previewMode ? PREVIEW_ITEMS : []);
  const [identities, setIdentities] = useState(previewMode ? PREVIEW_IDENTITIES : []);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (previewMode) {
      setItems(PREVIEW_ITEMS);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: feedError } = await supabase.rpc('vista_list_activity', {
      p_mode: focusId ? 'single' : mode,
      p_limit: profileId ? 40 : 30,
      p_profile_id: profileId,
      p_focus_id: focusId
    });
    if (feedError) setError(feedError.message);
    else setItems(data || []);
    setLoading(false);
  }, [focusId, mode, previewMode, profileId]);

  const loadIdentities = useCallback(async () => {
    if (previewMode) return;
    const { data } = await supabase.rpc('vista_my_update_identities');
    setIdentities(data || []);
  }, [previewMode]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { loadIdentities(); }, [loadIdentities]);

  useEffect(() => {
    if (previewMode) return undefined;
    const refreshVisible = () => {
      if (document.visibilityState !== 'hidden') refresh();
    };
    window.addEventListener('focus', refreshVisible);
    return () => window.removeEventListener('focus', refreshVisible);
  }, [previewMode, refresh]);

  const createUpdate = async ({ body, identity, imageUrl, linkUrl }) => {
    if (previewMode) {
      setItems(current => [{
        ...PREVIEW_ITEMS[0], item_id: `preview-${Date.now()}`, subject_id: `preview-${Date.now()}`,
        actor_type: identity.identity_type, actor_id: identity.identity_id, actor_name: identity.display_name,
        actor_handle: identity.handle, actor_image: identity.image_url, body, image_url: imageUrl, link_url: linkUrl,
        likes_count: 0, conversation_count: 0, created_at: new Date().toISOString()
      }, ...current]);
      return true;
    }
    const { error: createError } = await supabase.rpc('vista_create_update', {
      p_body: body,
      p_identity_type: identity.identity_type,
      p_identity_id: identity.identity_type === 'profile' ? null : identity.identity_id,
      p_image_url: imageUrl || null,
      p_link_url: linkUrl || null
    });
    if (createError) throw createError;
    await refresh();
    return true;
  };

  const toggleLike = async itemId => {
    const previous = items;
    setItems(current => current.map(item => item.item_id === itemId ? {
      ...item,
      is_liked: !item.is_liked,
      likes_count: Math.max(0, Number(item.likes_count || 0) + (item.is_liked ? -1 : 1))
    } : item));
    if (previewMode) return;
    const { data, error: likeError } = await supabase.rpc('vista_toggle_update_like', { p_update_id: itemId });
    if (likeError) {
      setItems(previous);
      throw likeError;
    }
    setItems(current => current.map(item => item.item_id === itemId ? {
      ...item,
      is_liked: Boolean(data?.liked),
      likes_count: Number(data?.likes_count) || 0
    } : item));
  };

  const deleteUpdate = async itemId => {
    if (!previewMode) {
      const { error: deleteError } = await supabase.rpc('vista_delete_update', { p_update_id: itemId });
      if (deleteError) throw deleteError;
    }
    setItems(current => current.filter(item => item.item_id !== itemId));
  };

  return { items, identities, loading, error, refresh, createUpdate, toggleLike, deleteUpdate };
}
