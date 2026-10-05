import React, { useEffect, useRef, useState } from 'react';
import { X, ArrowUpRight } from 'lucide-react';
import { halloweenIcon, isHalloweenSeason } from '../../utils/season';

const treats = [
  ['El futuro no da miedo.', 'Mirarlo siempre igual, sí. Esta noche, cambia de perspectiva.'],
  ['Hay historias del otro lado.', 'Un servidor por descubrir. Una edición por abrir. Alguien con quien crear.'],
  ['Tu próxima idea está viva.', 'Que no se quede como un fantasma. Dale un lugar en VISTA.'],
  ['Hoy te toca un trato.', 'Una mirada nueva para un mundo que todavía tiene mucho que contar.'],
];

export default function HalloweenScene() {
  const scene = useRef(null);
  const trigger = useRef(null);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [treat, setTreat] = useState(0);
  const active = isHalloweenSeason();
  useEffect(() => {
    if (!active || !scene.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(scene.current);
    return () => observer.disconnect();
  }, [active]);
  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  if (!active) return null;
  return <div ref={scene} className={`hw-scene ${visible ? 'hw-visible' : ''} ${open ? 'hw-awake' : ''}`}>
    <div className="hw-night" aria-hidden="true"/>
    <div className="hw-moon" aria-hidden="true"><span/><img className="hw-moon-ghost" src={halloweenIcon('ghost')} alt="" width="64" height="64"/></div>
    <div className="hw-flight" aria-hidden="true">{[1,2,3].map(n => <img key={n} className={`hw-bat hw-bat-${n}`} src={halloweenIcon('bat')} alt="" width="64" height="64"/>)}</div>
    <svg className="hw-web" viewBox="0 0 180 180" fill="none" aria-hidden="true"><path d="M180 0H0M180 0V180M180 0L0 180M180 0L20 80M180 0L100 180M140 0Q143 22 151 29Q162 34 180 40M105 0Q111 40 123 57Q143 70 180 75M70 0Q79 62 95 85Q124 106 180 110M35 0Q48 84 67 113Q103 145 180 145"/></svg>
    <div className="hw-edition" onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); close(); } }}>
      <span className="hw-edition-label">VISTA · EDICIÓN DE OCTUBRE</span>
      <button ref={trigger} type="button" className="hw-treat-trigger" aria-expanded={open} aria-controls="vista-halloween-treat" onClick={() => { if (!open) setTreat(Math.floor(Math.random() * treats.length)); setOpen(!open); }}>
        <img src={halloweenIcon('pumpkin')} alt="" width="42" height="42"/><span>Truco o trato</span><ArrowUpRight size={14}/>
      </button>
      {open && <div id="vista-halloween-treat" className="hw-treat">
        <button type="button" className="hw-treat-close" aria-label="Cerrar sorpresa de Halloween" onClick={close}><X size={18}/></button>
        <img src={halloweenIcon('wrapped-candy')} alt="" width="48" height="48"/>
        <div role="status"><p className="hw-treat-label">UN TRATO, SIN SUSTOS.</p><h2>{treats[treat][0]}</h2><p>{treats[treat][1]}</p></div>
        <span className="hw-signature">See it differently.</span>
      </div>}
    </div>
    <p className="hw-caption" aria-hidden="true"><span/>No le temas a otra perspectiva.</p>
  </div>;
}
