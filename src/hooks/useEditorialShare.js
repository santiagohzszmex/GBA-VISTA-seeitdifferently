import { useCallback, useState } from 'react';
import { buildVistaPublicUrl } from '../utils/publicUrl';

const SHARE_STATUS_DURATION = 1800;

export function getEditorialShareUrl(editorialKey) {
  if (!editorialKey) return '';
  return buildVistaPublicUrl(`/api/editorial?slug=${encodeURIComponent(editorialKey)}`);
}

export function useEditorialShare(editorial, fallbackKey = '') {
  const [shareStatus, setShareStatus] = useState('idle');
  const editorialKey = editorial?.slug || fallbackKey;

  const shareEditorial = useCallback(async () => {
    if (!editorialKey) return false;

    const title = editorial?.nombre || fallbackKey || 'Editorial en VISTA';
    const description = editorial?.descripcion || 'Descubre su archivo editorial en VISTA.';
    const url = getEditorialShareUrl(editorialKey);

    try {
      if (navigator.share) {
        await navigator.share({ title, text: description.slice(0, 180), url });
        setShareStatus('shared');
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus('copied');
      }

      window.setTimeout(() => setShareStatus('idle'), SHARE_STATUS_DURATION);
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la editorial:', error);
      return false;
    }
  }, [editorial?.descripcion, editorial?.nombre, editorialKey, fallbackKey]);

  return { shareEditorial, shareStatus, shareUrl: getEditorialShareUrl(editorialKey) };
}
