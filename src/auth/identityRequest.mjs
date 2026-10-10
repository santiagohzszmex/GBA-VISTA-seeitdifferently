// WebKit-compatible request: secure device IDs and a cancellable timeout.
export async function requestIdentity(endpoint, body, {
  storage,
  secureRandom = globalThis.crypto,
  fetchRequest = globalThis.fetch,
  timeoutMs = 20000,
} = {}) {
  let device;
  try { storage ??= globalThis.localStorage; device = storage?.getItem('gba-id-device'); } catch { /* Storage may be disabled. */ }
  if (!device || !/^[a-z0-9-]{16,64}$/i.test(device)) {
    device = Array.from(secureRandom.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    try { storage?.setItem('gba-id-device', device); } catch { /* The request can use an ephemeral device ID. */ }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchRequest(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, device }), signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || result.error || !result.session) throw Error(result.error || 'No pudimos iniciar sesión');
    return result.session;
  } finally { clearTimeout(timer); }
}
