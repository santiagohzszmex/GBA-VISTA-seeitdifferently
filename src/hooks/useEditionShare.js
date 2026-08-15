import { useCallback, useState } from 'react';
import { buildVistaPublicUrl } from '../utils/publicUrl';

const SHARE_STATUS_DURATION = 1800;

export function getEditionShareUrl(itemId) {
  if (!itemId) return '';
  return buildVistaPublicUrl(`/api/edition?id=${encodeURIComponent(itemId)}`);
}

export function useEditionShare(item, localizedContent = {}) {
  const [shareStatus, setShareStatus] = useState('idle');

  const shareEdition = useCallback(async (event) => {
    event?.stopPropagation?.();
    if (!item?.id) return false;

    const title = localizedContent.titulo || item.titulo || 'Edicion de VISTA';
    const description = localizedContent.descripcion || item.descripcion || '';
    const url = getEditionShareUrl(item.id);

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
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la edicion:', error);
      return false;
    }
  }, [item, localizedContent.descripcion, localizedContent.titulo]);

  return { shareEdition, shareStatus, shareUrl: getEditionShareUrl(item?.id) };
}
