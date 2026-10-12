import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarClock, FileText, Inbox, Plus, Search } from 'lucide-react';
import WorkEditor from './WorkEditor';
import { CommandForm, choices } from './ui';
import { PRIORITIES, dateLabel } from './gimgModel';
import WorkConversation from './WorkConversation';
import WorkOperations from './WorkOperations';
import { taskIsMine, canReviewTask, nextStep, hasReviewPermission } from './documentModel';
import TaskMaterials from './TaskMaterials';
import ReferenceSplit from './ReferenceSplit';
import { Avatar, CLOSED_STATES, DueLabel, Status, dateShort, dueInfo } from './workView';

/* Mi trabajo y Asignaciones · Workspace 1.5.7 (rediseño visual).
   Los permisos (taskPermissions, areaPermissions, taskIsMine, permisos de revisión)
   y los comandos son los mismos que antes; sólo cambia la presentación. */

export function CreateWork({ project, data, actorId, personal, command, busy, onCreated }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const createTrigger = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = event => { if (root.current && !root.current.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === 'Escape') { setOpen(false); createTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [open]);
  const areas = data.areas.filter(area => area.project_id === project.id && data.areaPermissions?.[area.id]?.['task.create'] && (personal || data.areaPermissions?.[area.id]?.['task.assign']));
  if (!areas.length) return null;
  return <details ref={root} open={open} onToggle={event => setOpen(event.currentTarget.open)} className="gw-wk-create">
    <summary ref={createTrigger} className={`gw-wk-btn${personal ? '' : ' gw-wk-btn-primary'}`}><Plus size={16} aria-hidden="true" />{personal ? 'Crear documento' : 'Nueva asignación'}</summary>
    <div className="gw-wk-popover">
      <h3>{personal ? 'Nuevo documento' : 'Nueva asignación'}</h3>
      <p>{personal ? 'Se crea como borrador privado y puedes empezar a escribir de inmediato.' : 'Indica qué debe entregar la persona, en qué área y quién lo realiza.'}</p>
      <CommandForm resetOnSuccess initial={{ area_id: areas.length === 1 ? areas[0].id : '' }} busy={busy} button={personal ? 'Crear y empezar a escribir' : 'Asignar trabajo'} fields={{ title: personal ? 'Título del documento' : 'Título de la asignación', ...(personal ? {} : { description: { label: 'Qué debe realizar y entregar esta persona', type: 'richtext', scope:{kind:'assignment',projectId:project.id} } }), area_id: { label: 'Área', options: choices(areas, 'name') }, ...(personal ? {} : { responsible_id: { label: 'Asignar a', options: choices(data.members, 'display_name'), optional: true } }) }} onSave={async values => { const task = await command('task.create', { ...values, responsible_id: personal ? actorId : values.responsible_id }); if (task) { onCreated(task); setOpen(false); createTrigger.current?.focus(); } return task; }} />
    </div>
  </details>;
}

const WORK_GROUPS = [
  ['attention', 'Necesita tu atención', ['changes_requested', 'blocked']],
  ['doing', 'En curso', ['in_progress', 'assigned', 'pending']],
  ['sent', 'En revisión', ['review']]
];
const groupOf = state => (WORK_GROUPS.find(([, , states]) => states.includes(state))?.[0]) || 'closed';

export function PersonalWork({ project, data, task, actorId, command, api, busy, onPick, previewMode, onDirtyChange, onReference, referenceApi }) {
  const [filter, setFilter] = useState(() => task && CLOSED_STATES.includes(task.state) ? 'all' : 'active');
  const [focus, setFocus] = useState(false);
  const [split, setSplit] = useState(false);
  const order = { changes_requested: 0, blocked: 1, in_progress: 2, assigned: 3, pending: 3, review: 4 };
  const mine = data.tasks.filter(item => item.project_id === project.id && taskIsMine(item, actorId)).sort((a,b) => (order[a.state] ?? 5) - (order[b.state] ?? 5) || (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity));
  const tasks = mine.filter(item => filter === 'all' || !CLOSED_STATES.includes(item.state));
  const selected = tasks.find(item => item.id === task?.id) || tasks[0];
  const pending = mine.filter(item => !CLOSED_STATES.includes(item.state)).length;
  const groups = [...WORK_GROUPS.map(([id, label]) => [id, label]), ['closed', 'Aceptado y cerrado']]
    .map(([id, label]) => ({ id, label, items: tasks.filter(item => groupOf(item.state) === id) })).filter(group => group.items.length);
  return <section className="gw-wk gw-wk-mine" data-focus={selected && focus || undefined} data-split={selected && split || undefined} data-compact={selected && (focus || split) || undefined}>
    {focus && <h1 className="gw-sr-only">Mi trabajo</h1>}
    <div className="gw-wk-head"><div><h1>Mi trabajo</h1><p>Tus asignaciones y los documentos que estás preparando.</p></div><CreateWork project={project} data={data} actorId={actorId} personal command={command} busy={busy} onCreated={onPick} /></div>
    <div className="gw-wk-mine-layout">
      <aside className="gw-wk-rail" aria-label="Lista de mi trabajo">
        <div className="gw-wk-seg" role="group" aria-label="Mostrar mi trabajo">
          <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Pendiente <span>{pending}</span></button>
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todo <span>{mine.length}</span></button>
        </div>
        {groups.map(group => <div key={group.id} className="gw-wk-group" role="group" aria-label={group.label}>
          <h2 className="gw-wk-group-label">{group.label}</h2>
          <ul className="gw-wk-items">{group.items.map(item => <li key={item.id}><button type="button" className="gw-wk-work-item" aria-current={selected?.id === item.id || undefined} onClick={() => onPick(item)}>
            <strong>{item.title}</strong>
            <span className="gw-wk-work-meta"><Status state={item.state} /><DueLabel task={item} /></span>
            {item.block_reason && <span className="gw-wk-work-reason">{item.block_reason}</span>}
          </button></li>)}</ul>
        </div>)}
        {!tasks.length && <p className="gw-wk-rail-empty">{filter === 'active' && mine.length ? 'No tienes trabajo pendiente. Cambia a «Todo» para ver lo aceptado.' : 'Aquí aparecerá tu trabajo.'}</p>}
      </aside>
      {selected
        ? <WorkEditor key={selected.id} task={selected} data={data} actorId={actorId} api={api} command={command} previewMode={previewMode} busy={busy} onDirtyChange={onDirtyChange} onReference={onReference} focus={focus} onFocusChange={setFocus} onSplitChange={setSplit} referenceApi={referenceApi} />
        : <div className="gw-wk-empty"><FileText size={30} aria-hidden="true" /><h2>No tienes trabajo pendiente en esta edición.</h2><p>Cuando el responsable de tu área te asigne trabajo, podrás abrirlo aquí, preparar el documento y enviarlo a revisión.</p><button type="button" className="gw-wk-btn" onClick={onReference}>Consultar documentos de la edición</button></div>}
    </div>
  </section>;
}

const FILTERS = [['open', 'Abierto'], ['unassigned', 'Sin responsable'], ['blocked', 'Bloqueado'], ['late', 'Con retraso'], ['all', 'Todo']];

export function AreaAssignments({ project, data, task, command, busy, onPick, onReview, referenceApi }) {
  const [query, setQuery] = useState('');
  const [referenceTarget,setReferenceTarget] = useState(null);
  const [filter, setFilter] = useState('open');
  const [areaId, setAreaId] = useState('');
  const scoped = data.tasks.filter(item => item.project_id === project.id && data.taskPermissions?.[item.id]?.['task.assign']);
  const areas = data.areas.filter(area => area.project_id === project.id && data.areaPermissions?.[area.id]?.['task.assign']);
  const matches = (item, key = filter) => key === 'all' || (key === 'blocked' ? item.state === 'blocked' : key === 'unassigned' ? !item.responsible_id : key === 'late' ? item.due_at && new Date(item.due_at) < new Date() && !['published','archived'].includes(item.state) : !['published','archived'].includes(item.state));
  const nameOf = id => data.members.find(member => member.user_id === id)?.display_name || '';
  const tasks = scoped.filter(item => matches(item) && (!areaId || item.area_id === areaId) && `${item.title} ${nameOf(item.responsible_id)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const selected = tasks.find(item => item.id === task?.id) || tasks[0];
  const permissions = selected && data.taskPermissions[selected.id];
  const area = selected && data.areas.find(item => item.id === selected.area_id);
  const dependencies = selected ? (data.dependencies || []).filter(item => item.deliverable_id === selected.id) : [];
  const canReview = selected && canReviewTask(selected, permissions, area);
  const editable = selected && ['pending', 'assigned', 'in_progress', 'review', 'changes_requested', 'blocked'].includes(selected.state);
  return <section className="gw-wk gw-wk-team">
    <div className="gw-wk-head"><div><h1>Asignaciones</h1><p>Organiza el trabajo de {areas.length === 1 ? areas[0].name : 'la edición'}: quién lo realiza, qué entrega y cuándo.</p></div><CreateWork project={project} data={data} command={command} busy={busy} onCreated={onPick} /></div>
    <div className="gw-wk-toolbar">
      <label className="gw-wk-search"><span className="gw-sr-only">Buscar asignación o persona</span><Search size={16} aria-hidden="true" /><input type="search" placeholder="Buscar trabajo o persona" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="gw-wk-chipset" role="group" aria-label="Filtrar asignaciones">{FILTERS.map(([key, label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}{key !== 'all' && <span>{scoped.filter(item => matches(item, key)).length}</span>}</button>)}</div>
      {areas.length > 1 && <label className="gw-wk-areafilter"><span className="gw-sr-only">Filtrar por área</span><select value={areaId} onChange={event => setAreaId(event.target.value)}><option value="">Todas las áreas</option>{areas.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
      <span className="gw-wk-count" role="status">{tasks.length} {tasks.length === 1 ? 'trabajo' : 'trabajos'}</span>
    </div>
    <div className="gw-wk-team-layout">
      <div className="gw-wk-list">
        <ul className="gw-wk-items" aria-label="Asignaciones">
        {tasks.map(item => { const person = nameOf(item.responsible_id); const due = dueInfo(item.due_at, item.state); return <li key={item.id}><button type="button" className="gw-wk-assign-item" aria-current={selected?.id === item.id || undefined} onClick={() => onPick(item)}>
          <Avatar name={person} />
          <span className="gw-wk-assign-main">
            <strong>{item.title}</strong>
            <span className="gw-wk-assign-sub">{person || <em>Sin responsable</em>}{areas.length > 1 && ` · ${data.areas.find(row => row.id === item.area_id)?.name || ''}`}</span>
            <span className="gw-wk-assign-foot"><Status state={item.state} />{['high', 'urgent'].includes(item.priority) && <span className="gw-wk-tag" data-tone={item.priority}>{PRIORITIES[item.priority]}</span>}<span className="gw-wk-due" data-tone={due.tone || undefined}>{due.label}</span></span>
          </span>
        </button></li>; })}
        </ul>
        {!tasks.length && <div className="gw-wk-list-empty"><Inbox size={22} aria-hidden="true" />{scoped.length ? <><p>Ninguna asignación coincide con la búsqueda o el filtro.</p><button type="button" className="gw-wk-btn" onClick={() => { setQuery(''); setFilter('open'); setAreaId(''); }}>Mostrar el trabajo abierto</button></> : <p>Todavía no hay asignaciones en tu área.</p>}</div>}
      </div>
      {selected ? <ReferenceSplit open={Boolean(referenceTarget)} initialReferenceId={referenceTarget} task={selected} project={project} data={data} onClose={()=>setReferenceTarget(null)}><section className="gw-wk-detail" aria-label={`Asignación: ${selected.title}`}>
        <div className="gw-wk-detail-head">
          <span className="gw-wk-eyebrow">{area?.name}</span>
          <h2>{selected.title}</h2>
          <div className="gw-wk-chips">
            <Status state={selected.state} />
            <span className="gw-wk-chip"><Avatar name={nameOf(selected.responsible_id)} />{nameOf(selected.responsible_id) || 'Sin responsable'}</span>
            <span className="gw-wk-chip" data-tone={dueInfo(selected.due_at, selected.state).tone || undefined}><CalendarClock size={14} aria-hidden="true" />{dateLabel(selected.due_at)}{dueInfo(selected.due_at, selected.state).note && <small>{dueInfo(selected.due_at, selected.state).note}</small>}</span>
            {['high', 'urgent'].includes(selected.priority) && <span className="gw-wk-tag" data-tone={selected.priority}>Prioridad {PRIORITIES[selected.priority].toLowerCase()}</span>}
          </div>
        </div>
        <div className="gw-wk-nextstep"><ArrowRight size={16} aria-hidden="true" /><p>{nextStep(selected)}</p>{canReview && <button type="button" className="gw-wk-btn gw-wk-btn-primary" onClick={() => onReview(selected)}>Atender entrega en Revisión</button>}</div>
        <div className="gw-wk-detail-grid">
          <div className="gw-wk-col">
            <section className="gw-wk-card"><h3>Asignación</h3>
              {editable ? <CommandForm key={selected.id + selected.revision} initial={selected} busy={busy} fields={{ title: 'Título de la asignación', description: { label: 'Indicaciones para la persona', type: 'richtext', scope:{kind:'assignment',taskId:selected.id,projectId:project.id,areaId:selected.area_id} }, responsible_id: { label: 'Responsable', options: choices(data.members, 'display_name'), optional: true } }} button="Guardar asignación" onSave={values => command('task.save', { ...values, deliverable_id: selected.id, collaborator_ids: selected.collaborator_ids || [] }, selected.revision)} /> : <p className="gw-wk-note">La versión está aceptada. Su contenido y asignación se conservan.</p>}
            </section>
            <TaskMaterials task={selected} data={data} editable={Boolean(editable)} referenceApi={referenceApi} onOpen={row=>setReferenceTarget(row.reference_id)}/><WorkConversation task={selected} data={data} command={command} busy={busy} />
          </div>
          <div className="gw-wk-col gw-wk-side">
            {permissions['task.update_schedule'] && <details className="gw-wk-fold"><summary><span>Fecha de entrega y prioridad</span><small>{dateShort(selected.due_at)} · {PRIORITIES[selected.priority] || 'Normal'}</small></summary><CommandForm key={`schedule-${selected.id}-${selected.revision}`} initial={selected} busy={busy} button="Guardar fecha" fields={{ due_at: { label: 'Fecha de entrega', type: 'datetime-local', optional: true }, priority: { label: 'Prioridad', options: { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' } } }} onSave={values => command('task.schedule', { ...values, deliverable_id: selected.id }, selected.revision)} /></details>}
            <details className="gw-wk-fold"><summary><span>Trabajo que debe completarse primero</span><small>{dependencies.length ? `${dependencies.length} previo${dependencies.length === 1 ? '' : 's'}` : 'Ninguno'}</small></summary><p>Una dependencia evita iniciar o publicar este encargo antes de que el trabajo indicado esté publicado o archivado.</p>{dependencies.map(item => { const previous = data.tasks.find(row => row.id === item.depends_on_id); return <p key={item.depends_on_id} className="gw-wk-dependency">{previous?.title || 'Trabajo relacionado'}{previous && <Status state={previous.state} />}</p>; })}<CommandForm key={`dependency-${selected.id}`} busy={busy} button="Añadir dependencia" fields={{ depends_on_id: { label: 'Trabajo previo', options: choices(scoped.filter(item => item.id !== selected.id)) } }} onSave={values => command('dependency.add', { ...values, deliverable_id: selected.id }, selected.revision)} /></details>
            <WorkOperations task={selected} permissions={permissions} command={command} busy={busy} />
          </div>
        </div>
      </section></ReferenceSplit> : <div className="gw-wk-empty"><Inbox size={30} aria-hidden="true" /><h2>Selecciona una asignación</h2><p>{scoped.length ? 'Elige una de la lista para ver sus indicaciones, su fecha y a quién está asignada.' : 'Cuando crees una asignación, aparecerá aquí con su responsable y su fecha.'}</p></div>}
    </div>
  </section>;
}

export function EditionCalendar({ actorId, project, data, permissions, command, busy, onPick }) {
  const events = data.events.filter(event => event.project_id === project.id).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return <section className="gw-work-section"><h2>Calendario de la edición</h2><p>Entregas, revisiones y fechas editoriales de {project.title}.</p>
    {permissions['task.update_schedule'] && <details className="gw-disclosure"><summary>Añadir fecha</summary><CommandForm busy={busy} button="Añadir hito" fields={{ title: 'Título', kind: { label: 'Tipo', options: { milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial' } }, starts_at: { label: 'Inicio', type: 'datetime-local' }, ends_at: { label: 'Fin', type: 'datetime-local', optional: true } }} onSave={values => command('event.save', values)} /></details>}
    {!events.length && <p className="gw-empty">Todavía no hay fechas registradas para esta edición.</p>}
    <div className="gw-list">{events.map(event => <article key={event.id}><h3>{event.title}</h3><p>{dateLabel(event.starts_at)}{event.ends_at && ` → ${dateLabel(event.ends_at)}`} · {{ milestone: 'Hito', review: 'Revisión', editorial: 'Fecha editorial', deadline: 'Entrega' }[event.kind] || event.kind}</p>{event.deliverable_id && data.tasks.some(task => task.id === event.deliverable_id && (taskIsMine(task, actorId) || data.taskPermissions?.[task.id]?.['task.assign'] || hasReviewPermission(data.taskPermissions?.[task.id] || {}) || data.approvedDocuments?.some(document => document.deliverable_id === task.id))) && <button type="button" onClick={() => onPick(data.tasks.find(task => task.id === event.deliverable_id))}>Abrir trabajo</button>}{permissions['task.update_schedule'] && event.kind !== 'deadline' && <details className="gw-disclosure"><summary>Modificar fecha</summary><CommandForm key={`${event.id}-${event.revision}`} initial={event} busy={busy} fields={{ title: 'Título', starts_at: { label: 'Inicio', type: 'datetime-local' }, ends_at: { label: 'Fin', type: 'datetime-local', optional: true } }} button="Guardar fecha" onSave={values => command('event.save', { ...values, id: event.id, kind: event.kind }, event.revision)} /></details>}</article>)}</div>
  </section>;
}
