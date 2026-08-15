import { useCallback, useState } from 'react';
import { buildVistaPublicUrl } from '../utils/publicUrl';

const SHARE_STATUS_DURATION = 1800;

export function getKeynoteShareUrl(slug) {
  if (!slug) return '';
  return buildVistaPublicUrl(`/api/keynote?slug=${encodeURIComponent(slug)}`);
}

export function useKeynoteShare(keynote) {
  const [shareStatus, setShareStatus] = useState('idle');

  const shareKeynote = useCallback(async (event) => {
    event?.stopPropagation?.();
    if (!keynote?.slug) return false;

    const url = getKeynoteShareUrl(keynote.slug);
    try {
      if (navigator.share) {
        await navigator.share({
          title: keynote.title || 'GBA Keynote',
          text: String(keynote.summary || '').slice(0, 220),
          url
        });
        setShareStatus('shared');
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus('copied');
      }

      window.setTimeout(() => setShareStatus('idle'), SHARE_STATUS_DURATION);
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la Keynote:', error);
      return false;
    }
  }, [keynote]);

  return { shareKeynote, shareStatus, shareUrl: getKeynoteShareUrl(keynote?.slug) };
}
