import { useCallback, useState } from 'react';
import { buildVistaPublicUrl } from '../utils/publicUrl';

export function getUpdateShareUrl(updateId) {
  if (!updateId) return '';
  return buildVistaPublicUrl(`/api/update?id=${encodeURIComponent(updateId)}`);
}

export function useUpdateShare(item) {
  const [status, setStatus] = useState('idle');

  const share = useCallback(async event => {
    event?.stopPropagation?.();
    if (!item?.item_id) return;
    const url = getUpdateShareUrl(item.item_id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${item.actor_name} en VISTA`,
          text: String(item.body || '').slice(0, 180),
          url
        });
        setStatus('shared');
      } else {
        await navigator.clipboard.writeText(url);
        setStatus('copied');
      }
      window.setTimeout(() => setStatus('idle'), 1800);
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la actualización:', error);
    }
  }, [item]);

  return { share, status };
}
