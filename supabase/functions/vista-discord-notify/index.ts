import { createSupabaseContext } from 'npm:@supabase/server@1.4.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'
};

const respond = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { data: context, error: authError } = await createSupabaseContext(request, { auth: 'user' });
  if (authError || !context?.userClaims?.id) {
    return respond({ error: 'Unauthorized' }, authError?.status || 401);
  }

  const userId = context.userClaims.id;
  const { data: profileData } = await context.supabase
    .from('usuarios')
    .select('nombre, rol')
    .eq('id', userId)
    .single();
  const profile = profileData as { nombre: string | null; rol: string } | null;

  if (!profile) return respond({ error: 'Profile not found' }, 403);

  const payload = await request.json();
  let embed: Record<string, unknown> | null = null;

  if (payload.event === 'editorial_request') {
    const { data: editorialRequestData } = await context.supabase
      .from('solicitudes_editoriales')
      .select('usuario_id, nombre_noticiero, descripcion')
      .eq('id', payload.request_id)
      .single();
    const editorialRequest = editorialRequestData as {
      usuario_id: string;
      nombre_noticiero: string;
      descripcion: string | null;
    } | null;

    if (!editorialRequest || editorialRequest.usuario_id !== userId) {
      return respond({ error: 'Request not found' }, 404);
    }

    embed = {
      title: 'Nueva solicitud de sello editorial',
      description: 'Un ciudadano envió una propuesta de prensa y espera su acreditación en Aduana.',
      color: 3447003,
      fields: [
        { name: 'Nombre del noticiero', value: String(editorialRequest.nombre_noticiero).slice(0, 100), inline: true },
        { name: 'Solicitante', value: String(profile.nombre || 'GBA ID').slice(0, 100), inline: true },
        { name: 'Línea editorial', value: String(editorialRequest.descripcion || 'Sin descripción').slice(0, 1000) }
      ]
    };
  } else if (payload.event === 'edition_submitted') {
    const { data: editionData } = await context.supabase
      .from('contenido')
      .select('autor_id, titulo, sello_editorial, idioma_original, titulo_i18n')
      .eq('id', payload.edition_id)
      .single();
    const edition = editionData as {
      autor_id: string;
      titulo: string;
      sello_editorial: string | null;
      idioma_original: string | null;
      titulo_i18n: Record<string, unknown> | null;
    } | null;

    if (!edition || edition.autor_id !== userId || profile.rol !== 'Editor') {
      return respond({ error: 'Edition not found' }, 404);
    }

    const languageCount = edition.titulo_i18n && typeof edition.titulo_i18n === 'object'
      ? Object.keys(edition.titulo_i18n).length
      : 1;
    embed = {
      title: 'Nueva edición en Aduana',
      description: `El sello **"${String(edition.sello_editorial || 'Independiente').slice(0, 150)}"** subió un documento a revisión.`,
      color: 15105570,
      fields: [
        { name: 'Titular', value: String(edition.titulo || 'Sin título').slice(0, 250), inline: true },
        { name: 'Idioma base', value: String(edition.idioma_original || 'es').toUpperCase().slice(0, 10), inline: true },
        { name: 'Idiomas', value: String(languageCount), inline: true }
      ]
    };
  } else if (payload.event === 'admin_log') {
    if (!['Dueño', 'Admin'].includes(profile.rol)) return respond({ error: 'Forbidden' }, 403);

    embed = {
      title: String(payload.title || 'Aduana VISTA').slice(0, 250),
      description: String(payload.description || 'Sin detalles').slice(0, 3500),
      color: Math.min(16777215, Math.max(0, Number(payload.color) || 3447003)),
      footer: { text: 'Mothership Command • Sistema de Aduanas VISTA' }
    };
  } else {
    return respond({ error: 'Unsupported event' }, 400);
  }

  const webhookUrl = Deno.env.get('VISTA_DISCORD_WEBHOOK_URL');
  if (!webhookUrl) return respond({ error: 'Discord webhook is not configured' }, 503);

  const discordResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [{ ...embed, timestamp: new Date().toISOString() }] })
  });

  if (!discordResponse.ok) return respond({ error: 'Discord rejected the notification' }, 502);
  return respond({ ok: true });
});
