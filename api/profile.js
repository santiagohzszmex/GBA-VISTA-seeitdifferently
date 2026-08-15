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
  response.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800');
  response.send(html);
};

export default async function handler(request, response) {
  const handle = Array.isArray(request.query?.handle) ? request.query.handle[0] : request.query?.handle;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!handle || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Perfil no disponible</h1></body></html>');
    return;
  }

  let profile;
  try {
    const result = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_profile`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_handle: handle })
    });
    if (!result.ok) throw new Error(`Supabase respondio ${result.status}`);
    profile = await result.json();
  } catch (error) {
    console.error('No fue posible generar la vista previa del perfil:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar este perfil</h1></body></html>');
    return;
  }

  if (!profile?.handle) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Perfil no encontrado</h1></body></html>');
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${protocol}://${host}`;
  const name = compactText(profile.nombre_publico || profile.handle, 80);
  const description = compactText(profile.bio || 'Perfil de una persona que participa en VISTA.');
  const appUrl = `${origin}/?profile=${encodeURIComponent(profile.handle)}`;
  const canonicalUrl = `${origin}/api/profile?handle=${encodeURIComponent(profile.handle)}`;
  const initials = name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(name)} | GBA ID</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="VISTA | Global Insight Media Group" />
    <meta property="og:title" content="${escapeHtml(name)} (@${escapeHtml(profile.handle)})" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(name)} (@${escapeHtml(profile.handle)})" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.profile{width:min(720px,100%);background:#fff;border:1px solid #d2d2d7;border-radius:8px;padding:32px;box-shadow:0 24px 70px rgba(0,0,0,.12)}.identity{width:82px;height:82px;border-radius:8px;background:#1d1d1f;color:#fff;display:grid;place-items:center;font-size:24px;font-weight:900}.eyebrow{margin-top:28px;font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#06f}.title{font-family:Georgia,serif;font-style:italic;font-size:clamp(38px,7vw,58px);line-height:1;margin:12px 0 8px}.handle{color:#06f;font-weight:800}.description{color:#6e6e73;line-height:1.65;margin:22px 0}.meta{display:flex;gap:18px;flex-wrap:wrap;color:#86868b;font-size:12px;font-weight:700;margin-bottom:24px}.open{display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:800}
    </style>
  </head>
  <body><article class="profile"><div class="identity">${escapeHtml(initials)}</div><div class="eyebrow">Perfil GBA ID</div><h1 class="title">${escapeHtml(name)}</h1><div class="handle">@${escapeHtml(profile.handle)}</div><p class="description">${escapeHtml(description)}</p><div class="meta"><span>${Number(profile.publicaciones) || 0} publicaciones</span><span>${Number(profile.vistas) || 0} lecturas</span><span>${Number(profile.likes) || 0} likes</span></div><a class="open" href="${escapeHtml(appUrl)}">Ver perfil con GBA ID</a></article></body>
</html>`;

  sendHtml(response, 200, html);
}
