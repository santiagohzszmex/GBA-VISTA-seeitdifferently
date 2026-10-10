import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FileText, Search, BookOpen } from 'lucide-react';
import StructuredDocument from './StructuredDocument';
import { dateLabel } from './gimgModel';
import { taskIsMine } from './documentModel';
export function DocumentContent({ content }) { return <div className="gw-document-content"><ReactMarkdown skipHtml>{content || ''}</ReactMarkdown></div>; }
export default function EditionDocuments({ project, data, actorId, onOpenTask }) {
  const [selectedId, setSelectedId] = useState('brief');
  const [search, setSearch] = useState('');
  const documents = data.approvedDocuments || [];
  const query = search.trim().toLocaleLowerCase('es');
  const visible = documents.filter(document => `${document.title} ${document.area_name}`.toLocaleLowerCase('es').includes(query));
  const selected = documents.find(document => document.version_id === selectedId);
  const ownTask = selected && data.tasks.find(task => task.id === selected.deliverable_id && taskIsMine(task, actorId));
  const isBrief = !selected;
  return <div className="gw-document-browser"><h1 className="gw-sr-only">Documentos de {project.title}</h1>
    <aside className="gw-file-sidebar" aria-label="Documentos disponibles para la edición"><div className="gw-file-heading"><h2>Documentos</h2><span>{documents.length + 1}</span></div>
      <label className="gw-file-search"><Search size={15} aria-hidden="true" /><span className="gw-sr-only">Buscar documentos de esta edición</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar documento" /></label>
      <p className="gw-library-label">Referencias</p><div className="gw-file-list">{(!query || 'concepto dirección creativa'.includes(query)) && <button type="button" className={isBrief ? 'gw-file-active' : ''} aria-current={isBrief ? 'true' : undefined} onClick={() => setSelectedId('brief')}><BookOpen size={17} aria-hidden="true" /><span><strong>Concepto y dirección</strong><small>Referencia de la edición</small></span></button>}</div>
      <p className="gw-library-label">Documentos aceptados</p><div className="gw-file-list">{visible.map(document => <button type="button" key={document.version_id} className={selectedId === document.version_id ? 'gw-file-active' : ''} aria-current={selectedId === document.version_id ? 'true' : undefined} onClick={() => setSelectedId(document.version_id)}><FileText size={17} aria-hidden="true" /><span><strong>{document.title}</strong><small>{document.area_name} · Aceptado · v{document.version_number}</small></span></button>)}{!visible.length && <p className="gw-file-empty">{query ? 'Sin resultados.' : 'Aquí aparecerán las versiones que acepte el responsable del área.'}</p>}</div>
    </aside>
    <section className="gw-document-view" aria-label={isBrief ? 'Concepto y dirección' : selected.title}><div className="gw-document-toolbar"><span>{isBrief ? 'Referencia para trabajar' : 'Versión aceptada para consulta'}</span>{ownTask && <button type="button" onClick={() => onOpenTask(ownTask)}>Ir a mi trabajo</button>}</div>
      <article className="gw-document-paper"><p className="gw-eyebrow">{project.title}</p><h2>{isBrief ? 'Concepto y dirección' : selected.title}</h2>
        {isBrief ? project.brief ? <DocumentContent content={project.brief} /> : <p className="gw-document-empty">Dirección todavía no ha añadido el concepto de esta edición.</p> : <><p className="gw-document-meta">{selected.area_name} · Versión {selected.version_number} · {selected.imported ? 'Registro histórico' : dateLabel(selected.approved_at)}</p>{selected.content_document ? <StructuredDocument document={selected.content_document} /> : <DocumentContent content={selected.content_markdown} />}{selected.credits && <footer className="gw-document-credits"><h3>Créditos</h3><p>{selected.credits}</p></footer>}</>}
      </article>
    </section>
  </div>;
}
