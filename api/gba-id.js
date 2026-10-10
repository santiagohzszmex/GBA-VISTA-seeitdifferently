import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';

// Secrets and session tokens are never logged. Only the trusted platform IP
// reaches the database limiter; browser-provided headers are not accepted as IPs.
export function createIdentityHandler({ env = process.env, makeClient = createClient, random = randomBytes } = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    const allowed = new Set((env.GBA_ID_ALLOWED_ORIGINS || 'https://gba.software,https://www.gba.software,https://vista.gba.software,tauri://localhost,http://tauri.localhost,https://tauri.localhost').split(',').map(x => x.trim()));
    // The platform supplies this deployment's host. Request headers never add origins.
    if (env.VERCEL === '1' && /^[a-z0-9-]+\.vercel\.app$/i.test(env.VERCEL_URL || '')) allowed.add(`https://${env.VERCEL_URL}`);
    const origin = request.headers.origin;
    if (origin && !allowed.has(origin)) return response.status(403).json({ error: 'Origen no autorizado' });
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    if (request.method === 'OPTIONS') return response.status(204).end();
    if (request.method !== 'POST') return response.status(405).json({ error: 'Método no permitido' });
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 2048 || !['login','register','recover'].includes(body.action) || typeof body.handle !== 'string' || !/^[a-z0-9áéíóúüñ ._-]{3,64}$/i.test(body.handle.trim()) || !/^\d{4}$/.test(body.pin) || (body.action !== 'login' && (typeof body.recovery !== 'string' || body.recovery.trim().length < (body.action === 'register' ? 8 : 1) || body.recovery.length > 256)) || typeof body.device !== 'string' || !/^[a-z0-9-]{16,64}$/i.test(body.device)) return response.status(400).json({ error: 'Datos inválidos' });
    const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key || !anon) return response.status(503).json({ error: 'El acceso seguro aún no está configurado' });
    const client = makeClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = env.VERCEL === '1' ? request.headers['x-vercel-forwarded-for'] : request.socket?.remoteAddress;
    const originKey = createHash('sha256').update(String(ip || 'unknown').split(',')[0].trim()).digest('hex');
    const args = { p_action: body.action, p_handle: body.handle.trim(), p_pin: body.pin, p_recovery: body.recovery || '', p_origin: originKey, p_device: body.device, p_user_id: null };
    let created = null;
    let initialized = false;
    try {
      if (body.action === 'register') {
        const prepared = await client.rpc('gba_id_gateway', { ...args, p_action: 'prepare' });
        if (prepared.error) throw new Error('prepare');
        if (prepared.data?.error) return response.status(prepared.data.retry_after ? 429 : 400).json(prepared.data);
        const name = body.handle.trim().replace(/\s+/g, ' ');
        const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
        const result = await client.auth.admin.createUser({ email: `${normalized}@gba.com`, password: random(32).toString('hex'), email_confirm: true, user_metadata: { nombre: name, gimg_candidate: Boolean(body.candidate) } });
        if (result.error || !result.data.user) return response.status(400).json({ error: 'No pudimos crear la cuenta. Revisa tu GBA ID.' });
        created = result.data.user.id;
        args.p_user_id = created;
      }
      const checked = await client.rpc('gba_id_gateway', args);
      if (checked.error) throw new Error('verify');
      if (checked.data?.error || !checked.data?.user_id) {
        if (created) await client.auth.admin.deleteUser(created);
        if (checked.data?.retry_after) response.setHeader('Retry-After', String(checked.data.retry_after));
        return response.status(checked.data?.retry_after ? 429 : 401).json({ error: checked.data?.error || 'Acceso no autorizado', retry_after: checked.data?.retry_after });
      }
      initialized = true;
      const link = await client.auth.admin.generateLink({ type: 'magiclink', email: checked.data.email });
      if (link.error || !link.data.properties?.hashed_token || link.data.user?.id !== checked.data.user_id) throw new Error('session');
      const publicClient = makeClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const verified = await publicClient.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
      if (verified.error || !verified.data.session) throw new Error('session');
      return response.status(200).json({ session: { access_token: verified.data.session.access_token, refresh_token: verified.data.session.refresh_token } });
    } catch {
      if (created && !initialized) await client.auth.admin.deleteUser(created).catch(() => {});
      // An initialized account remains recoverable if session issuance failed.
      return response.status(503).json({ error: 'No pudimos completar el acceso. Intenta de nuevo.' });
    }
  };
}
export default createIdentityHandler();
