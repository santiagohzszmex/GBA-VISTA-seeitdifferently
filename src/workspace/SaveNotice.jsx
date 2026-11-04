import React, { useEffect, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

// 1.7.2: el aviso distingue éxito, error e información con icono y color propios.
const SUCCESS = /(guardad[oa]s?|enviad[oa]|aceptad[oa]|cread[oa]|archivad[oa]|restaurad[oa]|registrad[oa]|revocad[oa]|aprobad[oa]|asignad[oa])\b/i;
const FAILURE = /(no (pudimos|se pudo|tienes|puedes)|error|fall[óo]|inválid|denegad|permiso|espera a que|ya no|conflicto|vuelve a intentarlo)/i;
export function noticeTone(message) { return FAILURE.test(message) && !/^Borrador guardado/.test(message) ? 'error' : SUCCESS.test(message) ? 'success' : 'info'; }

export default function SaveNotice({ message, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const tone = message ? noticeTone(message) : 'info';
  useEffect(() => {
    if (!message || paused) return;
    const timer = setTimeout(onDismiss, tone === 'error' ? 20000 : 12000);
    return () => clearTimeout(timer);
  }, [message, paused, onDismiss, tone]);
  if (!message) return null;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Info;
  return <div className="gw-save-notice" data-tone={tone} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
    <Icon size={20} aria-hidden="true" /><p role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>{message}</p><button type="button" aria-label="Cerrar aviso" onClick={onDismiss}><X size={17} aria-hidden="true" /></button>
  </div>;
}
