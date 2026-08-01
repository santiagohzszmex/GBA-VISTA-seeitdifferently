import { createSupabaseContext } from 'npm:@supabase/server@1.4.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info'
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const { data: context, error: authError } = await createSupabaseContext(request, { auth: 'user' });
  if (authError || !context?.userClaims?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: authError?.status || 401, headers: corsHeaders });
  }

  const { data: profileData } = await context.supabase
    .from('usuarios')
    .select('nombre, rol')
    .eq('id', context.userClaims.id)
    .single();
  const profile = profileData as { nombre: string | null; rol: string } | null;

  if (!profile || !['Dueño', 'Admin', 'Forge Engineer'].includes(profile.rol)) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
  }

  const webhookUrl = Deno.env.get('FORGE_DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    return Response.json({ error: 'Discord webhook is not configured' }, { status: 503, headers: corsHeaders });
  }

  const payload = await request.json();
  const tools = Array.isArray(payload.herramientas) ? payload.herramientas.slice(0, 20) : [];
  const embed = {
    title: `[${String(payload.categoria || 'Forge').slice(0, 60)}] ${String(payload.titulo_experimento || 'Registro técnico').slice(0, 180)}`,
    color: 0x0066FF,
    fields: [
      { name: 'Estado', value: String(payload.estado || 'Sin estado').slice(0, 100), inline: true },
      { name: 'Ingeniero', value: String(profile.nombre || 'GBA Forge').slice(0, 100), inline: true },
      { name: 'Herramientas', value: tools.length > 0 ? tools.join(', ').slice(0, 1000) : 'Ninguna', inline: false },
      { name: 'Log Técnico', value: String(payload.log_tecnico || 'Sin descripción detallada.').slice(0, 1000), inline: false }
    ],
    timestamp: new Date().toISOString()
  };

  const discordResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] })
  });

  if (!discordResponse.ok) {
    return Response.json({ error: 'Discord rejected the notification' }, { status: 502, headers: corsHeaders });
  }

  return Response.json({ ok: true }, { headers: corsHeaders });
});
