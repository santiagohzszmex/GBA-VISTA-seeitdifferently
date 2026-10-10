import React, { useEffect, useRef } from 'react';
import EditionDocuments from './EditionDocuments';
export default function ReferenceDialog({ project, data, onClose }) {
  const panel = useRef(null);
  const close = useRef(null);
  useEffect(() => { const previous = document.activeElement; close.current?.focus(); return () => { if (previous?.isConnected) previous.focus(); }; }, []);
  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    if (event.key === 'Tab') {
      const items = [...panel.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href]')];
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1]?.focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0]?.focus(); }
    }
  }
  return <div className="gw-dialog-backdrop"><section ref={panel} className="gw-reference-dialog" role="dialog" aria-modal="true" aria-label="Consultar documentos sin cerrar el borrador" onKeyDown={keys}><div className="gw-reference-dialog-header"><div><h2>Documentos de {project.title}</h2><p>Tu borrador sigue abierto mientras consultas estas referencias.</p></div><button type="button" ref={close} onClick={onClose}>Volver a escribir</button></div><EditionDocuments project={project} data={data} /></section></div>;
}
