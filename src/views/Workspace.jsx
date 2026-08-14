import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Check,
  AlertCircle,
  Database,
  PanelsTopLeft,
  RefreshCw,
  ShieldCheck,
  Users,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import WorkspaceDocuments from '../workspace/WorkspaceDocuments';
import WorkspaceCalendar from '../workspace/WorkspaceCalendar';
import WorkspaceMembers from '../workspace/WorkspaceMembers';
import {
  DEMO_ACCESS,
  DEMO_COLLECTIONS,
  DEMO_DOCUMENTS,
  DEMO_EVENTS,
  DEMO_MEMBERS,
  DEMO_REVISIONS,
  ROLE_LABELS
} from '../workspace/workspaceData';

const AREAS = [
  { id: 'documents', label: 'Documentos', icon: BookOpen },
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'members', label: 'Equipo', icon: Users }
];

export default function Workspace({ previewMode = false }) {
  const { user } = useAuth();
  const [activeArea, setActiveArea] = useState('documents');
  const [access, setAccess] = useState(previewMode ? DEMO_ACCESS : null);
  const [collections, setCollections] = useState(previewMode ? DEMO_COLLECTIONS : []);
  const [documents, setDocuments] = useState(previewMode ? DEMO_DOCUMENTS : []);
  const [events, setEvents] = useState(previewMode ? DEMO_EVENTS : []);
  const [members, setMembers] = useState(previewMode ? DEMO_MEMBERS : []);
  const [keynotePublications, setKeynotePublications] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState(previewMode ? DEMO_DOCUMENTS[0].id : null);
  const [loading, setLoading] = useState(!previewMode);
  const [notice, setNotice] = useState(previewMode ? { type: 'info', message: 'Vista de demostración local. Ningún cambio afecta datos reales.' } : null);

  const canAccess = Boolean(access?.can_access);
  const currentName = previewMode ? 'Santiago Hernandez' : (user?.nombre_publico || user?.nombre || 'GBA ID');

  const loadWorkspace = async (clearNotice = true) => {
    if (previewMode) return;
    setLoading(true);
    if (clearNotice) setNotice(null);
    try {
      const { data: accessData, error: accessError } = await supabase.rpc('gba_workspace_my_access');
      if (accessError) throw accessError;
      setAccess(accessData);
      if (!accessData?.can_access) {
        setLoading(false);
        return;
      }

      const [collectionsResult, documentsResult, eventsResult, membersResult, keynotesResult] = await Promise.all([
        supabase.from('gba_workspace_collections').select('*').order('position'),
        supabase.from('gba_workspace_documents').select('*').order('updated_at', { ascending: false }),
        supabase.from('gba_workspace_events').select('*').order('starts_at'),
        supabase.rpc('gba_workspace_member_directory'),
        supabase.from('gba_keynotes').select('id,workspace_document_id,slug,title,summary,keynote_date,is_published,published_at,updated_at')
      ]);
      const error = collectionsResult.error || documentsResult.error || eventsResult.error || membersResult.error;
      if (error) throw error;

      const nextDocuments = documentsResult.data || [];
      setCollections(collectionsResult.data || []);
      setDocuments(nextDocuments);
      setEvents(eventsResult.data || []);
      setMembers(membersResult.data || []);
      if (!keynotesResult.error) setKeynotePublications(keynotesResult.data || []);
      setSelectedDocumentId(current => nextDocuments.some(document => document.id === current) ? current : nextDocuments[0]?.id || null);
    } catch (error) {
      console.error('Workspace load failed:', error);
      setNotice({ type: 'error', message: 'GBA Workspace todavía no está activo. Ejecuta la migración 202608010001_gba_workspace_phase1.sql.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [previewMode]);

  const flash = (type, message) => setNotice({ type, message });

  const createDocument = async collectionId => {
    if (previewMode) {
      const now = new Date().toISOString();
      const document = { id: `demo-${Date.now()}`, collection_id: collectionId, title: 'Documento sin título', content_markdown: '', status: 'draft', version: 1, updated_at: now, created_at: now };
      setDocuments(current => [document, ...current]);
      setSelectedDocumentId(document.id);
      flash('success', 'Documento de demostración creado.');
      return document;
    }
    const { data, error } = await supabase.from('gba_workspace_documents').insert({
      collection_id: collectionId,
      title: 'Documento sin título',
      content_markdown: '',
      status: 'draft',
      owner_id: user.id,
      created_by: user.id,
      updated_by: user.id
    }).select().single();
    if (error) {
      flash('error', error.message);
      return null;
    }
    setDocuments(current => [data, ...current]);
    setSelectedDocumentId(data.id);
    flash('success', 'Documento creado.');
    return data;
  };

  const saveDocument = async draft => {
    const payload = {
      title: draft.title.trim() || 'Documento sin título',
      content_markdown: draft.content_markdown,
      status: draft.status,
      updated_by: previewMode ? null : user.id
    };
    if (draft.status === 'approved') payload.approved_by = previewMode ? null : user.id;

    if (previewMode) {
      const saved = { ...draft, ...payload, version: Number(draft.version || 0) + 1, updated_at: new Date().toISOString() };
      setDocuments(current => current.map(document => document.id === saved.id ? saved : document));
      flash('success', 'Revisión de demostración guardada.');
      return saved;
    }
    const { data, error } = await supabase.from('gba_workspace_documents').update(payload).eq('id', draft.id).select().single();
    if (error) {
      flash('error', error.message);
      return null;
    }
    setDocuments(current => current.map(document => document.id === data.id ? data : document));
    flash('success', `Documento guardado como revisión ${data.version}.`);
    return data;
  };

  const loadRevisions = async documentId => {
    if (previewMode) return DEMO_REVISIONS[documentId] || [];
    const { data, error } = await supabase.from('gba_workspace_document_revisions').select('*').eq('document_id', documentId).order('revision_number', { ascending: false });
    if (error) {
      flash('error', error.message);
      return [];
    }
    return data || [];
  };

  const publishKeynote = async ({ documentId, summary, keynoteDate }) => {
    if (previewMode) {
      const document = documents.find(item => item.id === documentId);
      const slugBase = document.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const existing = keynotePublications.find(item => item.workspace_document_id === documentId);
      const publication = {
        id: existing?.id || `keynote-${Date.now()}`,
        workspace_document_id: documentId,
        slug: existing?.slug || `${slugBase}-${keynoteDate}`,
        title: document.title,
        summary,
        keynote_date: keynoteDate,
        is_published: true,
        published_at: existing?.published_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setKeynotePublications(current => [publication, ...current.filter(item => item.workspace_document_id !== documentId)]);
      flash('success', existing ? 'Keynote de demostración actualizada.' : 'Keynote de demostración publicada.');
      return publication;
    }

    const { data, error } = await supabase.rpc('gba_workspace_publish_keynote', {
      p_document_id: documentId,
      p_summary: summary,
      p_keynote_date: keynoteDate
    });
    if (error) {
      flash('error', error.message);
      return null;
    }
    const publication = Array.isArray(data) ? data[0] : data;
    setKeynotePublications(current => [publication, ...current.filter(item => item.workspace_document_id !== documentId)]);
    flash('success', 'Keynote publicada en VISTA.');
    return publication;
  };

  const unpublishKeynote = async documentId => {
    if (!window.confirm('¿Retirar esta Keynote del archivo público de VISTA?')) return false;
    if (previewMode) {
      setKeynotePublications(current => current.map(item => item.workspace_document_id === documentId ? { ...item, is_published: false } : item));
      flash('success', 'Keynote retirada de la demostración.');
      return true;
    }
    const { error } = await supabase.rpc('gba_workspace_unpublish_keynote', { p_document_id: documentId });
    if (error) {
      flash('error', error.message);
      return false;
    }
    setKeynotePublications(current => current.map(item => item.workspace_document_id === documentId ? { ...item, is_published: false } : item));
    flash('success', 'Keynote retirada del archivo público.');
    return true;
  };

  const saveEvent = async eventPayload => {
    const { id, ...payload } = eventPayload;
    if (previewMode) {
      const event = { ...payload, id: id || `event-${Date.now()}` };
      setEvents(current => (id
        ? current.map(item => item.id === id ? event : item)
        : [...current, event]
      ).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
      flash('success', id ? 'Evento de demostración actualizado.' : 'Evento de demostración programado.');
      return event;
    }
    const query = id
      ? supabase.from('gba_workspace_events').update(payload).eq('id', id)
      : supabase.from('gba_workspace_events').insert(payload);
    const { data, error } = await query.select().single();
    if (error) {
      flash('error', error.message);
      return null;
    }
    setEvents(current => (id
      ? current.map(item => item.id === data.id ? data : item)
      : [...current, data]
    ).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    flash('success', id ? 'Evento actualizado.' : 'Evento programado.');
    return data;
  };

  const addMember = async (handle, role) => {
    if (previewMode) {
      const member = { id: `member-${Date.now()}`, user_id: `user-${Date.now()}`, workspace_role: role, status: 'active', handle: handle.replace(/^@/, ''), display_name: handle.replace(/^@/, ''), platform_role: 'GBA ID', created_at: new Date().toISOString() };
      setMembers(current => [...current, member]);
      flash('success', 'Miembro añadido en la demostración.');
      return member;
    }
    const { error } = await supabase.rpc('gba_workspace_add_member', { p_handle: handle, p_role: role });
    if (error) {
      flash('error', error.message);
      return null;
    }
    await loadWorkspace(false);
    flash('success', 'GBA ID añadido a Workspace.');
    return true;
  };

  const setMemberRole = async (memberId, role) => {
    if (previewMode) {
      setMembers(current => current.map(member => member.id === memberId ? { ...member, workspace_role: role } : member));
      return;
    }
    const { error } = await supabase.rpc('gba_workspace_set_member_role', { p_member_id: memberId, p_role: role });
    if (error) flash('error', error.message);
    else await loadWorkspace(false);
  };

  const removeMember = async memberId => {
    if (!window.confirm('¿Suspender el acceso de este miembro a GBA Workspace?')) return;
    if (previewMode) {
      setMembers(current => current.map(member => member.id === memberId ? { ...member, status: 'suspended' } : member));
      return;
    }
    const { error } = await supabase.rpc('gba_workspace_remove_member', { p_member_id: memberId });
    if (error) flash('error', error.message);
    else await loadWorkspace(false);
  };

  const updateCollection = async (collection, minimumRole) => {
    if (previewMode) {
      setCollections(current => current.map(item => item.id === collection.id ? { ...item, minimum_role: minimumRole } : item));
      return;
    }
    const { data, error } = await supabase.from('gba_workspace_collections').update({ minimum_role: minimumRole, updated_at: new Date().toISOString() }).eq('id', collection.id).select().single();
    if (error) flash('error', error.message);
    else setCollections(current => current.map(item => item.id === data.id ? data : item));
  };

  const summary = useMemo(() => ({
    drafts: documents.filter(document => document.status === 'draft').length,
    reviews: documents.filter(document => document.status === 'review').length,
    upcoming: events.filter(event => new Date(event.starts_at) >= new Date()).length
  }), [documents, events]);

  if (loading) return <div className="min-h-screen bg-[#f5f6f8] flex items-center justify-center"><RefreshCw className="animate-spin text-[#2563eb]" size={24}/></div>;

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#1f2227] pb-20">
      <style>{`.ws-input{width:100%;min-height:40px;border:1px solid #d9dce3;border-radius:5px;background:#fff;padding:9px 11px;color:#24272c;font-size:12px;outline:none}.ws-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.08)}.ws-select{border:1px solid #d9dce3;border-radius:5px;background:#fff;padding:0 9px;color:#4d525a;font-size:10px;font-weight:700;outline:none}.ws-label{display:block;margin-bottom:6px;color:#8b9099;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.ws-icon{width:40px;height:40px;border:1px solid #d9dce3;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;color:#6f747d;background:#fff;transition:.18s}.ws-icon:hover{color:#17191d;border-color:#b8bdc6;background:#f8f9fa}.ws-primary,.ws-secondary{height:40px;border-radius:5px;padding:0 13px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:10px;font-weight:800;white-space:nowrap}.ws-primary{background:#17191d;color:#fff}.ws-primary:disabled{opacity:.4}.ws-secondary{border:1px solid #d9dce3;background:#fff;color:#4d525a}.ws-secondary:hover{border-color:#b8bdc6}`}</style>

      <header className="bg-white border-b border-[#dfe2e8]">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 h-20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-[#17191d] text-white flex items-center justify-center"><PanelsTopLeft size={19}/></div>
          <div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-lg font-bold tracking-tight">GBA Workspace</h1><span className="hidden sm:inline-flex text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-[#eef2f8] text-[#506078] rounded">Interno</span></div><p className="text-[10px] text-[#8b9099] mt-0.5 truncate">Memoria, decisiones y calendario de GBA</p></div>
          <div className="hidden lg:flex items-center gap-5 ml-auto text-[10px] text-[#6f747d]"><span><strong className="text-[#24272c]">{summary.drafts}</strong> borradores</span><span><strong className="text-amber-700">{summary.reviews}</strong> en revisión</span><span><strong className="text-[#2563eb]">{summary.upcoming}</strong> próximos</span></div>
          <div className="ml-auto lg:ml-6 pl-4 border-l border-[#e2e4e9] text-right"><p className="text-xs font-bold truncate max-w-36">{currentName}</p><p className="text-[9px] text-[#8b9099] mt-0.5">{ROLE_LABELS[access?.role] || 'Sin acceso'}</p></div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-5">
        <nav className="flex items-center gap-1 border-b border-[#dfe2e8] mb-5 overflow-x-auto" aria-label="Áreas de GBA Workspace">
          {AREAS.map(area => { const Icon = area.icon; return <button key={area.id} type="button" onClick={() => setActiveArea(area.id)} className={`h-11 px-4 flex items-center gap-2 border-b-2 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${activeArea === area.id ? 'border-[#17191d] text-[#17191d]' : 'border-transparent text-[#8b9099] hover:text-[#4d525a]'}`}><Icon size={14}/>{area.label}</button>; })}
          <div className="ml-auto hidden md:flex items-center gap-2 text-[9px] text-[#8b9099]"><ShieldCheck size={13}/>Acceso mediante GBA ID</div>
        </nav>

        {notice && <div className={`mb-4 min-h-10 px-4 py-2.5 border-l-2 flex items-center gap-2 text-xs ${notice.type === 'error' ? 'border-red-500 bg-red-50 text-red-700' : notice.type === 'success' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-[#2563eb] bg-blue-50 text-blue-700'}`}>{notice.type === 'error' ? <AlertCircle size={14}/> : notice.type === 'success' ? <Check size={14}/> : <Database size={14}/>}<span className="flex-1">{notice.message}</span><button type="button" title="Cerrar aviso" onClick={() => setNotice(null)}><X size={14}/></button></div>}

        {canAccess ? (
          activeArea === 'calendar'
            ? <WorkspaceCalendar access={access} events={events} documents={documents} onSaveEvent={saveEvent}/>
            : activeArea === 'members'
              ? <WorkspaceMembers access={access} members={members} collections={collections} onAddMember={addMember} onSetMemberRole={setMemberRole} onRemoveMember={removeMember} onUpdateCollection={updateCollection}/>
              : <WorkspaceDocuments access={access} collections={collections} documents={documents} events={events} keynotePublications={keynotePublications} selectedDocumentId={selectedDocumentId} onSelectDocument={setSelectedDocumentId} onCreateDocument={createDocument} onSaveDocument={saveDocument} onLoadRevisions={loadRevisions} onPublishKeynote={publishKeynote} onUnpublishKeynote={unpublishKeynote} previewMode={previewMode}/>
        ) : <AccessDenied/>}
      </div>
    </div>
  );
}

function AccessDenied() {
  return <div className="min-h-[70vh] flex items-center justify-center bg-[#f5f6f8] px-6"><div className="max-w-md text-center"><div className="w-12 h-12 mx-auto bg-white border border-[#d9dce3] rounded-md flex items-center justify-center text-[#6f747d]"><ShieldCheck size={21}/></div><h2 className="text-xl font-bold mt-5">Workspace restringido</h2><p className="text-sm leading-6 text-[#747982] mt-2">Tu GBA ID todavía no pertenece al equipo de Workspace. Un administrador debe añadirlo al directorio interno.</p></div></div>;
}
