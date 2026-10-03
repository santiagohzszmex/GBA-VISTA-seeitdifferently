import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { getGimgPremiereState } from '../utils/editionRelease';

export default function EditionDraftPreview({ form, cover, pages, mode, onClose }) {
  const item = { ...form, has_gimg_premiere: mode === 'video', gimg_video_url: mode === 'video' ? form.gimg_video_url : null, publicar_at: mode === 'now' ? null : form.publicar_at };
  const release = getGimgPremiereState(item);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const escape = event => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', escape); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[200] bg-black/85 p-4 md:p-8 flex justify-center items-center" role="dialog" aria-modal="true" aria-label="Vista previa de la edición" onClick={onClose}>
    <div className="w-full max-w-3xl max-h-[90vh] overflow-auto bg-[#121212] border border-white/15 rounded-xl text-white" onClick={e => e.stopPropagation()}>
      <header className="sticky top-0 bg-[#121212] border-b border-white/10 px-5 py-4 flex justify-between gap-4 items-center"><span className="text-xs text-neutral-400">Vista previa · {release.editionReleased ? 'Edición completa' : 'Anuncio de próxima edición'}</span><button className="ms-button" onClick={onClose} aria-label="Cerrar vista previa de la edición"><X size={16}/></button></header>
      <div className="p-6 md:p-8"><h3 className="font-serif italic text-3xl mb-4">{form.titulo || 'Título de la edición'}</h3><p className="text-sm text-neutral-400 mb-6">{form.descripcion}</p>
        {!release.editionReleased && <p className="ms-preview-note mb-6">{form.publicar_at ? `Las páginas se abrirán el ${new Date(form.publicar_at).toLocaleString('es-MX')}. ` : ''}{mode === 'cover' ? 'La portada ya se puede consultar.' : 'La presentación se mostrará cuando llegue su estreno.'}</p>}
        {(release.editionReleased || release.coverAnnouncement) && (cover ? <img src={cover} alt="Portada de la edición" className="max-w-full max-h-[65vh] object-contain mx-auto"/> : <p className="ms-help">Añade la portada para verla aquí.</p>)}
        {mode === 'video' && release.videoReleased && form.gimg_video_url && <video src={form.gimg_video_url} poster={form.gimg_video_portada_url || undefined} controls className="w-full"/>}
        {release.editionReleased && pages.map((page,index) => <img key={page.id} src={page.preview} alt={`Página ${index+1} de la edición`} className="w-full mt-6"/>)}
        {release.editionReleased && !pages.length && /^https:\/\//.test(form.enlace_pdf) && <p className="ms-help mt-5">PDF de la edición: {form.enlace_pdf}</p>}
      </div>
    </div>
  </div>;
}
