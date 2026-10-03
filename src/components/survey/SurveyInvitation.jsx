import React, { useEffect, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { STORAGE_KEY, SURVEY_KEY, SURVEY_PATH } from '../../survey/questionnaire';

export default function SurveyInvitation({dark=false}) {
  const [show,setShow]=useState(false);
  useEffect(()=>{
    let alive=true;
    try{if(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')?.submitted||sessionStorage.getItem('vista:survey:dismissed'))return;}catch{}
    supabase.from('vista_surveys').select('is_open').eq('key',SURVEY_KEY).single().then(({data})=>{if(alive)setShow(Boolean(data?.is_open));});
    return()=>{alive=false;};
  },[]);
  const close=()=>{setShow(false);try{sessionStorage.setItem('vista:survey:dismissed','1');}catch{}};
  if(!show)return null;
  return <aside className={`relative z-10 mx-6 md:mx-10 my-7 flex flex-wrap items-center justify-between gap-5 border-y py-6 ${dark?'border-white/15 text-white':'border-black/15 text-[#1d1d1f]'}`} aria-label="Encuesta de VISTA"><div><p className="uppercase text-[9px] tracking-[.2em] text-[#2a9d7d] mb-2">Tu perspectiva cuenta</p><h2 className="font-serif italic text-2xl">El siguiente capítulo de VISTA.</h2><p className={`text-xs mt-2 ${dark?'text-neutral-400':'text-neutral-500'}`}>Contenido, comunidades y GBA Partners. Ayúdanos a darle forma.</p></div><div className="flex gap-4 items-center"><a href={SURVEY_PATH} className={`flex items-center gap-3 px-5 py-3 border text-xs ${dark?'border-white/30 hover:bg-white/5':'border-black/20 hover:bg-black/5'}`}>Dar mi opinión <ArrowUpRight size={14}/></a><button type="button" aria-label="Cerrar invitación a la encuesta" onClick={close} className="p-3"><X size={15}/></button></div></aside>;
}
