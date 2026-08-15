import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ExternalLink, Pencil, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const emptyCredit = () => ({ key: crypto.randomUUID(), role: '', handle: '', display_name: '' });

export default function CreditsPanel({ subjectType, subjectId, editable = false, dark = false, className = '' }) {
  const [credits, setCredits] = useState([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [manageAllowed, setManageAllowed] = useState(false);

  const load = useCallback(async () => {
    if (!subjectId) return;
    setLoading(true);
    const { data, error: requestError } = await supabase.rpc('vista_list_credits', {
      p_subject_type: subjectType,
      p_subject_id: subjectId
    });
    if (!requestError) setCredits(data || []);
    if (editable) {
      const { data: allowed } = await supabase.rpc('vista_can_manage_subject', {
        p_subject_type: subjectType,
        p_subject_id: subjectId
      });
      setManageAllowed(Boolean(allowed));
    }
    setLoading(false);
  }, [editable, subjectId, subjectType]);

  useEffect(() => { load(); }, [load]);

  const canManage = editable && manageAllowed;
  const visible = credits.filter(credit => credit.status === 'accepted');
  const pendingMine = credits.filter(credit => credit.can_respond);

  const openManager = () => {
    setDraft(credits.filter(credit => credit.status !== 'declined').map(credit => ({
      key: credit.id,
      role: credit.role,
      handle: credit.handle ? `@${credit.handle}` : '',
      display_name: credit.display_name
    })));
    setError('');
    setManagerOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    const payload = draft
      .map(({ role, handle, display_name }) => ({ role: role.trim(), handle: handle.trim(), display_name: display_name.trim() }))
      .filter(item => item.role && (item.handle || item.display_name));
    const { error: saveError } = await supabase.rpc('vista_replace_credits', {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_credits: payload
    });
    if (saveError) {
      setError(saveError.message);
    } else {
      setManagerOpen(false);
      await load();
    }
    setSaving(false);
  };

  const respond = async (id, accept) => {
    await supabase.rpc('vista_respond_credit', { p_credit_id: id, p_accept: accept });
    await load();
  };

  const updateDraft = (key, field, value) => setDraft(current => current.map(item => item.key === key ? { ...item, [field]: value } : item));
  const shell = dark ? 'border-white/10 text-white' : 'border-[#d2d2d7] text-[#1d1d1f]';
  const muted = dark ? 'text-neutral-400' : 'text-[#86868b]';

  if (!subjectId) return null;

  return (
    <section className={`border-t pt-5 ${shell} ${className}`} aria-label="Créditos y colaboraciones">
      <div className="flex items-center gap-3">
        <UserCheck size={15} className={dark ? 'text-blue-400' : 'text-[#0066FF]'}/>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em]">Créditos y colaboraciones</p>
          {!loading && visible.length === 0 && <p className={`text-[10px] mt-1 ${muted}`}>Sin créditos registrados todavía.</p>}
        </div>
        {canManage && <button type="button" onClick={openManager} className={`h-8 px-3 rounded-md border text-[10px] font-bold inline-flex items-center gap-1.5 ${dark ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}><Pencil size={12}/>Gestionar</button>}
      </div>

      {visible.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {visible.map(credit => (
          <button key={credit.id} type="button" disabled={!credit.handle} onClick={() => credit.handle && (window.location.href = `/?profile=${encodeURIComponent(credit.handle)}`)} className={`text-left group ${credit.handle ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className={`block text-[9px] font-bold uppercase ${muted}`}>{credit.role}</span>
            <span className="text-xs font-bold inline-flex items-center gap-1">{credit.profile_name || credit.display_name}{credit.handle && <ExternalLink size={10} className="opacity-0 group-hover:opacity-60"/>}</span>
          </button>
        ))}
      </div>}

      {pendingMine.map(credit => <div key={credit.id} className={`mt-4 p-3 rounded-md border flex flex-col sm:flex-row sm:items-center gap-3 ${dark ? 'border-amber-400/30 bg-amber-400/10' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs flex-1"><strong>{credit.role}</strong> · Confirma si participaste en esta publicación.</p><div className="flex gap-2"><button type="button" onClick={() => respond(credit.id, false)} className="h-8 px-3 rounded-md border border-current text-[10px] font-bold">Rechazar</button><button type="button" onClick={() => respond(credit.id, true)} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center gap-1"><Check size={12}/>Aceptar</button></div></div>)}

      {managerOpen && <div className="fixed inset-0 z-[10000] bg-black/55 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setManagerOpen(false)}><div className="w-full max-w-2xl max-h-[86vh] overflow-y-auto bg-white text-[#1d1d1f] rounded-lg shadow-2xl border border-[#d2d2d7]" onClick={event => event.stopPropagation()}>
        <header className="sticky top-0 bg-white border-b border-[#d2d2d7] px-5 py-4 flex items-center gap-3 z-10"><div className="flex-1"><h3 className="font-bold">Créditos de la publicación</h3><p className="text-[10px] text-[#86868b] mt-1">Usa un @GBAID para una atribución verificable o escribe un nombre externo.</p></div><button type="button" onClick={() => setManagerOpen(false)} className="w-9 h-9 rounded-md bg-[#f5f5f7] flex items-center justify-center" title="Cerrar"><X size={16}/></button></header>
        <div className="p-5 space-y-3">
          {draft.map((credit, index) => <div key={credit.key} className="grid sm:grid-cols-[150px_1fr_1fr_36px] gap-2 p-3 border border-[#e5e5e7] rounded-md bg-[#fbfbfd]">
            <input value={credit.role} onChange={event => updateDraft(credit.key, 'role', event.target.value)} placeholder="Rol: Periodista" className="h-10 px-3 rounded-md border border-[#d2d2d7] text-xs outline-none focus:border-[#0066FF]"/>
            <input value={credit.handle} onChange={event => updateDraft(credit.key, 'handle', event.target.value)} placeholder="@GBAID (preferido)" className="h-10 px-3 rounded-md border border-[#d2d2d7] text-xs outline-none focus:border-[#0066FF]"/>
            <input value={credit.display_name} onChange={event => updateDraft(credit.key, 'display_name', event.target.value)} placeholder="Nombre mostrado" className="h-10 px-3 rounded-md border border-[#d2d2d7] text-xs outline-none focus:border-[#0066FF]"/>
            <button type="button" onClick={() => setDraft(current => current.filter(item => item.key !== credit.key))} className="w-9 h-10 rounded-md text-red-600 hover:bg-red-50 flex items-center justify-center" title={`Eliminar crédito ${index + 1}`}><Trash2 size={15}/></button>
          </div>)}
          {!draft.length && <p className="py-8 text-center text-xs text-[#86868b] border border-dashed border-[#d2d2d7] rounded-md">Añade a quienes hicieron posible esta publicación.</p>}
          <button type="button" onClick={() => setDraft(current => [...current, emptyCredit()])} className="h-10 px-4 rounded-md border border-[#d2d2d7] text-xs font-bold inline-flex items-center gap-2"><Plus size={14}/>Añadir crédito</button>
          {error && <p className="p-3 border border-red-200 bg-red-50 text-red-700 rounded-md text-xs">{error}</p>}
        </div>
        <footer className="sticky bottom-0 bg-white border-t border-[#d2d2d7] px-5 py-4 flex justify-end gap-2"><button type="button" onClick={() => setManagerOpen(false)} className="h-10 px-4 rounded-md border border-[#d2d2d7] text-xs font-bold">Cancelar</button><button type="button" onClick={save} disabled={saving} className="h-10 px-4 rounded-md bg-[#0066FF] text-white text-xs font-bold disabled:opacity-50">{saving ? 'Guardando' : 'Guardar créditos'}</button></footer>
      </div></div>}
    </section>
  );
}
