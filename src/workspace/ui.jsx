import React, { useRef } from 'react';
import { supabase } from '../supabaseClient';
import { STATES, dateLabel, inputDate, isoDate } from './gimgModel';
export const choices=(items,label='title')=>Object.fromEntries(items.map(x=>[x.id||x.user_id,x[label]||x.display_name]));
export async function rpc(name,args){const {data,error}=await supabase.rpc(name,args);if(error)throw error;return data;}
export function CommandForm({fields,onSave,initial={},button='Guardar',busy=false,resetOnSuccess=Object.keys(initial).length === 0}){
 const submitting = useRef(false);
 async function submit(event) {
  event.preventDefault();
  if (busy || submitting.current) return;
  submitting.current = true;
  const form = event.currentTarget;
  const values = new FormData(form);
  const out = {};
  for (const [key, field] of Object.entries(fields)) {
   const value = values.get(key);
   out[key] = field.type === 'datetime-local' ? isoDate(value) : value || null;
  }
  try {
   const result = await onSave(out);
   if (resetOnSuccess && result) form.reset();
  } finally { submitting.current = false; }
 }
 return <form className="gw-form" onSubmit={submit}>{Object.entries(fields).map(([key,value])=>{
  const f=typeof value==='string'?{label:value}:value;
  const initialValue=f.type==='datetime-local'?inputDate(initial[key]):initial[key]??'';
  const inputProps={name:key,disabled:busy,required:!f.optional,defaultValue:initialValue};
  return <label key={key} className={f.type==='textarea'?'gw-field-wide':undefined}>{f.label}{f.options?<select {...inputProps}><option value="">Seleccionar</option>{Object.entries(f.options).map(([id,name])=><option value={id} key={id}>{name}</option>)}</select>:f.type==='textarea'?<textarea {...inputProps} minLength={f.minLength}/>:<input {...inputProps} minLength={f.minLength} type={f.type||'text'}/>}</label>;
 })}<button className="gw-primary" disabled={busy}>{button}</button></form>;
}

export function TaskList({tasks,onPick,selectedId}){return <div className="gw-list">{tasks.map(t=><button key={t.id} className={selectedId===t.id?'gw-selected':''} onClick={()=>onPick(t)}><div className="gw-row"><strong>{t.title}</strong><span className="gw-badge">{STATES[t.state]}</span></div><p>{dateLabel(t.due_at)}</p>{t.block_reason&&<p className="gw-error">{t.block_reason}</p>}</button>)}{!tasks.length&&<p className="gw-empty">No hay trabajos en esta lista.</p>}</div>;}
export function Activity({rows}){return <div className="gw-list">{rows.map(r=><article key={r.id}><strong>{r.action}</strong><p>{dateLabel(r.created_at)}</p><small>Actor: {r.actor_id} · Objeto: {r.entity_id||'Unidad'}</small>{r.context?.reason&&<p>{r.context.reason}</p>}</article>)}{!rows.length&&<p className="gw-empty">Sin actividad nueva en tu alcance.</p>}</div>;}
