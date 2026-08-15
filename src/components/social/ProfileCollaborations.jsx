import React, { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function ProfileCollaborations({ userId }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!userId) return;
    supabase.rpc('vista_profile_credits', { p_user_id: userId }).then(({ data }) => setItems(data || []));
  }, [userId]);

  if (!items.length) return null;

  return <section className="pt-12 border-t border-[#d2d2d7]/60 mt-12">
    <div className="flex items-center gap-3 mb-7"><BadgeCheck size={18} className="text-[#0066FF]"/><div><h2 className="text-2xl font-serif italic font-bold">Colaboraciones verificadas</h2><p className="text-xs text-[#86868b] mt-1">Atribuciones confirmadas mediante GBA ID.</p></div></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map(item => <button key={item.id} type="button" onClick={() => window.location.href = item.action_url} className="min-h-24 p-4 bg-white border border-[#d2d2d7] rounded-md text-left flex items-center gap-4 hover:border-[#86868b] transition-colors group">
        <span className="w-12 h-12 rounded-md bg-[#f5f5f7] overflow-hidden flex items-center justify-center flex-shrink-0">{item.subject_image ? <img src={item.subject_image} alt="" className="w-full h-full object-cover"/> : <BadgeCheck size={19} className="text-[#0066FF]"/>}</span>
        <span className="min-w-0 flex-1"><span className="text-[9px] font-black uppercase tracking-wider text-[#0066FF] block">{item.role}</span><span className="text-sm font-bold line-clamp-2 mt-1">{item.subject_title}</span></span><ArrowUpRight size={14} className="text-[#86868b] group-hover:text-[#1d1d1f]"/>
      </button>)}
    </div>
  </section>;
}
