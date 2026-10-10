import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../supabaseClient';
import { dateLabel } from './gimgModel';
import './workspace.css';
export default function WorkspacePublications(){
 const [publications,setPublications]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;supabase.from('workspace_publications').select('*').order('published_at',{ascending:false}).then(({data,error})=>{if(active){setPublications(data||[]);setError(error?'No pudimos consultar las publicaciones.':'');setLoading(false);}});return()=>{active=false;};},[]);
 return <div className="gw"><header><div><p className="gw-eyebrow">GIMG / VISTA</p><h1>Trabajo aprobado. Historias compartidas.</h1></div><a href="/">Volver a VISTA</a></header><main>{loading?<p role="status">Cargando publicaciones…</p>:error?<p role="alert">{error}</p>:<div className="gw-list">{publications.map(p=><article key={p.id}><h2>{p.title}</h2><small>{dateLabel(p.published_at)}</small><ReactMarkdown>{p.content_markdown}</ReactMarkdown><p>{p.credits}</p></article>)}{!publications.length&&<p>Las publicaciones aprobadas de GIMG aparecerán aquí.</p>}</div>}</main></div>;
}
