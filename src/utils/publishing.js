export function youtubeId(value = '') {
  const input = value.trim();
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

export function videoPayload(form) {
  const id = youtubeId(form.youtube_id);
  const trailer = form.trailer_id.trim() ? youtubeId(form.trailer_id) : '';
  if (!id) throw new Error('Pega un enlace válido de YouTube o su ID de 11 caracteres.');
  if (form.trailer_id.trim() && !trailer) throw new Error('El enlace del tráiler no es válido.');
  if (!form.titulo.trim()) throw new Error('Escribe el título del video.');
  if (!form.sello_editorial.trim()) throw new Error('Indica el canal, autor o equipo que produjo el video.');
  const thumbnail = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return { ...form, titulo: form.titulo.trim(), youtube_id: id, trailer_id: trailer,
    sello_editorial: form.sello_editorial.trim(),
    banner_url: form.banner_url.trim() || thumbnail,
    poster_url: form.poster_url.trim() || form.banner_url.trim() || thumbnail,
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
