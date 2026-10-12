import React, { useEffect, useRef, useState } from 'react';
import { AtSign } from 'lucide-react';
import { rpc } from './ui';
import StructuredDocument from './StructuredDocument';
import { dateLabel } from './gimgModel';
export default function MentionDocument({ target, previewMode, previewState, onOpenCurrent }) {
  const [source,setSource]=useState(null),[error,setError]=useState('');const root=useRef(null);
  useEffect(()=>{let live=true;setSource(null);setError('');const promise=previewMode?Promise.resolve(target?.snapshot):rpc('workspace_notification_document',{p_id:target?.id});promise.then(value=>{if(live)setSource(value);}).catch(failure=>{if(live)setError(failure.message);});return()=>{live=false;};},[target?.id,previewMode]);
  useEffect(()=>{if(!source||!root.current)return;const element=[...root.current.querySelectorAll('[data-mention-id]')].find(node=>node.getAttribute('data-mention-id')===source.anchor_id);if(element){element.classList.add('gw-opal-mention-target');element.scrollIntoView({block:'center',behavior:'auto'});}},[source]);
  return <section className="gw-opal-mention-document" ref={root}><div className="gw-wk-head"><div><h1><AtSign size={22}/>Te mencionaron</h1><p>Consulta el documento en el momento de la mención.</p></div>{source&&<button type="button" className="gw-wk-btn" onClick={()=>onOpenCurrent(source)}>Abrir recurso actual</button>}</div>{error?<p role="alert" className="gw-error">{error}</p>:!source?<p role="status">Abriendo la mención…</p>:<article className="gw-document-paper"><p className="gw-eyebrow">{source.edition_title} · {dateLabel(source.created_at)}</p><h2>{source.title}</h2><StructuredDocument document={source.document}/></article>}</section>;
}
