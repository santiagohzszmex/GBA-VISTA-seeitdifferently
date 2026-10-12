import React, { useState } from 'react';
import { PanelLeftClose } from 'lucide-react';
import EditionDocuments from './EditionDocuments';
export default function ReferenceSplit({ open, project, data, onClose, children, task, initialReferenceId }) {
  const [width, setWidth] = useState(40);
  const linked = data.taskReferences?.[task?.id] || [];
  const scopedData = linked.length ? {...data,references:[...linked.map(row=>({...row.snapshot,id:row.reference_id,title:row.title,originals:row.originals || [],can_edit:false})),...(data.references || []).filter(reference=>!linked.some(row=>row.reference_id===reference.id))]} : data;
  return <div className={`gw-reference-split${open ? ' gw-reference-split-open' : ''}`} style={{'--reference-size': `${width}%`}}>
    <aside className="gw-reference-pane" hidden={!open} aria-label="Referencia junto al trabajo">{open && <><div className="gw-reference-pane-heading"><strong>Consultar mientras trabajas</strong><button type="button" onClick={onClose} aria-label="Cerrar pantalla dividida"><PanelLeftClose size={18} /></button></div><label className="gw-reference-width">Espacio de la referencia<input type="range" min="30" max="55" step="5" value={width} onChange={event => setWidth(Number(event.target.value))} /></label>{linked.length>0 && <p className="gw-opal-material-note">Materiales del encargo: se consulta la versión enlazada al asignar el trabajo.</p>}<EditionDocuments key={initialReferenceId || task?.id || project.id} initialReferenceId={initialReferenceId || linked[0]?.reference_id} compact project={project} data={scopedData} /></>}</aside>
    <div className="gw-reference-work">{children}</div>
  </div>;
}
