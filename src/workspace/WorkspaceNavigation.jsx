import React, { useRef } from 'react';
import { BookOpen, Layers, Settings, RefreshCw, Archive, Search, ChevronRight, PanelLeftOpen, PanelLeftClose, PenLine, ClipboardList, CheckCheck, FileText, Users, CalendarDays } from 'lucide-react';
import workspaceIcon from '../../src-tauri/icons/64x64.png';
import { hueOf } from './workView';

export const EDITION_SECTIONS = { work: 'Mi trabajo', assignments: 'Asignaciones', reviews: 'Revisión', documents: 'Documentos', team: 'Equipo', calendar: 'Calendario' };
export const SECTION_ICONS = { work: PenLine, assignments: ClipboardList, reviews: CheckCheck, documents: FileText, team: Users, calendar: CalendarDays };
export const SHORTCUT_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '') ? '⌘' : 'Ctrl+';

// Secciones visibles para la persona, en el orden de la barra. Los atajos ⌘1…⌘6 siguen este orden.
export function editionSections({ canAssign, canReview, canWork, canTeam = false }) {
  return Object.keys(EDITION_SECTIONS).filter(id => (id !== 'work' || canWork) && (id !== 'assignments' || canAssign) && (id !== 'reviews' || canReview) && (id !== 'team' || canTeam));
}

// 1.7.2: marco con barra lateral (marca, buscador, menú y ediciones) y barra superior
// con la ruta actual y la cuenta. Los avisos siguen abriéndose desde la esquina superior derecha.
export function WorkspaceNavigation({ screen, onScreenChange, context, unitName, name, role, loading, onRefresh, previewMode, blocked, notifications, closedCount = 0, editions = null, crumbs = [], onSearch, collapsed = false, onToggleSidebar }) {
  return <>
    <aside className="gw-sidebar" data-collapsed={collapsed || undefined} aria-hidden={blocked || undefined}>
      <div className="gw-brand"><img src={workspaceIcon} width="32" height="32" alt="" /><strong>Workspace</strong><span>{unitName}</span></div>
      {onSearch && <button type="button" className="gw-search-trigger" title={`Buscar o ir a… (${SHORTCUT_KEY}K)`} onClick={onSearch} aria-keyshortcuts={SHORTCUT_KEY === '⌘' ? 'Meta+K' : 'Control+K'}><Search size={15} aria-hidden="true" /><span>Buscar o ir a…</span><kbd>{SHORTCUT_KEY}K</kbd></button>}
      <nav className="gw-global-nav" aria-label="Menú general">
        <button type="button" data-nav="editions" aria-current={screen === 'editions' ? 'page' : undefined} title="Ediciones" onClick={() => onScreenChange('editions')}><Layers size={16} aria-hidden="true" /><span className="gw-nav-label">Ediciones</span></button>
        <button type="button" data-nav="closed" aria-current={screen === 'closed' ? 'page' : undefined} title="Ediciones cerradas" onClick={() => onScreenChange('closed')}><Archive size={16} aria-hidden="true"/><span className="gw-nav-label">Cerradas</span>{closedCount>0 && <small>{closedCount}</small>}</button>
        {context?.keynotes_access && <button type="button" data-nav="keynotes" aria-current={screen === 'keynotes' ? 'page' : undefined} title="Keynotes" onClick={() => onScreenChange('keynotes')}><BookOpen size={16} aria-hidden="true" /><span className="gw-nav-label">Keynotes</span></button>}
      </nav>
      {editions}
      <button type="button" className="gw-sidebar-settings" aria-label="Configuración" title="Configuración" aria-current={screen === 'settings' ? 'page' : undefined} onClick={() => onScreenChange('settings')}><Settings size={16} aria-hidden="true" /><span className="gw-nav-label">Configuración</span></button>
      {onToggleSidebar && <button type="button" className="gw-sidebar-toggle" aria-label={collapsed ? 'Mostrar barra lateral completa' : 'Compactar barra lateral'} title={collapsed ? 'Mostrar barra lateral completa' : 'Compactar barra lateral'} aria-pressed={collapsed} onClick={onToggleSidebar}>{collapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}<span className="gw-nav-label">Compactar</span></button>}
    </aside>
    <header className="gw-topbar" aria-hidden={blocked || undefined}>
      <nav className="gw-crumbs" aria-label="Ubicación">{crumbs.filter(Boolean).map((crumb, index, list) => <React.Fragment key={index}>{index > 0 && <ChevronRight size={14} aria-hidden="true" />}<span aria-current={index === list.length - 1 ? 'location' : undefined}>{crumb}</span></React.Fragment>)}</nav>
      <div className="gw-account">
        <span className="gw-account-name"><strong>{name}</strong>{role && <small>{role}</small>}</span>{notifications}
        <button type="button" className="gw-refresh" aria-label="Actualizar Workspace" title="Actualizar Workspace" disabled={loading} onClick={onRefresh}><RefreshCw size={16} aria-hidden="true" /></button>
      </div>
    </header>
  </>;
}

export function EditionTabs({ projects, selectedId, onSelect, busy, closed = false }) {
  const buttons = useRef([]);
  const selectedIndex = Math.max(0, projects.findIndex(project => project.id === selectedId));

  function move(event, index) {
    let next;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % projects.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + projects.length) % projects.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = projects.length - 1;
    else return;
    event.preventDefault();
    buttons.current[next]?.focus();
    onSelect(projects[next].id);
  }

  return <div className="gw-edition-strip">
    <span className="gw-edition-label">{closed ? 'Cerradas' : 'Ediciones'}</span>
    <div className="gw-edition-tabs" role="tablist" aria-orientation="vertical" aria-label={closed ? 'Ediciones cerradas' : 'Ediciones de trabajo'}>
      {projects.map((project, index) => <button
        type="button" role="tab" key={project.id} id={`workspace-edition-${project.id}`}
        aria-selected={project.id === selectedId} aria-controls="workspace-edition-panel"
        tabIndex={index === selectedIndex ? 0 : -1} disabled={busy}
        ref={element => { buttons.current[index] = element; }}
        title={project.title} onKeyDown={event => move(event, index)} onClick={() => onSelect(project.id)}
      ><i className="gw-edition-dot" data-hue={hueOf(project.id)} aria-hidden="true">{project.title.trim().charAt(0)}</i><span>{project.title}</span>{project.status === 'archived' && <small>Archivada</small>}</button>)}
    </div>
  </div>;
}

// counts: { [sección]: { value, label, tone } } — sólo resume datos que la persona ya puede ver.
export function EditionNavigation({ section, onSelect, canAssign, canReview, canWork, canTeam = false, counts = {} }) {
  return <nav className="gw-section-nav" aria-label="Trabajo de la edición">
    {editionSections({ canAssign, canReview, canWork, canTeam }).map((id, index) => {
      const Icon = SECTION_ICONS[id], count = counts[id];
      return <button type="button" key={id} data-section={id} aria-current={section === id ? 'page' : undefined} title={`${EDITION_SECTIONS[id]} · ${SHORTCUT_KEY}${index + 1}`} onClick={() => onSelect(id)}>
        <Icon size={16} aria-hidden="true" />{EDITION_SECTIONS[id]}
        {count?.value > 0 && <span className="gw-section-count" data-tone={count.tone || undefined}><span aria-hidden="true">{count.value}</span><span className="gw-sr-only">, {count.value} {count.label}</span></span>}
      </button>;
    })}
  </nav>;
}
