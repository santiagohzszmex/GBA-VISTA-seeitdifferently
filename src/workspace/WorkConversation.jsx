import React from 'react';
import { CommandForm } from './ui';
import { dateLabel } from './gimgModel';

const KINDS = { comment: 'Comentario', changes: 'Correcciones solicitadas', verified: 'Verificación', qa_issue: 'Incidencia de calidad' };

export default function WorkConversation({ task, data, command, busy }) {
  const permissions = data.taskPermissions?.[task.id] || {};
  const comments = data.comments.filter(item => item.deliverable_id === task.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!comments.length && !permissions['content.comment'] && !permissions['qa.raise_issue']) return null;
  const run = (action, values) => command(action, { ...values, deliverable_id: task.id }, task.revision);
  return <details className="gw-work-conversation"><summary>Conversación e incidencias {comments.length > 0 && <span>({comments.length})</span>}</summary>
    <p>Estos mensajes los ve el equipo con acceso a la asignación. Tu borrador sigue siendo privado.</p>
    {permissions['content.comment'] && <CommandForm key={`comment-${task.id}`} busy={busy} resetOnSuccess button="Enviar comentario" fields={{ body: { label: 'Comentario para el equipo', type: 'textarea' } }} onSave={values => run('comment.add', values)} />}
    {permissions['qa.raise_issue'] && <details className="gw-disclosure"><summary>Reportar un problema con la entrega</summary><CommandForm key={`issue-${task.id}`} busy={busy} resetOnSuccess button="Registrar incidencia" fields={{ body: { label: 'Describe el problema y qué se necesita resolver', type: 'textarea' } }} onSave={values => run('qa.issue', values)} /></details>}
    <div className="gw-conversation-history">{comments.map(comment => <article key={comment.id}><strong>{KINDS[comment.kind] || 'Registro'}</strong><p>{comment.body}</p><small>{data.members.find(member => member.user_id === comment.actor_id)?.display_name || 'Integrante'} · {comment.version_number > 0 ? `Versión ${comment.version_number}` : 'Antes de la primera entrega'} · {dateLabel(comment.created_at)}</small></article>)}</div>
  </details>;
}
