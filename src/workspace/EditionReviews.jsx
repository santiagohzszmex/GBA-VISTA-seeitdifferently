import React from 'react';
import { CommandForm, TaskList } from './ui';
import { DocumentContent } from './EditionDocuments';
import StructuredDocument from './StructuredDocument';
import VersionFile from './VersionFile';
import { reviewAction, canReviewTask } from './documentModel';
import { dateLabel, STATES } from './gimgModel';

export default function EditionReviews({ project, data, task, command, busy, onPick, previewMode }) {
  const queue = data.tasks.filter(item => item.project_id === project.id && canReviewTask(item, data.taskPermissions?.[item.id] || {}, data.areas.find(area => area.id === item.area_id)));
  const selected = queue.find(item => item.id === task?.id) || queue[0];
  const permissions = selected && data.taskPermissions[selected.id];
  const area = selected && data.areas.find(item => item.id === selected.area_id);
  const action = selected && reviewAction(selected, permissions, area);
  const version = selected && data.versions.find(item => item.deliverable_id === selected.id && item.version_number === selected.current_version);
  return <section className="gw-work-section"><div className="gw-work-heading"><div><h1>Revisión</h1><p>Revisa la versión entregada. El borrador personal permanece privado.</p></div><span>{queue.length} por atender</span></div>
    <div className="gw-review-layout"><TaskList tasks={queue} onPick={onPick} selectedId={selected?.id} />{selected ? <div className="gw-review-document"><div className="gw-editor-header"><div><span className="gw-eyebrow">{area?.name} · {STATES[selected.state]}</span><h2>{selected.title}</h2><p>{data.members.find(member => member.user_id === selected.responsible_id)?.display_name || 'Integrante'} · Versión {selected.current_version}</p></div>{action && <button type="button" className="gw-primary" disabled={busy} onClick={() => void command(action.action, { deliverable_id: selected.id, ...(action.state ? { state: action.state } : {}) }, selected.revision)}>{action.label}</button>}</div>
      <article className="gw-reviewed-paper"><VersionFile version={version} permissions={permissions} previewMode={previewMode} />{version?.content_document ? <StructuredDocument document={version.content_document} /> : <DocumentContent content={version?.content_markdown || 'Todavía no hay contenido entregado.'} />}{version?.credits && <footer className="gw-document-credits"><h3>Créditos</h3><p>{version.credits}</p></footer>}<small>{dateLabel(version?.created_at)}</small></article>
      {['review', 'in_qa'].includes(selected.state) && permissions['review.request_changes'] && (selected.state !== 'in_qa' || permissions['qa.approve']) && <details className="gw-return-document"><summary>Solicitar correcciones</summary><CommandForm busy={busy} fields={{ body: { label: 'Qué debe corregir la persona', type: 'textarea' } }} button="Devolver con correcciones" onSave={values => command('review.changes', { ...values, deliverable_id: selected.id }, selected.revision)} /></details>}
    </div> : <div className="gw-work-empty"><h3>No hay versiones pendientes de tu revisión.</h3><p>Las entregas aparecerán aquí cuando las personas las envíen.</p></div>}</div>
  </section>;
}
