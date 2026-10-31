import React,{useEffect,useState} from 'react';
import {supabase} from '../supabaseClient';
import {publicationPages} from '../vista/catalog.mjs';
export default function ArchiveTab(){
 const [items,setItems]=useState([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;supabase.from('contenido').select('id,titulo,categoria,archived_at,archive_reason,enlace_pdf,calidad_json').not('archived_at','is',null).order('archived_at',{ascending:false}).then(({data,error})=>{if(active){setItems(data||[]);if(error)setError('No pudimos cargar el archivo.');}});return()=>{active=false;};},[]);
 return <section><p className="text-xs text-neutral-400 mb-3">ARCHIVO PRIVADO</p><h2 className="text-3xl mb-4">Publicaciones conservadas</h2><p className="text-neutral-400 mb-8">Este material no aparece en VISTA. Sus documentos se conservan para administración.</p>{error&&<p role="alert">{error}</p>}<div className="grid md:grid-cols-2 gap-4">{items.map(item=><article key={item.id} className="p-6 border border-white/10 rounded-xl min-w-0"><h3 className="text-lg font-semibold break-words">{item.titulo}</h3><p className="text-sm text-neutral-400 mt-2">{item.archive_reason||'Catálogo anterior'} · {new Date(item.archived_at).toLocaleDateString('es-MX')}</p><details className="mt-4"><summary>Consultar originales conservados</summary><ul className="mt-3 space-y-2">{publicationPages(item).map((url,i)=><li key={url}><a className="text-sm text-blue-300 underline" href={url} target="_blank" rel="noopener noreferrer">Abrir original {i+1}</a></li>)}</ul></details></article>)}</div></section>;
}
