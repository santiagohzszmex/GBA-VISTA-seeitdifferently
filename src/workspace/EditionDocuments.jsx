import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Search, BookOpen, ArrowUpRight } from 'lucide-react';
import { STATES, dateLabel } from './gimgModel';

export function DocumentContent({ content }) {
  return <div className="gw-document-content"><ReactMarkdown skipHtml>{content || ''}</ReactMarkdown></div>;
}

export default function EditionDocuments({ project, data, onOpenTask }) {
  const [selectedId, setSelectedId] = useState('brief');
  const [search, setSearch] = useState('');
  const tasks = data.tasks.filter(task => task.project_id === project.id);
  const latestVersions = useMemo(() => {
    const result = new Map();
    for (const version of data.versions) {
      const latest = result.get(version.deliverable_id);
      if (!latest || version.version_number > latest.version_number) result.set(version.deliverable_id, version);
    }
    return result;
  }, [data.versions]);
  const query = search.trim().toLocaleLowerCase('es');
  const visibleTasks = tasks.filter(task => `${task.title} ${task.description || ''}`.toLocaleLowerCase('es').includes(query));
  const selectedTask = tasks.find(task => task.id === selectedId);
  const version = selectedTask && latestVersions.get(selectedTask.id);
  const isBrief = !selectedTask;

  return <div className="gw-document-browser">
    <aside className="gw-file-sidebar" aria-label="Archivos de la edición">
      <div className="gw-file-heading"><h2>Documentos</h2><span>{tasks.length + 1}</span></div>
      <label className="gw-file-search"><Search size={15} aria-hidden="true" /><span className="gw-sr-only">Buscar documentos de esta edición</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar documento" /></label>
      <div className="gw-file-list">
        {(!query || 'concepto dirección creativa'.includes(query)) && <button type="button" className={isBrief ? 'gw-file-active' : ''} aria-current={isBrief ? 'true' : undefined} onClick={() => setSelectedId('brief')}><BookOpen size={17} aria-hidden="true" /><span><strong>Concepto y dirección</strong><small>Brief de la edición</small></span></button>}
        {visibleTasks.map(task => <button type="button" key={task.id} className={selectedId === task.id ? 'gw-file-active' : ''} aria-current={selectedId === task.id ? 'true' : undefined} onClick={() => setSelectedId(task.id)}><FileText size={17} aria-hidden="true" /><span><strong>{task.title}</strong><small>{data.areas.find(area => area.id === task.area_id)?.name || 'Entregable'} · {latestVersions.has(task.id) ? `v${latestVersions.get(task.id).version_number}` : 'Sin versión'}</small></span></button>)}
        {query && !visibleTasks.length && !'concepto dirección creativa'.includes(query) && <p className="gw-file-empty" role="status">Sin documentos para esta búsqueda.</p>}
      </div>
    </aside>
    <section className="gw-document-view" aria-label={isBrief ? 'Concepto y dirección' : selectedTask.title}>
      <div className="gw-document-toolbar"><span>{isBrief ? 'Dirección de la edición' : STATES[selectedTask.state]}</span>{!isBrief && <button type="button" onClick={() => onOpenTask(selectedTask)}>Abrir trabajo<ArrowUpRight size={15} aria-hidden="true" /></button>}</div>
      <article className="gw-document-paper">
        <p className="gw-eyebrow">{project.title}</p><h2>{isBrief ? 'Concepto y dirección' : selectedTask.title}</h2>
        {isBrief ? (project.brief ? <DocumentContent content={project.brief} /> : <p className="gw-document-empty">Dirección todavía no ha añadido el concepto de esta edición.</p>) : version ? <><p className="gw-document-meta">Versión {version.version_number} · {dateLabel(version.created_at)}</p><DocumentContent content={version.content_markdown} />{!version.content_markdown && <p className="gw-document-empty">Esta versión contiene un activo externo. Puedes consultarlo desde el trabajo, según tus permisos.</p>}{version.credits && <footer className="gw-document-credits"><h3>Créditos</h3><p>{version.credits}</p></footer>}</> : <><p>{selectedTask.description || 'Documento pendiente de primera entrega.'}</p><p className="gw-document-empty">Todavía no hay una versión registrada. Abre el trabajo para escribir o entregar contenido según tu asignación.</p></>}
      </article>
    </section>
  </div>;
}
