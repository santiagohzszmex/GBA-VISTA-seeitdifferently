import { WORKSPACE_DEMO } from './workspaceDemo';
import matrix from './permissionMatrix.json';
import { documentMarkdown, taskIsMine } from './documentModel';
export const DEMO_ACTORS = {
 researcher: { id: 'demo-researcher', name: 'Investigador', role: 'gimg_contributor', area: 'research-demo', projects: ['halloween-demo'] },
 lead: { id: 'demo-lead', name: 'Responsable de Investigación', role: 'gimg_area_lead', area: 'research-demo', projects: ['halloween-demo'] },
 artist: { id: 'demo-artist', name: 'Artista', role: 'gimg_contributor', area: 'art-demo', projects: ['halloween-demo', 'muertos-demo'] },
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
  state.drafts = {};
  return state;
}
export function demoPermissions(actor, projectId, areaId = null, task = null) {
  const principal = actor.projects.includes(projectId) && (actor.role !== 'gimg_area_lead' || !areaId || actor.area === areaId);
  const own = task ? taskIsMine(task, actor.id) : areaId === actor.area;
  return Object.fromEntries(Object.entries(matrix[actor.role]).map(([key, mode]) => [key, Boolean(principal && (mode === 'U' || mode === 'P' || (mode === 'A' && areaId === actor.area) || (mode.startsWith('E') && own)))]));
}
export function workflowDemoData(state, actor, projectId) {
  const projects = state.projects.filter(project => actor.projects.includes(project.id));
  const tasks = state.tasks.filter(task => actor.projects.includes(task.project_id) && demoPermissions(actor, task.project_id, task.area_id, task)['task.read']);
  const taskIds = new Set(tasks.map(task => task.id));
  const areas = state.areas.filter(area => actor.projects.includes(area.project_id));
  return { ...state, projects, tasks, areas, versions: state.versions.filter(version => taskIds.has(version.deliverable_id)), comments: state.comments.filter(comment => taskIds.has(comment.deliverable_id)), events: state.events.filter(event => actor.projects.includes(event.project_id)),
    approvedDocuments: state.approvedDocuments.filter(document => state.tasks.find(task => task.id === document.deliverable_id)?.project_id === projectId && (() => { const task = state.tasks.find(item => item.id === document.deliverable_id); const permissions = demoPermissions(actor, projectId, task.area_id, task); return permissions['content.read'] || permissions['reference.read']; })()),
    areaPermissions: Object.fromEntries(areas.filter(area => area.project_id === projectId).map(area => [area.id, demoPermissions(actor, projectId, area.id)])),
    taskPermissions: Object.fromEntries(tasks.filter(task => task.project_id === projectId).map(task => [task.id, demoPermissions(actor, projectId, task.area_id, task)])) };
}
export function runWorkflowDemo(state, actor, action, payload, revision) {
  const next = clone(state);
  let task = next.tasks.find(item => item.id === payload.deliverable_id);
  const perms = demoPermissions(actor, payload.project_id || task?.project_id, payload.area_id || task?.area_id, task);
  const require = key => { if (!perms[key]) throw new Error('Esta función corresponde a otra persona del equipo.'); };
  const key = `${task?.id}:${actor.id}`;
  if (action === 'draft.get') return { state, result: clone(next.drafts[key] || null) };
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
    const version = { id: `version-${Date.now()}`, deliverable_id: task.id, version_number: task.current_version + 1, content_markdown: draft.content_markdown, content_document: draft.content_document, asset_url: draft.asset_url, has_file: Boolean(draft.asset_url), credits: draft.credits, change_summary: 'Envío a revisión', author_id: actor.id, created_at: new Date().toISOString() };
    next.versions.push(version); task.current_version++; task.state = 'review'; task.revision++; delete next.drafts[key];
    return { state: next, result: task };
  }
  if (action === 'task.create') {
    require('task.create');
    if (payload.responsible_id !== actor.id) require('task.assign');
    task = { id: `task-${Date.now()}`, unit_id: 'gimg-demo', project_id: payload.project_id, area_id: payload.area_id, title: payload.title, created_by: actor.id, description: payload.description || '', responsible_id: payload.responsible_id, collaborator_ids: [], state: 'assigned', current_version: 0, revision: 1, round: 0, extra_rounds: 0, priority: 'normal' };
    next.tasks.push(task); return { state: next, result: task };
  }
  if (!task || (revision != null && task.revision !== revision)) throw new Error('La asignación cambió; actualiza la vista.');
  if (action === 'task.save') { require('task.assign'); Object.assign(task, payload, { revision: task.revision + 1 }); }
  else if (action === 'task.schedule') { require('task.update_schedule'); Object.assign(task, { due_at: payload.due_at, priority: payload.priority, revision: task.revision + 1 }); }
  else if (action === 'review.changes') {
    require('review.request_changes'); task.state = 'changes_requested'; task.round++; task.revision++;
    next.comments.push({ id: `comment-${Date.now()}`, deliverable_id: task.id, version_number: task.current_version, body: payload.body, kind: 'changes', actor_id: actor.id, created_at: new Date().toISOString(), round: task.round });
  } else if (action === 'task.transition') {
    const area = next.areas.find(item => item.id === task.area_id);
    require(payload.state === 'area_approved' ? `review.approve_${area.specialty}` : payload.state === 'in_qa' ? 'review.queue_qa' : payload.state === 'qa_approved' ? 'qa.approve' : 'task.update_status');
    task.state = payload.state; task.revision++;
    if (payload.state === 'area_approved') {
      const version = next.versions.find(item => item.deliverable_id === task.id && item.version_number === task.current_version);
      next.approvedDocuments = next.approvedDocuments.filter(item => item.deliverable_id !== task.id);
      next.approvedDocuments.push({ ...version, version_id: version.id, title: task.title, area_id: area.id, area_name: area.name, approved_by: actor.id, approved_at: new Date().toISOString() });
    }
  } else if (action === 'publication.approve') { require('publication.approve_final'); task.final_approved_by = actor.id; task.revision++; }
  else throw new Error('Esta acción no está incluida en la demostración.');
  return { state: next, result: task };
}
