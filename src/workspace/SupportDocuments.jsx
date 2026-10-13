import React, { useEffect, useRef, useState } from 'react';
import { Archive, BookOpen, FileText, LockKeyhole, Plus, Share2, Upload } from 'lucide-react';
import RichDocument from './RichDocument';
import DraftExitDialog from './DraftExitDialog';
import ReferenceSplit from './ReferenceSplit';
import StructuredDocument from './StructuredDocument';
import { EMPTY_DOCUMENT, taskIsMine } from './documentModel';
import { parsePalette, validatePalette, validateOriginal } from './referenceModel';
import ReferenceOriginal from './ReferenceOriginal';
import { Palette } from './ReferenceEditor';
import './supportDocuments.css';

const KINDS = { interview:'Entrevista', notes:'Notas', source:'Fuente', transcript:'Transcripción', working:'Documento de trabajo' };
const rowPayload = row => ({ title:row.title || '', area_id:row.area_id || '', document_kind:row.document_kind || 'notes', content_document:row.content_document || EMPTY_DOCUMENT, content_markdown:row.content_markdown || '', credits:row.credits || '', palette:row.palette || [] });

function SupportDocumentsView({ project, data, actorId, supportApi, busy, onDirtyChange, onOpenTask, initialSupportId }) {
  const initialRows = (data.support?.documents || []).filter(row => row.project_id === project.id && (row.author_id === actorId || row.share_scope !== 'private'));
  const [documents, setDocuments] = useState(initialRows);
  const [selectedId, setSelectedId] = useState(() => initialRows.find(row => row.id === initialSupportId)?.id || initialRows.find(row => row.can_edit)?.id || initialRows[0]?.id || '');
  const [draft, setDraft] = useState(null);
  const [draftFor,setDraftFor]=useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createArea, setCreateArea] = useState('');
  const [createKind, setCreateKind] = useState('notes');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [history, setHistory] = useState([]);
  const [paletteText, setPaletteText] = useState('');
  const baseline = useRef('');
  const baseRevision = useRef(0);
  const dirtyRef = useRef(false);
  const [remoteConflict, setRemoteConflict] = useState(null);
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [splitOpen, setSplitOpen] = useState(false);
  const [conversionTaskBySupport, setConversionTaskBySupport] = useState({});
  const selected = documents.find(row => row.id === selectedId);
  const allowedAreas = data.areas.filter(area => area.project_id === project.id && (data.support?.creation_areas || []).includes(area.id));
  const permittedTasks = selected ? data.tasks.filter(task => task.project_id === project.id && task.area_id === selected.area_id && ['pending','assigned','in_progress','changes_requested'].includes(task.state) && (taskIsMine(task, actorId) || data.taskPermissions?.[task.id]?.['content.edit_assigned'] || data.taskPermissions?.[task.id]?.['task.assign'])) : [];
  const linkedTask = selected?.linked_task_id ? data.tasks.find(task => task.id === selected.linked_task_id) : null;
  const linkedMaterial = linkedTask ? data.taskReferences?.[linkedTask.id]?.find(row => row.latest_source_id === selected.id || row.snapshot?.support_id === selected.id) : null;
  const convertedTaskId = selected?.converted_task_id || conversionTaskBySupport[selectedId];
  const colors = parsePalette(paletteText);
  const dirty = Boolean((draft && JSON.stringify(draft) !== baseline.current) || (selected?.can_edit && draft && paletteText !== (draft.palette || []).join(' ')));
  dirtyRef.current = dirty;

  useEffect(() => {
    const incoming = (data.support?.documents || []).filter(row => row.project_id === project.id && (row.author_id === actorId || row.share_scope !== 'private'));
    setDocuments(current => incoming.map(row => {
      const local = current.find(item => item.id === row.id);
      if (!local?.originals?.length) return row;
      const merged = new Map([...local.originals, ...(row.originals || [])].map(asset => [asset.id,asset]));
      return { ...row, originals:[...merged.values()] };
    }));
    const latest = incoming.find(row => row.id === selectedId);
    if (!latest || latest.revision === baseRevision.current) return;
    if (dirtyRef.current) setRemoteConflict(latest);
    else { const next = rowPayload(latest); setDraft(next); baseline.current = JSON.stringify(next); baseRevision.current = latest.revision || 0; setPaletteText(next.palette.join(' ')); setRemoteConflict(null); setEditorEpoch(epoch=>epoch+1); }
  }, [data.support?.documents, actorId, project.id, selectedId]);
  useEffect(() => { if (initialSupportId && initialSupportId !== selectedId && documents.some(row => row.id === initialSupportId)) navigate(() => setSelectedId(initialSupportId)); }, [initialSupportId]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => { if (!dirty) return; const warn = event => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  useEffect(() => {
    if (!selected) { setDraft(null); baseline.current = ''; baseRevision.current = 0; setPaletteText(''); setRemoteConflict(null); return; }
    const next = rowPayload(selected);
    setDraftFor(selected.id);setDraft(next); baseline.current = JSON.stringify(next); baseRevision.current = selected.revision || 0; setPaletteText(next.palette.join(' ')); setError(''); setConfirmation(''); setHistory([]); setRemoteConflict(null); setSplitOpen(false);
  }, [selectedId]);

  function change(patch, initial = false) {
    setDraft(current => {
      const next = { ...current, ...patch };
      if (initial) baseline.current = JSON.stringify({ ...JSON.parse(baseline.current || '{}'), ...patch });
      return next;
    });
  }
  function navigate(action) { if (dirty) setPending(() => action); else action(); }
  const [pending, setPending] = useState(null);

  async function createDocument(event) {
    event.preventDefault(); if (!supportApi || working || !createTitle.trim() || !createArea) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const row = await supportApi('support.save', { project_id:project.id, revision:0, title:createTitle.trim(), area_id:createArea, document_kind:createKind, content_document:EMPTY_DOCUMENT, content_markdown:'', credits:'', palette:[], editor_version:2 }, 0);
      if (!row?.id) throw Error('El documento no se guardó. Inténtalo de nuevo.');
      setDocuments(current => [row, ...current.filter(item => item.id !== row.id)]); setSelectedId(row.id); setCreateOpen(false); setCreateTitle(''); setNotice('Documento de apoyo creado en privado.');
    } catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  }
  async function persistDraft() {
    if (!selected?.can_edit || !draft || !supportApi || working) return null;
    if (!dirty) return selected;
    if (!validatePalette(colors)) { setError('Usa hasta 24 colores con códigos HEX de seis dígitos.'); return null; }
    setWorking(true); setError(''); setNotice('');
    try {
      const row = await supportApi('support.save', { ...draft, project_id:project.id, id:selected.id, revision:baseRevision.current, palette:colors, editor_version:2 }, baseRevision.current);
      if (!row?.id) throw Error('No se pudo guardar el documento.');
      setDocuments(current => current.map(item => item.id === row.id ? { ...item, ...row, originals:row.originals || item.originals || [] } : item)); setDraft(rowPayload(row)); baseline.current = JSON.stringify(rowPayload(row)); baseRevision.current = row.revision || 0; setPaletteText((row.palette || []).join(' ')); setRemoteConflict(null); setEditorEpoch(epoch=>epoch+1); setNotice('Documento de apoyo guardado.');
      return row;
    } catch (failure) { setError(failure.message); return null; }
    finally { setWorking(false); }
  }
  async function save(event) {
    event?.preventDefault?.();
    await persistDraft();
  }
  async function uploadOriginal(event) {
    const input=event.currentTarget, file=input.files?.[0];
    if(!file) return;
    setError('');
    try {
      validateOriginal(file,'instructions');
      if(!selected?.can_edit || !supportApi || working) throw Error('No puedes añadir archivos a este documento.');
      if(data.referenceStorage?.gateway_url == null) throw Error('El almacenamiento privado todavía no está configurado.');
      if(dirty){ const saved=await persistDraft(); if(!saved) return; }
      setWorking(true);
      const result=await supportApi('upload',{project_id:project.id,area_id:selected.area_id,id:selected.id,revision:baseRevision.current,file},baseRevision.current);
      const returnedOriginals=Array.isArray(result?.originals)?result.originals:null;
      const uploadedAsset=result?.asset || (result?.id && result?.file_name ? result : null);
      if(result?.revision) baseRevision.current=result.revision;
      setDocuments(current=>current.map(row=>{
        if(row.id!==selected.id)return row;
        const originals=returnedOriginals || [...(row.originals || []),...(uploadedAsset?[uploadedAsset]:[])];
        return {...row,originals,revision:result?.revision || row.revision};
      }));
      setNotice('Archivo original añadido.');
    } catch(failure) { setError(failure.message); }
    finally { setWorking(false); input.value=''; }
  }
  async function run(action, value, message) {
    if (!supportApi || !selected || working) return;
    if (dirty && action !== 'history') { setError('Guarda los cambios antes de modificar el acceso o el estado del documento.'); return; }
    setWorking(true); setError(''); setNotice('');
    try {
      const payload = { project_id:project.id, area_id:selected.area_id, id:selected.id, revision:baseRevision.current, ...value };
      const result = await supportApi(`support.${action}`, payload, baseRevision.current);
      if (action === 'share') { setDocuments(current => current.map(row => row.id === selected.id ? { ...row, ...result, share_scope:value.share_scope, linked_task_id:null } : row)); baseRevision.current = result?.revision || baseRevision.current + 1; }
      if (action === 'link') { setDocuments(current => current.map(row => row.id === selected.id ? { ...row, ...result, linked_task_id:value.linked_task_id } : row)); baseRevision.current = result?.revision || baseRevision.current + 1; }
      if (action === 'archive') { setDocuments(current => current.filter(row => row.id !== selected.id)); setSelectedId(''); }
      if (action === 'history') setHistory(Array.isArray(result) ? result : result?.rows || result?.history || []);
      if (action === 'convert' && result?.id) {
        setConversionTaskBySupport(current=>({...current,[selected.id]:result.id}));
        const source = result.source_document || result.sourceDoc;
        if (source?.id === selected.id) {
          setDocuments(current => current.map(row => row.id === selected.id ? { ...row, ...source, originals:source.originals || row.originals || [] } : row));
          if (source.revision != null) baseRevision.current = source.revision;
        }
      }
      if (message) setNotice(message);
      if (action === 'convert' && result?.id && onOpenTask) setNotice('Se creó una entrega como borrador. No se envió a revisión.');
      setConfirmation('');
      return result;
    } catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  }

  return <section className="gw-support" aria-label="Documentos de apoyo">
    <div className="gw-support-heading"><div><h2>Documentos de apoyo</h2><p>Notas, fuentes y materiales de preparación privados hasta que decidas compartirlos.</p></div><button type="button" className="gw-wk-btn gw-wk-btn-primary" disabled={!supportApi || !allowedAreas.length || busy} onClick={() => { setCreateOpen(value => !value); setError(''); }}><Plus size={15} />Crear documento de apoyo</button></div>
    {createOpen && <form className="gw-support-create" onSubmit={createDocument}><label>Título<input autoFocus maxLength={180} required value={createTitle} onChange={event => setCreateTitle(event.target.value)} placeholder="Ej. Fuentes para la entrevista" /></label><label>Área<select required value={createArea} onChange={event => setCreateArea(event.target.value)}><option value="">Seleccionar área</option>{allowedAreas.map(area => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label><label>Tipo<select value={createKind} onChange={event => setCreateKind(event.target.value)}>{Object.entries(KINDS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="submit" className="gw-wk-btn gw-wk-btn-primary" disabled={working || busy || !supportApi}>{working ? 'Creando…' : 'Crear en privado'}</button><small>No agrega una fecha, responsable ni revisión.</small></form>}
    {error && <p className="gw-support-alert" role="alert">{error}</p>}{notice && <p className="gw-support-notice" role="status">{notice}</p>}{remoteConflict && <div className="gw-support-conflict" role="alert"><span>Otra ventana actualizó este documento. Tu borrador sigue intacto; puedes intentar guardarlo para confirmar el conflicto.</span><button type="button" className="gw-wk-btn" onClick={() => { const next = rowPayload(remoteConflict); setDraft(next); baseline.current = JSON.stringify(next); baseRevision.current = remoteConflict.revision || 0; setPaletteText(next.palette.join(' ')); setRemoteConflict(null); setError(''); setEditorEpoch(epoch=>epoch+1); setNotice(`Se cargó la revisión ${remoteConflict.revision}.`); }}>Descartar mi borrador y cargar la revisión {remoteConflict.revision}</button></div>}
    <div className="gw-support-layout"><aside className="gw-support-list" aria-label="Tus documentos y documentos compartidos">{documents.map(row => { const area = data.areas.find(item => item.id === row.area_id); return <button type="button" key={row.id} aria-current={row.id === selectedId || undefined} onClick={() => navigate(() => setSelectedId(row.id))}><FileText size={16} aria-hidden="true"/><span><strong>{row.title}</strong><small>{KINDS[row.document_kind] || row.document_kind} · {area?.name || 'Área'} · {row.share_scope === 'private' ? 'Privado' : 'Compartido'}</small></span></button>; })}{!documents.length && <p>No hay documentos de apoyo todavía.</p>}</aside>
      {selected && draft && draftFor===selected.id ? <ReferenceSplit open={Boolean(splitOpen && linkedTask && linkedMaterial)} project={project} data={data} task={linkedTask} initialReferenceId={linkedMaterial?.reference_id} onClose={()=>setSplitOpen(false)}><article className="gw-support-document"><header><div><span className="gw-wk-eyebrow">{data.areas.find(item => item.id === selected.area_id)?.name || 'Área'}</span><h3>{selected.title}</h3></div><div className="gw-support-heading-actions"><span className="gw-support-scope">{selected.share_scope === 'private' ? <><LockKeyhole size={14}/>Privado</> : <><Share2 size={14}/>Compartido</>}</span>{linkedTask && linkedMaterial && <button type="button" className="gw-wk-btn" aria-pressed={splitOpen} onClick={()=>setSplitOpen(value=>!value)}>{splitOpen ? 'Cerrar pantalla dividida' : 'Consultar copia vinculada'}</button>}</div></header>
        <form onSubmit={save}><div className="gw-support-fields"><label>Título<input maxLength={180} value={draft.title} disabled={!selected.can_edit || working || busy} onChange={event => change({title:event.target.value})}/></label><label>Tipo<select value={draft.document_kind} disabled={!selected.can_edit || working || busy} onChange={event => change({document_kind:event.target.value})}>{Object.entries(KINDS).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
          {selected.can_edit ? <RichDocument key={`${selected.id}:${editorEpoch}`} initialDocument={draft.content_document} initialMarkdown={draft.content_markdown} onChange={change} disabled={working || busy} palette={colors} onSave={() => void save()} scope={{kind:'support',supportId:selected.id,projectId:project.id,areaId:selected.area_id}} ariaLabel={`Documento de apoyo: ${selected.title}`} /> : selected.content_document ? <StructuredDocument document={selected.content_document} /> : <pre className="gw-support-readonly-text">{selected.content_markdown}</pre>}
          <section className="gw-support-originals" aria-label="Archivos originales"><div><h4>Archivos originales</h4><p>PDF e imágenes de hasta 25 MB, sin comprimir ni redimensionar.</p></div>{selected.can_edit && <label className="gw-wk-btn gw-support-upload"><Upload size={14}/>Añadir PDF o imagen<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/tiff,image/avif,image/heic,image/heif,application/pdf,.jpg,.jpeg,.png,.webp,.gif,.tif,.tiff,.avif,.heic,.heif,.pdf" onChange={event=>void uploadOriginal(event)} disabled={working || busy || !supportApi || !data.referenceStorage?.gateway_url}/></label>}{!data.referenceStorage?.gateway_url && <small>El almacenamiento privado está pendiente de conexión.</small>}{(selected.originals || []).map(asset=><ReferenceOriginal key={asset.id} asset={asset} gateway={data.referenceStorage?.gateway_url}/>)}</section>
          <div className="gw-support-details"><label>Créditos<textarea rows={2} value={draft.credits} disabled={!selected.can_edit || working || busy} onChange={event => change({credits:event.target.value})}/></label><label>Paleta de color<input value={paletteText} disabled={!selected.can_edit || working || busy} onChange={event => setPaletteText(event.target.value)} placeholder="#673AB7 #F4ECE0" /></label>{selected.palette?.length > 0 && <Palette colors={selected.palette}/>}</div>
          {selected.can_edit && <div className="gw-support-save"><span role="status">{working ? 'Guardando…' : dirty ? 'Cambios sin guardar' : `Revisión ${selected.revision || 1} guardada`}</span><button className="gw-wk-btn gw-wk-btn-primary" type="submit" disabled={working || busy || !dirty}>{working ? 'Guardando…' : 'Guardar documento'}</button></div>}
        </form>
        <div className="gw-support-actions"><section><h4>Compartir y vincular</h4><p>Compartir da lectura al área; no concede permiso para editar. Vincular crea una copia congelada para esa asignación: el documento sigue con su alcance actual y los cambios futuros no modifican la copia.</p>{selected.can_edit && confirmation === 'share' ? <div className="gw-support-confirm" role="group" aria-label="Confirmar compartir"><p>¿Compartir este documento con las personas del área que ya tienen acceso? La copia ya vinculada a una tarea permanecerá allí.</p><button type="button" className="gw-wk-btn gw-wk-btn-primary" disabled={working || busy || dirty} onClick={() => void run('share',{id:selected.id,share_scope:'area'},'Documento compartido con el área.')}>Confirmar</button><button type="button" className="gw-wk-btn" onClick={() => setConfirmation('')}>Cancelar</button></div> : selected.can_edit && confirmation === 'private' ? <div className="gw-support-confirm" role="group" aria-label="Confirmar retirar acceso"><p>¿Retirar el acceso al documento vivo y volver a dejarlo privado? La copia congelada vinculada a una tarea no se retira.</p><button type="button" className="gw-wk-btn gw-wk-btn-primary" disabled={working || busy || dirty} onClick={() => void run('share',{id:selected.id,share_scope:'private'},'El documento volvió a ser privado; las copias vinculadas se conservan.')}>Confirmar</button><button type="button" className="gw-wk-btn" onClick={() => setConfirmation('')}>Cancelar</button></div> : selected.can_edit && <button type="button" className="gw-wk-btn" disabled={working || busy || dirty} onClick={() => setConfirmation(selected.share_scope === 'private' ? 'share' : 'private')}><Share2 size={14}/>{selected.share_scope === 'private' ? 'Compartir con el área' : 'Retirar acceso del área'}</button>}
            {selected.can_edit && (selected.linked_task_id ? <p>Hay una copia congelada vinculada a «{data.tasks.find(task => task.id === selected.linked_task_id)?.title || 'una asignación accesible'}». Retirar el acceso del área no la elimina.</p> : <label>Vincular una copia a una asignación accesible<select value="" disabled={working || busy || dirty || !permittedTasks.length} onChange={event => { if (event.target.value) void run('link',{id:selected.id,linked_task_id:event.target.value},'Copia vinculada a la asignación; el documento vivo conserva su alcance.'); }}><option value="">Elegir asignación</option>{permittedTasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label>)}
          </section><section><h4>Historial y estado</h4><p>Archivar conserva el historial. Convertir conserva el original de apoyo y crea una entrega con borrador privado, sin enviarla a revisión.</p>{selected.can_edit && <><button type="button" className="gw-wk-btn" disabled={working || busy} onClick={() => void run('history',{id:selected.id})}><BookOpen size={14}/>Consultar historial</button>{!convertedTaskId && selected.can_convert !== false && <>{confirmation === 'convert' ? <div className="gw-support-confirm" role="group" aria-label="Confirmar conversión"><p>¿Convertir en una entrega? Se conservará el contenido de apoyo original y se creará un borrador privado; no se enviará a revisión.</p><button type="button" className="gw-wk-btn gw-wk-btn-primary" disabled={working || busy || dirty} onClick={async () => { const task = await run('convert',{id:selected.id}); if (task?.id) onOpenTask?.(task); }}>Confirmar conversión</button><button type="button" className="gw-wk-btn" onClick={() => setConfirmation('')}>Cancelar</button></div> : <button type="button" className="gw-wk-btn" disabled={working || busy || dirty} onClick={() => setConfirmation('convert')}>Convertir en entrega…</button>}</>}{confirmation === 'archive' ? <div className="gw-support-confirm" role="group" aria-label="Confirmar archivo"><p>Se ocultará de la biblioteca activa y conservará su historial.</p><button type="button" className="gw-wk-btn gw-wk-btn-danger" disabled={working || busy || dirty} onClick={() => void run('archive',{id:selected.id},'Documento archivado.')}>Archivar documento</button><button type="button" className="gw-wk-btn" onClick={() => setConfirmation('')}>Cancelar</button></div> : <button type="button" className="gw-wk-btn" disabled={working || busy || dirty} onClick={() => setConfirmation('archive')}><Archive size={14}/>Archivar…</button>}</>}
            {convertedTaskId && <p>Convertido en entrega. {onOpenTask && <button type="button" className="gw-wk-btn" onClick={() => { const task = data.tasks.find(item => item.id === convertedTaskId); if (task) onOpenTask(task); }}>Abrir entrega</button>}</p>}
          </section></div>
        {history.length > 0 && <section className="gw-support-history" aria-label="Historial del documento"><h4>Historial</h4>{history.map((item,index) => <p key={item.id || item.revision || index}>Revisión {item.revision || index + 1}{(item.created_at || item.updated_at) ? ` · ${new Date(item.created_at || item.updated_at).toLocaleString('es-MX')}` : ''}{item.title || item.snapshot?.title ? ` · ${item.title || item.snapshot.title}` : ''}</p>)}</section>}
        {!selected.can_edit && <p className="gw-support-readonly">Documento compartido para consulta. No puedes editarlo ni cambiar su acceso.</p>}
      </article></ReferenceSplit> : <div className="gw-wk-empty"><FileText size={28}/><h3>Selecciona un documento de apoyo</h3><p>Los documentos que crees empiezan en privado y no son entregas ni solicitudes de revisión.</p>{allowedAreas.length > 0 && <button type="button" className="gw-wk-btn gw-wk-btn-primary" onClick={() => setCreateOpen(true)}>Crear documento de apoyo</button>}</div>}
    </div>
    {pending && <DraftExitDialog onStay={() => setPending(null)} onDiscard={() => { const next = pending; setPending(null); dirtyRef.current=false; onDirtyChange?.(false); setNotice(''); next(); }} />}
  </section>;
}

export default function SupportDocuments(props) {
  // A project or actor change starts a new local draft baseline. Background
  // bundle updates for the same key remain handled by the conflict-aware effect.
  return <SupportDocumentsView key={`${props.project?.id || ''}:${props.actorId || ''}`} {...props} />;
}
