const time = value => { const t = value ? new Date(value).getTime() : null; return Number.isFinite(t) ? t : null; };

export const getGimgPremiereState = (item, now = Date.now()) => {
  const hasPremiere = Boolean(item?.gimg_video_url || item?.has_gimg_premiere);
  const videoReleaseAt = time(item?.gimg_video_estreno_at);
  const editionReleaseAt = time(item?.publicar_at);
  const videoReleased = hasPremiere && (!videoReleaseAt || now >= videoReleaseAt);
  const editionReleased = !editionReleaseAt || now >= editionReleaseAt;
  const coverAnnouncement = !hasPremiere && !editionReleased;
  return { hasPremiere, videoReleased, editionReleased, videoReleaseAt, editionReleaseAt,
    coverAnnouncement, canOpen: editionReleased || coverAnnouncement || videoReleased,
    isPremierePhase: !editionReleased };
};
