import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, CornerUpLeft, MessageCircle, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

export default function ConversationPanel({ subjectType, subjectId, dark = false, className = '' }) {
  const { user } = useAuth();
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);
  const requestId = React.useRef(0);
  const busy = React.useRef(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);

  const load = useCallback(async () => {
    if (!subjectId) return;
    const request = ++requestId.current;
    setLoading(true); setLoadError('');
    const { data, error: requestError } = await supabase.rpc('vista_list_conversation', {
      p_subject_type: subjectType,
      p_subject_id: subjectId
    });
    if (request !== requestId.current) return;
    if (requestError) setLoadError('No pudimos cargar la conversación.');
    else setMessages(data || []);
    setLoading(false);
  }, [subjectId, subjectType]);

  useEffect(() => { setMessages([]); setReplyTo(null); setBody(''); setError(''); load(); return () => { requestId.current += 1; }; }, [load]);

  const send = async () => {
    if (!body.trim() || busy.current || !user?.id) return;
    busy.current = true; setError('');
    setSending(true);
    const { error } = await supabase.rpc('vista_add_conversation', {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_body: body.trim(),
      p_parent_id: replyTo?.id || null
    });
    if (!error) {
      setBody('');
      setReplyTo(null);
      await load();
    }
    if (error) setError('No pudimos enviar tu mensaje. Tu texto sigue aquí para intentarlo de nuevo.');
    setSending(false); busy.current = false;
  };

  const remove = async id => {
    if (busy.current) return;
    busy.current = true; setRemoving(id); setError('');
    const { error: removeError } = await supabase.rpc('vista_delete_conversation', { p_conversation_id: id });
    if (removeError) setError('No pudimos eliminar el mensaje. Vuelve a intentarlo.');
    else { if (replyTo?.id === id) setReplyTo(null); await load(); }
    setRemoving(null); busy.current = false;
  };

  if (!subjectId) return null;
  const border = dark ? 'border-white/10' : 'border-[#d2d2d7]';
  const muted = dark ? 'text-neutral-400' : 'text-[#86868b]';

  return <section className={`border-t ${border} ${className}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(current => !current)} className="w-full min-h-14 flex items-center gap-3 text-left">
      <MessageCircle size={15} className={dark ? 'text-blue-400' : 'text-[#0066FF]'}/>
      <span className="text-xs font-bold flex-1">Conversación <span className={`font-medium ${muted}`}>({messages.length})</span></span>
      <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${muted}`}/>
    </button>
    {open && <div className="pb-5">
      {loading && <p role="status" className={`text-xs py-3 ${muted}`}>Cargando conversación...</p>}
      {loadError && <p role="alert" className="text-xs text-red-500 py-3">{loadError} <button type="button" className="underline" onClick={load}>Reintentar</button></p>}
      {error && <p role="alert" className="text-xs text-red-500 py-3">{error}</p>}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {messages.map(message => <article key={message.id} className={`group py-3 border-b last:border-0 ${border} ${message.parent_id ? 'ml-8 border-l pl-3' : ''}`}>
          <div className="flex items-start gap-3"><button type="button" onClick={() => window.location.href = `/?profile=${encodeURIComponent(message.handle)}`} className={`w-8 h-8 rounded-md flex-shrink-0 text-[9px] font-black ${dark ? 'bg-white/10 text-white' : 'bg-[#f0f5ff] text-[#0066FF]'}`}>{message.display_name.slice(0, 2).toUpperCase()}</button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><button type="button" onClick={() => window.location.href = `/?profile=${encodeURIComponent(message.handle)}`} className="text-[11px] font-bold hover:underline">{message.display_name}</button><span className={`text-[9px] ${muted}`}>@{message.handle}</span></div><p className={`text-xs leading-5 mt-1 whitespace-pre-wrap ${dark ? 'text-neutral-300' : 'text-[#55565a]'}`}>{message.body}</p><time dateTime={message.created_at} className={`block text-[9px] mt-1 ${muted}`}>{new Date(message.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}</time><button type="button" disabled={!user?.id || sending || Boolean(removing)} onClick={() => setReplyTo(message)} className={`mt-2 inline-flex items-center gap-1 text-[9px] font-bold ${muted} hover:text-[#0066FF]`}><CornerUpLeft size={11}/>Responder</button></div>{message.can_delete && <button type="button" disabled={sending || Boolean(removing)} onClick={() => remove(message.id)} className="p-2 opacity-70 hover:opacity-100 focus:opacity-100 disabled:opacity-30 text-red-500" title="Eliminar mensaje"><Trash2 size={13}/></button>}</div>
        </article>)}
        {!loading && !loadError && !messages.length && <p className={`py-6 text-center text-xs ${muted}`}>Inicia una conversación sobre esta publicación.</p>}
      </div>
      {replyTo && <div className={`mt-4 px-3 py-2 rounded-md flex items-center gap-2 text-[10px] ${dark ? 'bg-white/5 text-neutral-300' : 'bg-[#f5f5f7] text-[#626269]'}`}><CornerUpLeft size={12}/><span className="truncate flex-1">Respondiendo a @{replyTo.handle}</span><button type="button" onClick={() => setReplyTo(null)} title="Cancelar respuesta"><X size={13}/></button></div>}
      {user?.id ? <div className={`${replyTo ? 'mt-2' : 'mt-4'} flex items-end gap-2 p-2 rounded-md border ${border} ${dark ? 'bg-white/5' : 'bg-white'}`}><textarea aria-label="Mensaje de la conversación" disabled={sending} value={body} onChange={event => setBody(event.target.value)} maxLength={1200} rows="2" placeholder={replyTo ? `Responder a @${replyTo.handle}...` : 'Escribe un mensaje...'} className={`min-w-0 flex-1 resize-none bg-transparent p-2 text-xs outline-none ${dark ? 'text-white placeholder:text-neutral-600' : ''}`}/><button type="button" onClick={send} disabled={!body.trim() || sending || Boolean(removing) || Boolean(loadError)} className="w-10 h-10 rounded-md bg-[#0066FF] text-white flex items-center justify-center disabled:opacity-40" title="Enviar"><Send size={15}/></button></div> : <p className={`text-xs mt-4 ${muted}`}>Inicia sesión con GBA ID para participar.</p>}
    </div>}
  </section>;
}
