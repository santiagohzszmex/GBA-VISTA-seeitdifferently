import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { createUpdateController } from './updateController.mjs';
import { displayVersion } from './releaseVersion.mjs';
import releaseInfo from './releaseInfo.json';
import './desktop-updates.css';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
function updateStorage() { try { return window.localStorage; } catch { return null; } }
export default function DesktopUpdates({ client, children }) {
  const [controller] = useState(() => client || createUpdateController({ check, relaunch, currentVersion: getVersion, storage: updateStorage() }));
  const [state, setState] = useState(controller.getState);
  const [version, setVersion] = useState('');
  const [firstNotice, setFirstNotice] = useState(() => { try { return updateStorage()?.getItem(`workspace-release-seen-${releaseInfo.version}`) !== 'yes'; } catch { return true; } });
  const [open, setOpen] = useState(firstNotice);
  const panel = useRef(null), trigger = useRef(null);
  const native = Boolean(client) || isTauri();
  useEffect(() => {
    if (!native) return;
    let live = true;
    const unsubscribe = controller.subscribe(setState);
    getVersion().then(v => { if (live) setVersion(displayVersion(v)); }).catch(() => {});
    void controller.check();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void controller.check({ deferRequirement: true }); }, CHECK_INTERVAL);
    return () => { live = false; unsubscribe(); clearInterval(timer); };
  }, [controller, native]);
  useEffect(() => {
    if (!open && !state.required) return;
    panel.current?.focus();
    const handle = event => {
      if (event.key === 'Escape' && !state.required) close();
      if (event.key === 'Tab') {
        const items = [...panel.current.querySelectorAll('button:not(:disabled), a[href]')];
        if (!items.length) { event.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, state.required, state.phase]);
  if (!native) return children || null;
  const available = ['available', 'downloading', 'ready', 'installing', 'installed'].includes(state.phase);
  const busy = ['checking', 'downloading', 'installing'].includes(state.phase);
  const percent = state.total ? Math.min(100, Math.round(state.downloaded / state.total * 100)) : null;
  const startup = state.lastChecked === null && ['idle','checking'].includes(state.phase);
  const blocked = startup || state.required || firstNotice;
  function close() {
    if (state.required) return;
    if (firstNotice) { try { updateStorage()?.setItem(`workspace-release-seen-${releaseInfo.version}`, 'yes'); } catch { /* The notice will reappear when storage is unavailable. */ } setFirstNotice(false); }
    setOpen(false); trigger.current?.focus();
  }
  return <>
    <div className="wu-toolbar"><span>Workspace {version && <small>{version}</small>}</span>
      <button ref={trigger} className={available ? 'wu-available' : ''} onClick={() => { setOpen(true); if (!available) void controller.check({ deferRequirement: !blocked }); }} aria-haspopup="dialog" aria-label={available ? `Actualización disponible: Workspace ${state.version}` : 'Buscar actualizaciones de Workspace'} title={available ? 'Actualización disponible' : 'Buscar actualizaciones'}>
        {available ? <Download size={16} aria-hidden="true"/> : <RefreshCw size={15} aria-hidden="true"/>}
        {available && <span>Actualización disponible</span>}
      </button>
    </div>
    {blocked ? <main className="wu-startup"><p role="status">{state.required ? 'Actualiza Workspace para continuar.' : startup ? 'Comprobando actualizaciones antes de entrar…' : 'Workspace está listo. Revisa el aviso para continuar.'}</p></main> : <div inert={open ? '' : undefined} aria-hidden={open || undefined}>{children}</div>}
    {(open || state.required) && <div className="wu-overlay"><section ref={panel} className="wu-panel" role="dialog" aria-modal="true" aria-labelledby="wu-title" tabIndex={-1}>
      {!state.required && <button className="wu-close" onClick={close} aria-label="Cerrar actualizaciones"><X size={18}/></button>}
      <p className="wu-label">WORKSPACE · ACTUALIZACIONES</p>
      <h2 id="wu-title">{state.required ? 'Actualización obligatoria' : firstNotice && !available ? releaseInfo.noticeTitle || 'Importante · Acceso actualizado' : available ? `Workspace ${state.version}` : 'Tu espacio, al día.'}</h2>
      {state.required && <p>Instala Workspace {state.version || releaseInfo.version} para continuar. Puedes hacerlo aquí sin iniciar sesión.</p>}
      {!state.required && state.mandatoryAvailable && <p>Esta actualización será obligatoria al volver a abrir Workspace. Guarda tu trabajo antes de instalarla.</p>}
      {firstNotice && !available && <><p><strong>Workspace {releaseInfo.version}</strong></p><p>{releaseInfo.notice}</p></>}
      {state.phase === 'checking' && <p role="status">Buscando actualizaciones…</p>}
      {state.phase === 'current' && <p role="status">Tienes la versión más reciente disponible.</p>}
      {state.notes && <div className="wu-notes">{state.notes}</div>}
      {state.error && <p className="wu-error" role="alert">{state.error}</p>}
      {state.phase === 'downloading' && <div role="status"><p>Descargando y verificando{percent === null ? '…' : ` · ${percent}%`}</p><progress max="100" {...(percent === null ? {} : { value: percent })}/></div>}
      {state.phase === 'ready' && <p role="status">Descarga verificada. Guarda tu trabajo antes de instalar; Workspace se cerrará y volverá a abrirse.</p>}
      {state.phase === 'installing' && <p role="status">Instalando la actualización…</p>}
      {available && <p className="wu-footnote">La instalación comienza cuando tú la solicitas.</p>}
      <div className="wu-actions">
        {state.phase === 'available' && <button className="wu-primary" onClick={() => void controller.download()}>Descargar actualización</button>}
        {state.phase === 'ready' && <button className="wu-primary" onClick={() => void controller.install()}>Instalar y reiniciar</button>}
        {state.phase === 'installed' && <button className="wu-primary" onClick={() => void controller.restart()}>Reiniciar Workspace</button>}
        {!available && <button onClick={() => void controller.check({ deferRequirement: !blocked })} disabled={busy}>Buscar actualizaciones</button>}
        {!state.required && <button onClick={close}>{firstNotice ? 'Continuar a Workspace' : available ? 'Más tarde' : 'Cerrar'}</button>}
      </div>
    </section></div>}
  </>;
}
