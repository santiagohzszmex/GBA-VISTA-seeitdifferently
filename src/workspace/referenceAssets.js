import { supabase } from '../supabaseClient';
import { validateOriginal, originalMime } from './referenceModel';
async function authorizedFetch(gateway, path, options = {}) {
  const url = new URL(gateway);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev')) throw Error('El almacenamiento privado todavía no está configurado.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw Error('Inicia sesión para acceder al archivo.');
  const result = await fetch(new URL(path, url), { ...options, headers: { ...options.headers, Authorization: `Bearer ${data.session.access_token}` }, cache: 'no-store' });
  if (!result.ok) { let body; try { body = await result.json(); } catch {} throw Error(body?.error || 'No se pudo acceder al original.'); }
  return result;
}
export async function uploadReferenceOriginal(gateway, reference, file) {
  validateOriginal(file, reference.kind);
  const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await authorizedFetch(gateway, `/references/${reference.id}`, { method: 'POST', headers: { 'Content-Type': originalMime(file), 'X-File-Name': encodeURIComponent(file.name), 'X-File-Size': String(file.size), 'X-File-Sha256': sha256 }, body: file });
  return response.json();
}
export async function readReferenceOriginal(gateway, asset, download = false) {
  const response = await authorizedFetch(gateway, `/originals/${asset.id}${download ? '?download=1' : ''}`);
  const blob = await response.blob();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (blob.size !== asset.size_bytes || digest !== asset.sha256) throw Error('El original no coincide con su registro de integridad.');
  return blob;
}
