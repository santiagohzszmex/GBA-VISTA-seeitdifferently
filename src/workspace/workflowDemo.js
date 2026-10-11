import { WORKSPACE_DEMO } from './workspaceDemo';
import matrix from './permissionMatrix.json';
import { documentMarkdown, taskIsMine } from './documentModel';
import { referencePermission } from './referenceModel';
export const DEMO_ACTORS = {
 researcher: { id: 'demo-researcher', name: 'Investigador', role: 'gimg_contributor', area: 'research-demo', projects: ['halloween-demo'] },
 lead: { id: 'demo-lead', name: 'Responsable de Investigación', role: 'gimg_area_lead', area: 'research-demo', projects: ['halloween-demo'] },
 artist: { id: 'demo-artist', name: 'Artista', role: 'gimg_contributor', area: 'art-demo', projects: ['halloween-demo', 'muertos-demo'] },
 writer: { id: 'demo-writer', name: 'Redacción', role: 'gimg_contributor', area: 'text-demo', projects: ['halloween-demo'] },
 production: { id: 'demo-production', name: 'Producción', role: 'gimg_production_lead', projects: ['halloween-demo', 'muertos-demo'] },
 coordinator: { id: 'demo-coordinator', name: 'Coordinación', role: 'gimg_workspace_coordinator', projects: ['halloween-demo'] },
 productDirector: { id: 'demo-product-direction', name: 'Dirección de producto delegada', role: 'gimg_project_director', projects: ['halloween-demo'], delegated: ['task.create', 'task.assign', 'task.update_schedule', 'review.approve_research', 'review.approve_art', 'review.approve_text', 'review.approve_integration', 'review.request_changes', 'review.queue_qa', 'content.comment', 'qa.raise_issue'] },
 quality: { id: 'demo-quality', name: 'Archivos y QA', role: 'gimg_quality_manager', projects: ['halloween-demo'] },
 viewer: { id: 'demo-viewer', name: 'Consulta compartida', role: 'gimg_viewer', projects: ['halloween-demo'], delegated: ['unit.read', 'project.read', 'task.read', 'content.read', 'asset.download_preview'] },
 platform: { id: 'demo-platform', name: 'Administración técnica de GBA', role: 'gba_platform_owner', platformOwner: true, projects: [] },
 direction: { id: 'demo-direction', name: 'Dirección', role: 'gimg_direction', platformOwner: true, keynotesAccess: true, projects: ['halloween-demo', 'muertos-demo', 'leyendas-demo'] }
};
const clone = value => JSON.parse(JSON.stringify(value));
export function createWorkflowDemo() {
  const state = clone(WORKSPACE_DEMO);
  state.tasks = state.tasks.map(task => ({ ...task, responsible_id: task.area_id === 'research-demo' ? 'demo-researcher' : 'demo-artist' }));
  state.members = Object.values(DEMO_ACTORS).map(actor => ({ user_id: actor.id, display_name: actor.name, handle: actor.id, membership_status: 'active' }));
  state.versions = state.versions.map(version => ({ ...version, author_id: version.deliverable_id === 'research-task-demo' ? 'demo-researcher' : 'demo-artist' }));
  const acceptedTask = { ...state.tasks[0], id: 'accepted-research-demo', title: 'Fuentes y contexto de la edición', state: 'area_approved', area_approved_by: 'demo-lead' };
  state.tasks.push(acceptedTask);
  const acceptedVersion = { ...state.versions[0], id: 'accepted-version-demo', deliverable_id: acceptedTask.id, content_markdown: '## Una base para el equipo\n\nEsta investigación fue aceptada por el área y queda disponible para orientar la redacción y el arte de la edición.', change_summary: 'Investigación aceptada' };
  state.versions.push(acceptedVersion);
  state.approvedDocuments = [{ ...acceptedVersion, version_id: acceptedVersion.id, title: acceptedTask.title, area_id: acceptedTask.area_id, area_name: 'Investigación', approved_by: 'demo-lead', approved_at: '2026-10-09T18:00:00Z' }];
  state.areas.push({ id: 'text-demo', project_id: 'halloween-demo', name: 'Redacción', specialty: 'text' });
  state.areas.push({ id: 'integration-demo', project_id: 'halloween-demo', name: 'Integración y maquetación', specialty: 'integration' });
  for (const [id, title, area, responsible, status] of [
    ['writing-demo', 'Texto de apertura', 'text-demo', 'demo-writer', 'assigned'],
    ['qa-task-demo', 'Archivo integrado para verificar', 'integration-demo', 'demo-artist', 'in_qa'],
    ['final-task-demo', 'Pieza lista para publicación', 'art-demo', 'demo-artist', 'qa_approved']
  ]) {
    const task = { ...state.tasks[0], id, title, area_id: area, responsible_id: responsible, state: status, current_version: status === 'assigned' ? 0 : 1 };
    state.tasks.push(task);
    if (task.current_version) state.versions.push({ ...state.versions[1], id: `${id}-version`, deliverable_id: id, content_markdown: `## ${title}\n\nDocumento de demostración para recorrer revisión, calidad y aprobación final.`, author_id: responsible });
  }
  state.referenceHistory = {};
  state.references = [{ id: 'concept-demo', project_id: 'halloween-demo', kind: 'concept', title: 'Lo que permanece en la oscuridad', area_id: null, content_markdown: '## La idea de esta edición\n\nObservar las tradiciones desde sus historias y las personas que las mantienen vivas. Evitamos el terror gratuito; buscamos memoria, curiosidad y contraste.', palette: ['#342943', '#CAB8DD', '#F6F0E7'], revision: 1, updated_at: '2026-10-09T18:00:00Z', originals: [] }, { id: 'research-guide-demo', project_id: 'halloween-demo', kind: 'instructions', area_id: 'research-demo', title: 'Cómo construir la investigación', content_markdown: '## Una historia que se pueda comprobar\n\nRegistra tus fuentes, distingue los testimonios de los datos históricos y explica la relación con el concepto de la edición. Tu investigación aceptada orientará a Redacción y Arte.', palette: [], revision: 1, updated_at: '2026-10-09T18:00:00Z', originals: [] }];
  state.referenceStorage = { capacity_bytes: 10_000_000_000, used_bytes: 0, gateway_url: null };
  state.dependencies = [];
  state.sequence = 0;
  state.drafts = {};
  return state;
}
export function demoPermissions(actor, projectId, areaId = null, task = null) {
  const principal = actor.projects.includes(projectId) && (actor.role !== 'gimg_area_lead' || !areaId || actor.area === areaId);
  const own = task ? taskIsMine(task, actor.id) : areaId === actor.area;
  return Object.fromEntries(Object.entries(matrix[actor.role]).map(([key, mode]) => [key, Boolean(principal && (actor.role !== 'gimg_project_director' || ['unit.read','project.read','task.read','content.read','unit.members.read','audit.read_scoped'].includes(key) || actor.delegated?.includes(key)) && (mode === 'U' || mode === 'P' || (mode === 'D' && actor.delegated?.includes(key)) || (mode === 'A' && areaId === actor.area) || (mode.startsWith('E') && own)))]));
}
export function workflowDemoData(state, actor, projectId) {
  const projects = state.projects.filter(project => !project.deleted_at && actor.projects.includes(project.id));
  const visibleProjects = projects.map(project=>project.id);
  const tasks = state.tasks.filter(task => visibleProjects.includes(task.project_id) && demoPermissions(actor, task.project_id, task.area_id, task)['task.read']);
  const taskIds = new Set(tasks.map(task => task.id));
  const areas = state.areas.filter(area => actor.projects.includes(area.project_id));
  return { ...state, projects, tasks, areas, versions: state.versions.filter(version => taskIds.has(version.deliverable_id)), comments: state.comments.filter(comment => taskIds.has(comment.deliverable_id)), events: state.events.filter(event => actor.projects.includes(event.project_id) && (!event.deliverable_id || taskIds.has(event.deliverable_id))), dependencies: (state.dependencies || []).filter(item => taskIds.has(item.deliverable_id) && taskIds.has(item.depends_on_id)),
    referencePermissions: demoPermissions(actor, projectId),
    references: (state.references || []).filter(reference => reference.project_id === projectId && actor.projects.includes(projectId) && (!reference.area_id || !actor.area || reference.area_id === actor.area)).map(reference => ({...reference, area_name:areas.find(area => area.id === reference.area_id)?.name, can_edit: Boolean(demoPermissions(actor, projectId, reference.area_id)[referencePermission(reference.kind)])})),
    approvedDocuments: state.approvedDocuments.filter(document => state.tasks.find(task => task.id === document.deliverable_id)?.project_id === projectId && (() => { const task = state.tasks.find(item => item.id === document.deliverable_id); const permissions = demoPermissions(actor, projectId, task.area_id, task); return !task.qa_blocked && (permissions['content.read'] || permissions['reference.read']); })()),
    areaPermissions: Object.fromEntries(areas.filter(area => area.project_id === projectId).map(area => [area.id, demoPermissions(actor, projectId, area.id)])),
    taskPermissions: Object.fromEntries(tasks.filter(task => task.project_id === projectId).map(task => [task.id, demoPermissions(actor, projectId, task.area_id, task)])) };
}
export function runWorkflowDemo(state, actor, action, payload, revision) {
  const next = clone(state);
  const uid = prefix => `${prefix}-${Date.now()}-${++next.sequence}`;
  let task = next.tasks.find(item => item.id === payload.deliverable_id);
  const perms = demoPermissions(actor, payload.project_id || task?.project_id, payload.area_id || task?.area_id, task);
  const require = key => { if (!perms[key]) throw new Error('Esta función corresponde a otra persona del equipo.'); };
  if (action.startsWith('reference.')) {
    const old = next.references.find(reference => reference.id === payload.id);
    require(referencePermission(payload.kind || old?.kind));
    if (old && old.revision !== revision) throw Error('La referencia cambió en otra ventana.');
    if (action === 'reference.archive') { next.references = next.references.filter(reference => reference.id !== old.id); return { state:next, result:{id:old.id} }; }
    if (old && (old.kind !== payload.kind || old.area_id !== payload.area_id)) throw Error('El tipo y alcance no se pueden cambiar.');
    const reference = {...payload, id:old?.id || uid('reference'), content_markdown:payload.content_document ? documentMarkdown(payload.content_document) : payload.content_markdown || '', revision:(old?.revision || 0)+1, updated_at:new Date().toISOString(), originals:old?.originals || []};
    if(payload.from_legacy_brief){const project=next.projects.find(item=>item.id===payload.project_id);next.referenceHistory[reference.id]=[{revision:0,created_at:new Date().toISOString(),snapshot:{content_markdown:project.brief}}];}
    next.referenceHistory[reference.id]=[{revision:reference.revision,created_at:reference.updated_at,snapshot:reference},...(next.referenceHistory[reference.id] || [])];
    next.references = [...next.references.filter(item => item.id !== reference.id), reference]; return {state:next,result:reference};
  }
  if(action==='project.remove' || action==='project.restore'){
    require('project.archive');const project=next.projects.find(item=>item.id===payload.project_id);
    if(!project || project.revision!==revision)throw Error('La edición cambió; vuelve a cargarla.');
    if(action==='project.remove'){
      if(payload.confirmation!==project.title || payload.reason?.trim().length<10)throw Error('Confirma el nombre exacto y registra el motivo.');
      Object.assign(project,{deleted_at:new Date().toISOString(),deletion_reason:payload.reason,deleted_from_status:project.status,status:'archived',revision:project.revision+1});
    }else Object.assign(project,{deleted_at:null,deletion_reason:null,status:project.deleted_from_status,deleted_from_status:null,revision:project.revision+1});
    return {state:next,result:project};
  }
  const key = `${task?.id}:${actor.id}`;
  if (action === 'draft.get') { require('content.edit_assigned'); return { state, result: clone(next.drafts[key] || null) }; }
  if (action === 'draft.save') {
    require('content.edit_assigned');
    const old = next.drafts[key];
    const draft = { ...payload.data, content_markdown: documentMarkdown(payload.data.content_document), deliverable_id: task.id, author_id: actor.id, revision: (old?.revision || 0) + 1, base_version: task.current_version, updated_at: new Date().toISOString() };
    next.drafts[key] = draft;
    return { state: next, result: draft };
  }
  if (action === 'draft.submit') {
    require('content.request_review'); const draft = next.drafts[key];
    if (!draft) throw new Error('Guarda el borrador antes de enviarlo.');
    const version = { id: uid('version'), deliverable_id: task.id, version_number: task.current_version + 1, content_markdown: draft.content_markdown, content_document: draft.content_document, asset_url: draft.asset_url, has_file: Boolean(draft.asset_url), credits: draft.credits, change_summary: 'Envío a revisión', author_id: actor.id, created_at: new Date().toISOString() };
    next.versions.push(version); task.current_version++; task.state = 'review'; task.revision++; delete next.drafts[key];
    return { state: next, result: task };
  }
  if (action === 'task.create') {
    require('task.create');
    if (payload.responsible_id !== actor.id) require('task.assign');
    task = { id: uid('task'), unit_id: 'gimg-demo', project_id: payload.project_id, area_id: payload.area_id, title: payload.title, created_by: actor.id, description: payload.description || '', responsible_id: payload.responsible_id, collaborator_ids: [], state: payload.responsible_id ? 'assigned' : 'pending', current_version: 0, revision: 1, round: 0, extra_rounds: 0, priority: 'normal' };
    next.tasks.push(task); return { state: next, result: task };
  }
  if (action === 'event.save') {
    require('task.update_schedule');
    if (payload.kind === 'deadline') throw new Error('Cambia la fecha desde la asignación.');
    if (payload.id) {
      const event = next.events.find(item => item.id === payload.id && item.project_id === payload.project_id && item.kind !== 'deadline');
      if (!event || event.revision !== revision) throw new Error('La fecha cambió; actualiza la vista.');
      Object.assign(event, { title: payload.title, starts_at: payload.starts_at, ends_at: payload.ends_at, revision: event.revision + 1 });
      return { state: next, result: event };
    }
    const event = { ...payload, id: uid('event'), revision: 1 }; next.events.push(event);
    return { state: next, result: event };
  }
  if (!task || (revision != null && task.revision !== revision)) throw new Error('La asignación cambió; actualiza la vista.');
  if (action === 'task.save') { require('task.assign'); Object.assign(task, payload, { revision: task.revision + 1 }); }
  else if (action === 'task.schedule') {
    require('task.update_schedule'); Object.assign(task, { due_at: payload.due_at, priority: payload.priority, revision: task.revision + 1 });
    next.events = next.events.filter(event => event.deliverable_id !== task.id || event.kind !== 'deadline');
    if (task.due_at) next.events.push({ id: uid('deadline'), project_id: task.project_id, deliverable_id: task.id, title: task.title, starts_at: task.due_at, kind: 'deadline', revision: 1 });
  }
  else if (action === 'dependency.add') {
    require('task.assign');
    const previous = next.tasks.find(item => item.id === payload.depends_on_id && item.project_id === task.project_id);
    const reaches = (id, seen = new Set()) => id === task.id || (!seen.has(id) && (seen.add(id), next.dependencies.filter(item => item.deliverable_id === id).some(item => reaches(item.depends_on_id, seen))));
    if (!previous || reaches(previous.id)) throw new Error('La dependencia es inválida o circular.');
    if (!next.dependencies.some(item => item.deliverable_id === task.id && item.depends_on_id === previous.id)) next.dependencies.push({ deliverable_id: task.id, depends_on_id: previous.id });
    task.revision++;
  }
  else if (action === 'comment.add' || action === 'qa.issue') {
    require(action === 'comment.add' ? 'content.comment' : 'qa.raise_issue');
    if (!payload.body?.trim()) throw new Error('Escribe el mensaje.');
    next.comments.push({ id: uid('comment'), deliverable_id: task.id, version_number: task.current_version, body: payload.body, kind: action === 'comment.add' ? 'comment' : 'qa_issue', actor_id: actor.id, created_at: new Date().toISOString(), round: task.round }); task.revision++;
  }
  else if (action === 'review.extra_round') { require('review.authorize_extra_round'); if (!payload.reason || payload.reason.trim().length < 10) throw new Error('Registra el motivo (mínimo 10 caracteres).'); task.extra_rounds++; task.revision++; }
  else if (action === 'review.reopen') { require('review.reopen'); if (!['area_approved','in_qa','qa_approved','published','archived'].includes(task.state) || !payload.reason || payload.reason.trim().length < 10) throw new Error('Registra el motivo y elige un documento aceptado.'); task.state = 'in_progress'; task.final_approved_by = null; task.revision++; }
  else if (action === 'qa.block' || action === 'qa.release') {
    require(action === 'qa.block' ? 'qa.block_release' : 'qa.approve');
    if (!payload.reason || payload.reason.trim().length < 10 || (action === 'qa.release' && !task.qa_blocked)) throw new Error('Registra la incidencia o verificación (mínimo 10 caracteres).');
    task.qa_blocked = action === 'qa.block'; task.final_approved_by = null;
    if (task.qa_blocked) { task.blocked_from = task.state; task.block_reason = payload.reason; task.state = 'blocked'; }
    else { task.state = 'in_progress'; task.block_reason = null; task.area_approved_by = null; task.qa_approved_by = null; }
    task.revision++;
  }
  else if (action === 'review.changes') {
    require('review.request_changes'); if (!['review','in_qa'].includes(task.state) || task.round >= 1 + task.extra_rounds) throw new Error('Dirección debe autorizar otra ronda de correcciones.'); if (task.state === 'in_qa') require('qa.approve'); task.state = 'changes_requested'; task.round++; task.revision++;
    next.comments.push({ id: uid('comment'), deliverable_id: task.id, version_number: task.current_version, body: payload.body, kind: 'changes', actor_id: actor.id, created_at: new Date().toISOString(), round: task.round });
  } else if (action === 'task.transition') {
    const area = next.areas.find(item => item.id === task.area_id);
    if (payload.state === 'blocked') {
      require('task.block'); if (!payload.reason || payload.reason.trim().length < 5) throw new Error('Registra el motivo del bloqueo.'); task.blocked_from = task.state; task.block_reason = payload.reason;
    } else if (task.state === 'blocked') {
      require('task.block'); if (task.qa_blocked || payload.state !== task.blocked_from) throw new Error('El bloqueo debe liberarse mediante su verificación.'); task.block_reason = null;
    } else {
      const transitions = { 'assigned:in_progress': 'task.update_status', 'review:area_approved': `review.approve_${area.specialty}`, 'area_approved:in_qa': 'review.queue_qa', 'in_qa:qa_approved': 'qa.approve', 'qa_approved:published': 'publication.execute', 'published:archived': 'asset.archive' };
      const permission = transitions[`${task.state}:${payload.state}`]; if (!permission) throw new Error('Transición no autorizada.'); require(permission);
      if (payload.state === 'published' && (!task.final_approved_by || task.qa_blocked)) throw new Error('Falta la aprobación final de Dirección.');
      if (['in_progress','published'].includes(payload.state) && next.dependencies.some(item => item.deliverable_id === task.id && !['published','archived'].includes(next.tasks.find(other => other.id === item.depends_on_id)?.state))) throw new Error('Hay trabajo previo pendiente.');
    }
    task.state = payload.state; task.revision++;
    if (payload.state === 'area_approved') {
      const version = next.versions.find(item => item.deliverable_id === task.id && item.version_number === task.current_version);
      next.approvedDocuments = next.approvedDocuments.filter(item => item.deliverable_id !== task.id);
      next.approvedDocuments.push({ ...version, version_id: version.id, title: task.title, area_id: area.id, area_name: area.name, approved_by: actor.id, approved_at: new Date().toISOString() });
    }
  } else if (action === 'publication.approve') { require('publication.approve_final'); if (task.state !== 'qa_approved' || task.qa_blocked || taskIsMine(task, actor.id) || next.versions.some(version => version.deliverable_id === task.id && version.author_id === actor.id)) throw new Error('Se requiere QA aprobado y una aprobación final ajena a la autoría.'); task.final_approved_by = actor.id; task.revision++; }
  else throw new Error('Esta acción no está incluida en la demostración.');
  return { state: next, result: task };
}

export function demoNotifications(state,actor){
 const data=workflowDemoData(state,actor,actor.projects[0]);
 return data.tasks.flatMap(task=>{
  const p=demoPermissions(actor,task.project_id,task.area_id,task), own=taskIsMine(task,actor.id);
  const area=state.areas.find(item=>item.id===task.area_id);
  let type,title;
  if(own && ['assigned','in_progress','changes_requested'].includes(task.state)){type=task.state==='changes_requested'?'corrections.requested':'assignment.updated';title=task.state==='changes_requested'?'Hay correcciones para tu trabajo':'Tu asignación está lista';}
  else if(task.state==='review' && (p['review.approve_'+area?.specialty] || p['task.assign'])){type='review.requested';title='Nueva entrega por revisar';}
  else if(task.state==='in_qa' && p['qa.approve']){type='qa.requested';title='Hay un trabajo listo para QA';}
  else if(task.state==='qa_approved' && p['publication.approve_final'] && !own){type='publication.requested';title='Falta la aprobación final de Dirección';}
  if(!type)return [];
  return [{id:'demo-notice-'+task.id,event_type:type,title,body:task.title,project_id:task.project_id,project_title:data.projects.find(item=>item.id===task.project_id)?.title,deliverable_id:task.id,created_at:task.created_at || new Date().toISOString()}];
 });
}
