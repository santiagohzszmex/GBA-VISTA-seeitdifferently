import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowUpRight, BarChart3, Check, Copy, Download, MessageSquare, RefreshCw, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { OPTIONS, QUESTION_LABELS, SURVEY_KEY, SURVEY_PATH, countryName, isAdminResponse, optionLabel, safeCsvCell, tally } from '../survey/questionnaire';

const dateFormat=new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short'});
const dayFormat=new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short'});
const labelFor=(key,value)=>key==='country'?countryName(value):optionLabel(key,value);
function Bars({rows,field,title}) {
  const {total,values}=tally(rows,field);
  return <section className="border border-white/10 p-5 md:p-6 min-w-0"><h3 className="text-sm font-medium text-white">{title||QUESTION_LABELS[field]}</h3><p className="text-[11px] text-neutral-400 mt-1 mb-6">{total} {total===1?'respuesta':'respuestas'} a esta pregunta</p>{values.length?values.map(([value,count])=><div key={value} className="mb-5 last:mb-0"><div className="flex justify-between items-start gap-4 text-[11px] mb-2"><span className="text-neutral-300">{labelFor(field,value)}</span><span className="text-white shrink-0 tabular-nums">{count} · {Math.round(count/total*100)}%</span></div><div className="h-1.5 bg-white/5"><div className="h-full bg-emerald-400/80" style={{width:`${count/total*100}%`}}/></div></div>):<p className="text-xs text-neutral-500">Todavía no hay respuestas para esta pregunta.</p>}</section>;
}
function BudgetSummary({rows}) {
  const groups=new Map();
  rows.filter(row=>row.answers.budget_status==='amount').forEach(row=>{
    const a=row.answers,currency=a.currency==='OTHER'?a.currency_other:a.currency;
    const values=groups.get(currency)||[];values.push(Number(a.budget_amount));groups.set(currency,values);
  });
  return <section className="border border-white/10 p-5 md:p-6"><h3 className="text-sm font-medium text-white">Presupuestos mensuales por moneda</h3><p className="text-[11px] text-neutral-400 mt-1 mb-6">Cantidades declaradas; no son compras ni tarifas aprobadas.</p>{groups.size?[...groups].map(([currency,values])=>{
    values.sort((a,b)=>a-b);const middle=Math.floor(values.length/2),median=values.length%2?values[middle]:(values[middle-1]+values[middle])/2;
    return <div key={currency} className="py-4 border-t border-white/10"><div className="flex justify-between gap-4"><strong className="text-sm font-medium">{currency}</strong><span className="text-xs text-neutral-400">{values.length} respuestas</span></div><p className="mt-2 text-lg tabular-nums">{median.toLocaleString('es-MX',{maximumFractionDigits:2})}<span className="ml-2 text-[10px] text-neutral-400">mediana mensual</span></p><p className="mt-1 text-[11px] text-neutral-400">Rango: {values[0].toLocaleString('es-MX')}–{values.at(-1).toLocaleString('es-MX')} {currency}</p></div>;
  }):<p className="text-xs text-neutral-500">Todavía no hay cantidades declaradas.</p>}</section>;
}
function DailyChart({rows}) {
  const counts=new Map();rows.forEach(row=>{const day=row.created_at.slice(0,10);counts.set(day,(counts.get(day)||0)+1);});
  const days=[...counts].sort((a,b)=>a[0].localeCompare(b[0])).slice(-14),max=Math.max(1,...days.map(([,count])=>count));
  return <section className="border border-white/10 p-6"><h3 className="text-sm font-medium">Respuestas por día</h3><p className="text-[11px] text-neutral-400 mt-1">Últimos 14 días con respuestas · UTC</p>{days.length?<div className="flex items-end gap-2 mt-8 h-48">{days.map(([day,count])=><div key={day} className="flex-1 h-full min-w-0 flex flex-col justify-end items-center" title={`${day}: ${count} respuestas`}><span className="text-[11px] text-neutral-300 mb-2 tabular-nums">{count}</span><div className="w-full max-w-16 bg-emerald-400/80" style={{height:`${count/max*70}%`}}/><span className="text-[9px] text-neutral-400 mt-3 text-center">{dayFormat.format(new Date(`${day}T12:00:00Z`))}</span></div>)}</div>:<p className="mt-8 text-xs text-neutral-500">Las primeras respuestas aparecerán aquí.</p>}</section>;
}
export default function SurveysTab({previewMode=false}) {
  const {isDueño}=useAuth();
  const [rows,setRows]=useState([]),[definition,setDefinition]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [tab,setTab]=useState('summary'),[role,setRole]=useState(''),[country,setCountry]=useState(''),[since,setSince]=useState(''),[until,setUntil]=useState('');
  const [connection,setConnection]=useState('connecting'),[updated,setUpdated]=useState(null),[copied,setCopied]=useState(false),[selected,setSelected]=useState(null),[saving,setSaving]=useState(false),[controlError,setControlError]=useState('');
  const sequence=useRef(0),alive=useRef(true);
  const load=useCallback(async(quiet=false)=>{
    if(!isDueño&&!previewMode)return;
    const request=++sequence.current;
    if(!quiet)setLoading(true);setError('');
    if(previewMode){setRows([]);setDefinition({is_open:true});setLoading(false);setUpdated(new Date());return;}
    try {
      const {data:survey,error:surveyError}=await supabase.from('vista_surveys').select('*').eq('key',SURVEY_KEY).single();if(surveyError)throw surveyError;
      const results=[];
      for(let offset=0;;offset+=1000){
        const {data,error:failed}=await supabase.from('vista_survey_responses').select('id,version,user_id,answers,created_at').eq('survey_key',SURVEY_KEY).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
        if(failed)throw failed;results.push(...data);if(data.length<1000)break;
      }
      if(alive.current&&request===sequence.current){setRows(results);setDefinition(survey);setUpdated(new Date());}
    } catch {if(alive.current&&request===sequence.current)setError('No pudimos consultar las respuestas. Comprueba la conexión y vuelve a intentar.');}
    finally {if(alive.current&&request===sequence.current)setLoading(false);}
  },[isDueño,previewMode]);
  useEffect(()=>{
    alive.current=true;load();
    if(previewMode||!isDueño){setConnection(previewMode?'preview':'offline');return()=>{alive.current=false;};}
    let timer;
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>load(true),350);};
    const channel=supabase.channel(`vista-survey-admin-${crypto.randomUUID()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'vista_survey_responses',filter:`survey_key=eq.${SURVEY_KEY}`},refresh).on('postgres_changes',{event:'UPDATE',schema:'public',table:'vista_surveys',filter:`key=eq.${SURVEY_KEY}`},refresh).subscribe(status=>{
      if(!alive.current)return;
      setConnection(status==='SUBSCRIBED'?'live':status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'?'offline':'connecting');
      if(status==='SUBSCRIBED')load(true);
    });
    const visible=()=>{if(document.visibilityState==='visible')load(true);};
    const reconnect=()=>load(true);
    const fallback=setInterval(()=>{if(document.visibilityState==='visible')load(true);},30000);
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',reconnect);
    return()=>{alive.current=false;sequence.current++;clearTimeout(timer);clearInterval(fallback);supabase.removeChannel(channel);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',reconnect);};
  },[load,isDueño,previewMode]);
  const filtered=useMemo(()=>rows.filter(row=>(!role||row.answers.roles?.includes(role))&&(!country||row.answers.country===country)&&(!since||row.created_at.slice(0,10)>=since)&&(!until||row.created_at.slice(0,10)<=until)),[rows,role,country,since,until]);
  const countries=[...new Set(rows.map(row=>row.answers.country))].sort((a,b)=>countryName(a).localeCompare(countryName(b),'es'));
  const adminRows=filtered.filter(row=>isAdminResponse(row.answers));
  const today=new Date().toISOString().slice(0,10);
  async function copyLink(){try{await navigator.clipboard.writeText(`${window.location.origin}${SURVEY_PATH}`);setCopied(true);}catch{setControlError('No se pudo copiar el enlace. Abre la encuesta y cópialo desde la barra de direcciones.');}}
  async function toggleOpen(){
    if(previewMode)return;
    setSaving(true);setControlError('');
    const {data,error:failed}=await supabase.from('vista_surveys').update({is_open:!definition.is_open}).eq('key',SURVEY_KEY).select('key,is_open').single();
    if(failed)setControlError('No se pudo cambiar la recepción de respuestas.');else setDefinition(current=>({...current,is_open:data.is_open}));
    setSaving(false);
  }
  function exportCsv(){
    const fields=['id','fecha_utc','tipo_respuesta','roles','country','frequency','content','server_info','placements','goal','budget_status','budget_amount','currency','payment','comment'];
    const csv=[fields.map(safeCsvCell).join(','),...filtered.map(row=>fields.map(key=>{
      const a=row.answers;
      const value=key==='id'?row.id:key==='fecha_utc'?row.created_at:key==='tipo_respuesta'?(row.user_id?'GBA ID':'Sin cuenta'):key==='currency'?(a.currency==='OTHER'?a.currency_other:a.currency):key==='country'?countryName(a.country):Array.isArray(a[key])?a[key].map(v=>optionLabel(key,v)).join(' | '):OPTIONS[key]?optionLabel(key,a[key]):a[key];
      return safeCsvCell(a[`${key}_other`]&&key!=='currency'?`${value} | ${a[`${key}_other`]}`:value);
    }).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`vista-encuesta-${today}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(!isDueño&&!previewMode)return <p className="text-sm text-neutral-400">Este apartado requiere permisos de administración.</p>;
  return <section className="max-w-6xl mx-auto">
    <header className="flex flex-wrap justify-between items-end gap-5 border-b border-white/10 pb-7"><div><p className="text-emerald-400 uppercase tracking-[.2em] text-[10px] mb-3">VISTA escucha</p><h2 className="font-serif italic text-4xl text-white">Encuestas.</h2><p className="text-neutral-400 text-xs mt-3">El siguiente capítulo de VISTA · Network y GBA Partners</p></div><div className="flex flex-wrap gap-2"><a href={SURVEY_PATH} target="_blank" rel="noopener noreferrer" className="flex gap-2 items-center border border-white/15 px-4 py-3 text-[10px] text-neutral-300">Abrir encuesta <ArrowUpRight size={13}/></a><button onClick={copyLink} className="flex gap-2 items-center border border-white/15 px-4 py-3 text-[10px] text-neutral-300">{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copiado':'Copiar enlace'}</button><button onClick={()=>load()} disabled={loading} aria-label="Actualizar resultados" className="p-3 border border-white/15 disabled:opacity-40"><RefreshCw size={13}/></button></div></header>
    <div className="flex flex-wrap items-center justify-between gap-4 py-5 text-[10px]"><div className="flex gap-3 items-center text-neutral-400"><span className={`w-1.5 h-1.5 rounded-full ${connection==='live'?'bg-emerald-400':'bg-amber-300'}`}/><span>{connection==='live'?'En vivo':connection==='preview'?'Vista de desarrollo':connection==='connecting'?'Conectando…':'Sin conexión en vivo · consulta automática cada 30 s'}</span>{updated&&<span>Última consulta: {updated.toLocaleTimeString('es-MX')}</span>}</div>{definition&&<button type="button" onClick={toggleOpen} disabled={saving||previewMode} className="border border-white/15 px-3 py-2 text-neutral-300 disabled:opacity-50">{saving?'Guardando…':definition.is_open?'Recepción abierta · Pausar':'Recepción pausada · Reabrir'}</button>}</div>
    {controlError&&<p className="text-xs text-red-300 mb-4" role="alert">{controlError}</p>}{error&&<p className="text-xs text-red-300 border border-red-400/20 p-5 mb-6" role="alert">{error}</p>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-7">{[['Respuestas totales',rows.length,Users],['Recibidas hoy · UTC',rows.filter(row=>row.created_at.startsWith(today)).length,Activity],['Perfil administrador',rows.filter(row=>isAdminResponse(row.answers)).length,BarChart3],['Con comentarios',rows.filter(row=>row.answers.comment?.trim()).length,MessageSquare]].map(([label,value,Icon])=><div key={label} className="border border-white/10 bg-white/[.025] p-5"><div className="flex justify-between gap-2 text-[10px] text-neutral-400"><span>{label}</span><Icon size={14}/></div><p className="text-3xl mt-5 text-white tabular-nums">{loading?'—':value}</p></div>)}</div>
    <div className="flex gap-1 border-b border-white/10 mb-6" role="tablist" aria-label="Vistas de resultados">{[['summary','Resumen'],['questions','Por pregunta'],['responses','Respuestas']].map(([key,label])=><button key={key} id={`survey-${key}-tab`} role="tab" aria-controls="survey-results" aria-selected={tab===key} onClick={()=>{setTab(key);setSelected(null);}} className={`px-4 py-3 text-[11px] border-b-2 ${tab===key?'border-emerald-400 text-white':'border-transparent text-neutral-400'}`}>{label}</button>)}</div>
    <div className="flex flex-wrap items-end gap-3 mb-6">{[['Perfil',role,setRole,OPTIONS.roles],['País',country,setCountry,countries.map(code=>[code,countryName(code)])]].map(([label,value,change,choices])=><label key={label} className="text-[10px] text-neutral-400 flex-1 min-w-36">{label}<select value={value} onChange={e=>change(e.target.value)} className="block w-full bg-[#141414] border border-white/15 text-neutral-200 px-3 py-2 mt-2 text-xs"><option value="">Todos</option>{choices.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>)}<label className="text-[10px] text-neutral-400">Desde · UTC<input type="date" value={since} onChange={e=>setSince(e.target.value)} className="block bg-[#141414] border border-white/15 text-neutral-200 px-3 py-2 mt-2 text-xs [color-scheme:dark]"/></label><label className="text-[10px] text-neutral-400">Hasta · UTC<input type="date" value={until} onChange={e=>setUntil(e.target.value)} className="block bg-[#141414] border border-white/15 text-neutral-200 px-3 py-2 mt-2 text-xs [color-scheme:dark]"/></label><button onClick={exportCsv} disabled={!filtered.length||loading} className="flex gap-2 items-center border border-white/15 px-4 py-2 text-[10px] text-neutral-300 disabled:opacity-35"><Download size={13}/> CSV</button></div>
    <p className="text-[11px] text-neutral-400 mb-6">{filtered.length} respuestas con estos filtros · {adminRows.length} incluyen perfil administrador. Los perfiles son declarados por cada participante y pueden coincidir.</p>
    <div id="survey-results" role="tabpanel" aria-labelledby={`survey-${tab}-tab`}>
      {tab==='summary'&&<div className="grid md:grid-cols-2 gap-4"><DailyChart rows={filtered}/><Bars rows={filtered} field="roles"/><Bars rows={filtered} field="country"/><Bars rows={filtered} field="content"/><Bars rows={adminRows} field="placements"/><BudgetSummary rows={adminRows}/></div>}
      {tab==='questions'&&<><p className="text-[11px] text-neutral-400 mb-5">En selección múltiple, los porcentajes pueden sumar más de 100%. Cada gráfica usa las respuestas a esa pregunta.</p><div className="grid md:grid-cols-2 gap-4">{['roles','country','frequency','content','server_info','placements','goal','budget_status','payment'].map(field=><Bars key={field} rows={filtered} field={field}/>)}<BudgetSummary rows={adminRows}/></div><div className="mt-5 border border-white/10 p-6"><h3 className="text-sm mb-5">Comentarios y opciones «otro»</h3>{filtered.filter(row=>Object.keys(row.answers).some(key=>(key.endsWith('_other')||key==='comment')&&row.answers[key])).map(row=><article key={row.id} className="py-4 border-t border-white/10"><p className="text-[10px] text-neutral-400 mb-2">{dateFormat.format(new Date(row.created_at))}</p>{Object.entries(row.answers).filter(([key,value])=>(key.endsWith('_other')||key==='comment')&&value).map(([key,value])=><p key={key} className="text-xs text-neutral-300 leading-6 whitespace-pre-wrap break-words">{key==='comment'?'Comentario':QUESTION_LABELS[key.replace('_other','')]||'Moneda'}: {value}</p>)}</article>)}{!filtered.some(row=>Object.keys(row.answers).some(key=>(key.endsWith('_other')||key==='comment')&&row.answers[key]))&&<p className="text-xs text-neutral-500">Todavía no hay comentarios.</p>}</div></>}
      {tab==='responses'&&<div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-5"><div>{filtered.length?filtered.map(row=><button key={row.id} onClick={()=>setSelected(row.id)} className={`w-full text-left p-4 border-b border-white/10 ${selected===row.id?'bg-white/5':''}`}><span className="block text-xs text-white">{row.answers.roles.map(value=>optionLabel('roles',value)).join(' · ')}</span><span className="block text-[10px] text-neutral-400 mt-2">{countryName(row.answers.country)} · {dateFormat.format(new Date(row.created_at))} · {row.user_id?'GBA ID':'Sin cuenta'}</span></button>):<p className="text-xs text-neutral-500">Todavía no hay respuestas con estos filtros.</p>}</div><div className="border border-white/10 p-6">{selected&&filtered.find(row=>row.id===selected)?<>{Object.entries(filtered.find(row=>row.id===selected).answers).map(([key,value])=><div key={key} className="pb-4 mb-4 border-b border-white/10"><p className="text-[10px] text-neutral-400 mb-2">{QUESTION_LABELS[key]||({comment:'Comentario',budget_amount:'Cantidad mensual',currency:'Moneda',currency_other:'Otra moneda'}[key])||`${QUESTION_LABELS[key.replace('_other','')]||key} · Otro`}</p><p className="text-xs text-neutral-200 leading-6 whitespace-pre-wrap break-words">{Array.isArray(value)?value.map(v=>optionLabel(key,v)).join(' · '):labelFor(key,value)}</p></div>)}</>:<p className="text-xs text-neutral-400">Selecciona una respuesta para leer el cuestionario completo.</p>}</div></div>}
    </div>
  </section>;
}
