import React, { useState } from 'react';
import LicensePanel from './LicensePanel';
import TeamPanel from './TeamPanel';
import { Activity, CommandForm, rpc } from './ui';
import { dateLabel } from './gimgModel';

export default function WorkspaceSettings({ context, data, permissions, command, busy, loading, unitId, projectId, onUnitChange, onProjectChange, previewMode, onNotice }) {
  const [section, setSection] = useState('general');
  const sections = { general: 'General' };
  if (permissions['unit.members.read']) sections.team = 'Integrantes y permisos';
  if (permissions['project.create'] || permissions['project.update']) sections.projects = 'Administrar ediciones';
  if (permissions['audit.read_scoped'] || permissions['audit.export_full']) sections.audit = 'Actividad';
  if (context?.platform_owner) sections.licenses = 'Licencias';
  const currentSection = sections[section] ? section : 'general';
  const project = data.projects.find(item => item.id === projectId);

  async function exportAudit() {
    try {
      const result = await rpc('workspace_export_audit', { p_unit: unitId });
      const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'auditoria-workspace.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { onNotice(error.message); }
  }

  return <section className="gw-settings">
    <div className="gw-page-heading"><p className="gw-eyebrow">Workspace</p><h1>Configuración</h1><p>Administración del espacio, accesos y ediciones.</p></div>
    <div className="gw-settings-layout">
      <nav className="gw-settings-nav" aria-label="Configuración de Workspace">{Object.entries(sections).map(([id, label]) => <button type="button" key={id} aria-current={currentSection === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>)}</nav>
      <div className="gw-settings-content">
        {loading ? <p role="status">Cargando configuración…</p> : <>
        {currentSection === 'general' && <><h2>Espacio de trabajo</h2><label>Unidad activa<select value={unitId} disabled={busy || !context?.units?.length} onChange={event => onUnitChange(event.target.value)}>{context?.units?.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><p>Cada edición conserva sus propios documentos, entregables y calendario.</p><p>Los controles disponibles dependen de tu asignación en GIMG. La administración de GBA y los permisos editoriales se gestionan por separado.</p></>}
        {['team', 'projects'].includes(currentSection) && data.projects.length > 0 && <label className="gw-settings-project">Edición para administrar<select value={projectId} disabled={busy} onChange={event => onProjectChange(event.target.value)}>{data.projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
        {currentSection === 'team' && <TeamPanel data={data} permissions={permissions} command={command} busy={busy} unitId={unitId} projectId={projectId} />}
        {currentSection === 'projects' && <><h2>Administrar ediciones</h2>{permissions['project.create'] && <details className="gw-disclosure"><summary>Crear edición</summary><CommandForm busy={busy} button="Crear edición" fields={{ title: 'Nombre de la edición', brief: { label: 'Concepto y dirección', type: 'textarea', optional: true }, starts_at: { label: 'Inicio', type: 'datetime-local', optional: true }, ends_at: { label: 'Cierre', type: 'datetime-local', optional: true } }} onSave={values => command('project.create', values)} /></details>}
          {project && permissions['project.update'] && <CommandForm key={project.id + project.revision} initial={project} busy={busy} button="Guardar edición" fields={{ title: 'Nombre', brief: { label: 'Concepto y dirección', type: 'textarea', optional: true }, status: { label: 'Estado', options: { planned: 'Planeada', active: 'Activa', closed: 'Cerrada', ...(permissions['project.archive'] ? { archived: 'Archivada' } : {}) } }, starts_at: { label: 'Inicio', type: 'datetime-local', optional: true }, ends_at: { label: 'Cierre', type: 'datetime-local', optional: true } }} onSave={values => command('project.save', values, project.revision)} />}
          <div className="gw-list">{data.projects.map(item => <article key={item.id}><h3>{item.title}</h3><p>{dateLabel(item.starts_at)} → {dateLabel(item.ends_at)}</p><button type="button" disabled={busy} onClick={() => onProjectChange(item.id)}>Seleccionar edición</button></article>)}</div>
        </>}
        {currentSection === 'audit' && <><h2>Actividad de Workspace</h2>{permissions['audit.export_full'] && <button type="button" disabled={busy} onClick={() => void exportAudit()}>Exportar auditoría completa</button>}<p>Últimas 200 acciones visibles según tu alcance.</p><Activity rows={data.audit} /></>}
        {currentSection === 'licenses' && context?.platform_owner && <LicensePanel previewMode={previewMode} />}
        </>}
      </div>
    </div>
  </section>;
}
