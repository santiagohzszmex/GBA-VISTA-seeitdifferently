import React from 'react';
import {Plus, Trash2} from 'lucide-react';

export default function EditionCredits({credits = [], dark = false}) {
  const rows = Array.isArray(credits) ? credits.filter(row=>row?.role && row?.name) : [];
  return <section className={`edition-credits ${dark ? 'edition-credits-dark' : ''}`} aria-label="Créditos de la edición">
    <p className="edition-credits-label">QUIÉNES HICIERON ESTA EDICIÓN</p><h3>Créditos</h3>
    <p className="edition-credits-publisher">Una publicación de Global Insight Media Group · GIMG</p>
    {rows.length ? <dl>{rows.map((row,index)=><div key={index}><dt>{row.role}</dt><dd><strong>{row.name}</strong>{row.detail && <span>{row.detail}</span>}</dd></div>)}</dl> : <p>Los créditos de esta edición están pendientes de registrar.</p>}
  </section>;
}

export function EditionCreditsEditor({value = [], onChange, disabled}) {
  const update = (index,field,text)=>onChange(value.map((row,i)=>i===index?{...row,[field]:text}:row));
  return <fieldset disabled={disabled} className="ms-edition-credits">
    <legend>Créditos de la edición</legend><p className="ms-help">Nombres públicos y función real: investigación, redacción, ilustración, fotografía, diseño, traducción o dirección. Se publicarán al guardar. No añadas correos ni datos privados.</p>
    {value.map((row,index)=><div className="ms-credit-row" key={index}>
      <label className="ms-field"><span>Función</span><input aria-label={`Función del crédito ${index+1}`} maxLength={80} value={row.role} onChange={e=>update(index,'role',e.target.value)} placeholder="Ilustración"/></label>
      <label className="ms-field"><span>Nombre o seudónimo</span><input aria-label={`Nombre del crédito ${index+1}`} maxLength={120} value={row.name} onChange={e=>update(index,'name',e.target.value)} placeholder="Nombre que autorizó la persona"/></label>
      <label className="ms-field"><span>Aportación o páginas · opcional</span><input aria-label={`Aportación del crédito ${index+1}`} maxLength={240} value={row.detail || ''} onChange={e=>update(index,'detail',e.target.value)} placeholder="Portada y páginas 6–7"/></label>
      <button className="ms-button" type="button" aria-label={`Quitar crédito ${index+1}`} onClick={()=>onChange(value.filter((_,i)=>i!==index))}><Trash2 size={16}/></button>
    </div>)}
    <button type="button" className="ms-button" disabled={value.length>=80} onClick={()=>onChange([...value,{role:'',name:'',detail:''}])}><Plus size={15}/>Añadir persona y función</button>
    {!value.length && <p className="ms-help">Las ediciones nuevas necesitan al menos un crédito. Registra sólo participaciones confirmadas.</p>}
  </fieldset>;
}
