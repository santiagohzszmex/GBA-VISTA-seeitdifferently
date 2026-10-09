import { supabase } from '../supabaseClient';
export async function authenticateGbaId(action, handle, pin, recovery = '', candidate = false) {
  let device = localStorage.getItem('gba-id-device');
  if (!device) { device = crypto.randomUUID(); localStorage.setItem('gba-id-device', device); }
  const endpoint = import.meta.env.VITE_GBA_ID_API_URL || '/api/gba-id';
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, handle, pin, recovery, device, candidate }), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok || result.error || !result.session) throw Error(result.error || 'No pudimos iniciar sesión');
  const { data, error } = await supabase.auth.setSession(result.session);
  if (error || !data.session) throw Error('No pudimos guardar la sesión');
  return data.session;
}
