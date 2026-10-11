import React, { useState } from 'react';
import { PanelLeftClose } from 'lucide-react';
import EditionDocuments from './EditionDocuments';
export default function ReferenceSplit({ open, project, data, onClose, children }) {
  const [width, setWidth] = useState(40);
  return <div className={`gw-reference-split${open ? ' gw-reference-split-open' : ''}`} style={{'--reference-size': `${width}%`}}>
    <aside className="gw-reference-pane" hidden={!open} aria-label="Referencia junto al trabajo">{open && <><div className="gw-reference-pane-heading"><strong>Consultar mientras trabajas</strong><button type="button" onClick={onClose} aria-label="Cerrar pantalla dividida"><PanelLeftClose size={18} /></button></div><label className="gw-reference-width">Espacio de la referencia<input type="range" min="30" max="55" step="5" value={width} onChange={event => setWidth(Number(event.target.value))} /></label><EditionDocuments compact project={project} data={data} /></>}</aside>
    <div className="gw-reference-work">{children}</div>
  </div>;
}
