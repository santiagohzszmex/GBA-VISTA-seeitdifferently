import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

export default function SaveNotice({ message, onDismiss }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!message || paused) return;
    const timer = setTimeout(onDismiss, 12000);
    return () => clearTimeout(timer);
  }, [message, paused, onDismiss]);
  if (!message) return null;
  const Icon = /^(Borrador guardado|Referencia guardada|Original guardado|Cambio guardado|Documento (enviado|aceptado)|Licencia creada|Referencia archivada)/.test(message) ? CheckCircle2 : Info;
  return <div className="gw-save-notice" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <Icon size={20} aria-hidden="true" /><p role="status" aria-live="polite">{message}</p><button type="button" aria-label="Cerrar aviso" onClick={onDismiss}><X size={17} aria-hidden="true" /></button>
  </div>;
}
