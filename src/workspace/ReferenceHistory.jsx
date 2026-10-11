import React, { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { rpc } from './ui';
import StructuredDocument from './StructuredDocument';
import { DocumentContent } from './EditionDocuments';
import { dateLabel } from './gimgModel';

export default function ReferenceHistory({ id, previewRows }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState(null), [selected, setSelected] = useState(null), [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let active = true;
    (previewRows ? Promise.resolve(previewRows) : rpc('workspace_reference_history', {p_id:id})).then(result => {if(active){setRows(result);setSelected(result[0] || null);}}).catch(failure => {if(active)setError(failure.message);});
    return () => {active=false;};
  }, [id,open,previewRows]);
  return <div className="gw-reference-history"><button type="button" aria-expanded={open} onClick={() => setOpen(value=>!value)}><History size={15} />Historial de la referencia</button>{open && <section aria-label="Historial de la referencia">{error ? <p role="alert">{error}</p> : !rows ? <p role="status">Abriendo historial…</p> : <><label>Consultar versión<select value={selected?.revision ?? ''} onChange={event=>setSelected(rows.find(row=>String(row.revision)===event.target.value))}>{rows.map(row=><option key={row.revision} value={row.revision}>{row.revision===0 ? 'Descripción breve original' : `Versión ${row.revision}`} · {dateLabel(row.created_at)}</option>)}</select></label><p>Consulta del historial. Las versiones anteriores se conservan.</p>{selected?.snapshot.content_document ? <StructuredDocument document={selected.snapshot.content_document}/> : <DocumentContent content={selected?.snapshot.content_markdown}/>}</>}</section>}</div>;
}
