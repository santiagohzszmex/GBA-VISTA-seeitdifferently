import { supabase } from '../supabaseClient';
import { requestIdentity } from './identityRequest.mjs';
export async function authenticateGbaId(action, handle, pin, recovery = '', candidate = false) {
  const endpoint = import.meta.env.VITE_GBA_ID_API_URL || '/api/gba-id';
  const session = await requestIdentity(endpoint, { action, handle, pin, recovery, candidate });
  const { data, error } = await supabase.auth.setSession(session);
  if (error || !data.session) throw Error('No pudimos guardar la sesión');
  return data.session;
}
