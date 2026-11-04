import React, { useState } from 'react';
import { ExternalLink, FileArchive, FileText, Image as ImageIcon, LayoutTemplate, Download } from 'lucide-react';
import { nativeWorkspace } from './devicePush.mjs';

/* Workspace 1.7.5 · Puente con Ultramar (contrato gba.workspace.ultramar/1).
   Workspace prepara, coordina y revisa; Ultramar diseña. Nada se aprueba ni publica desde Ultramar.
   Estos componentes sólo se muestran si el servidor reporta el puente encendido. */

// Medidas en puntos tipográficos (1/72 in).
export const PAGE_PRESETS = {
  letter: { label: 'Carta (21,6 × 27,9 cm)', ancho: 612, alto: 792 },
  a4: { label: 'A4 (21 × 29,7 cm)', ancho: 595.276, alto: 841.89 },
  half: { label: 'Media carta (14 × 21,6 cm)', ancho: 396, alto: 612 },
  tabloid: { label: 'Tabloide (27,9 × 43,2 cm)', ancho: 792, alto: 1224 },
  custom: { label: 'Personalizado' }
};
export const isLayoutTask = (task, data) => data.areas?.find(area => area.id === task?.area_id)?.specialty === 'integration';
export const ultramarLink = task => `ultramar://workspace/asignacion/${encodeURIComponent(task.id)}`;
const bytes = n => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const when = value => value ? new Date(value).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Mexico_City' }) : '';
const pageLabel = page => {
  if (!page) return '';
  const preset = Object.values(PAGE_PRESETS).find(p => p.ancho === page.ancho && p.alto === page.alto);
  return `${preset ? preset.label : `${page.ancho} × ${page.alto} pt`} · sangrado ${page.sangrado?.arriba ?? 0} pt`;
};

async function openInUltramar(task) {
  const url = ultramarLink(task);
  if (nativeWorkspace()) { const { openUrl } = await import('@tauri-apps/plugin-opener'); await openUrl(url); }
  else window.location.href = url;
}

/** Asignaciones: quien coordina prepara una instantánea con los materiales del encargo. */
export function UltramarPrepare({ task, data, api, busy, editable }) {
  const snapshot = data.ultramar?.snapshots?.[task.id];
  const [preset, setPreset] = useState('letter');
  const [custom, setCustom] = useState({ ancho: '', alto: '' });
  const [bleed, setBleed] = useState('9');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  if (!data.ultramar?.enabled || !isLayoutTask(task, data)) return null;
  const editableState = ['pending', 'assigned', 'in_progress', 'changes_requested'].includes(task.state);
  async function submit(event) {
    event.preventDefault(); setError('');
    const size = preset === 'custom' ? { ancho: Number(custom.ancho), alto: Number(custom.alto) } : PAGE_PRESETS[preset];
    const b = Number(bleed);
    if (!(size.ancho > 0 && size.alto > 0)) { setError('Indica el ancho y el alto en puntos.'); return; }
    if (!(b >= 0 && b <= 720)) { setError('El sangrado va de 0 a 720 puntos.'); return; }
    try {
      await api('prepare', task, { pagina: { ancho: size.ancho, alto: size.alto, unidad: 'pt', colorModel: 'RGB', sangrado: { arriba: b, derecha: b, abajo: b, izquierda: b } }, ...(notes.trim() ? { instrucciones: notes.trim() } : {}) }, task.revision);
      setNotes('');
    } catch (failure) { setError(failure.message || 'No se pudo preparar la asignación.'); }
  }
  return <section className="gw-wk-card gw-ultramar-card">
    <h3><LayoutTemplate size={17} aria-hidden="true" />Ultramar</h3>
    {snapshot
      ? <p>Preparada · instantánea {snapshot.version} del {when(snapshot.created_at)} · {snapshot.textos} {snapshot.textos === 1 ? 'texto' : 'textos'} y {snapshot.recursos} {snapshot.recursos === 1 ? 'original' : 'originales'} · {pageLabel(snapshot.pagina)}.</p>
      : <p>Prepárala para que la persona asignada la diseñe en Ultramar. Se usan los materiales del encargo, las indicaciones y la página que elijas.</p>}
    {editable && editableState && <form className="gw-form gw-ultramar-form" onSubmit={submit}>
      <label>Tamaño de página<select value={preset} disabled={busy} onChange={event => setPreset(event.target.value)}>{Object.entries(PAGE_PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select></label>
      {preset === 'custom' && <><label>Ancho (pt)<input type="number" min="1" max="14400" step="0.001" required value={custom.ancho} disabled={busy} onChange={event => setCustom(c => ({ ...c, ancho: event.target.value }))} /></label>
        <label>Alto (pt)<input type="number" min="1" max="14400" step="0.001" required value={custom.alto} disabled={busy} onChange={event => setCustom(c => ({ ...c, alto: event.target.value }))} /></label></>}
      <label>Sangrado (pt)<input type="number" min="0" max="720" step="0.5" value={bleed} disabled={busy} onChange={event => setBleed(event.target.value)} /></label>
      <label className="gw-field-wide">Indicaciones para Ultramar (opcional)<textarea value={notes} maxLength={20000} disabled={busy} placeholder="Si lo dejas vacío se usan las indicaciones de la asignación." onChange={event => setNotes(event.target.value)} /></label>
      {error && <p className="gw-error" role="alert">{error}</p>}
      <button className="gw-primary" disabled={busy}>{snapshot ? 'Preparar nueva instantánea' : 'Preparar para Ultramar'}</button>
      <small>Lo que ya está abierto en Ultramar no cambia; la persona verá que hay una instantánea nueva.</small>
    </form>}
    {!editableState && <small>La asignación está en revisión o cerrada; se prepara otra vez si se solicitan cambios.</small>}
  </section>;
}

/** Mi trabajo: acceso para quien realiza la asignación de maquetación. */
export function UltramarOpen({ task, data, previewMode }) {
  const [error, setError] = useState('');
  if (!data.ultramar?.enabled || !isLayoutTask(task, data)) return null;
  const snapshot = data.ultramar.snapshots?.[task.id];
  return <section className="gw-ultramar-open" aria-label="Diseñar en Ultramar">
    <div><strong><LayoutTemplate size={17} aria-hidden="true" />Diseña esta asignación en Ultramar</strong>
      <p>{snapshot ? `Instantánea ${snapshot.version} lista: ${snapshot.textos} ${snapshot.textos === 1 ? 'texto' : 'textos'}, ${snapshot.recursos} ${snapshot.recursos === 1 ? 'original' : 'originales'} · ${pageLabel(snapshot.pagina)}. Al terminar, usa «Enviar a Workspace» en Ultramar; la entrega pasa a la revisión del área.` : 'Quien coordina el área todavía no la prepara para Ultramar.'}</p>
      {error && <p className="gw-error" role="alert">{error}</p>}
    </div>
    {snapshot && <button type="button" className="gw-primary" disabled={previewMode} title={previewMode ? 'La demostración no abre aplicaciones' : undefined} onClick={() => { setError(''); openInUltramar(task).catch(() => setError('No se pudo abrir Ultramar. Revisa que esté instalado y con tu GBA ID.')); }}><ExternalLink size={16} aria-hidden="true" />Abrir en Ultramar</button>}
  </section>;
}

const FILE_INFO = { pdf: ['PDF para revisar', FileText], preview: ['Vista previa', ImageIcon], ultramar: ['Archivo editable de Ultramar', FileArchive] };
/** Revisión: archivos de una versión enviada desde Ultramar. */
export function UltramarVersionFiles({ version, data, previewMode }) {
  const entry = version && data.ultramar?.versions?.[version.id];
  const [working, setWorking] = useState(''), [error, setError] = useState('');
  if (!entry) return null;
  const gateway = data.referenceStorage?.gateway_url;
  const onDownload = !previewMode && gateway ? async (v, file) => { setWorking(file.rol); setError(''); try { const { downloadUltramarFile } = await import('./referenceAssets'); await downloadUltramarFile(gateway, v, file); } catch (failure) { setError(failure.message); } finally { setWorking(''); } } : null;
  return <section className="gw-ultramar-files" aria-label="Entrega de Ultramar">
    <p><LayoutTemplate size={16} aria-hidden="true" />Maquetación enviada desde Ultramar · instantánea {entry.instantanea}</p>
    <ul>{entry.archivos.map(file => { const [label, Icon] = FILE_INFO[file.rol] || [file.rol, FileText]; return <li key={file.rol}><Icon size={16} aria-hidden="true" /><span><strong>{label}</strong><small>{file.nombre} · {bytes(file.bytes)}</small></span>
      {onDownload && <button type="button" disabled={Boolean(working)} onClick={() => void onDownload(version, file)}><Download size={15} aria-hidden="true" />Descargar</button>}</li>; })}</ul>
    {error && <p className="gw-error" role="alert">{error}</p>}
    <small>Las correcciones se hacen en Workspace; la persona las verá al volver a abrir la asignación en Ultramar.</small>
  </section>;
}
