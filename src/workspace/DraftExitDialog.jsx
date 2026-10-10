import React, { useEffect, useId, useRef } from 'react';

export default function DraftExitDialog({ onStay, onDiscard }) {
  const titleId = useId();
  const descriptionId = useId();
  const stay = useRef(null);
  const discard = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    stay.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, []);

  function keys(event) {
    if (event.key === 'Escape') { event.preventDefault(); onStay(); }
    if (event.key === 'Tab') {
      event.preventDefault();
      if (document.activeElement === stay.current) discard.current?.focus();
      else stay.current?.focus();
    }
  }

  return <div className="gw-dialog-backdrop">
    <section className="gw-draft-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={keys}>
      <h2 id={titleId}>Hay cambios sin guardar</h2>
      <p id={descriptionId}>Puedes seguir escribiendo o salir y descartar estos cambios. Lo que guardaste o enviaste antes se conserva.</p>
      <div className="gw-actions"><button type="button" ref={stay} onClick={onStay}>Seguir escribiendo</button><button type="button" ref={discard} onClick={onDiscard}>Descartar y salir</button></div>
    </section>
  </div>;
}
