import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, MessageCircle, Send, Trash2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function ConversationPanel({ subjectType, subjectId, dark = false, className = '' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!subjectId) return;
    const { data } = await supabase.rpc('vista_list_conversation', {
      p_subject_type: subjectType,
      p_subject_id: subjectId
    });
    setMessages(data || []);
  }, [subjectId, subjectType]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    const { error } = await supabase.rpc('vista_add_conversation', {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_body: body.trim(),
      p_parent_id: null
    });
    if (!error) {
      setBody('');
      await load();
    }
    setSending(false);
  };

  const remove = async id => {
    await supabase.rpc('vista_delete_conversation', { p_conversation_id: id });
    await load();
  };

  if (!subjectId) return null;
  const border = dark ? 'border-white/10' : 'border-[#d2d2d7]';
  const muted = dark ? 'text-neutral-400' : 'text-[#86868b]';

  return <section className={`border-t ${border} ${className}`}>
    <button type="button" onClick={() => setOpen(current => !current)} className="w-full min-h-14 flex items-center gap-3 text-left">
      <MessageCircle size={15} className={dark ? 'text-blue-400' : 'text-[#0066FF]'}/>
      <span className="text-xs font-bold flex-1">Conversación <span className={`font-medium ${muted}`}>({messages.length})</span></span>
      <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''} ${muted}`}/>
    </button>
    {open && <div className="pb-5">
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {messages.map(message => <article key={message.id} className={`group py-3 border-b last:border-0 ${border}`}>
          <div className="flex items-start gap-3"><button type="button" onClick={() => window.location.href = `/?profile=${encodeURIComponent(message.handle)}`} className={`w-8 h-8 rounded-md flex-shrink-0 text-[9px] font-black ${dark ? 'bg-white/10 text-white' : 'bg-[#f0f5ff] text-[#0066FF]'}`}>{message.display_name.slice(0, 2).toUpperCase()}</button><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><button type="button" onClick={() => window.location.href = `/?profile=${encodeURIComponent(message.handle)}`} className="text-[11px] font-bold hover:underline">{message.display_name}</button><span className={`text-[9px] ${muted}`}>@{message.handle}</span></div><p className={`text-xs leading-5 mt-1 whitespace-pre-wrap ${dark ? 'text-neutral-300' : 'text-[#55565a]'}`}>{message.body}</p></div>{message.can_delete && <button type="button" onClick={() => remove(message.id)} className="p-2 opacity-0 group-hover:opacity-100 text-red-500" title="Eliminar mensaje"><Trash2 size={13}/></button>}</div>
        </article>)}
        {!messages.length && <p className={`py-6 text-center text-xs ${muted}`}>Inicia una conversación sobre esta publicación.</p>}
      </div>
      <div className={`mt-4 flex items-end gap-2 p-2 rounded-md border ${border} ${dark ? 'bg-white/5' : 'bg-white'}`}><textarea value={body} onChange={event => setBody(event.target.value)} maxLength={1200} rows="2" placeholder="Escribe un mensaje..." className={`min-w-0 flex-1 resize-none bg-transparent p-2 text-xs outline-none ${dark ? 'text-white placeholder:text-neutral-600' : ''}`}/><button type="button" onClick={send} disabled={!body.trim() || sending} className="w-10 h-10 rounded-md bg-[#0066FF] text-white flex items-center justify-center disabled:opacity-40" title="Enviar"><Send size={15}/></button></div>
    </div>}
  </section>;
}
