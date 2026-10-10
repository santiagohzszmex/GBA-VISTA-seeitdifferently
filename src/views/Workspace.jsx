import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import KeynotesWorkspace from '../workspace/KeynotesWorkspace';
import EditionDocuments from '../workspace/EditionDocuments';
import { EditionCalendar, PersonalWork, AreaAssignments } from '../workspace/EditionWork';
import EditionReviews from '../workspace/EditionReviews';
import { taskIsMine, canReviewTask } from '../workspace/documentModel';
import WorkspaceSettings from '../workspace/WorkspaceSettings';
import DraftExitDialog from '../workspace/DraftExitDialog';
import { WorkspaceNavigation, EditionTabs, EditionNavigation } from '../workspace/WorkspaceNavigation';
import { DEMO_ACTORS, createWorkflowDemo, demoPermissions, workflowDemoData, runWorkflowDemo } from '../workspace/workflowDemo';
import { rpc } from '../workspace/ui';
import '../workspace/workspace.css';

const EMPTY = { projects: [], areas: [], tasks: [], members: [], events: [], audit: [], versions: [], comments: [], assignments: [], grants: [], delegations: [], approvedDocuments: [], areaPermissions: {}, taskPermissions: {} };
const TABLES = { projects: 'workspace_projects', areas: 'workspace_areas', tasks: 'workspace_deliverables', events: 'workspace_events', audit: 'workspace_audit', assignments: 'workspace_assignments', grants: 'workspace_access_grants', delegations: 'workspace_delegations' };

export default function Workspace({ previewMode = false }) {
  const { user } = useAuth();
  const [screen, setScreen] = useState('editions');
  const [section, setSection] = useState('work');
  const [context, setContext] = useState(null);
  const [unitId, setUnitId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState(EMPTY);
  const [permissions, setPermissions] = useState({});
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [demoActorKey, setDemoActorKey] = useState('researcher');
  const demoState = useRef(null);
  if (previewMode && !demoState.current) demoState.current = createWorkflowDemo();
  const actor = DEMO_ACTORS[demoActorKey];
  const generation = useRef(0);
  const userId = previewMode ? actor.id : user?.id;
  const project = data.projects.find(item => item.id === projectId);
  const task = data.tasks.find(item => item.id === selectedId && item.project_id === projectId);
  const disabled = busy || loading;

  async function load() {
    const seq = ++generation.current;
    setLoading(true);
    try {
      if (previewMode) {
        const id = demoState.current.projects.find(item => item.id === projectId && actor.projects.includes(item.id))?.id || actor.projects[0];
        setContext({ units: [{ id: 'gimg-demo', name: 'GIMG' }], platform_owner: actor.platformOwner === true, keynotes_access: actor.keynotesAccess === true });
        setUnitId('gimg-demo'); setProjectId(id);
        const next = workflowDemoData(demoState.current, actor, id);
        setData(next); setSelectedId(current => next.tasks.some(item => item.id === current && item.project_id === id) ? current : next.tasks.find(item => item.project_id === id && taskIsMine(item, actor.id))?.id || '');
        setPermissions(demoPermissions(actor, id, actor.area || null));
        return;
      }
      const ctx = await rpc('workspace_context');
      if (seq !== generation.current) return;
      setContext(ctx);
      const unit = ctx.units.find(item => item.id === unitId)?.id || ctx.units[0]?.id || '';
      setUnitId(unit);
      if (!unit) { setData(EMPTY); setProjectId(''); setSelectedId(''); setPermissions({}); return; }

      const results = await Promise.all(Object.entries(TABLES).map(async ([key, table]) => {
        let query = supabase.from(table).select('*').eq('unit_id', unit);
        if (key === 'audit') query = query.order('created_at', { ascending: false }).limit(200);
        const { data: rows, error } = await query;
        if (error) throw error;
        return [key, rows || []];
      }));
      if (seq !== generation.current) return;
      const next = Object.fromEntries(results);
      const id = next.projects.find(item => item.id === projectId)?.id || next.projects[0]?.id || '';
      const contextualTask = next.tasks.find(item => item.id === selectedId && item.project_id === id) || next.tasks.find(item => item.project_id === id);
      const area = contextualTask?.area_id || next.areas.find(item => item.project_id === id)?.id || null;
      const [unitPerm, directoryPerm, workPermissions, approvedDocuments] = await Promise.all([
        rpc('workspace_permissions', { p_unit: unit }),
        rpc('workspace_permissions', { p_unit: unit, p_project: id || null, p_area: area, p_deliverable: contextualTask?.id || null }),
        id ? rpc('workspace_work_permissions', { p_project_id: id }) : { project: {}, areas: {}, tasks: {}, version_documents: {} },
        id ? rpc('workspace_edition_documents', { p_project_id: id }) : []
      ]);
      if (seq !== generation.current) return;
      const perm = { ...workPermissions.project, 'unit.members.read': Boolean(directoryPerm['unit.members.read']) };
      for (const [key, value] of Object.entries(unitPerm)) if ((key.startsWith('unit.') && key !== 'unit.members.read') || key === 'project.create') perm[key] = value;
      next.areaPermissions = workPermissions.areas || {}; next.taskPermissions = workPermissions.tasks || {}; next.approvedDocuments = approvedDocuments;
      next.members = directoryPerm['unit.members.read'] ? await rpc('workspace_directory', { p_unit: unit, p_project: id || null, p_area: area, p_deliverable: contextualTask?.id || null }) : [];
      const ids = next.tasks.map(item => item.id);
      const contents = await Promise.all([['versions', 'workspace_versions'], ['comments', 'workspace_comments']].map(async ([key, table]) => {
        if (!ids.length) return [key, []];
        const { data: rows, error } = await supabase.from(table).select('*').in('deliverable_id', ids).order('created_at', { ascending: false });
        if (error) throw error;
        return [key, (rows || []).map(row => key === 'versions' ? { ...row, content_document: workPermissions.version_documents?.[row.id] || null, has_file: Boolean(workPermissions.version_files?.[row.id]) } : row)];
      }));
      if (seq !== generation.current) return;
      Object.assign(next, Object.fromEntries(contents));
      setData(next);
      setProjectId(id);
      setPermissions(perm);
      setSelectedId(current => next.tasks.some(item => item.id === current && item.project_id === id) ? current : next.tasks.find(item => item.project_id === id)?.id || '');
      localStorage.setItem('gba-workspace-last-visit', String(Date.now()));
    } catch (error) {
      if (seq === generation.current) { setPermissions({}); setNotice(error.message || 'No pudimos abrir Workspace. Vuelve a intentarlo.'); }
    } finally { if (seq === generation.current) setLoading(false); }
  }

  useEffect(() => { void load(); return () => { generation.current++; }; }, [userId, unitId, projectId, previewMode]);

  function navigate(action) {
    if (hasDraft) setPendingNavigation(() => action);
    else action();
  }

  function selectScreen(id) { if (id !== screen) navigate(() => setScreen(id)); }
  function selectSection(id) { if (id !== section) navigate(() => setSection(id)); }

  function selectProject(id) {
    if (id === projectId || busy) return;
    navigate(() => changeProject(id));
  }

  function changeProject(id) {
    generation.current++;
    setLoading(true);
    setPermissions({});
    setSelectedId('');
    setNotice('');
    setProjectId(id);
  }

  function selectUnit(id) {
    if (id === unitId || busy) return;
    navigate(() => changeUnit(id));
  }

  function changeUnit(id) {
    generation.current++;
    setLoading(true);
    setPermissions({});
    setData(EMPTY);
    setProjectId('');
    setSelectedId('');
    setNotice('');
    setUnitId(id);
  }

  async function command(action, payload, revision = null) {
    if (loading || busy) return null;
    setBusy(true);
    setNotice('');
    try {
      if (previewMode) {
        const out = runWorkflowDemo(demoState.current, actor, action, { unit_id: unitId, project_id: projectId, ...payload }, revision);
        demoState.current = out.state; setData(workflowDemoData(out.state, actor, projectId));
        setNotice(action === 'task.transition' && payload.state === 'area_approved' ? 'Documento aceptado. Ya está disponible en Documentos.' : 'Cambio realizado en la demostración local.');
        return out.result;
      }
      const result = await rpc('workspace_command', { p_action: action, p_data: { unit_id: unitId, project_id: projectId, ...payload }, p_revision: revision });
      await load();
      setNotice(action === 'task.transition' && payload.state === 'area_approved' ? 'Documento aceptado. Ya está disponible en Documentos.' : 'Cambio guardado en Workspace.');
      return result;
    } catch (error) { setNotice(error.message); return null; }
    finally { setBusy(false); }
  }

  async function workApi(action, item, payload) {
    const mutation = action !== 'draft.get';
    if (mutation) setBusy(true);
    try {
      if (previewMode) {
        const out = runWorkflowDemo(demoState.current, actor, action, { ...payload, project_id: item.project_id, deliverable_id: item.id }, item.revision);
        demoState.current = out.state;
        if (mutation) setData(workflowDemoData(out.state, actor, projectId));
        return out.result;
      }
      if (action === 'draft.get') return await rpc('workspace_draft', { p_deliverable_id: item.id });
      if (action === 'draft.save') return await rpc('workspace_save_draft', { p_deliverable_id: item.id, p_data: payload.data, p_revision: payload.revision, p_base_version: payload.base_version });
      const result = await rpc('workspace_submit_draft', { p_deliverable_id: item.id, p_draft_revision: payload.draft_revision, p_task_revision: payload.task_revision });
      await load(); setNotice('Documento enviado a revisión. Esta versión ya está disponible para el responsable de tu área.');
      return result;
    } finally { if (mutation) setBusy(false); }
  }
  function pick(item, target) {
    const nextSection = target || (taskIsMine(item, userId) ? 'work' : canReviewTask(item, data.taskPermissions?.[item.id] || {}, data.areas.find(area => area.id === item.area_id)) ? 'reviews' : 'assignments');
    if (item.id === selectedId && section === nextSection && screen === 'editions') return;
    navigate(() => { if (item.project_id !== projectId) changeProject(item.project_id); setSelectedId(item.id); setSection(nextSection); setScreen('editions'); });
  }
  const areaPermissions = Object.values(data.areaPermissions || {});
  const canAssign = areaPermissions.some(item => item['task.assign']);
  const canReview = areaPermissions.some(item => Object.entries(item).some(([key, value]) => value && (key.startsWith('review.approve_') || ['review.request_changes', 'review.queue_qa', 'qa.approve', 'publication.approve_final', 'publication.execute'].includes(key)))) || data.tasks.some(item => canReviewTask(item, data.taskPermissions?.[item.id] || {}, data.areas.find(area => area.id === item.area_id)));
  const visibleSection = section === 'assignments' && !canAssign || section === 'reviews' && !canReview ? 'work' : section;
  const unitName = context?.units?.find(unit => unit.id === unitId)?.name || 'GBA';

  return <div className="gw gw-editions">
    <WorkspaceNavigation screen={screen} onScreenChange={selectScreen} context={context} unitName={unitName} name={previewMode ? actor.name : user?.nombre_publico || user?.nombre || 'GBA ID'} loading={loading || busy} onRefresh={() => navigate(() => void load())} previewMode={previewMode} blocked={Boolean(pendingNavigation)} />
    <main className="gw-main" aria-hidden={Boolean(pendingNavigation) || undefined}>
      {previewMode && <div className="gw-demo-flow"><span>Demostración local · prueba el flujo sin modificar datos reales.</span><label>Ver como<select value={demoActorKey} disabled={busy} onChange={event => { const next = event.target.value; navigate(() => { setDemoActorKey(next); setSection(next === 'lead' ? 'assignments' : 'work'); setSelectedId(''); setLoading(true); setData(EMPTY); setNotice(''); }); }}>{Object.entries(DEMO_ACTORS).map(([key, value]) => <option key={key} value={key}>{value.name}</option>)}</select></label></div>}
      {notice && <p className="gw-alert" role="alert">{notice}</p>}
      {screen === 'keynotes' && context?.keynotes_access ? <KeynotesWorkspace previewMode={previewMode} /> : screen === 'settings' ? <WorkspaceSettings context={context} data={data} permissions={permissions} command={command} busy={disabled || previewMode} loading={loading} unitId={unitId} projectId={projectId} onUnitChange={selectUnit} onProjectChange={selectProject} previewMode={previewMode} onNotice={setNotice} /> : <>
        {data.projects.length > 0 && <EditionTabs projects={data.projects} selectedId={projectId} onSelect={selectProject} busy={busy} />}
        {loading ? <p className="gw-loading" role="status">Abriendo edición…</p> : !context?.units?.length ? <div className="gw-empty"><h2>Tu equipo está por comenzar.</h2><p>Dirección debe incorporar tu GBA ID y asignarte permisos para una unidad. Una licencia de escritorio no concede acceso editorial.</p></div> : !project ? <div className="gw-empty"><h2>Todavía no hay ediciones disponibles.</h2><p>Las ediciones aparecerán aquí cuando tengas acceso a ellas.</p>{permissions['project.create'] && <button type="button" onClick={() => setScreen('settings')}>Ir a Configuración</button>}</div> : <section role="tabpanel" id="workspace-edition-panel" aria-labelledby={`workspace-edition-${projectId}`} tabIndex={0}>
          <EditionNavigation section={visibleSection} onSelect={selectSection} canAssign={canAssign} canReview={canReview} />
          {visibleSection === 'work' && <PersonalWork project={project} data={data} task={task} actorId={userId} command={command} api={workApi} previewMode={previewMode} busy={disabled} onPick={item => pick(item, 'work')} onDirtyChange={setHasDraft} onReference={() => selectSection('documents')} />}
          {visibleSection === 'assignments' && <AreaAssignments project={project} data={data} task={task} command={command} busy={disabled} onPick={item => pick(item, 'assignments')} />}
          {visibleSection === 'reviews' && <EditionReviews previewMode={previewMode} project={project} data={data} task={task} command={command} busy={disabled} onPick={item => pick(item, 'reviews')} />}
          {visibleSection === 'documents' && <EditionDocuments key={project.id} project={project} data={data} actorId={userId} onOpenTask={item => pick(item, 'work')} />}
          {visibleSection === 'calendar' && <EditionCalendar project={project} data={data} permissions={permissions} command={command} busy={disabled} onPick={pick} />}
        </section>}
      </>}
    </main>
    {pendingNavigation && <DraftExitDialog onStay={() => setPendingNavigation(null)} onDiscard={() => { const next = pendingNavigation; setPendingNavigation(null); setHasDraft(false); next(); }} />}
  </div>;
}
