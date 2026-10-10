import React from 'react';
import { CommandForm } from './ui';

export default function WorkOperations({ task, permissions, command, busy, review = false }) {
  const run = (action, values) => command(action, { ...values, deliverable_id: task.id }, task.revision);
  const reason = label => ({ reason: { label, type: 'textarea', minLength: 10 } });
  const closed = ['area_approved', 'in_qa', 'qa_approved', 'published', 'archived'].includes(task.state);
  return <div className="gw-work-operations">
    {task.block_reason && <p className="gw-corrections"><strong>{task.qa_blocked ? 'Bloqueo de calidad' : 'Trabajo bloqueado'}</strong><br />{task.block_reason}</p>}
    {task.state === 'blocked' && !task.qa_blocked && permissions['task.block'] && <button type="button" disabled={busy} onClick={() => void run('task.transition', { state: task.blocked_from })}>Retomar trabajo</button>}
    {task.state !== 'blocked' && !closed && permissions['task.block'] && <details className="gw-disclosure"><summary>No puedo continuar este trabajo</summary><CommandForm busy={busy} fields={{ reason: { label: 'Qué impide continuar (mínimo 5 caracteres)', type: 'textarea', minLength: 5 } }} button="Registrar bloqueo" onSave={values => run('task.transition', { ...values, state: 'blocked' })} /></details>}
    {review && permissions['qa.block_release'] && !task.qa_blocked && <details className="gw-disclosure"><summary>Registrar una incidencia crítica y detener la salida</summary><p>El bloqueo impide publicar y retira la publicación pública si existe.</p><CommandForm busy={busy} fields={reason('Incidencia crítica (mínimo 10 caracteres)')} button="Bloquear salida por calidad" onSave={values => run('qa.block', values)} /></details>}
    {review && task.qa_blocked && permissions['qa.approve'] && <details className="gw-disclosure"><summary>Verificar la corrección y liberar el bloqueo</summary><p>El trabajo vuelve a preparación y debe pasar de nuevo por revisión.</p><CommandForm busy={busy} fields={reason('Verificación realizada (mínimo 10 caracteres)')} button="Liberar bloqueo de calidad" onSave={values => run('qa.release', values)} /></details>}
    {review && ['review', 'in_qa', 'changes_requested'].includes(task.state) && permissions['review.authorize_extra_round'] && <details className="gw-disclosure"><summary>Autorizar otra ronda de correcciones</summary><CommandForm busy={busy} fields={reason('Por qué se necesita otra ronda (mínimo 10 caracteres)')} button="Autorizar ronda adicional" onSave={values => run('review.extra_round', values)} /></details>}
    {review && closed && permissions['review.reopen'] && <details className="gw-disclosure"><summary>Reabrir para preparar una nueva versión</summary><p>La versión aceptada se conserva. La nueva versión necesitará otra revisión.</p><CommandForm busy={busy} fields={reason('Motivo de la reapertura (mínimo 10 caracteres)')} button="Reabrir trabajo" onSave={values => run('review.reopen', values)} /></details>}
    {review && task.state === 'published' && permissions['asset.archive'] && <details className="gw-disclosure"><summary>Cerrar y archivar el trabajo</summary><button type="button" disabled={busy} onClick={() => void run('task.transition', { state: 'archived' })}>Archivar trabajo publicado</button></details>}
  </div>;
}
