import React, { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Pencil, Plus, Search, Trash2, UserCheck, X } from 'lucide-react';
import { creditPayload, creditStatusLabel } from '../../utils/social';
import { supabase } from '../../supabaseClient';

const emptyCredit = () => ({ key: crypto.randomUUID(), role: '', handle: '', display_name: '', verified: false });

function GbaIdLookup({ credit, onChange, onSelect }) {
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    const query = credit.handle.replace(/^@/, '').trim();
    if (query.length < 2 || credit.verified) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setSearched(false);
    setSearchError('');
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('vista_search_public_profiles', { p_query: query });
      if (!active) return;
      setSearchError(error ? 'No pudimos buscar cuentas. Vuelve a intentarlo.' : '');
      setResults(error ? [] : (data || []));
      setSearched(true);
      setLoading(false);
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [credit.handle, credit.verified]);

  const queryLongEnough = credit.handle.replace(/^@/, '').trim().length >= 2;
  const showMenu = focused && queryLongEnough && !credit.verified;

  return <div className="relative min-w-0">
    <div className="relative">
      <Search size={13} className="absolute left-3 top-3.5 text-[#86868b]"/>
      <input
        value={credit.handle}
        onFocus={() => setFocused(true)}
        onBlur={() => window.setTimeout(() => setFocused(false), 140)}
        onChange={event => onChange(event.target.value)}
        placeholder="@GBAID" aria-label="Buscar cuenta GBA ID"
        autoComplete="off"
        className={`w-full h-10 pl-8 pr-8 rounded-md border text-xs outline-none ${credit.verified ? 'border-emerald-400 bg-emerald-50' : 'border-[#d2d2d7] focus:border-[#0066FF]'}`}
      />
      {loading && <Loader2 size={13} className="absolute right-3 top-3.5 text-[#0066FF] animate-spin"/>}
      {credit.verified && <Check size={14} className="absolute right-3 top-3.5 text-emerald-600"/>}
    </div>

    {credit.verified && <span className="block mt-1 text-[9px] font-bold text-emerald-700">Cuenta encontrada</span>}

    {showMenu && <div className="absolute z-30 top-11 left-0 right-0 min-w-[240px] bg-white border border-[#d2d2d7] rounded-md shadow-xl overflow-hidden">
      {results.map(profile => <button
        key={profile.user_id}
        type="button"
        onMouseDown={event => event.preventDefault()}
        onClick={() => { onSelect(profile); setFocused(false); }}
        className="w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-[#f5f5f7] border-b border-[#eeeeef] last:border-0"
      >
        <span className="w-8 h-8 rounded-md bg-[#f0f5ff] text-[#0066FF] flex items-center justify-center text-[9px] font-black flex-shrink-0">{profile.profile_name.slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><strong className="block text-[11px] truncate">{profile.profile_name}</strong><span className="block text-[9px] text-[#0066FF] font-bold truncate">@{profile.handle}</span></span>
        <span className="text-[8px] font-bold uppercase text-[#86868b]">{profile.platform_role || 'GBA ID'}</span>
      </button>)}
      {searchError && <p role="alert" className="px-3 py-4 text-xs text-red-700">{searchError}</p>}
      {!searchError && !loading && searched && results.length === 0 && <p className="px-3 py-4 text-[10px] text-[#86868b] text-center">No encontramos un GBA ID público con esa búsqueda.</p>}
    </div>}
  </div>;
}

export default function CreditsPanel({ subjectType, subjectId, editable = false, dark = false, className = '' }) {
  const [credits, setCredits] = useState([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [draft, setDraft] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [responding, setResponding] = useState(null);
  const requestId = React.useRef(0);
  const savingRef = React.useRef(false);
  const respondingRef = React.useRef(false);
  const [manageAllowed, setManageAllowed] = useState(false);

  const load = useCallback(async () => {
    if (!subjectId) return;
    const request = ++requestId.current;
    setLoading(true);
    setLoadError('');
    const { data, error: requestError } = await supabase.rpc('vista_list_credits', {
      p_subject_type: subjectType,
      p_subject_id: subjectId
    });
    if (request !== requestId.current) return;
    setLoadError(requestError ? 'No pudimos cargar los créditos. Vuelve a intentarlo.' : '');
    if (!requestError) setCredits(data || []);
    if (editable) {
      const { data: allowed } = await supabase.rpc('vista_can_manage_subject', {
        p_subject_type: subjectType,
        p_subject_id: subjectId
      });
      if (request !== requestId.current) return;
      setManageAllowed(Boolean(allowed));
    }
    setLoading(false);
  }, [editable, subjectId, subjectType]);

  useEffect(() => { setCredits([]); setManageAllowed(false); setManagerOpen(false); setError(''); load(); return () => { requestId.current += 1; }; }, [load]);

  const canManage = editable && manageAllowed;
  const visible = credits.filter(credit => credit.status === 'accepted');
  const pendingMine = credits.filter(credit => credit.can_respond);

  const closeManager = () => { if (!savingRef.current) { setManagerOpen(false); setError(''); } };

  const openManager = () => {
    setDraft(credits.map(credit => ({
      id: credit.id, contributor_id: credit.contributor_id, status: credit.status, originalRole: credit.role, originalStatus: credit.status,
      key: credit.id,
      role: credit.role,
      handle: credit.handle ? `@${credit.handle}` : '',
      display_name: credit.display_name,
      verified: Boolean(credit.handle)
    })));
    setError('');
    setManagerOpen(true);
  };

  const save = async () => {
    if (savingRef.current) return;
    setError('');
    let payload;
    try { payload = creditPayload(draft); } catch (validationError) { setError(validationError.message); return; }
    savingRef.current = true;
    setSaving(true);
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
    savingRef.current = false;
  };

  const respond = async (id, accept) => {
    if (respondingRef.current) return;
    respondingRef.current = true; setResponding(id); setError('');
    const { error: responseError } = await supabase.rpc('vista_respond_credit', { p_credit_id: id, p_accept: accept });
    if (responseError) setError(responseError.message || 'No pudimos registrar tu respuesta.');
    else await load();
    setResponding(null); respondingRef.current = false;
  };

  const updateDraft = (key, field, value) => setDraft(current => current.map(item => item.key === key ? { ...item, [field]: value, ...(field === 'role' ? { status: value.trim().toLowerCase() === item.originalRole?.trim().toLowerCase() ? item.originalStatus : undefined } : {}) } : item));
  const updateCredit = (key, patch) => setDraft(current => current.map(item => item.key === key ? { ...item, ...patch } : item));
  const shell = dark ? 'border-white/10 text-white' : 'border-[#d2d2d7] text-[#1d1d1f]';
  const muted = dark ? 'text-neutral-400' : 'text-[#86868b]';

  if (!subjectId) return null;

  return (
    <section className={`border-t pt-5 ${shell} ${className}`} aria-label="Créditos y colaboraciones">
      <div className="flex items-center gap-3">
        <UserCheck size={15} className={dark ? 'text-blue-400' : 'text-[#0066FF]'}/>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.16em]">Créditos y colaboraciones</p>
          {!loading && !loadError && visible.length === 0 && <p className={`text-[10px] mt-1 ${muted}`}>Sin créditos registrados todavía.</p>}
        </div>
        {canManage && !loadError && <button disabled={loading || Boolean(responding)} type="button" onClick={openManager} className={`h-8 px-3 rounded-md border text-[10px] font-bold inline-flex items-center gap-1.5 ${dark ? 'border-white/15 bg-white/5 hover:bg-white/10' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'}`}><Pencil size={12}/>Gestionar</button>}
      </div>

      {loading && <p className={`text-xs mt-3 ${muted}`} role="status">Cargando créditos...</p>}
      {loadError && <p role="alert" className="text-xs text-red-500 mt-3">{loadError} <button type="button" onClick={load} className="underline">Reintentar</button></p>}
      {error && !managerOpen && <p role="alert" className="text-xs text-red-500 mt-3">{error}</p>}
      {visible.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {visible.map(credit => (
          <button key={credit.id} type="button" disabled={!credit.handle} onClick={() => credit.handle && (window.location.href = `/?profile=${encodeURIComponent(credit.handle)}`)} className={`text-left group ${credit.handle ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className={`block text-[9px] font-bold uppercase ${muted}`}>{credit.role}</span>
            <span className="text-xs font-bold inline-flex items-center gap-1">{credit.profile_name || credit.display_name}{!credit.contributor_id && <span className={`text-[9px] font-normal ${muted}`}> · Nombre externo</span>}{credit.handle && <ExternalLink size={10} className="opacity-0 group-hover:opacity-60"/>}</span>
          </button>
        ))}
      </div>}

      {pendingMine.map(credit => <div key={credit.id} className={`mt-4 p-3 rounded-md border flex flex-col sm:flex-row sm:items-center gap-3 ${dark ? 'border-amber-400/30 bg-amber-400/10' : 'border-amber-200 bg-amber-50'}`}><p className="text-xs flex-1"><strong>{credit.role}</strong> · Confirma si participaste en esta publicación.</p><div className="flex gap-2"><button type="button" disabled={Boolean(responding)} onClick={() => respond(credit.id, false)} className="h-8 px-3 rounded-md border border-current text-[10px] font-bold">Rechazar</button><button type="button" disabled={Boolean(responding)} onClick={() => respond(credit.id, true)} className="h-8 px-3 rounded-md bg-emerald-600 text-white text-[10px] font-bold inline-flex items-center gap-1"><Check size={12}/>{responding === credit.id ? 'Guardando...' : 'Aceptar'}</button></div></div>)}

      {managerOpen && <div className="fixed inset-0 z-[10000] bg-black/55 backdrop-blur-sm p-4 flex items-center justify-center" onClick={closeManager}><div role="dialog" aria-modal="true" aria-label="Créditos de la publicación" className="w-full max-w-2xl max-h-[86vh] overflow-y-auto bg-white text-[#1d1d1f] rounded-lg shadow-2xl border border-[#d2d2d7]" onClick={event => event.stopPropagation()}>
        <header className="sticky top-0 bg-white border-b border-[#d2d2d7] px-5 py-4 flex items-center gap-3 z-10"><div className="flex-1"><h3 className="font-bold">Créditos de la publicación</h3><p className="text-[10px] text-[#86868b] mt-1">Busca un GBA ID para solicitar su confirmación o escribe un nombre externo. Las confirmaciones se conservan al guardar.</p></div><button type="button" onClick={closeManager} className="w-9 h-9 rounded-md bg-[#f5f5f7] flex items-center justify-center" title="Cerrar"><X size={16}/></button></header>
        <fieldset disabled={saving} className="p-5 space-y-3">
          {draft.map((credit, index) => <div key={credit.key} className="grid sm:grid-cols-[150px_1fr_1fr_36px] gap-2 p-3 border border-[#e5e5e7] rounded-md bg-[#fbfbfd]">
            <input value={credit.role} onChange={event => updateDraft(credit.key, 'role', event.target.value)} maxLength={60} aria-label={`Rol del crédito ${index + 1}`} placeholder="Rol: Periodista" className="h-10 px-3 rounded-md border border-[#d2d2d7] text-xs outline-none focus:border-[#0066FF]"/>
            <GbaIdLookup
              credit={credit}
              onChange={value => updateCredit(credit.key, { handle: value, verified: false, contributor_id: null, status: undefined })}
              onSelect={profile => updateCredit(credit.key, { handle: `@${profile.handle}`, display_name: profile.profile_name, contributor_id: profile.user_id, status: undefined, verified: true })}
            />
            <input value={credit.display_name} onChange={event => updateDraft(credit.key, 'display_name', event.target.value)} maxLength={80} aria-label={`Nombre del crédito ${index + 1}`} placeholder="Nombre mostrado" className="h-10 px-3 rounded-md border border-[#d2d2d7] text-xs outline-none focus:border-[#0066FF]"/>
            <button type="button" onClick={() => setDraft(current => current.filter(item => item.key !== credit.key))} className="w-9 h-10 rounded-md text-red-600 hover:bg-red-50 flex items-center justify-center" title={`Eliminar crédito ${index + 1}`}><Trash2 size={15}/></button>
            <p className="sm:col-span-4 text-[10px] text-[#626269]">{creditStatusLabel(credit)}{!credit.contributor_id && ' · Atribución escrita por el editor; sin confirmación mediante GBA ID.'}</p>
          </div>)}
          {!draft.length && <p className="py-8 text-center text-xs text-[#86868b] border border-dashed border-[#d2d2d7] rounded-md">Añade a quienes hicieron posible esta publicación.</p>}
          <button type="button" disabled={draft.length >= 30 || saving} onClick={() => setDraft(current => [...current, emptyCredit()])} className="h-10 px-4 rounded-md border border-[#d2d2d7] text-xs font-bold inline-flex items-center gap-2"><Plus size={14}/>Añadir crédito</button>
          {error && <p role="alert" className="p-3 border border-red-200 bg-red-50 text-red-700 rounded-md text-xs">{error}</p>}
        </fieldset>
        <footer className="sticky bottom-0 bg-white border-t border-[#d2d2d7] px-5 py-4 flex justify-end gap-2"><button type="button" onClick={closeManager} className="h-10 px-4 rounded-md border border-[#d2d2d7] text-xs font-bold">Cancelar</button><button type="button" onClick={save} disabled={saving} className="h-10 px-4 rounded-md bg-[#0066FF] text-white text-xs font-bold disabled:opacity-50">{saving ? 'Guardando' : 'Guardar créditos'}</button></footer>
      </div></div>}
    </section>
  );
}
