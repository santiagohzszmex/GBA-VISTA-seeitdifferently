import { micromark } from 'micromark';

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
  const slug = Array.isArray(request.query?.slug) ? request.query.slug[0] : request.query?.slug;
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!slug || !supabaseUrl || !supabaseKey) {
    sendHtml(response, 400, '<!doctype html><html><body><h1>Keynote no disponible</h1></body></html>');
    return;
  }

  let keynote;
  try {
    const fields = 'slug,title,summary,content_markdown,keynote_date,published_at';
    const endpoint = `${supabaseUrl}/rest/v1/gba_keynotes?slug=eq.${encodeURIComponent(slug)}&is_published=eq.true&select=${encodeURIComponent(fields)}&limit=1`;
    const result = await fetch(endpoint, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    if (!result.ok) throw new Error(`Supabase respondió ${result.status}`);
    [keynote] = await result.json();
  } catch (error) {
    console.error('No fue posible generar la vista previa de la Keynote:', error);
    sendHtml(response, 502, '<!doctype html><html><body><h1>No fue posible cargar esta Keynote</h1></body></html>');
    return;
  }

  if (!keynote) {
    sendHtml(response, 404, '<!doctype html><html><body><h1>Keynote no encontrada</h1></body></html>');
    return;
  }

  const protocol = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  const origin = `${protocol}://${host}`;
  const title = compactText(keynote.title || 'GBA Keynote', 100);
  const description = compactText(keynote.summary || 'Una publicación de GBA.');
  const appUrl = `${origin}/?keynote=${encodeURIComponent(keynote.slug)}`;
  const canonicalUrl = `${origin}/api/keynote?slug=${encodeURIComponent(keynote.slug)}`;
  const formattedDate = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${keynote.keynote_date}T12:00:00Z`));
  const renderedContent = micromark(keynote.content_markdown || '');

  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} | GBA Keynote</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="VISTA | Global Insight Media Group" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
    <meta property="article:published_time" content="${escapeHtml(keynote.published_at)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <style>
      *{box-sizing:border-box}body{margin:0;background:#fbfbfd;color:#1d1d1f;font-family:Inter,system-ui,sans-serif}.page{width:min(850px,100%);margin:0 auto;padding:64px 24px 96px}.eyebrow{font-size:10px;font-weight:900;letter-spacing:.22em;text-transform:uppercase;color:#06f}.title{font-family:Georgia,serif;font-style:italic;font-size:clamp(42px,8vw,72px);line-height:1.03;margin:18px 0}.date{color:#86868b;font-size:13px}.summary{font-family:Georgia,serif;font-style:italic;font-size:clamp(20px,4vw,27px);line-height:1.5;color:#4a4a4f;margin:42px 0;padding-bottom:42px;border-bottom:1px solid #d2d2d7}.body{font-size:16px;line-height:1.9;color:#454549}.body h1,.body h2{font-family:Georgia,serif;font-style:italic;color:#1d1d1f;margin:42px 0 16px}.body h2{font-size:30px}.body h3{font-size:20px;margin:32px 0 14px}.body p,.body ul,.body ol{margin:0 0 24px}.body li{margin:8px 0}.body a{color:#06f}.body blockquote{border-left:2px solid #06f;margin:28px 0;padding-left:20px;font-family:Georgia,serif;font-style:italic}.open{display:inline-flex;margin-top:48px;background:#1d1d1f;color:#fff;text-decoration:none;padding:14px 20px;border-radius:6px;font-weight:800}
    </style>
  </head>
  <body><article class="page"><div class="eyebrow">GBA Keynote</div><h1 class="title">${escapeHtml(title)}</h1><p class="date">${escapeHtml(formattedDate)}</p><p class="summary">${escapeHtml(keynote.summary)}</p><div class="body">${renderedContent}</div><a class="open" href="${escapeHtml(appUrl)}">Abrir en VISTA</a></article></body>
</html>`;

  sendHtml(response, 200, html);
}
