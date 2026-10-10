import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import KeynotesWorkspace from '../workspace/KeynotesWorkspace';
import EditionDocuments from '../workspace/EditionDocuments';
import { EditionCalendar, EditionDay, EditionDeliverables } from '../workspace/EditionWork';
import WorkspaceSettings from '../workspace/WorkspaceSettings';
import DraftExitDialog from '../workspace/DraftExitDialog';
import { WorkspaceNavigation, EditionTabs, EditionNavigation } from '../workspace/WorkspaceNavigation';
import { WORKSPACE_DEMO } from '../workspace/workspaceDemo';
import { rpc } from '../workspace/ui';
import '../workspace/workspace.css';

const EMPTY = { projects: [], areas: [], tasks: [], members: [], events: [], audit: [], versions: [], comments: [], assignments: [], grants: [], delegations: [] };
const TABLES = { projects: 'workspace_projects', areas: 'workspace_areas', tasks: 'workspace_deliverables', events: 'workspace_events', audit: 'workspace_audit', assignments: 'workspace_assignments', grants: 'workspace_access_grants', delegations: 'workspace_delegations' };

export default function Workspace({ previewMode = false }) {
  const { user } = useAuth();
  const [screen, setScreen] = useState('editions');
  const [section, setSection] = useState('documents');
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
  const [lastVisit] = useState(() => Number(localStorage.getItem('gba-workspace-last-visit') || 0));
  const generation = useRef(0);
  const userId = previewMode ? 'demo-user' : user?.id;
  const project = data.projects.find(item => item.id === projectId);
  const task = data.tasks.find(item => item.id === selectedId && item.project_id === projectId);
  const disabled = busy || loading || previewMode;

  async function load() {
    const seq = ++generation.current;
    setLoading(true);
    try {
      if (previewMode) {
        const id = WORKSPACE_DEMO.projects.find(item => item.id === projectId)?.id || WORKSPACE_DEMO.projects[0].id;
        setContext({ units: [{ id: 'gimg-demo', name: 'GIMG' }], platform_owner: true, keynotes_access: true });
        setUnitId('gimg-demo');
        setProjectId(id);
        setData(WORKSPACE_DEMO);
        setSelectedId(current => WORKSPACE_DEMO.tasks.some(item => item.id === current && item.project_id === id) ? current : WORKSPACE_DEMO.tasks.find(item => item.project_id === id)?.id || '');
        setPermissions(new Proxy({}, { get: () => true }));
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
      const [unitPerm, projectPerm, directoryPerm] = await Promise.all([
        rpc('workspace_permissions', { p_unit: unit }),
        rpc('workspace_permissions', { p_unit: unit, p_project: id || null }),
        rpc('workspace_permissions', { p_unit: unit, p_project: id || null, p_area: area, p_deliverable: contextualTask?.id || null })
      ]);
      if (seq !== generation.current) return;
      const perm = { ...projectPerm, 'unit.members.read': Boolean(directoryPerm['unit.members.read']) };
      for (const [key, value] of Object.entries(unitPerm)) if ((key.startsWith('unit.') && key !== 'unit.members.read') || key === 'project.create') perm[key] = value;
      next.members = directoryPerm['unit.members.read'] ? await rpc('workspace_directory', { p_unit: unit, p_project: id || null, p_area: area, p_deliverable: contextualTask?.id || null }) : [];
      const ids = next.tasks.map(item => item.id);
      const contents = await Promise.all([['versions', 'workspace_versions'], ['comments', 'workspace_comments']].map(async ([key, table]) => {
        if (!ids.length) return [key, []];
        const { data: rows, error } = await supabase.from(table).select('*').in('deliverable_id', ids).order('created_at', { ascending: false });
        if (error) throw error;
        return [key, rows || []];
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
    if (previewMode || loading || busy) return null;
    setBusy(true);
    setNotice('');
    try {
      const result = await rpc('workspace_command', { p_action: action, p_data: { unit_id: unitId, project_id: projectId, ...payload }, p_revision: revision });
      await load();
      setNotice('Cambio guardado en Workspace.');
      return result;
    } catch (error) { setNotice(error.message); return null; }
    finally { setBusy(false); }
  }

  function pick(item) {
    if (item.id === selectedId && section === 'tasks' && screen === 'editions') return;
    navigate(() => {
      if (item.project_id !== projectId) changeProject(item.project_id);
      setSelectedId(item.id); setSection('tasks'); setScreen('editions');
    });
  }
  const unitName = context?.units?.find(unit => unit.id === unitId)?.name || 'GBA';

  return <div className="gw gw-editions">
    <WorkspaceNavigation screen={screen} onScreenChange={selectScreen} context={context} unitName={unitName} name={previewMode ? 'Demostración' : user?.nombre_publico || user?.nombre || 'GBA ID'} loading={loading || busy} onRefresh={() => navigate(() => void load())} previewMode={previewMode} blocked={Boolean(pendingNavigation)} />
    <main className="gw-main" aria-hidden={Boolean(pendingNavigation) || undefined}>
      {previewMode && <p className="gw-preview-note">Demostración local · los ejemplos no modifican datos reales.</p>}
      {notice && <p className="gw-alert" role="alert">{notice}</p>}
      {screen === 'keynotes' && (previewMode || context?.keynotes_access) ? <KeynotesWorkspace previewMode={previewMode} /> : screen === 'settings' ? <WorkspaceSettings context={context} data={data} permissions={permissions} command={command} busy={disabled} loading={loading} unitId={unitId} projectId={projectId} onUnitChange={selectUnit} onProjectChange={selectProject} previewMode={previewMode} onNotice={setNotice} /> : <>
        {data.projects.length > 0 && <EditionTabs projects={data.projects} selectedId={projectId} onSelect={selectProject} busy={busy} />}
        {loading ? <p className="gw-loading" role="status">Abriendo edición…</p> : !context?.units?.length ? <div className="gw-empty"><h2>Tu equipo está por comenzar.</h2><p>Dirección debe incorporar tu GBA ID y asignarte permisos para una unidad. Una licencia de escritorio no concede acceso editorial.</p></div> : !project ? <div className="gw-empty"><h2>Todavía no hay ediciones disponibles.</h2><p>Las ediciones aparecerán aquí cuando tengas acceso a ellas.</p>{permissions['project.create'] && <button type="button" onClick={() => setScreen('settings')}>Ir a Configuración</button>}</div> : <section role="tabpanel" id="workspace-edition-panel" aria-labelledby={`workspace-edition-${projectId}`} tabIndex={0}>
          <EditionNavigation section={section} onSelect={selectSection} />
          {section === 'documents' && <EditionDocuments key={project.id} project={project} data={data} onOpenTask={pick} />}
          {section === 'tasks' && <EditionDeliverables project={project} data={data} task={task} permissions={permissions} command={command} busy={disabled} onPick={pick} previewMode={previewMode} onDirtyChange={setHasDraft} />}
          {section === 'calendar' && <EditionCalendar project={project} data={data} permissions={permissions} command={command} busy={disabled} onPick={pick} />}
          {section === 'home' && <EditionDay project={project} data={data} userId={userId} lastVisit={lastVisit} onPick={pick} />}
        </section>}
      </>}
    </main>
    {pendingNavigation && <DraftExitDialog onStay={() => setPendingNavigation(null)} onDiscard={() => { const next = pendingNavigation; setPendingNavigation(null); setHasDraft(false); next(); }} />}
  </div>;
}
