import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { createUpdateController } from './updateController.mjs';
import './desktop-updates.css';

const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
export default function DesktopUpdates({ client }) {
  const [controller] = useState(() => client || createUpdateController({ check, relaunch }));
  const [state, setState] = useState(controller.getState);
  const [version, setVersion] = useState('');
  const [open, setOpen] = useState(false);
  const panel = useRef(null), trigger = useRef(null);
  const native = Boolean(client) || isTauri();
  useEffect(() => {
    if (!native) return;
    let live = true;
    const unsubscribe = controller.subscribe(setState);
    getVersion().then(v => { if (live) setVersion(v); }).catch(() => {});
    void controller.check();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void controller.check(); }, CHECK_INTERVAL);
    return () => { live = false; unsubscribe(); clearInterval(timer); };
  }, [controller, native]);
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const handle = event => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
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
  }, [open]);
  if (!native) return null;
  const available = ['available', 'downloading', 'ready', 'installing', 'installed'].includes(state.phase);
  const busy = ['checking', 'downloading', 'installing'].includes(state.phase);
  const percent = state.total ? Math.min(100, Math.round(state.downloaded / state.total * 100)) : null;
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <>
    <div className="wu-toolbar"><span>Workspace {version && <small>{version}</small>}</span>
      <button ref={trigger} className={available ? 'wu-available' : ''} onClick={() => { setOpen(true); if (!available) void controller.check(); }} aria-haspopup="dialog" aria-label={available ? `Actualización disponible: Workspace ${state.version}` : 'Buscar actualizaciones de Workspace'} title={available ? 'Actualización disponible' : 'Buscar actualizaciones'}>
        {available ? <Download size={16} aria-hidden="true"/> : <RefreshCw size={15} aria-hidden="true"/>}
        {available && <span>Actualización disponible</span>}
      </button>
    </div>
    {open && <div className="wu-overlay"><section ref={panel} className="wu-panel" role="dialog" aria-modal="true" aria-labelledby="wu-title" tabIndex={-1}>
      <button className="wu-close" onClick={close} aria-label="Cerrar actualizaciones"><X size={18}/></button>
      <p className="wu-label">WORKSPACE · ACTUALIZACIONES</p>
      <h2 id="wu-title">{available ? `Workspace ${state.version}` : 'Tu espacio, al día.'}</h2>
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
        {!available && <button onClick={() => void controller.check()} disabled={busy}>Buscar actualizaciones</button>}
        <button onClick={close}>{available ? 'Más tarde' : 'Cerrar'}</button>
      </div>
    </section></div>}
  </>;
}
