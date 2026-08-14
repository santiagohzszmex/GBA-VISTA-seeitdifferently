import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FilePlus2,
  Files,
  Globe2,
  Heading2,
  History,
  Italic,
  Link,
  List,
  Save,
  Search,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { DOCUMENT_STATUS, ROLE_RANK } from './workspaceData';

const STATUS_STYLES = {
  draft: 'bg-neutral-100 text-neutral-600',
  review: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  superseded: 'bg-violet-50 text-violet-700',
  archived: 'bg-neutral-200 text-neutral-500'
};

function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" title={label} aria-label={label} className={`ws-icon ${className}`} {...props}>{children}</button>;
}

function StatusBadge({ status }) {
  return <span className={`inline-flex h-6 items-center px-2 rounded text-[9px] font-black uppercase tracking-wider ${STATUS_STYLES[status] || STATUS_STYLES.draft}`}>{DOCUMENT_STATUS[status] || status}</span>;
}

export default function WorkspaceDocuments({
  access,
  collections,
  documents,
  selectedDocumentId,
  onSelectDocument,
  onCreateDocument,
  onSaveDocument,
  onLoadRevisions,
  onPublishKeynote,
  onUnpublishKeynote,
  keynotePublications = [],
  events = [],
  previewMode
}) {
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publicationForm, setPublicationForm] = useState({ summary: '', keynoteDate: '' });
  const editorRef = useRef(null);

  const selectedDocument = documents.find(document => document.id === selectedDocumentId) || null;
  const selectedCollection = collections.find(collection => collection.id === selectedCollectionId) || collections[0] || null;
  const canEditCollection = Boolean(access?.can_edit) && selectedCollection
    && ROLE_RANK[access.role] >= ROLE_RANK[selectedCollection.minimum_role];
  const canApprove = Boolean(access?.can_approve) && selectedCollection
    && ROLE_RANK[access.role] >= ROLE_RANK[selectedCollection.minimum_role];
  const isKeynotesCollection = selectedCollection?.slug === 'keynotes';
  const publication = keynotePublications.find(item => item.workspace_document_id === selectedDocument?.id) || null;

  useEffect(() => {
    if (!selectedCollectionId && collections[0]) setSelectedCollectionId(collections[0].id);
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    if (selectedDocument) {
      setDraft({ ...selectedDocument });
      setSelectedCollectionId(selectedDocument.collection_id);
      setHistoryOpen(false);
      setPublishOpen(false);
    } else {
      setDraft(null);
    }
  }, [selectedDocument]);

  const visibleDocuments = useMemo(() => documents
    .filter(document => document.collection_id === selectedCollection?.id)
    .filter(document => `${document.title} ${document.content_markdown}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)), [documents, search, selectedCollection]);

  const isDirty = Boolean(draft && selectedDocument && (
    draft.title !== selectedDocument.title
    || draft.content_markdown !== selectedDocument.content_markdown
    || draft.status !== selectedDocument.status
  ));

  const save = async changes => {
    if (!draft || !canEditCollection) return;
    setSaving(true);
    const nextDraft = { ...draft, ...changes };
    const saved = await onSaveDocument(nextDraft);
    if (saved) setDraft(saved);
    setSaving(false);
  };

  const openHistory = async () => {
    if (!selectedDocument) return;
    const data = await onLoadRevisions(selectedDocument.id);
    setRevisions(data || []);
    setHistoryOpen(true);
  };

  const openPublication = () => {
    if (!selectedDocument) return;
    const linkedEvent = events.find(event => event.event_type === 'keynote' && event.linked_document_id === selectedDocument.id);
    const fallbackDate = linkedEvent?.starts_at || selectedDocument.approved_at || selectedDocument.created_at || new Date().toISOString();
    setPublicationForm({
      summary: publication?.summary || '',
      keynoteDate: publication?.keynote_date || fallbackDate.slice(0, 10)
    });
    setPublishOpen(true);
  };

  const submitPublication = async event => {
    event.preventDefault();
    if (!draft || !onPublishKeynote) return;
    setPublishing(true);
    const result = await onPublishKeynote({
      documentId: draft.id,
      summary: publicationForm.summary.trim(),
      keynoteDate: publicationForm.keynoteDate
    });
    setPublishing(false);
    if (result) setPublishOpen(false);
  };

  const removePublication = async () => {
    if (!draft || !onUnpublishKeynote) return;
    setPublishing(true);
    const removed = await onUnpublishKeynote(draft.id);
    setPublishing(false);
    if (removed) setPublishOpen(false);
  };

  const insertSyntax = (prefix, suffix = prefix, placeholder = 'texto') => {
    const textarea = editorRef.current;
    if (!textarea || !draft) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content_markdown.slice(start, end) || placeholder;
    const content = `${draft.content_markdown.slice(0, start)}${prefix}${selected}${suffix}${draft.content_markdown.slice(end)}`;
    setDraft({ ...draft, content_markdown: content });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  };

  const exportMarkdown = () => {
    if (!draft) return;
    const blob = new Blob([`# ${draft.title}\n\n${draft.content_markdown}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'documento'}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-[calc(100vh-156px)] grid xl:grid-cols-[210px_300px_minmax(0,1fr)] border border-[#d9dce3] bg-white overflow-hidden rounded-md">
      <aside className="border-b xl:border-b-0 xl:border-r border-[#e2e4e9] bg-[#f7f8fa] p-3">
        <div className="px-2 py-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099]">Colecciones</p>
        </div>
        <div className="flex xl:block gap-2 overflow-x-auto pb-2 xl:pb-0">
          {collections.map(collection => {
            const count = documents.filter(document => document.collection_id === collection.id).length;
            return (
              <button key={collection.id} type="button" onClick={() => {
                setSelectedCollectionId(collection.id);
                const first = documents.find(document => document.collection_id === collection.id);
                onSelectDocument(first?.id || null);
              }} className={`min-w-40 xl:min-w-0 w-full flex items-center gap-3 px-3 py-3 rounded-md text-left transition-colors ${selectedCollection?.id === collection.id ? 'bg-white shadow-sm text-[#17191d]' : 'text-[#6f747d] hover:bg-white/70'}`}>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: collection.color }}/>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold truncate">{collection.name}</span><span className="block text-[9px] mt-0.5 text-[#9a9ea6]">{count} documentos</span></span>
              </button>
            );
          })}
        </div>
        {selectedCollection && <p className="hidden xl:block px-3 mt-5 text-[10px] leading-4 text-[#9a9ea6]">{selectedCollection.description}</p>}
      </aside>

      <section className="border-b xl:border-b-0 xl:border-r border-[#e2e4e9] min-w-0">
        <div className="h-16 border-b border-[#e2e4e9] px-4 flex items-center gap-2">
          <label className="relative flex-1"><Search size={14} className="absolute left-3 top-3 text-[#a0a4ac]"/><input value={search} onChange={event => setSearch(event.target.value)} className="ws-input pl-9" placeholder="Buscar"/></label>
          {canEditCollection && <IconButton label="Nuevo documento" onClick={() => onCreateDocument(selectedCollection.id)}><FilePlus2 size={16}/></IconButton>}
        </div>
        <div className="max-h-72 xl:max-h-[calc(100vh-222px)] overflow-y-auto divide-y divide-[#eceef2]">
          {visibleDocuments.map(document => (
            <button key={document.id} type="button" onClick={() => onSelectDocument(document.id)} className={`w-full p-4 text-left border-l-2 transition-colors ${document.id === selectedDocumentId ? 'border-[#2563eb] bg-[#f6f8fc]' : 'border-transparent hover:bg-[#fafafa]'}`}>
              <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-bold text-[#24272c] leading-5 line-clamp-2">{document.title}</h3><StatusBadge status={document.status}/></div>
              <div className="flex items-center gap-2 mt-3 text-[9px] text-[#9a9ea6]"><Clock3 size={11}/><span>{new Date(document.updated_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span><span>·</span><span>v{document.version}</span></div>
            </button>
          ))}
          {!visibleDocuments.length && <div className="py-14 px-6 text-center"><Files size={22} className="mx-auto text-[#c2c5cb]"/><p className="text-xs font-bold text-[#6f747d] mt-3">Colección vacía</p><p className="text-[10px] text-[#a0a4ac] mt-1">Crea el primer documento cuando exista contenido real.</p></div>}
        </div>
      </section>

      <section className="min-w-0 flex flex-col bg-white">
        {draft ? (
          <>
            <header className="min-h-16 border-b border-[#e2e4e9] px-4 md:px-6 py-3 flex flex-wrap items-center gap-3">
              <input value={draft.title} disabled={!canEditCollection} onChange={event => setDraft({ ...draft, title: event.target.value })} className="min-w-48 flex-1 bg-transparent text-base font-bold outline-none disabled:text-[#24272c]" aria-label="Título del documento"/>
              <StatusBadge status={draft.status}/>
              {previewMode && <span className="text-[8px] font-black uppercase tracking-widest text-[#2563eb]">Vista demo</span>}
              {publication?.is_published && <span className="inline-flex h-6 items-center gap-1 px-2 rounded bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider"><Globe2 size={11}/>Publicada</span>}
              <div className="flex items-center gap-2 ml-auto">
                <IconButton label="Historial de revisiones" onClick={openHistory}><History size={16}/></IconButton>
                <IconButton label="Exportar Markdown" onClick={exportMarkdown}><Download size={16}/></IconButton>
                {isKeynotesCollection && canApprove && publication?.is_published && <IconButton label="Abrir Keynote pública" onClick={() => window.open(`/?keynote=${encodeURIComponent(publication.slug)}`, '_blank', 'noopener,noreferrer')}><ExternalLink size={16}/></IconButton>}
                {isKeynotesCollection && canApprove && <button type="button" onClick={openPublication} disabled={draft.status !== 'approved' || isDirty} title={draft.status !== 'approved' ? 'Aprueba el documento antes de publicarlo' : isDirty ? 'Guarda los cambios antes de publicarlo' : publication?.is_published ? 'Actualizar Keynote pública' : 'Publicar Keynote'} className="ws-secondary disabled:opacity-40"><Globe2 size={14}/>{publication?.is_published ? 'Actualizar en VISTA' : 'Publicar en VISTA'}</button>}
                {canEditCollection && <button type="button" onClick={() => save()} disabled={!isDirty || saving} className="ws-primary"><Save size={14}/>{saving ? 'Guardando' : 'Guardar'}</button>}
              </div>
            </header>

            {canEditCollection && (
              <div className="min-h-12 border-b border-[#e2e4e9] px-4 md:px-6 flex flex-wrap items-center gap-1 py-1.5">
                <IconButton label="Encabezado" onClick={() => insertSyntax('## ', '', 'Título')}><Heading2 size={16}/></IconButton>
                <IconButton label="Negrita" onClick={() => insertSyntax('**')}><Bold size={16}/></IconButton>
                <IconButton label="Cursiva" onClick={() => insertSyntax('_')}><Italic size={16}/></IconButton>
                <IconButton label="Lista" onClick={() => insertSyntax('- ', '', 'Elemento')}><List size={16}/></IconButton>
                <IconButton label="Enlace" onClick={() => insertSyntax('[', '](https://)', 'texto')}><Link size={16}/></IconButton>
                <span className="w-px h-6 bg-[#e2e4e9] mx-2"/>
                <select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })} className="ws-select h-9" aria-label="Estado del documento">
                  <option value="draft">Borrador</option>
                  <option value="review">En revisión</option>
                  {canApprove && <option value="approved">Aprobado</option>}
                  {canApprove && <option value="superseded">Sustituido</option>}
                  <option value="archived">Archivado</option>
                </select>
                {draft.status === 'draft' && <button type="button" onClick={() => save({ status: 'review' })} className="ws-secondary ml-auto"><Send size={14}/>Enviar a revisión</button>}
                {draft.status === 'review' && canApprove && <button type="button" onClick={() => save({ status: 'approved', approved_at: new Date().toISOString() })} className="ws-secondary ml-auto text-emerald-700"><CheckCircle2 size={14}/>Aprobar</button>}
              </div>
            )}

            <div className="relative flex-1 min-h-[500px]">
              <textarea ref={editorRef} value={draft.content_markdown} readOnly={!canEditCollection} onChange={event => setDraft({ ...draft, content_markdown: event.target.value })} className="absolute inset-0 w-full h-full resize-none border-0 outline-none px-6 md:px-10 py-8 text-sm leading-7 text-[#31343a] font-mono bg-white read-only:font-sans" spellCheck="true" aria-label="Contenido Markdown"/>
            </div>
            <footer className="h-10 border-t border-[#e2e4e9] px-6 flex items-center justify-between text-[9px] text-[#a0a4ac]"><span>Markdown · {draft.content_markdown.trim() ? draft.content_markdown.trim().split(/\s+/).length : 0} palabras</span><span>{isDirty ? 'Cambios sin guardar' : `Revisión ${draft.version}`}</span></footer>
          </>
        ) : (
          <div className="min-h-[520px] flex flex-col items-center justify-center text-center px-8"><Files size={30} className="text-[#c7cad0]"/><h3 className="font-bold mt-4">Selecciona un documento</h3><p className="text-xs text-[#8b9099] mt-2 max-w-sm">Abre un registro existente o crea uno dentro de la colección seleccionada.</p></div>
        )}

        {historyOpen && (
          <div className="absolute md:fixed right-4 md:right-8 top-24 bottom-24 w-[calc(100%-2rem)] md:w-96 bg-white border border-[#d9dce3] shadow-2xl z-[1200] rounded-md overflow-hidden">
            <div className="h-14 px-4 border-b border-[#e2e4e9] flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-widest">Historial</p><p className="text-[9px] text-[#8b9099] mt-0.5">Las revisiones aprobadas no se sobrescriben</p></div><IconButton label="Cerrar historial" onClick={() => setHistoryOpen(false)}><X size={16}/></IconButton></div>
            <div className="overflow-y-auto h-[calc(100%-56px)] divide-y divide-[#eceef2]">
              {revisions.map(revision => <button key={revision.id} type="button" onClick={() => { setDraft({ ...draft, title: revision.title, content_markdown: revision.content_markdown, status: 'draft' }); setHistoryOpen(false); }} className="w-full p-4 text-left hover:bg-[#f7f8fa]"><div className="flex justify-between gap-3"><span className="text-xs font-bold">Revisión {revision.revision_number}</span><StatusBadge status={revision.status}/></div><p className="text-[10px] text-[#8b9099] mt-2">{new Date(revision.created_at).toLocaleString('es-MX')}</p><p className="text-[10px] leading-4 text-[#6f747d] mt-3 line-clamp-3">{revision.content_markdown || 'Documento vacío'}</p></button>)}
              {!revisions.length && <p className="text-xs text-[#8b9099] text-center py-12">Sin revisiones disponibles.</p>}
            </div>
          </div>
        )}

        {publishOpen && draft && (
          <div className="fixed inset-0 z-[1400] bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={submitPublication} className="w-full max-w-xl bg-white border border-[#d9dce3] rounded-md shadow-2xl overflow-hidden">
              <header className="min-h-16 px-5 border-b border-[#e2e4e9] flex items-center justify-between gap-4">
                <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#2563eb]">GBA Keynote</p><h3 className="font-bold mt-1">{publication?.is_published ? 'Actualizar publicación' : 'Publicar en VISTA'}</h3></div>
                <IconButton label="Cerrar" onClick={() => setPublishOpen(false)}><X size={16}/></IconButton>
              </header>
              <div className="p-5 space-y-5">
                <div className="p-4 bg-[#f7f8fa] border border-[#e2e4e9] rounded-md"><p className="text-[9px] font-black uppercase tracking-wider text-[#8b9099]">Documento aprobado</p><p className="font-serif italic text-xl mt-2">{draft.title}</p><p className="text-[10px] text-[#8b9099] mt-2">La publicación guardará una copia de esta revisión.</p></div>
                <label><span className="ws-label">Fecha de la Keynote</span><input required type="date" value={publicationForm.keynoteDate} onChange={event => setPublicationForm(current => ({ ...current, keynoteDate: event.target.value }))} className="ws-input"/></label>
                <label><span className="ws-label">Resumen público</span><textarea required minLength="20" maxLength="600" rows="5" value={publicationForm.summary} onChange={event => setPublicationForm(current => ({ ...current, summary: event.target.value }))} className="ws-input resize-none" placeholder="Explica brevemente qué se presentó en esta Keynote."/><span className="block text-right text-[9px] text-[#9a9ea6] mt-1">{publicationForm.summary.length}/600</span></label>
              </div>
              <footer className="p-4 bg-[#f7f8fa] border-t border-[#e2e4e9] flex flex-wrap items-center justify-end gap-2">
                {publication?.is_published && <button type="button" onClick={removePublication} disabled={publishing} className="h-10 px-3 mr-auto rounded-md text-red-600 inline-flex items-center gap-2 text-[10px] font-bold hover:bg-red-50"><Trash2 size={14}/>Retirar</button>}
                <button type="button" onClick={() => setPublishOpen(false)} className="ws-secondary">Cancelar</button>
                <button type="submit" disabled={publishing || publicationForm.summary.trim().length < 20} className="ws-primary"><Globe2 size={14}/>{publishing ? 'Publicando' : publication?.is_published ? 'Actualizar' : 'Publicar'}</button>
              </footer>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
