import React, { useState } from 'react';
import WorkEditor from './WorkEditor';
import { CommandForm, TaskList, choices } from './ui';
import { STATES, dateLabel } from './gimgModel';
import { taskIsMine } from './documentModel';

export function CreateWork({ project, data, actorId, personal, command, busy, onCreated }) {
  const areas = data.areas.filter(area => area.project_id === project.id && data.areaPermissions?.[area.id]?.['task.create'] && (personal || data.areaPermissions?.[area.id]?.['task.assign']));
  if (!areas.length) return null;
  return <details className="gw-create-work"><summary>{personal ? 'Crear documento' : 'Nueva asignación'}</summary><CommandForm busy={busy} button={personal ? 'Crear y empezar a escribir' : 'Asignar trabajo'} fields={{ title: personal ? 'Título del documento' : 'Título de la asignación', ...(personal ? {} : { description: { label: 'Qué debe realizar y entregar esta persona', type: 'textarea' } }), area_id: { label: 'Área', options: choices(areas, 'name') }, ...(personal ? {} : { responsible_id: { label: 'Asignar a', options: choices(data.members, 'display_name') } }) }} onSave={async values => { const task = await command('task.create', { ...values, responsible_id: personal ? actorId : values.responsible_id }); if (task) onCreated(task); }} /></details>;
}

export function PersonalWork({ project, data, task, actorId, command, api, busy, onPick, previewMode, onDirtyChange, onReference }) {
  const [filter, setFilter] = useState(() => task && ['area_approved','in_qa','qa_approved','published','archived'].includes(task.state) ? 'all' : 'active');
  const mine = data.tasks.filter(item => item.project_id === project.id && taskIsMine(item, actorId));
  const tasks = mine.filter(item => filter === 'all' || !['area_approved', 'in_qa', 'qa_approved', 'published', 'archived'].includes(item.state));
  const selected = tasks.find(item => item.id === task?.id) || tasks[0];
  return <section className="gw-personal-work"><div className="gw-work-heading"><div><h1>Mi trabajo</h1><p>Tus asignaciones y los documentos que estás preparando.</p></div><CreateWork project={project} data={data} actorId={actorId} personal command={command} busy={busy} onCreated={onPick} /></div>
    <div className="gw-personal-layout"><aside className="gw-personal-list"><label><span className="gw-sr-only">Mostrar mi trabajo</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="active">Trabajo pendiente</option><option value="all">Todo mi trabajo</option></select></label><TaskList tasks={tasks} selectedId={selected?.id} onPick={onPick} /></aside>
      {selected ? <WorkEditor key={selected.id} task={selected} data={data} actorId={actorId} api={api} previewMode={previewMode} busy={busy} onDirtyChange={onDirtyChange} onReference={onReference} /> : <div className="gw-work-empty"><h3>No tienes trabajo pendiente en esta edición.</h3><p>Cuando el responsable de tu área te asigne trabajo, podrás abrirlo aquí, preparar el documento y enviarlo a revisión.</p><button type="button" onClick={onReference}>Consultar documentos de la edición</button></div>}
    </div>
  </section>;
}

export function AreaAssignments({ project, data, task, command, busy, onPick }) {
  const tasks = data.tasks.filter(item => item.project_id === project.id && data.taskPermissions?.[item.id]?.['task.assign']);
  const selected = tasks.find(item => item.id === task?.id) || tasks[0];
  const permissions = selected && data.taskPermissions[selected.id];
  return <section className="gw-work-section"><div className="gw-work-heading"><div><h1>Asignaciones del área</h1><p>Define el encargo, el responsable y lo que debe entregar.</p></div><CreateWork project={project} data={data} command={command} busy={busy} onCreated={onPick} /></div>
    <div className="gw-assignment-layout"><div className="gw-list">{tasks.map(item => <button type="button" key={item.id} className={selected?.id === item.id ? 'gw-selected' : ''} onClick={() => onPick(item)}><strong>{item.title}</strong><p>{data.members.find(member => member.user_id === item.responsible_id)?.display_name || 'Sin responsable'}</p><small>{STATES[item.state]} · {dateLabel(item.due_at)}</small></button>)}{!tasks.length && <p className="gw-empty">Todavía no hay asignaciones en tu área.</p>}</div>
      {selected && <section className="gw-assignment-detail"><h3>{selected.title}</h3><p>{STATES[selected.state]}</p>{['pending', 'assigned', 'in_progress', 'review', 'changes_requested'].includes(selected.state) ? <CommandForm key={selected.id + selected.revision} initial={selected} busy={busy} fields={{ title: 'Asignación', description: { label: 'Indicaciones para la persona', type: 'textarea' }, responsible_id: { label: 'Responsable', options: choices(data.members, 'display_name') } }} button="Guardar asignación" onSave={values => command('task.save', { ...values, deliverable_id: selected.id, collaborator_ids: selected.collaborator_ids || [] }, selected.revision)} /> : <p>La versión está aceptada. Su contenido y asignación se conservan.</p>}
        {permissions['task.update_schedule'] && <details className="gw-disclosure"><summary>Fecha de entrega y prioridad</summary><CommandForm key={`schedule-${selected.id}-${selected.revision}`} initial={selected} busy={busy} button="Guardar fecha" fields={{ due_at: { label: 'Fecha de entrega', type: 'datetime-local', optional: true }, priority: { label: 'Prioridad', options: { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } } }} onSave={values => command('task.schedule', { ...values, deliverable_id: selected.id }, selected.revision)} /></details>}
      </section>}
    </div>
  </section>;
}

export function EditionCalendar({ project, data, permissions, command, busy, onPick }) {
  const events = data.events.filter(event => event.project_id === project.id).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return <section className="gw-work-section"><h2>Calendario de la edición</h2><p>Entregas, revisiones y fechas editoriales de {project.title}.</p>
    {permissions['task.update_schedule'] && <details className="gw-disclosure"><summary>Añadir fecha</summary><CommandForm busy={busy} button="Añadir hito" fields={{ title: 'Título', kind: { label: 'Tipo', options: { milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial' } }, starts_at: { label: 'Inicio', type: 'datetime-local' }, ends_at: { label: 'Fin', type: 'datetime-local', optional: true } }} onSave={values => command('event.save', values)} /></details>}
    {!events.length && <p className="gw-empty">Todavía no hay fechas registradas para esta edición.</p>}
    <div className="gw-list">{events.map(event => <article key={event.id}><h3>{event.title}</h3><p>{dateLabel(event.starts_at)} · {{ milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial', deadline: 'Entrega' }[event.kind] || event.kind}</p>{event.deliverable_id && data.tasks.some(task => task.id === event.deliverable_id) && <button type="button" onClick={() => onPick(data.tasks.find(task => task.id === event.deliverable_id))}>Abrir trabajo</button>}</article>)}</div>
  </section>;
}
