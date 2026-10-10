import React from 'react';
import TaskDetail from './TaskDetail';
import { Activity, CommandForm, TaskList, choices } from './ui';
import { dateLabel, summary } from './gimgModel';

export function EditionDeliverables({ project, data, task, permissions, command, busy, onPick, previewMode, onDirtyChange }) {
  const tasks = data.tasks.filter(item => item.project_id === project.id);
  return <section className="gw-work-section"><div className="gw-row"><h2>Entregables</h2><span>{tasks.length} en esta edición</span></div>
    {permissions['task.create'] && <details className="gw-disclosure"><summary>Crear entregable</summary><CommandForm busy={busy} button="Crear entregable" fields={{ title: 'Título', description: { label: 'Descripción', type: 'textarea', optional: true }, area_id: { label: 'Área', options: choices(data.areas.filter(area => area.project_id === project.id), 'name') }, responsible_id: { label: 'Responsable', options: choices(data.members, 'display_name'), optional: true } }} onSave={values => command('task.create', values)} /></details>}
    <div className="gw-grid"><TaskList tasks={tasks} onPick={onPick} selectedId={task?.id} />{task ? <TaskDetail key={task.id} task={task} data={data} command={command} busy={busy} previewMode={previewMode} onDirtyChange={onDirtyChange} /> : <p className="gw-empty">Selecciona un entregable para trabajar o revisar.</p>}</div>
  </section>;
}

export function EditionCalendar({ project, data, permissions, command, busy, onPick }) {
  const events = data.events.filter(event => event.project_id === project.id).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return <section className="gw-work-section"><h2>Calendario de la edición</h2><p>Entregas, revisiones y fechas editoriales de {project.title}.</p>
    {permissions['task.update_schedule'] && <details className="gw-disclosure"><summary>Añadir fecha</summary><CommandForm busy={busy} button="Añadir hito" fields={{ title: 'Título', kind: { label: 'Tipo', options: { milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial' } }, starts_at: { label: 'Inicio', type: 'datetime-local' }, ends_at: { label: 'Fin', type: 'datetime-local', optional: true } }} onSave={values => command('event.save', values)} /></details>}
    {!events.length && <p className="gw-empty">Todavía no hay fechas registradas para esta edición.</p>}
    <div className="gw-list">{events.map(event => <article key={event.id}><h3>{event.title}</h3><p>{dateLabel(event.starts_at)} · {{ milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial', deadline: 'Entrega' }[event.kind] || event.kind}</p>{event.deliverable_id && data.tasks.some(task => task.id === event.deliverable_id && task.project_id === project.id) && <button type="button" onClick={() => onPick(data.tasks.find(task => task.id === event.deliverable_id))}>Abrir entregable</button>}{event.kind !== 'deadline' && permissions['task.update_schedule'] && <details className="gw-disclosure"><summary>Modificar fecha</summary><CommandForm key={event.id + event.revision} busy={busy} initial={event} button="Actualizar hito" fields={{ title: 'Título', kind: { label: 'Tipo', options: { milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial' } }, starts_at: { label: 'Inicio', type: 'datetime-local' }, ends_at: { label: 'Fin', type: 'datetime-local', optional: true } }} onSave={values => command('event.save', { ...values, id: event.id }, event.revision)} /></details>}</article>)}</div>
  </section>;
}

export function EditionDay({ project, data, userId, lastVisit, onPick }) {
  const tasks = data.tasks.filter(task => task.project_id === project.id);
  const totals = summary(tasks, userId);
  const activity = data.audit.filter(row => (row.project_id === project.id || row.context?.project_id === project.id || tasks.some(task => task.id === row.entity_id) || row.entity_id === project.id) && new Date(row.created_at).getTime() > lastVisit);
  return <section className="gw-work-section"><h2>Mi jornada</h2><p>Tu trabajo dentro de {project.title}.</p>
    <div className="gw-cards">{[['Mi trabajo', totals.mine.length], ['Por revisar', totals.reviews.length], ['Fuera de fecha', totals.late.length], ['Bloqueados', totals.blocked.length]].map(([label, count]) => <article key={label}><p>{label}</p><strong>{count}</strong></article>)}</div>
    <h3>Próximas entregas</h3><TaskList tasks={[...totals.mine].sort((a, b) => new Date(a.due_at || '9999') - new Date(b.due_at || '9999'))} onPick={onPick} />
    <h3 className="gw-section">Revisiones y bloqueos</h3><TaskList tasks={[...totals.reviews, ...totals.blocked]} onPick={onPick} />
    <h3 className="gw-section">Cambios desde tu última entrada</h3><Activity rows={activity} />
  </section>;
}
