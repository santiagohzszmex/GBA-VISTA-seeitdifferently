const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const compactText = (value = '', maxLength = 260) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
};

const sendHtml = (response, status, html) => {
  response.status(status);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  response.send(html);
};

export default async function handler(request, response) {
  const id = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!id || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Edicion no disponible</h1></body></html>');
    return;
  }

  let edition;
  try {
    const endpoint = `${supabaseUrl}/rest/v1/rpc/vista_public_edition_preview`;
    const result = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_content_id: id })
    });

    if (!result.ok) throw new Error(`Supabase respondio ${result.status}`);
    [edition] = await result.json();
  } catch (error) {
    console.error('No fue posible generar la vista previa de la edicion:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar esta edicion</h1></body></html>');
    return;
  }

  if (!edition) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Edicion no encontrada</h1></body></html>');
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${protocol}://${host}`;
  const now = Date.now();
  const editionReleaseAt = edition.publicar_at ? new Date(edition.publicar_at).getTime() : null;
  const videoReleaseAt = edition.gimg_video_estreno_at ? new Date(edition.gimg_video_estreno_at).getTime() : null;
  const isPremierePhase = Boolean(editionReleaseAt && now < editionReleaseAt);
  const coverAnnouncement = isPremierePhase && !edition.has_gimg_premiere;
  const videoReleased = isPremierePhase && edition.has_gimg_premiere && (!videoReleaseAt || now >= videoReleaseAt);
  const title = compactText(
    (isPremierePhase && edition.gimg_video_titulo) || edition.titulo || 'Edicion de VISTA',
    100
  );
  const description = compactText(
    (isPremierePhase && edition.gimg_video_descripcion) || edition.descripcion || 'Una publicacion disponible en VISTA.'
  );
  const image = (isPremierePhase && edition.gimg_video_portada_url) || edition.poster_url || edition.banner_url || '';
  const video = videoReleased ? edition.gimg_video_url : '';
  const appUrl = `${origin}/?edition=${encodeURIComponent(edition.id)}`;
  const canonicalUrl = `${origin}/api/edition?id=${encodeURIComponent(edition.id)}`;
  const publisher = compactText(edition.sello_editorial || 'Global Insight Media Group', 80);
  const releaseLabel = isPremierePhase && editionReleaseAt
    ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(new Date(editionReleaseAt))
    : '';
  const actionLabel = coverAnnouncement ? 'Ver portada con GBA ID' : videoReleased ? 'Ver presentacion con GBA ID' : 'Leer con GBA ID';

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | VISTA</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${video ? 'video.other' : 'article'}" />
    <meta property="og:site_name" content="VISTA | Global Insight Media Group" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    ${video ? `<meta property="og:video" content="${escapeHtml(video)}" />
    <meta property="og:video:secure_url" content="${escapeHtml(video)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1280" />
    <meta property="og:video:height" content="720" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.edition{width:min(760px,100%);background:#fff;border:1px solid #d2d2d7;border-radius:8px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.12)}.cover{width:100%;max-height:430px;object-fit:cover;display:block;background:#111}.content{padding:28px}.publisher{font-size:11px;font-weight:800;text-transform:uppercase;color:#06f}.title{font-family:Georgia,serif;font-style:italic;font-size:clamp(30px,6vw,52px);line-height:1;margin:12px 0 18px}.description{color:#6e6e73;line-height:1.65;margin:0 0 24px}.meta{display:flex;gap:18px;color:#86868b;font-size:12px;font-weight:700;margin-bottom:24px}.open{display:inline-block;background:#1d1d1f;color:white;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:800}
    </style>
  </head>
  <body>
    <article class="edition">
      ${image ? `<img class="cover" src="${escapeHtml(image)}" alt="Portada de ${escapeHtml(title)}" />` : ''}
      <div class="content">
        <div class="publisher">${escapeHtml(publisher)}</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="description">${escapeHtml(description)}</p>
        <div class="meta">${isPremierePhase ? `<span>Proxima edicion</span><span>Disponible ${escapeHtml(releaseLabel)}</span>` : `<span>${Number(edition.vistas) || 0} lecturas</span><span>${Number(edition.likes_count) || 0} likes</span>`}</div>
        <a class="open" href="${escapeHtml(appUrl)}">${escapeHtml(actionLabel)}</a>
      </div>
    </article>
  </body>
</html>`;

  sendHtml(response, 200, html);
}
