import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { Save, Edit3, Plus, X, Trash2, Eye } from 'lucide-react';
import { VIDEO_CATEGORIES } from '../utils/contentTypes';
import { youtubeId, videoPayload } from '../utils/publishing';
import CreditsPanel from '../components/social/CreditsPanel';
import './publishing.css';

const blankVideo = () => ({ titulo: '', descripcion: '', youtube_id: '', trailer_id: '', categoria: 'Video', año: new Date().getFullYear().toString(), duracion: '', calificacion: '', generos: '', banner_url: '', poster_url: '', es_top_10: false, en_hero: false, es_comunidad: false, estado_publicacion: 'aprobado', sello_editorial: 'GIMG Studios' });

export default function VideosTab({ previewMode = false }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [list, setList] = useState([]);
  const [listLoading, setListLoading] = useState(!previewMode);
  const [editingId, setEditingId] = useState(null);
  const [cast, setCast] = useState([]);
  const [preview, setPreview] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankVideo);
  const id = youtubeId(form.youtube_id);
  const thumbnail = form.banner_url || (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '');
  const field = (name, value) => setForm(current => ({ ...current, [name]: value }));

  const refresh = async () => {
    if (previewMode) return;
    setListLoading(true);
    const { data, error } = await supabase.from('contenido').select('*, reparto(*)').in('categoria', VIDEO_CATEGORIES).order('created_at', { ascending: false });
    if (error) setStatus({ type: 'error', msg: 'No se pudo cargar el catálogo. Puedes reintentar desde el botón Actualizar.' });
    else setList(data || []);
    setListLoading(false);
  };
  useEffect(() => { void refresh(); }, [previewMode]);
  const reset = () => { setEditingId(null); setForm(blankVideo()); setCast([]); setStatus(null); };
  const edit = item => {
    setEditingId(item.id);
    setForm({ ...blankVideo(), ...Object.fromEntries(Object.keys(blankVideo()).map(key => [key, item[key] ?? blankVideo()[key]])), generos: (item.generos || []).join(', '), sello_editorial: item.sello_editorial || (item.es_comunidad ? '' : 'GIMG Studios') });
    setCast(item.reparto || []); setStatus(null); window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const source = external => setForm(current => ({ ...current, es_comunidad: external, sello_editorial: external ? (current.es_comunidad ? current.sello_editorial : '') : 'GIMG Studios', en_hero: external ? false : current.en_hero, es_top_10: external ? false : current.es_top_10 }));
  const save = async event => {
    event.preventDefault(); setLoading(true); setStatus(null);
    try {
      const payload = videoPayload(form);
      let contentId = editingId;
      if (previewMode) {
        contentId ||= `preview-${Date.now()}`;
        setList(current => [{ ...payload, id: contentId, reparto: cast }, ...current.filter(item => item.id !== contentId)]);
      } else {
        const query = editingId ? supabase.from('contenido').update(payload).eq('id', editingId) : supabase.from('contenido').insert([payload]);
        const { data, error } = await query.select('id').single();
        if (error) throw error;
        contentId = data.id;
        // The editor remains on the saved record if a secondary cast write fails.
        setEditingId(contentId);
        const { error: castDeleteError } = await supabase.from('reparto').delete().eq('contenido_id', contentId);
        if (castDeleteError) throw new Error('El video se guardó, pero no se pudieron actualizar los colaboradores. Reintenta Guardar cambios.');
        if (cast.length) {
          const { error: castError } = await supabase.from('reparto').insert(cast.map(actor => ({ contenido_id: contentId, nombre_real: actor.nombre_real, nombre_personaje: actor.nombre_personaje, foto_url: actor.foto_url })));
          if (castError) throw new Error('El video se guardó, pero falta actualizar los colaboradores. Reintenta Guardar cambios.');
        }
        await refresh();
      }
      setEditingId(contentId);
      setForm(current => ({ ...current, youtube_id: payload.youtube_id, trailer_id: payload.trailer_id }));
      setStatus({ type: 'success', msg: previewMode ? 'Vista de desarrollo: video guardado solo en esta página.' : payload.estado_publicacion === 'aprobado' ? 'Video publicado. Ya puedes encontrarlo en VISTA.' : 'Video guardado como pendiente.' });
    } catch (error) { setStatus({ type: 'error', msg: error.message || 'No se pudo guardar el video.' }); }
    finally { setLoading(false); }
  };
  const changeVisibility = async item => {
    const next = item.estado_publicacion === 'aprobado' ? 'pendiente' : 'aprobado';
    if (previewMode) setList(current => current.map(video => video.id === item.id ? { ...video, estado_publicacion: next } : video));
    else {
      const { error } = await supabase.from('contenido').update({ estado_publicacion: next }).eq('id', item.id);
      if (error) { setStatus({ type: 'error', msg: error.message }); return; }
      await refresh();
    }
    if (item.id === editingId) field('estado_publicacion', next);
  };
  const remove = async item => {
    if (!window.confirm(`¿Eliminar definitivamente “${item.titulo}”?`)) return;
    if (previewMode) setList(current => current.filter(video => video.id !== item.id));
    else {
      const { error: castError } = await supabase.from('reparto').delete().eq('contenido_id', item.id);
      const { error } = castError ? { error: castError } : await supabase.from('contenido').delete().eq('id', item.id);
      if (error) { setStatus({ type: 'error', msg: error.message }); return; }
      await refresh();
    }
    if (editingId === item.id) reset();
  };
  const openPreview = () => {
    try { setPreview({ ...videoPayload(form), reparto: cast }); }
    catch (error) { setStatus({ type: 'error', msg: error.message }); }
  };
  const visible = list.filter(item => `${item.titulo} ${item.sello_editorial} ${item.categoria}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="ms-publishing">
    <section className="ms-editor">
      <header className="ms-editor-head"><div><h2>{editingId ? 'Editar video.' : 'Publicar un video.'}</h2><p>Un enlace de YouTube, un título y quién lo creó.</p></div>{editingId && <button className="ms-button" onClick={reset}><Plus size={14}/>Nuevo</button>}</header>
      {previewMode && <p className="ms-preview-note mb-6">Vista de desarrollo. Los cambios no se publican en VISTA.</p>}
      <form onSubmit={save}>
        <section className="ms-step"><h3><span className="ms-step-number">1</span>Origen del video</h3>
          <div className="ms-source-options">
            <label className="ms-option"><input type="radio" name="video-source" checked={!form.es_comunidad} onChange={() => source(false)}/><span><strong>Producción de GIMG</strong><small>Creado por nuestro equipo.</small></span></label>
            <label className="ms-option"><input type="radio" name="video-source" checked={form.es_comunidad} onChange={() => source(true)}/><span><strong>Aportado por la comunidad</strong><small>Tutoriales y videos de administradores o creadores.</small></span></label>
          </div>
          <label className="ms-field"><span>{form.es_comunidad ? 'Canal, autor o equipo creador' : 'Equipo o sello de producción'}</span><input value={form.sello_editorial} onChange={e => field('sello_editorial', e.target.value)} placeholder={form.es_comunidad ? 'Ej. Canal del servidor o nombre del creador' : 'GIMG Studios'} required/></label>
          <label className="ms-field"><span>Enlace de YouTube</span><input value={form.youtube_id} onChange={e => field('youtube_id', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" required/><small>Puedes pegar el enlace completo, un Short o el ID del video.</small></label>
          {thumbnail && <div className="ms-thumbnail"><img src={thumbnail} alt="Miniatura del video"/><div><strong>Miniatura de YouTube</strong>Se usa automáticamente. Puedes cambiarla en las opciones adicionales.</div></div>}
        </section>
        <section className="ms-step"><h3><span className="ms-step-number">2</span>Presentación en VISTA</h3>
          <label className="ms-field"><span>Título</span><input value={form.titulo} onChange={e => field('titulo', e.target.value)} required placeholder="Qué aprenderá o verá la comunidad"/></label>
          <label className="ms-field"><span>Descripción</span><textarea value={form.descripcion} onChange={e => field('descripcion', e.target.value)} rows={3} placeholder="Presenta el video y el servidor al que pertenece."/></label>
          <div className="ms-fields"><label className="ms-field"><span>Tipo de contenido</span><select value={form.categoria} onChange={e => field('categoria', e.target.value)}>{[...new Set(['Video','Tutorial','Película','Serie','Original',form.categoria])].map(category => <option key={category}>{category}</option>)}</select></label><label className="ms-field"><span>Temas</span><input value={form.generos} onChange={e => field('generos', e.target.value)} placeholder="Tutoriales, Naciones, Towny…"/></label></div>
        </section>
        <section className="ms-step"><h3><span className="ms-step-number">3</span>Publicación</h3>
          <label className="ms-field"><span>Visibilidad</span><select value={form.estado_publicacion} onChange={e => field('estado_publicacion', e.target.value)}><option value="aprobado">Publicado en VISTA</option><option value="pendiente">Pendiente · todavía oculto</option>{form.estado_publicacion === 'rechazado' && <option value="rechazado">Rechazado · oculto</option>}</select></label>
          {form.es_comunidad ? <p className="ms-help">Aparecerá en Videos de la comunidad, con el autor indicado. Las producciones de GIMG conservan su propia colección.</p> : <div className="ms-checks"><label><input type="checkbox" checked={form.en_hero} onChange={e => field('en_hero', e.target.checked)}/>Mostrar en el hero de Inicio</label><label><input type="checkbox" checked={form.es_top_10} onChange={e => field('es_top_10', e.target.checked)}/>Marcar como Top 10</label></div>}
        </section>
        <details className="ms-more"><summary>Opciones adicionales · imágenes, tráiler y colaboradores</summary><div>
          <div className="ms-fields">{[['banner_url','Imagen horizontal'],['poster_url','Imagen de catálogo'],['trailer_id','Enlace del tráiler'],['año','Año'],['duracion','Duración'],['calificacion','Clasificación']].map(([key,label]) => <label key={key} className="ms-field"><span>{label}</span><input value={form[key]} onChange={e => field(key,e.target.value)} type={key.endsWith('_url') ? 'url' : 'text'} placeholder={key.endsWith('_url') ? 'https://…' : ''}/></label>)}</div>
          <div><div className="flex justify-between items-center"><h3 className="text-xs font-semibold">Colaboradores ({cast.length})</h3><button type="button" className="ms-button" onClick={() => setCast(current => [...current,{id:`new-${Date.now()}`,nombre_real:'',nombre_personaje:'',foto_url:''}])}><Plus size={12}/>Agregar</button></div>{cast.map(actor => <div key={actor.id} className="ms-fields mt-4">{[['nombre_real','Nombre'],['nombre_personaje','Participación'],['foto_url','Foto']].map(([key,label]) => <label className="ms-field" key={key}><span>{label}</span><input value={actor[key] || ''} onChange={e => setCast(current => current.map(person => person.id === actor.id ? {...person,[key]:e.target.value} : person))}/></label>)}<button type="button" className="ms-button self-end" aria-label={`Retirar colaborador ${actor.nombre_real || 'sin nombre'}`} onClick={() => setCast(current => current.filter(person => person.id !== actor.id))}><X size={13}/>Retirar</button></div>)}</div>
        </div></details>
        {status && <p role={status.type === 'error' ? 'alert' : 'status'} className={`ms-notice ms-notice-${status.type}`}>{status.msg}</p>}
        <div className="ms-actions"><button type="button" className="ms-button" onClick={openPreview}><Eye size={15}/>Vista previa</button><button className="ms-button ms-button-primary" disabled={loading}><Save size={15}/>{loading ? 'Guardando…' : editingId ? 'Guardar cambios' : form.estado_publicacion === 'aprobado' ? 'Publicar video' : 'Guardar pendiente'}</button></div>
      </form>
      {editingId && !previewMode && <CreditsPanel subjectType="content" subjectId={editingId} editable dark className="mt-7"/>}
    </section>
    <section className="ms-catalogue"><div className="flex justify-between items-center mb-5"><h2 className="!mb-0">Catálogo de videos.</h2><button className="ms-button" disabled={listLoading} onClick={refresh}>Actualizar</button></div><label className="ms-field"><span>Buscar en el catálogo</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Título, autor o tipo de video"/></label>
      {listLoading ? <p className="ms-help" role="status">Cargando videos…</p> : <div className="ms-video-list">{visible.map(item => <article className="ms-video-item" key={item.id}><img src={item.poster_url || item.banner_url || `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg`} alt=""/><div><span className="ms-badge">{item.es_comunidad ? 'Comunidad' : 'GIMG'} · {item.categoria}</span><h3>{item.titulo}</h3><p>{item.sello_editorial} · {item.estado_publicacion === 'aprobado' ? 'Publicado' : item.estado_publicacion === 'rechazado' ? 'Rechazado' : 'Pendiente'}</p><div className="ms-actions"><button className="ms-button" onClick={() => edit(item)}><Edit3 size={12}/>Editar</button><button className="ms-button" onClick={() => changeVisibility(item)}>{item.estado_publicacion === 'aprobado' ? 'Ocultar' : 'Publicar'}</button><button className="ms-button" aria-label={`Vista previa de ${item.titulo}`} onClick={() => setPreview(item)}><Eye size={13}/></button><button className="ms-button" aria-label={`Eliminar ${item.titulo}`} onClick={() => remove(item)}><Trash2 size={13}/></button></div></div></article>)}</div>}
      {!listLoading && !visible.length && <p className="ms-help py-8">{list.length ? 'No hay coincidencias con esta búsqueda.' : 'Los videos publicados aparecerán aquí.'}</p>}
    </section>
    {preview && <div className="fixed inset-0 z-[200] bg-black/85 p-4 md:p-10 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Vista previa del video" onClick={() => setPreview(null)}><div className="relative w-full max-w-3xl bg-[#121212] border border-white/15 rounded-xl max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}><button className="ms-button absolute right-4 top-4" aria-label="Cerrar vista previa" onClick={() => setPreview(null)}><X size={16}/></button><p className="text-xs text-neutral-400 mt-2 pr-16">{preview.es_comunidad ? 'Video de la comunidad' : 'Producción de GIMG'} · {preview.sello_editorial}</p><h3 className="font-serif italic text-3xl mt-4">{preview.titulo}</h3><p className="text-sm text-neutral-400 mt-3 mb-5">{preview.descripcion}</p><div className="aspect-video"><iframe title="Vista previa de YouTube" className="w-full h-full rounded-lg" src={`https://www.youtube.com/embed/${youtubeId(preview.youtube_id)}`} allowFullScreen/></div></div></div>}
  </div>;
}
