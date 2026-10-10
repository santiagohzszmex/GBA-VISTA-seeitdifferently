import { createClient } from '@supabase/supabase-js';

// Checks the privileged server connection without returning account data or keys.
export function createHealthHandler({ env = process.env, makeClient = createClient } = {}) {
  let cached = null;
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET') return response.status(405).json({ error: 'Método no permitido' });
    if (cached && cached.until > Date.now()) return response.status(cached.status).json(cached.body);
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    let accepted = false;
    if (url && key) {
      try {
        const client = makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const result = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
        accepted = !result.error;
      } catch { /* A failed probe never includes provider errors or account data. */ }
    }
    cached = { until: Date.now() + 30000, status: accepted ? 200 : 503, body: { server_connection: accepted ? 'verified' : 'unavailable' } };
    return response.status(cached.status).json(cached.body);
  };
}

export default createHealthHandler();
