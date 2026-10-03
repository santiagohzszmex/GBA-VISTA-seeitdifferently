import React, { useEffect, useId, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';
import { safeUrl } from '../../network/serverData';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function NetworkImageInput({ label, value, file, onFileChange, onUrlChange, dark = false, logo = false, hint = '', previewMode = false }) {
  const id = useId();
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  useEffect(() => {
    setError('');
    if (input.current) { input.current.value = ''; input.current.setCustomValidity(''); }
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, value]);
  const choose = event => {
    const next = event.target.files?.[0];
    if (!next) return;
    const message = !IMAGE_TYPES.includes(next.type) ? 'Elige una imagen JPG, PNG o WebP.'
      : !next.size ? 'Este archivo está vacío.'
      : next.size > MAX_IMAGE_BYTES ? 'La imagen debe pesar 10 MB o menos.' : '';
    event.target.setCustomValidity(message);
    setError(message);
    if (!message) onFileChange(next);
  };
  const cancel = () => {
    if (input.current) { input.current.value = ''; input.current.setCustomValidity(''); }
    setError('');
    onFileChange(null);
  };
  const previewValue = previewMode && value?.startsWith('data:image/') ? value : '';
  const image = preview || previewValue || safeUrl(value);
  return <section className={`vn-image-picker${dark ? ' vn-image-picker-dark' : ''}`} aria-labelledby={`${id}-title`}>
    <h4 id={`${id}-title`} className="vn-eyebrow">{label}</h4>
    <div className={`vn-image-preview${logo ? ' vn-image-preview-logo' : ''}`}>
      {image ? <img src={image} alt={`Vista previa de ${label.toLowerCase()}`} onError={() => {
        if (file) { const message = 'No se pudo leer esta imagen. Elige otro archivo.'; setError(message); input.current?.setCustomValidity(message); }
      }}/> : <ImagePlus size={32} strokeWidth={1.2} aria-hidden="true"/>}
    </div>
    <div className="vn-image-actions">
      <button type="button" className="vn-button" onClick={() => input.current?.click()}><Upload size={15}/>{image ? 'Cambiar imagen' : 'Subir imagen'}</button>
      {(file || error) && <button type="button" className="vn-button vn-button-quiet" onClick={cancel}><X size={14}/>Cancelar selección</button>}
    </div>
    <input ref={input} id={id} className="vn-image-file" aria-label={`Subir ${label.toLowerCase()}`} aria-describedby={`${id}-help`} type="file" accept="image/png,image/jpeg,image/webp" onChange={choose}/>
    <p id={`${id}-help`} className="vn-note">JPG, PNG o WebP · Hasta 10 MB.{hint && ` ${hint}`}</p>
    {file && <p className="vn-image-filename" role="status">{file.name} · Se subirá al guardar.</p>}
    {error && <p className="vn-image-error" role="alert">{error}</p>}
    <button type="button" className="vn-image-url-toggle" aria-expanded={showUrl} aria-controls={`${id}-url`} onClick={() => setShowUrl(current => !current)}>{showUrl ? 'Ocultar enlace' : 'Usar un enlace de imagen'}</button>
    {showUrl && <div id={`${id}-url`}>
      <label htmlFor={`${id}-url-input`} className="vn-note block mb-2">Enlace HTTPS de {label.toLowerCase()}</label>
      <input id={`${id}-url-input`} className="vn-input" type="url" pattern="https://.*" value={previewValue ? '' : value} onChange={event => { cancel(); onUrlChange(event.target.value); }} placeholder="https://…" maxLength={2000}/>
    </div>}
  </section>;
}
