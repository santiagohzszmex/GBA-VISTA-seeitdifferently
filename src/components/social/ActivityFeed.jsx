import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  FileText,
  Heart,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Newspaper,
  Send,
  Share2,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { uploadToCloudinary } from '../../cloudinary';
import { useActivityFeed } from '../../hooks/useActivityFeed';
import { useLikes } from '../../hooks/useLikes';
import { useUpdateShare } from '../../hooks/useUpdateShare';
import ConversationPanel from './ConversationPanel';

const relativeTime = value => {
  const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} d`;
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
};

const identityLabel = type => ({ profile: 'GBA ID', editorial: 'Editorial', business: 'Network' }[type] || 'VISTA');

function RichBody({ children }) {
  const parts = String(children || '').split(/(@[A-Za-z0-9_.-]{2,32})/g);
  return <p className="text-[15px] md:text-base leading-7 text-[#343438] whitespace-pre-wrap break-words">
    {parts.map((part, index) => part.startsWith('@')
      ? <button key={`${part}-${index}`} type="button" onClick={() => { window.location.href = `/?profile=${encodeURIComponent(part.slice(1))}`; }} className="text-[#0066FF] font-semibold hover:underline">{part}</button>
      : part)}
  </p>;
}

function IdentityMark({ item, size = 'md' }) {
  const dimensions = size === 'sm' ? 'w-9 h-9 text-[9px]' : 'w-11 h-11 text-[11px]';
  const initials = String(item.actor_name || 'VI').slice(0, 2).toUpperCase();
  return <span className={`${dimensions} rounded-md overflow-hidden flex-shrink-0 bg-[#1d1d1f] text-white flex items-center justify-center font-black`}>
    {item.actor_image ? <img src={item.actor_image} alt="" className="w-full h-full object-cover"/> : initials}
  </span>;
}

function ContentLikeButton({ item }) {
  const { isLiked, likesCount, toggleLike, checking } = useLikes(item.item_id);
  return <button type="button" onClick={toggleLike} disabled={checking} className={`h-10 px-3 rounded-md flex items-center gap-2 text-xs font-bold transition-colors ${isLiked ? 'text-red-600 bg-red-50' : 'text-[#626269] hover:bg-[#f5f5f7]'}`} title="Me gusta">
    <Heart size={16} className={isLiked ? 'fill-current' : ''}/><span>{likesCount}</span>
  </button>;
}

function UpdateActions({ item, onToggleLike, onDelete }) {
  const { share, status } = useUpdateShare(item);
  return <div className="flex items-center gap-1 pt-3 border-t border-[#e8e8ed]">
    <button type="button" onClick={() => onToggleLike(item.item_id)} className={`h-10 px-3 rounded-md flex items-center gap-2 text-xs font-bold transition-colors ${item.is_liked ? 'text-red-600 bg-red-50' : 'text-[#626269] hover:bg-[#f5f5f7]'}`} title="Me gusta">
      <Heart size={16} className={item.is_liked ? 'fill-current' : ''}/><span>{item.likes_count || 0}</span>
    </button>
    <span className="h-10 px-3 flex items-center gap-2 text-xs font-bold text-[#626269]"><MessageCircle size={16}/>{item.conversation_count || 0}</span>
    <button type="button" onClick={share} className="h-10 px-3 rounded-md flex items-center gap-2 text-xs font-bold text-[#626269] hover:bg-[#f5f5f7]" title="Compartir actualización">
      {status === 'idle' ? <Share2 size={16}/> : <Check size={16} className="text-emerald-600"/>}<span className="hidden sm:inline">Compartir</span>
    </button>
    {item.can_delete && <button type="button" onClick={() => onDelete(item.item_id)} className="ml-auto w-10 h-10 rounded-md flex items-center justify-center text-[#86868b] hover:bg-red-50 hover:text-red-600" title="Eliminar actualización"><Trash2 size={15}/></button>}
  </div>;
}

function FeedCard({ item, onToggleLike, onDelete }) {
  const openActor = () => {
    if (item.actor_type === 'profile') window.location.href = `/?profile=${encodeURIComponent(item.actor_handle)}`;
    else if (item.actor_type === 'editorial') window.location.href = `/?editorial=${encodeURIComponent(item.actor_handle)}`;
    else window.location.href = '/?network=1';
  };
  const openContent = () => { if (item.action_url) window.location.href = item.action_url; };

  return <article id={`activity-${item.item_id}`} className="bg-white border border-[#d2d2d7] rounded-md overflow-hidden">
    <header className="px-5 pt-5 pb-4 flex items-start gap-3">
      <button type="button" onClick={openActor}><IdentityMark item={item}/></button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={openActor} className="font-bold text-sm hover:underline truncate">{item.actor_name}</button>
          <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[#0066FF]">{identityLabel(item.actor_type)}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#86868b] mt-1"><span>@{item.actor_handle}</span><span>·</span><time>{relativeTime(item.created_at)}</time></div>
      </div>
      <MoreHorizontal size={17} className="text-[#b0b0b5]"/>
    </header>

    <div className="px-5 pb-5">
      {item.item_kind !== 'update' && <button type="button" onClick={openContent} className="w-full text-left mb-4 group">
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#0066FF] flex items-center gap-2">
          {item.item_kind === 'edition' ? <Newspaper size={13}/> : <FileText size={13}/>}
          {item.item_kind === 'edition' ? 'Nueva edición' : 'GBA Keynote'}
        </span>
        <span className="block font-serif italic text-2xl md:text-3xl leading-tight mt-2 group-hover:text-[#0066FF] transition-colors">{item.title}</span>
      </button>}
      <RichBody>{item.body}</RichBody>

      {item.image_url && <button type="button" onClick={item.item_kind === 'update' ? undefined : openContent} className="block w-full mt-4 overflow-hidden rounded-md bg-[#f5f5f7] border border-[#e8e8ed]">
        <img src={item.image_url} alt="" className="w-full max-h-[520px] object-cover" loading="lazy"/>
      </button>}

      {item.link_url && <a href={item.link_url} target="_blank" rel="noreferrer" className="mt-4 min-h-14 px-4 border border-[#d2d2d7] rounded-md flex items-center gap-3 text-sm font-bold hover:border-[#86868b] transition-colors"><Link2 size={16} className="text-[#0066FF]"/><span className="truncate flex-1">{item.link_url.replace(/^https?:\/\//, '')}</span><ArrowUpRight size={15}/></a>}

      {item.item_kind === 'update' ? <UpdateActions item={item} onToggleLike={onToggleLike} onDelete={onDelete}/> : <div className="flex items-center gap-1 pt-3 mt-4 border-t border-[#e8e8ed]">
        {item.item_kind === 'edition' ? <ContentLikeButton item={item}/> : <span className="h-10 px-3 flex items-center text-xs font-bold text-[#626269]"><Heart size={16} className="mr-2"/>0</span>}
        <span className="h-10 px-3 flex items-center gap-2 text-xs font-bold text-[#626269]"><MessageCircle size={16}/>{item.conversation_count || 0}</span>
        <button type="button" onClick={openContent} className="ml-auto h-10 px-3 rounded-md bg-[#1d1d1f] text-white text-xs font-bold flex items-center gap-2">Abrir<ArrowUpRight size={14}/></button>
      </div>}
      <ConversationPanel subjectType={item.subject_type} subjectId={item.subject_id}/>
    </div>
  </article>;
}

function UpdateComposer({ identities, onPublish }) {
  const [body, setBody] = useState('');
  const [identityId, setIdentityId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const selectedIdentity = useMemo(() => identities.find(identity => `${identity.identity_type}:${identity.identity_id}` === identityId) || identities[0], [identities, identityId]);
  const imagePreview = useMemo(() => imageFile ? URL.createObjectURL(imageFile) : '', [imageFile]);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const publish = async () => {
    if (!body.trim() || !selectedIdentity || publishing) return;
    setPublishing(true);
    setError('');
    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile, `VISTA_Updates/${selectedIdentity.handle}`);
        if (!imageUrl) throw new Error('No se pudo subir la imagen.');
      }
      await onPublish({ body: body.trim(), identity: selectedIdentity, imageUrl, linkUrl: linkUrl.trim() });
      setBody('');
      setImageFile(null);
      setLinkUrl('');
      setShowLink(false);
    } catch (publishError) {
      setError(publishError.message || 'No se pudo publicar la actualización.');
    } finally {
      setPublishing(false);
    }
  };

  if (!identities.length) return null;
  return <section className="bg-white border border-[#d2d2d7] rounded-md p-4 md:p-5">
    <div className="flex items-start gap-3">
      <span className="w-11 h-11 rounded-md bg-[#1d1d1f] text-white flex items-center justify-center flex-shrink-0"><UserRound size={19}/></span>
      <div className="min-w-0 flex-1">
        <select value={identityId || `${selectedIdentity.identity_type}:${selectedIdentity.identity_id}`} onChange={event => setIdentityId(event.target.value)} className="h-9 max-w-full px-2 -ml-2 bg-transparent text-xs font-bold outline-none">
          {identities.map(identity => <option key={`${identity.identity_type}:${identity.identity_id}`} value={`${identity.identity_type}:${identity.identity_id}`}>{identity.display_name} · {identityLabel(identity.identity_type)}</option>)}
        </select>
        <textarea value={body} onChange={event => setBody(event.target.value)} maxLength={600} rows="3" placeholder="Comparte una actualización..." className="w-full mt-2 resize-none bg-transparent text-base leading-7 outline-none placeholder:text-[#a1a1a6]"/>
      </div>
    </div>

    {imagePreview && <div className="relative mt-3 ml-0 md:ml-14 rounded-md overflow-hidden border border-[#d2d2d7] bg-[#f5f5f7]"><img src={imagePreview} alt="Vista previa" className="w-full max-h-80 object-cover"/><button type="button" onClick={() => setImageFile(null)} className="absolute top-2 right-2 w-9 h-9 rounded-full bg-black/75 text-white flex items-center justify-center" title="Quitar imagen"><X size={15}/></button></div>}
    {showLink && <div className="mt-3 ml-0 md:ml-14 flex items-center gap-2"><Link2 size={15} className="text-[#86868b]"/><input type="url" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} placeholder="https://" className="h-10 min-w-0 flex-1 px-3 border border-[#d2d2d7] rounded-md text-xs outline-none focus:border-[#0066FF]"/></div>}
    {error && <p className="ml-0 md:ml-14 mt-3 text-xs font-bold text-red-600">{error}</p>}

    <div className="ml-0 md:ml-14 mt-3 pt-3 border-t border-[#e8e8ed] flex items-center gap-1">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={event => setImageFile(event.target.files?.[0] || null)}/>
      <button type="button" onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-md flex items-center justify-center text-[#0066FF] hover:bg-blue-50" title="Añadir imagen"><ImageIcon size={17}/></button>
      <button type="button" onClick={() => setShowLink(current => !current)} className={`w-10 h-10 rounded-md flex items-center justify-center hover:bg-blue-50 ${showLink ? 'bg-blue-50 text-[#0066FF]' : 'text-[#0066FF]'}`} title="Añadir enlace"><Link2 size={17}/></button>
      <span className="ml-auto text-[10px] font-bold text-[#86868b] mr-2">{body.length}/600</span>
      <button type="button" onClick={publish} disabled={!body.trim() || publishing} className="h-10 px-4 rounded-md bg-[#0066FF] text-white text-xs font-bold flex items-center gap-2 disabled:opacity-40"><Send size={14}/>{publishing ? 'Publicando' : 'Publicar'}</button>
    </div>
  </section>;
}

export default function ActivityFeed({ mode = 'featured', profileId = null, focusId = null, showComposer = false, previewMode = false, limitClass = 'max-w-3xl' }) {
  const { items, identities, loading, error, createUpdate, toggleLike, deleteUpdate } = useActivityFeed({ mode, profileId, focusId, previewMode });

  const remove = async itemId => {
    if (!window.confirm('¿Eliminar esta actualización?')) return;
    try { await deleteUpdate(itemId); } catch (deleteError) { window.alert(deleteError.message || 'No se pudo eliminar.'); }
  };

  return <div className={`${limitClass} mx-auto w-full space-y-3`}>
    {showComposer && <UpdateComposer identities={identities} onPublish={createUpdate}/>} 
    {loading && <div className="py-16 text-center text-xs font-bold uppercase tracking-widest text-[#86868b]">Actualizando VISTA...</div>}
    {error && <div className="border border-red-200 bg-red-50 rounded-md px-5 py-4 text-xs font-bold text-red-700">Ejecuta la migración de Actividad VISTA para abrir este feed.</div>}
    {!loading && !error && items.map(item => <FeedCard key={`${item.item_kind}:${item.item_id}`} item={item} onToggleLike={toggleLike} onDelete={remove}/>)}
    {!loading && !error && !items.length && <div className="py-16 px-6 border border-dashed border-[#d2d2d7] rounded-md text-center"><UserRound size={24} className="mx-auto text-[#86868b]"/><p className="font-bold mt-4">Tu feed está listo para crecer.</p><p className="text-xs text-[#86868b] mt-2">Sigue personas y editoriales para ver aquí sus próximas publicaciones.</p></div>}
  </div>;
}
