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

const getAssets = (campaign) => (
  Array.isArray(campaign?.campania_assets)
    ? [...campaign.campania_assets].sort((a, b) => (a.orden || 0) - (b.orden || 0))
    : []
);

const getDiscordVideoUrl = (value = '') => {
  if (!value) return '';
  if (/\.mp4(?:$|\?)/i.test(value)) return value;

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
};

const isCampaignCurrentlyVisible = (campaign) => {
  const now = Date.now();
  const startsAt = campaign.fecha_inicio ? new Date(campaign.fecha_inicio).getTime() : null;
  const endsAt = campaign.fecha_fin ? new Date(campaign.fecha_fin).getTime() : null;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
};

export default async function handler(request, response) {
  const id = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!id || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Campaña no disponible</h1></body></html>');
    return;
  }

  let campaign;
  try {
    const fields = 'id,titulo,descripcion,estado,fecha_inicio,fecha_fin,likes_count,campania_assets(id,tipo,url,thumbnail_url,titulo,orden,metadata)';
    const endpoint = `${supabaseUrl}/rest/v1/campanias?id=eq.${encodeURIComponent(id)}&estado=eq.activa&select=${encodeURIComponent(fields)}&limit=1`;
    const result = await fetch(endpoint, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
    });

    if (!result.ok) throw new Error(`Supabase respondió ${result.status}`);
    [campaign] = await result.json();
  } catch (error) {
    console.error('No fue posible generar la vista previa de la campaña:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar esta campaña</h1></body></html>');
    return;
  }

  if (!campaign || !isCampaignCurrentlyVisible(campaign)) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Campaña no encontrada</h1></body></html>');
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${protocol}://${host}`;
  const assets = getAssets(campaign);
  const videoAsset = assets.find((asset) => asset.tipo === 'video');
  const imageAsset = assets.find((asset) => asset.tipo === 'banner') || assets.find((asset) => asset.tipo === 'poster');
  const video = getDiscordVideoUrl(videoAsset?.url || '');
  const image = videoAsset?.thumbnail_url || imageAsset?.url || '';
  const title = compactText(campaign.titulo || 'Campaña VISTA', 100);
  const description = compactText(campaign.descripcion || 'Una campaña disponible en VISTA.');
  const appUrl = `${origin}/?campaign=${encodeURIComponent(campaign.id)}`;
  const canonicalUrl = `${origin}/api/campaign?id=${encodeURIComponent(campaign.id)}`;

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | VISTA</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="${video ? 'video.other' : 'website'}" />
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
    <meta name="twitter:card" content="${video ? 'player' : 'summary_large_image'}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
    ${video ? `<meta name="twitter:player" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:player:width" content="1280" />
    <meta name="twitter:player:height" content="720" />` : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;background:#080808;color:#fff;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.campaign{width:min(920px,100%);background:#111;border:1px solid #2b2b2b;border-radius:8px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.5)}.media{display:block;width:100%;max-height:520px;object-fit:cover;background:#000}.content{padding:30px}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#4f8fff}.title{font-family:Georgia,serif;font-style:italic;font-size:clamp(34px,7vw,62px);line-height:1;margin:12px 0 18px}.description{color:#b7b7bb;line-height:1.65;margin:0 0 24px}.actions{display:flex;align-items:center;gap:14px;flex-wrap:wrap}.open{display:inline-block;background:#fff;color:#111;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:800}.meta{color:#7f7f85;font-size:12px;font-weight:700}
    </style>
  </head>
  <body>
    <article class="campaign">
      ${video ? `<video class="media" controls playsinline preload="metadata" ${image ? `poster="${escapeHtml(image)}"` : ''}><source src="${escapeHtml(video)}" type="video/mp4" /></video>` : image ? `<img class="media" src="${escapeHtml(image)}" alt="Imagen de ${escapeHtml(title)}" />` : ''}
      <div class="content">
        <div class="eyebrow">Campaña VISTA</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="description">${escapeHtml(description)}</p>
        <div class="actions"><a class="open" href="${escapeHtml(appUrl)}">Abrir campaña en VISTA</a><span class="meta">${Number(campaign.likes_count) || 0} likes</span></div>
      </div>
    </article>
  </body>
</html>`;

  sendHtml(response, 200, html);
}
