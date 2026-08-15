const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const compactText = (value = '', maxLength = 220) => {
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
};

const sendHtml = (response, status, html) => {
  response.status(status);
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=900');
  response.send(html);
};

export default async function handler(request, response) {
  const id = Array.isArray(request.query?.id) ? request.query.id[0] : request.query?.id;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!id || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Actualización no disponible</h1></body></html>');
    return;
  }

  let update;
  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/vista_get_update_share`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_update_id: id })
    });
    if (!result.ok) throw new Error(`Supabase respondió ${result.status}`);
    update = await result.json();
  } catch (error) {
    console.error('No fue posible generar la vista previa de la actualización:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar esta actualización</h1></body></html>');
    return;
  }

  if (!update?.id) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Actualización no encontrada</h1></body></html>');
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${protocol}://${host}`;
  const author = compactText(update.actor_name || 'VISTA', 80);
  const description = compactText(update.body);
  const appUrl = `${origin}/?update=${encodeURIComponent(update.id)}`;
  const canonicalUrl = `${origin}/api/update?id=${encodeURIComponent(update.id)}`;
  const image = update.image_url || '';

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(author)} en VISTA</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="VISTA | Global Insight Media Group" />
    <meta property="og:title" content="${escapeHtml(author)} en VISTA" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(author)} en VISTA" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.update{width:min(720px,100%);background:#fff;border:1px solid #d2d2d7;border-radius:8px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.12)}.copy{padding:28px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#06f}.author{font-family:Georgia,serif;font-style:italic;font-size:36px;margin:10px 0 18px}.body{font-size:18px;line-height:1.6;white-space:pre-wrap}.image{display:block;width:100%;max-height:460px;object-fit:cover}.open{display:inline-block;margin-top:24px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:6px;font-weight:800}
    </style>
  </head>
  <body><article class="update">${image ? `<img class="image" src="${escapeHtml(image)}" alt="" />` : ''}<div class="copy"><div class="eyebrow">Actualización VISTA</div><h1 class="author">${escapeHtml(author)}</h1><p class="body">${escapeHtml(description)}</p><a class="open" href="${escapeHtml(appUrl)}">Ver en VISTA</a></div></article></body>
</html>`;

  sendHtml(response, 200, html);
}
