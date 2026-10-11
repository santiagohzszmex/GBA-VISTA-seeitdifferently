import React, { useEffect, useRef, useState } from 'react';
import { Plus, Upload, X } from 'lucide-react';
import { REFERENCE_KINDS, canManageReference, parsePalette, validatePalette, validateOriginal } from './referenceModel';
import { documentText } from './documentModel';
const RichDocument = React.lazy(() => import('./RichDocument'));
export function Palette({ colors = [] }) { return colors.length > 0 && <div className="gw-reference-palette" aria-label="Paleta de colores">{colors.map(color => <span key={color}><i style={{backgroundColor: color}} aria-hidden="true" /><code>{color}</code></span>)}</div>; }
export default function ReferenceEditor({ reference, project, data, permissions, onSave, onUpload, onClose, onDirtyChange, busy }) {
  const available = Object.keys(REFERENCE_KINDS).filter(kind => canManageReference(kind, null, permissions) || (kind === 'instructions' && data.areas.some(area => canManageReference(kind, area.id, permissions, data.areaPermissions))));
  const [value, setValue] = useState(() => reference || { title: '', kind: available[0], area_id: available[0] === 'instructions' && !canManageReference('instructions', null, permissions) ? data.areas.find(area => canManageReference('instructions', area.id, permissions, data.areaPermissions))?.id : null, content_document: null, content_markdown: '', palette: [] });
  const [paletteText, setPaletteText] = useState((reference?.palette || []).join(' '));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const baseline = useRef(JSON.stringify(value));
  const dirty = JSON.stringify(value) !== baseline.current || paletteText !== (reference?.palette || []).join(' ');
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const colors = parsePalette(paletteText);
  function change(patch, initial = false) { setValue(current => { const next = { ...current, ...patch }; if (initial) baseline.current = JSON.stringify({ ...JSON.parse(baseline.current), ...patch }); return next; }); }
  async function save(event) {
    event.preventDefault(); if (saving || busy) return; setError('');
    if (!validatePalette(colors)) { setError('Usa hasta 24 colores con códigos de seis dígitos, por ejemplo #673AB7.'); return; }
    if (!documentText(value.content_document).trim() && value.kind !== 'moodboard') { setError('Escribe el contenido de esta referencia.'); return; }
    setSaving(true);
    try { const saved = await onSave({ ...value, palette: colors, project_id: project.id }, reference?.revision || 0); if (saved) { onDirtyChange?.(false); onClose(saved.id); } }
    catch (failure) { setError(failure.message); } finally { setSaving(false); }
  }
  async function upload(event) {
    const input = event.currentTarget, file = input.files?.[0]; if (!file) return; setError('');
    try { validateOriginal(file, value.kind); setSaving(true); await onUpload(reference, file); input.value = ''; }
    catch (failure) { setError(failure.message); } finally { setSaving(false); }
  }
  return <form className="gw-reference-editor" onSubmit={save}><div className="gw-reference-editor-heading"><div><p className="gw-eyebrow">Referencia de {project.title}</p><h2>{reference ? 'Editar referencia' : 'Nueva referencia'}</h2></div><button type="button" onClick={() => onClose()} aria-label="Cerrar edición de referencia"><X size={18} /></button></div>
    <div className="gw-reference-fields"><label>Tipo de referencia<select value={value.kind} disabled={Boolean(reference) || saving || busy} onChange={event => change({ kind: event.target.value, area_id: event.target.value === 'instructions' && !canManageReference('instructions', null, permissions) ? data.areas.find(area => canManageReference('instructions', area.id, permissions, data.areaPermissions))?.id : null })}>{available.map(kind => <option key={kind} value={kind}>{REFERENCE_KINDS[kind]}</option>)}</select></label>
      <label>Título<input required maxLength={180} value={value.title} disabled={saving || busy} onChange={event => change({title: event.target.value})} placeholder="Nombre claro para el equipo" /></label>
      {value.kind === 'instructions' && <label>Destinatarios<select disabled={Boolean(reference) || saving || busy} value={value.area_id || ''} onChange={event => change({area_id: event.target.value || null})}>{canManageReference('instructions', null, permissions) && <option value="">Toda la edición</option>}{data.areas.filter(area => area.project_id === project.id && canManageReference('instructions', area.id, permissions, data.areaPermissions)).map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>}
    </div>
    <React.Suspense fallback={<p role="status">Abriendo editor…</p>}><RichDocument initialDocument={value.content_document} initialMarkdown={value.content_markdown} onChange={change} disabled={saving || busy} /></React.Suspense>
    <div className="gw-reference-details"><label>Paleta de la referencia<input value={paletteText} onChange={event => setPaletteText(event.target.value)} disabled={saving || busy} placeholder="#673AB7 #F4ECE0" /><small>Códigos HEX separados por espacios. Selecciona texto en el editor para cambiar su color o tipografía.</small></label>{validatePalette(colors) && <Palette colors={colors} />}
      <div className="gw-reference-upload"><h3>{value.kind === 'moodboard' ? 'Moodboard en imágenes o PDF' : 'Imágenes de apoyo'}</h3><p>Originales privados, hasta 25 MB por archivo. {reference ? 'Añade archivos sin comprimir ni redimensionar.' : 'Guarda primero la referencia para añadir sus archivos.'}</p>{reference && <label className="gw-upload-button"><Upload size={16} />Añadir {value.kind === 'moodboard' ? 'imagen o PDF' : 'imagen'} original<input type="file" aria-label="Archivo original de referencia" accept={value.kind === 'moodboard' ? 'image/jpeg,image/png,image/webp,image/gif,image/tiff,image/avif,image/heic,image/heif,application/pdf' : 'image/jpeg,image/png,image/webp,image/gif,image/tiff,image/avif,image/heic,image/heif'} onChange={event => void upload(event)} disabled={saving || busy || dirty || !data.referenceStorage?.gateway_url} /></label>}{reference && !data.referenceStorage?.gateway_url && <p>El almacenamiento está pendiente de conexión.</p>}{dirty && reference && <small>Guarda los cambios de texto antes de añadir un original.</small>}</div>
    </div>{error && <p role="alert" className="gw-error">{error}</p>}<div className="gw-reference-editor-footer"><span>{dirty ? 'Cambios sin guardar' : reference ? 'Referencia guardada' : 'Nueva referencia'}</span><button type="submit" className="gw-primary" disabled={saving || busy}>{saving ? 'Guardando…' : reference ? 'Guardar cambios' : <><Plus size={15} />Crear referencia</>}</button></div>
  </form>;
}
