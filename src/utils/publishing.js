export function youtubeId(value = '') {
  const input = typeof value === 'string' ? value.trim() : '';
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';
    if (host === 'youtu.be') id = url.pathname.split('/')[1];
    else if (['youtube.com', 'm.youtube.com', 'youtube-nocookie.com'].includes(host)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : '';
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
  } catch { return ''; }
}

export const youtubeLink = value => {
  const id = youtubeId(value);
  return id ? `https://www.youtube.com/watch?v=${id}` : '';
};
export const youtubeThumbnail = value => {
  const id = youtubeId(value);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
};

// Old records may have a watch URL or an ID in an image field. Never use those
// as an image src; preserve custom image URLs and recover a YouTube thumbnail.
export function videoImageUrl(value, video = '') {
  if (typeof value !== 'string' || !value.trim()) return '';
  const input = value.trim();
  if (youtubeId(input)) return youtubeThumbnail(video || input);
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (['img.youtube.com', 'i.ytimg.com'].includes(host) && /^\/vi(?:_webp)?\//.test(url.pathname)) {
      if (youtubeId(video) && url.pathname.split('/')[2] !== youtubeId(video)) return youtubeThumbnail(video);
      url.search = ''; url.hash = '';
    }
    return url.href;
  } catch { return ''; }
}

export function videoImageSources(item = {}, prefer = 'poster') {
  const video = item.youtube_url || item.youtube_id;
  const images = prefer === 'banner' ? [item.banner_url, item.poster_url] : [item.poster_url, item.banner_url];
  return [...new Set([...images.map(value => videoImageUrl(value, video)), youtubeThumbnail(video)].filter(Boolean))];
}

export function videoPayload(form) {
  if (form.youtube_url !== undefined && !/^https?:\/\//i.test(form.youtube_url.trim())) throw new Error('Pega el enlace completo de YouTube.');
  const id = youtubeId(form.youtube_url ?? form.youtube_id);
  const trailer = form.trailer_id.trim() ? youtubeId(form.trailer_id) : '';
  if (!id) throw new Error('Pega un enlace válido de YouTube.');
  if (form.trailer_id.trim() && !trailer) throw new Error('El enlace del tráiler no es válido.');
  if (!form.titulo.trim()) throw new Error('Escribe el título del video.');
  if (!form.sello_editorial.trim()) throw new Error('Indica el canal, autor o equipo que produjo el video.');
  const thumbnail = youtubeThumbnail(id);
  const { youtube_url, ...stored } = form;
  return { ...stored, titulo: form.titulo.trim(), youtube_id: id, trailer_id: trailer,
    sello_editorial: form.sello_editorial.trim(),
    banner_url: videoImageUrl(form.banner_url, id) || thumbnail,
    poster_url: videoImageUrl(form.poster_url, id) || videoImageUrl(form.banner_url, id) || thumbnail,
    generos: form.generos.split(',').map(g => g.trim()).filter(Boolean) };
}

export function validateEditionRelease(mode, form, hasVideo, now = Date.now()) {
  const editionDate = form.publicar_at ? new Date(form.publicar_at).getTime() : null;
  const videoDate = form.gimg_video_estreno_at ? new Date(form.gimg_video_estreno_at).getTime() : null;
  if (mode === 'cover' && (!Number.isFinite(editionDate) || editionDate <= now)) {
    throw new Error('Elige una fecha futura para abrir las páginas de la edición.');
  }
  if (mode === 'video') {
    if (!hasVideo) throw new Error('Adjunta el video de presentación o utiliza la opción de portada sin video.');
    if (!Number.isFinite(videoDate)) throw new Error('Indica la fecha y hora del estreno del video.');
    if (editionDate !== null && (!Number.isFinite(editionDate) || videoDate >= editionDate)) {
      throw new Error('El video debe estrenarse antes de abrir las páginas.');
    }
  }
}
