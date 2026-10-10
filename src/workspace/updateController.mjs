// Checking may run automatically. Download, installation and restart require
// separate user actions; the native updater verifies the package signature.
import { displayVersion, nativeParts, newerNative } from './releaseVersion.mjs';
export function createUpdateController({ check, relaunch, currentVersion, storage, now = Date.now }) {
  let minimum = null;
  try { minimum = storage?.getItem('workspace-minimum-native-version'); if (minimum) nativeParts(minimum); } catch { minimum = null; }
  let state = { phase: 'idle', version: null, notes: '', required: Boolean(minimum), downloaded: 0, total: null, error: '', lastChecked: null };
  let update = null;
  const listeners = new Set();
  const set = patch => { state = { ...state, ...patch }; for (const listener of listeners) listener(state); };
  const busy = () => ['checking', 'downloading', 'installing'].includes(state.phase);
  async function find(options = {}) {
    if (busy() || ['ready', 'installed'].includes(state.phase)) return;
    set({ phase: 'checking', error: '' });
    try {
      const current = await currentVersion?.();
      if (current && minimum && (!options.deferRequirement || state.required)) set({ required: newerNative(minimum, current) });
      const next = await check({ timeout: 15000 });
      const proposed = next?.rawJson?.minimumNativeVersion || (next?.rawJson?.mandatory === true ? next.version : null);
      if (proposed && current) {
        nativeParts(proposed);
        if (newerNative(proposed, next.version)) throw Error('Invalid minimum version');
        if (!minimum || newerNative(proposed, minimum)) {
          minimum = proposed;
          try { storage?.setItem('workspace-minimum-native-version', minimum); } catch { /* A storage restriction does not bypass the active requirement. */ }
        }
      }
      const previous = update; update = next;
      try { await previous?.close(); } catch { /* Resource cleanup must not hide a successful check. */ }
      const required = Boolean(current && minimum && newerNative(minimum, current));
      set({ phase: next ? 'available' : 'current', version: next ? displayVersion(next.version) : null, required: required && (!options.deferRequirement || state.required), mandatoryAvailable: required,
        notes: next?.body || '', lastChecked: now(), downloaded: 0, total: null });
    } catch { set({ phase: update ? 'available' : 'error', error: 'No pudimos buscar actualizaciones. Puedes volver a intentarlo.' }); }
  }
  async function download() {
    if (state.phase !== 'available' || !update) return;
    set({ phase: 'downloading', error: '', downloaded: 0, total: null });
    try {
      await update.download(event => {
        if (event.event === 'Started') set({ total: event.data.contentLength || null, downloaded: 0 });
        if (event.event === 'Progress') set({ downloaded: state.downloaded + event.data.chunkLength });
      }, { timeout: 120000 });
      set({ phase: 'ready' });
    } catch { set({ phase: 'available', error: 'La descarga no se completó o no pasó la verificación. No se instaló nada.' }); }
  }
  async function install() {
    if (state.phase !== 'ready' || !update) return;
    set({ phase: 'installing', error: '' });
    try {
      await update.install({ restartAfterInstall: true });
      set({ phase: 'installed' });
    } catch { set({ phase: 'ready', error: 'No pudimos instalar la actualización. Puedes volver a intentarlo.' }); return; }
    await restart();
  }
  async function restart() {
    if (state.phase !== 'installed') return;
    try { await relaunch(); }
    catch { set({ error: 'La actualización está instalada. Cierra y vuelve a abrir Workspace para usarla.' }); }
  }
  return { getState: () => state, check: find, download, install, restart,
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    async dispose() { if (busy()) return; await update?.close(); update = null; listeners.clear(); } };
}
