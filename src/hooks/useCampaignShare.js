import { useCallback, useState } from 'react';
import { useCampaigns } from './useCampaigns';
import { buildVistaPublicUrl } from '../utils/publicUrl';

const SHARE_STATUS_DURATION = 1800;

const getCampaignAssets = (campaign) => campaign?.assets || campaign?.campania_assets || [];

export function getCampaignShareUrl(campaignId) {
  if (!campaignId) return '';
  return buildVistaPublicUrl(`/api/campaign?id=${encodeURIComponent(campaignId)}`);
}

export function getCampaignDiscordVideoUrl(campaign) {
  const asset = getCampaignAssets(campaign).find((item) => item.tipo === 'video');
  const value = asset?.url || '';
  if (!value || /\.mp4(?:$|\?)/i.test(value)) return value;

  try {
    const url = new URL(value);
    if (url.hostname === 'res.cloudinary.com' && url.pathname.includes('/video/upload/')) {
      const [prefix, resource] = url.pathname.split('/video/upload/');
      const mp4Resource = /\.[a-z0-9]+$/i.test(resource)
        ? resource.replace(/\.[a-z0-9]+$/i, '.mp4')
        : `${resource}.mp4`;
      url.pathname = `${prefix}/video/upload/f_mp4,vc_h264,ac_aac/${mp4Resource}`;
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

export function buildCampaignDiscordText(campaign, campaignUrl, videoUrl) {
  const title = campaign?.titulo || 'Campaña VISTA';
  const description = String(campaign?.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 220);
  const lines = [title];

  if (description) lines.push(description);
  lines.push('', 'Ver campaña en VISTA:', campaignUrl);
  if (videoUrl) lines.push('', 'Reproducir video en Discord:', videoUrl);

  return lines.join('\n');
}

export function useCampaignShare(campaign) {
  const [shareStatus, setShareStatus] = useState('idle');
  const { trackCampaignEvent } = useCampaigns();

  const shareCampaign = useCallback(async (event) => {
    event?.stopPropagation?.();
    if (!campaign?.id) return false;

    const campaignUrl = getCampaignShareUrl(campaign.id);
    const videoUrl = getCampaignDiscordVideoUrl(campaign);
    const title = campaign.titulo || 'Campaña VISTA';
    const description = String(campaign.descripcion || '').replace(/\s+/g, ' ').trim().slice(0, 220);
    const discordText = buildCampaignDiscordText(campaign, campaignUrl, videoUrl);

    try {
      if (navigator.share) {
        const mediaLine = videoUrl ? `\n\nReproducir video en Discord:\n${videoUrl}` : '';
        await navigator.share({ title, text: `${description}${mediaLine}`.trim(), url: campaignUrl });
        setShareStatus('shared');
      } else {
        await navigator.clipboard.writeText(discordText);
        setShareStatus('copied');
      }

      const videoAsset = getCampaignAssets(campaign).find((item) => item.tipo === 'video');
      trackCampaignEvent(campaign.id, 'share', videoAsset?.id || null);
      window.setTimeout(() => setShareStatus('idle'), SHARE_STATUS_DURATION);
      return true;
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('No se pudo compartir la campaña:', error);
      return false;
    }
  }, [campaign, trackCampaignEvent]);

  return {
    shareCampaign,
    shareStatus,
    shareUrl: getCampaignShareUrl(campaign?.id),
    videoUrl: getCampaignDiscordVideoUrl(campaign)
  };
}
