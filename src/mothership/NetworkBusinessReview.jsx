import React, { useEffect, useState } from 'react';
import { Building2, Check, Eye, MapPin, ShieldCheck, Star, Store, X } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function NetworkBusinessReview() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [promoted, setPromoted] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('network_businesses').select('*').eq('estado', 'pendiente').order('created_at', { ascending: true });
    if (error) console.error('No se pudieron cargar las solicitudes de Network:', error);
    setItems(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const choose = item => {
    setSelected(item);
    setVerified(Boolean(item.verificada));
    setPromoted(Boolean(item.promocionada));
  };

  const notify = async (title, description, color) => {
    try {
      await supabase.functions.invoke('vista-discord-notify', { body: { event: 'admin_log', title, description, color } });
    } catch (error) {
      console.warn('Network se actualizo, pero Discord no recibio el aviso:', error);
    }
  };

  const review = async estado => {
    if (!selected || saving) return;
    if (estado === 'rechazado' && !window.confirm(`¿Rechazar la cuenta de ${selected.nombre}?`)) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc('vista_review_network_business', {
        p_business_id: selected.id,
        p_estado: estado,
        p_verificada: estado === 'aprobado' ? verified : false,
        p_promocionada: estado === 'aprobado' ? promoted : false
      });
      if (error) throw error;
      await notify(
        estado === 'aprobado' ? 'CUENTA DE NETWORK APROBADA' : 'CUENTA DE NETWORK RECHAZADA',
        `La cuenta **${selected.nombre}** fue ${estado === 'aprobado' ? 'autorizada para aparecer en Empyria' : 'devuelta para recibir cambios'}.`,
        estado === 'aprobado' ? 65280 : 16711680
      );
      setItems(current => current.filter(item => item.id !== selected.id));
      setSelected(null);
    } catch (error) {
      alert(error.message || 'No se pudo resolver la solicitud de Network.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-2 space-y-4">
        {loading ? <p className="text-neutral-500 italic py-6">Consultando solicitudes de Network...</p> : items.map(item => (
          <button key={item.id} type="button" onClick={() => choose(item)} className={`w-full flex items-center justify-between gap-4 p-5 bg-[#121212] border rounded-2xl text-left transition-all ${selected?.id === item.id ? 'border-blue-500 bg-blue-500/5' : 'border-white/10 hover:border-white/20'}`}>
            <span className="flex items-center gap-4 min-w-0"><span className="w-11 h-11 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">{item.account_type === 'company' ? <Building2 size={20}/> : <Store size={20}/>}</span><span className="min-w-0"><strong className="block text-base truncate">{item.nombre}</strong><span className="block text-[10px] text-neutral-500 mt-1 uppercase tracking-wider">{item.account_type === 'company' ? 'Empresa' : 'Negocio'} · {item.categoria} · Empyria</span></span></span>
            <span className="h-7 px-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0"><Eye size={11}/>Revision</span>
          </button>
        ))}
        {!loading && items.length === 0 && <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center bg-white/5"><ShieldCheck className="text-neutral-600 mx-auto mb-3" size={32}/><p className="text-neutral-500 text-sm font-medium">No hay cuentas de Network pendientes.</p></div>}
      </div>

      <aside className="lg:col-span-1">
        {selected ? <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 sticky top-8 space-y-6">
          <div className="flex items-start gap-3"><span className="w-12 h-12 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center">{selected.account_type === 'company' ? <Building2 size={21}/> : <Store size={21}/>}</span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Solicitud Network</p><h3 className="font-bold text-lg mt-1">{selected.nombre}</h3></div></div>
          <div><span className="text-[9px] uppercase tracking-widest font-black text-neutral-500">Presentacion</span><p className="text-sm font-bold mt-2">{selected.headline || 'Sin titular'}</p><p className="text-xs leading-5 text-neutral-400 mt-3">{selected.descripcion}</p></div>
          <div className="grid gap-3 text-[10px]"><span className="flex items-center gap-2 text-neutral-300"><MapPin size={13} className="text-neutral-500"/>{selected.ubicacion || 'Empyria'}</span><span className="flex items-center gap-2 text-neutral-300"><Store size={13} className="text-neutral-500"/>{selected.categoria}</span><span className="flex items-center gap-2 text-neutral-300"><Building2 size={13} className="text-neutral-500"/>{selected.contacto}</span></div>
          <div className="space-y-2 pt-4 border-t border-white/10"><label className="min-h-11 px-3 rounded-md border border-white/10 bg-black/20 flex items-center gap-3"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} className="accent-blue-500"/><span className="text-xs font-bold flex items-center gap-2"><ShieldCheck size={13}/>Perfil verificado</span></label><label className="min-h-11 px-3 rounded-md border border-white/10 bg-black/20 flex items-center gap-3"><input type="checkbox" checked={promoted} onChange={event => setPromoted(event.target.checked)} className="accent-amber-500"/><span className="text-xs font-bold flex items-center gap-2"><Star size={13}/>Promocionado</span></label></div>
          <div className="grid grid-cols-2 gap-3"><button type="button" disabled={saving} onClick={() => review('aprobado')} className="h-11 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"><Check size={15}/>Aprobar</button><button type="button" disabled={saving} onClick={() => review('rechazado')} className="h-11 rounded-md border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 text-neutral-400 hover:text-red-400 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"><X size={15}/>Rechazar</button></div>
        </div> : <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center text-neutral-600 text-xs h-64 flex flex-col items-center justify-center sticky top-8"><Eye size={24} className="mb-2 text-neutral-700"/>Selecciona una cuenta para revisar su perfil.</div>}
      </aside>
    </div>
  );
}
