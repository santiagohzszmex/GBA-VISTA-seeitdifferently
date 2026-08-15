const VISTA_ORIGIN = 'https://vista.gba.software';

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

const fetchJson = async (url, key) => {
  const result = await fetch(url, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!result.ok) throw new Error(`Supabase respondio ${result.status}`);
  return result.json();
};

export default async function handler(request, response) {
  const key = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!key || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Editorial no disponible</h1></body></html>');
    return;
  }

  let editorial;
  let editions = [];
  try {
    const fields = 'id,slug,nombre,descripcion,logo_url,portada_url,categorias,idiomas,servidor,nacion,acepta_colaboradores,verificada';
    const bySlug = `${supabaseUrl}/rest/v1/editoriales?slug=eq.${encodeURIComponent(key)}&select=${fields}&limit=1`;
    [editorial] = await fetchJson(bySlug, supabaseKey);

    if (!editorial) {
      const byName = `${supabaseUrl}/rest/v1/editoriales?nombre=ilike.${encodeURIComponent(key)}&select=${fields}&limit=1`;
      [editorial] = await fetchJson(byName, supabaseKey);
    }

    if (editorial) {
      const editionFields = 'id,poster_url,banner_url,vistas,likes_count';
      const editionsUrl = `${supabaseUrl}/rest/v1/contenido?editorial_id=eq.${encodeURIComponent(editorial.id)}&estado_publicacion=eq.aprobado&select=${editionFields}&order=created_at.desc`;
      editions = await fetchJson(editionsUrl, supabaseKey);
    }
  } catch (error) {
    console.error('No fue posible generar la vista previa editorial:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar esta editorial</h1></body></html>');
    return;
  }

  if (!editorial) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Editorial no encontrada</h1></body></html>');
    return;
  }

  const title = compactText(editorial.nombre || 'Editorial en VISTA', 100);
  const description = compactText(editorial.descripcion || 'Archivo editorial publicado en VISTA.');
  const image = editorial.portada_url || editorial.logo_url || editions.find(item => item.banner_url || item.poster_url)?.banner_url || editions.find(item => item.poster_url)?.poster_url || '';
  const appUrl = `${VISTA_ORIGIN}/?editorial=${encodeURIComponent(editorial.slug)}`;
  const canonicalUrl = `${VISTA_ORIGIN}/api/editorial?slug=${encodeURIComponent(editorial.slug)}`;
  const views = editions.reduce((total, item) => total + (Number(item.vistas) || 0), 0);
  const likes = editions.reduce((total, item) => total + (Number(item.likes_count) || 0), 0);

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | VISTA</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="VISTA | Global Insight Media Group" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
    <style>
      *{box-sizing:border-box}body{margin:0;background:#f5f5f7;color:#1d1d1f;font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.profile{width:min(820px,100%);background:#fff;border:1px solid #d2d2d7;border-radius:8px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.12)}.cover{width:100%;height:280px;object-fit:cover;display:block;background:#181818}.content{padding:30px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:#06f}.title{font-family:Georgia,serif;font-style:italic;font-size:clamp(38px,7vw,62px);line-height:1;margin:13px 0 18px}.description{color:#6e6e73;line-height:1.65;margin:0 0 24px}.meta{display:flex;gap:18px;flex-wrap:wrap;color:#86868b;font-size:12px;font-weight:700;margin-bottom:24px}.open{display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:8px;font-weight:800}
    </style>
  </head>
  <body>
    <article class="profile">
      ${image ? `<img class="cover" src="${escapeHtml(image)}" alt="Portada de ${escapeHtml(title)}" />` : ''}
      <div class="content">
        <div class="eyebrow">Organizacion editorial en VISTA</div>
        <h1 class="title">${escapeHtml(title)}</h1>
        <p class="description">${escapeHtml(description)}</p>
        <div class="meta"><span>${editions.length} ediciones</span><span>${views} lecturas</span><span>${likes} likes</span></div>
        <a class="open" href="${escapeHtml(appUrl)}">Ver perfil editorial</a>
      </div>
    </article>
  </body>
</html>`;

  sendHtml(response, 200, html);
}
