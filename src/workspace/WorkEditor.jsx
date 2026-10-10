import React, { useEffect, useRef, useState } from 'react';
const RichDocument = React.lazy(() => import('./RichDocument'));
import { DocumentContent } from './EditionDocuments';
import StructuredDocument from './StructuredDocument';
import ReferenceDialog from './ReferenceDialog';
import VersionFile from './VersionFile';
import WorkConversation from './WorkConversation';
import WorkOperations from './WorkOperations';
import { EDITABLE_STATES, documentText, nextStep } from './documentModel';
import { STATES, dateLabel } from './gimgModel';

export default function WorkEditor({ task, data, actorId, api, command, onDirtyChange, busy, onReference, previewMode }) {
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [payload, setPayload] = useState(null);
  const [saved, setSaved] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const baseline = useRef('');
  const permissions = data.taskPermissions?.[task.id] || {};
  const editable = permissions['content.edit_assigned'] && EDITABLE_STATES.includes(task.state);
  const version = data.versions.find(item => item.deliverable_id === task.id && item.version_number === task.current_version);
  const staleDraft = Boolean(saved && saved.base_version !== task.current_version);
  const dirty = payload !== null && JSON.stringify(payload) !== baseline.current;
  const area = data.areas.find(item => item.id === task.area_id);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    (async () => {
      try {
        const draft = editable ? await api('draft.get', task, {}) : null;
        if (!live) return;
        const values = { content_document: draft?.content_document || version?.content_document || null, content_markdown: draft?.content_markdown ?? version?.content_markdown ?? '', credits: draft?.credits ?? version?.credits ?? '', asset_url: draft?.asset_url || '' };
        baseline.current = JSON.stringify(values); setSaved(draft); setPayload(values);
      } catch (failure) { if (live) setError(failure.message); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [task.id, task.current_version, task.state, actorId]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => { if (!dirty) return; const warn = event => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);

  function change(content, initial = false) {
    setPayload(current => {
      const next = { ...current, ...content };
      if (initial) baseline.current = JSON.stringify(next);
      return next;
    });
  }
  async function persist() {
    if (!dirty && saved && !staleDraft) return saved;
    if (payload.asset_url && !/^https:\/\//i.test(payload.asset_url.trim())) throw new Error('Usa un enlace HTTPS para el archivo.');
    const draft = await api('draft.save', task, { data: payload, revision: saved?.revision || 0, base_version: task.current_version });
    baseline.current = JSON.stringify(payload); setSaved(draft); onDirtyChange(false); return draft;
  }
  async function save(send) {
    setWorking(true); setError('');
    try { const draft = await persist(); if (send) await api('draft.submit', task, { draft_revision: draft.revision, task_revision: task.revision }); }
    catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  }
  if (loading) return <p role="status" className="gw-loading">Abriendo tu documento…</p>;
  const comments = data.comments.filter(comment => comment.deliverable_id === task.id && comment.kind === 'changes');
  return <><section className="gw-personal-editor" aria-hidden={referenceOpen || undefined} aria-label={`Trabajo: ${task.title}`}>
    <div className="gw-editor-header"><div><span className="gw-eyebrow">{area?.name} · {STATES[task.state]}</span><h2>{task.title}</h2><p>Entrega: {dateLabel(task.due_at)}</p></div>
      {editable && payload && <div className="gw-editor-save"><span role="status">{dirty ? 'Cambios sin guardar' : saved ? `Borrador guardado · ${dateLabel(saved.updated_at)}` : 'Tu borrador'}</span><div><button type="button" disabled={working || busy || (!dirty && Boolean(saved) && !staleDraft)} onClick={() => void save(false)}>Guardar borrador</button><button type="button" className="gw-primary" disabled={working || busy || staleDraft || !permissions['content.request_review'] || (!documentText(payload.content_document).trim() && !payload.asset_url)} onClick={() => void save(true)}>{working ? 'Guardando…' : 'Enviar a revisión'}</button></div></div>}
    </div>
    {error && <p className="gw-alert" role="alert">{error}</p>}{staleDraft && <p className="gw-work-notice">Este borrador parte de la versión {saved.base_version}; la última entrega es la versión {task.current_version}. Revisa el contenido y guarda el borrador antes de enviarlo.</p>}
    <div className="gw-writing-layout"><div>
      {!editable && <VersionFile version={version} permissions={permissions} previewMode={previewMode} />}
      {!editable && <p className="gw-work-notice">{task.state === 'review' ? 'Enviaste esta versión a revisión. Aquí verás si el responsable solicita cambios o acepta el documento.' : ['area_approved','in_qa','qa_approved','published','archived'].includes(task.state) ? 'Esta versión ya fue aceptada. Puedes consultarla en Documentos.' : 'Este trabajo no se puede editar en su estado actual.'}</p>}
      {task.state === 'changes_requested' && comments.length > 0 && <div className="gw-corrections"><strong>Cambios solicitados</strong><p>{[...comments].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0].body}</p></div>}
      {editable && payload ? <React.Suspense fallback={<p role="status">Abriendo editor…</p>}><RichDocument initialDocument={payload.content_document} initialMarkdown={payload.content_markdown} onChange={change} disabled={working || busy} /></React.Suspense> : version?.content_document ? <StructuredDocument document={version.content_document} /> : <DocumentContent content={version?.content_markdown || ''} />}
    </div><aside className="gw-work-context"><h3>Siguiente paso</h3><p>{nextStep(task, true)}</p><h3>Tu asignación</h3><p>{task.description || (task.created_by === actorId ? 'Documento creado por ti para esta edición.' : 'El responsable del área todavía no ha añadido indicaciones.')}</p><button type="button" onClick={() => setReferenceOpen(true)}>Consultar documentos de la edición</button>
      {editable && payload && <details><summary>Créditos y archivo de apoyo</summary><label>Créditos<textarea value={payload.credits} disabled={working || busy} onChange={event => change({ credits: event.target.value })} /></label><label>Enlace a tu archivo<input type="url" placeholder="https://…" disabled={working || busy} value={payload.asset_url} onChange={event => change({ asset_url: event.target.value })} /></label><p>Si tu trabajo está en un repositorio externo, añade aquí su enlace.</p></details>}
      <WorkOperations task={task} permissions={permissions} command={command} busy={working || busy || dirty} />
      {dirty && <small>Guarda tu borrador antes de cambiar el estado del trabajo.</small>}
    </aside></div>
    <WorkConversation task={task} data={data} command={command} busy={working || busy} />
  </section>{referenceOpen && <ReferenceDialog project={data.projects.find(item => item.id === task.project_id)} data={data} onClose={() => setReferenceOpen(false)} />}</>;
}
