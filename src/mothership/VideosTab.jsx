import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Save, Edit3, PlusCircle, X, Trash2, Eye } from 'lucide-react';
import { VIDEO_CATEGORIES } from '../utils/contentTypes';

export default function VideosTab() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [contentList, setContentList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [castList, setCastList] = useState([]); 

  const initialFormContent = {
    titulo: '',
    descripcion: '',
    youtube_id: '',
    trailer_id: '',
    categoria: 'Película', // Gramática correcta para que lo lea el sistema
    año: new Date().getFullYear().toString(),
    duracion: '1h 30m',
    calificacion: 'B15',
    generos: '',
    banner_url: '',
    poster_url: '',
    es_top_10: false,
    en_hero: false,
    es_comunidad: false, // Nuevo control de comunidad
    estado_publicacion: 'aprobado', // Nuevo control de visibilidad
    sello_editorial: 'GIMG Studios' // Nuevo control de marca
  };

  const [formData, setFormData] = useState(initialFormContent);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    // Traemos todos los videos (oficiales y de comunidad)
    const { data } = await supabase
      .from('contenido')
      .select('*, reparto(*)')
      .in('categoria', VIDEO_CATEGORIES)
      .order('created_at', { ascending: false });
      
    if (data) setContentList(data);
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  // Manejador especial para el toggle de comunidad
  const handleComunidadToggle = (e) => {
    const isComunidad = e.target.checked;
    setFormData({
      ...formData,
      es_comunidad: isComunidad,
      sello_editorial: isComunidad ? '' : 'GIMG Studios' // Si es oficial, auto-rellena GIMG
    });
  };

  // Gestión de Reparto
  const addActor = () => setCastList([...castList, { id: Date.now(), nombre_real: '', nombre_personaje: '', foto_url: '' }]);
  const updateActor = (id, field, value) => setCastList(castList.map(actor => actor.id === id ? { ...actor, [field]: value } : actor));
  const removeActor = (id) => setCastList(castList.filter(actor => actor.id !== id));

  // Editar Contenido
  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      titulo: item.titulo,
      descripcion: item.descripcion,
      youtube_id: item.youtube_id || '',
      trailer_id: item.trailer_id || '',
      categoria: item.categoria || 'Película',
      año: item.año || '',
      duracion: item.duracion || '',
      calificacion: item.calificacion || '',
      generos: item.generos ? item.generos.join(', ') : '',
      banner_url: item.banner_url || '',
      poster_url: item.poster_url || '',
      es_top_10: item.es_top_10 || false,
      en_hero: item.en_hero || false,
      es_comunidad: item.es_comunidad || false,
      estado_publicacion: item.estado_publicacion || 'aprobado',
      sello_editorial: item.sello_editorial || 'GIMG Studios'
    });
    setCastList(item.reparto || []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatus({ type: 'info', msg: `Editando: ${item.titulo}` });
  };

  // Guardar Contenido
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const idForImage = formData.youtube_id || formData.trailer_id;
      const defaultBanner = idForImage ? `https://img.youtube.com/vi/${idForImage}/maxresdefault.jpg` : '';
      const finalBanner = formData.banner_url || defaultBanner;
      const generosArray = formData.generos.split(',').map(g => g.trim()).filter(g => g !== '');

      const contentData = {
        ...formData,
        banner_url: finalBanner,
        poster_url: formData.poster_url || finalBanner,
        generos: generosArray
      };

      let contentId = editingId;

      if (editingId) {
        const { error } = await supabase.from('contenido').update(contentData).eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('contenido').insert([contentData]).select().single();
        if (error) throw error;
        contentId = data.id;
      }

      // Guardar Reparto
      if (contentId) {
         await supabase.from('reparto').delete().eq('contenido_id', contentId);
         if (castList.length > 0) {
            const castToInsert = castList.map(actor => ({
               contenido_id: contentId,
               nombre_real: actor.nombre_real,
               nombre_personaje: actor.nombre_personaje,
               foto_url: actor.foto_url
            }));
            await supabase.from('reparto').insert(castToInsert);
         }
      }

      setStatus({ type: 'success', msg: '¡Guardado correctamente!' });
      fetchContent();
      if (!editingId) {
        setEditingId(null);
        setFormData(initialFormContent);
        setCastList([]);
      }
      
    } catch (error) {
      console.error("Error al guardar en Supabase:", error);
      setStatus({ type: 'error', msg: 'Error al guardar. Revisa la consola.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Borrar definitivamente?")) return;
    await supabase.from('reparto').delete().eq('contenido_id', id);
    const { error } = await supabase.from('contenido').delete().eq('id', id);
    if (!error) {
      fetchContent();
      if (editingId === id) {
          setEditingId(null);
          setFormData(initialFormContent);
          setCastList([]);
      }
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData(initialFormContent);
    setCastList([]);
    setStatus(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 text-white">
      
      {/* EDITOR */}
      <div className="xl:col-span-1">
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-xl sticky top-8 shadow-2xl">
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {editingId ? <><Edit3 className="text-yellow-500"/> Editando</> : <><PlusCircle className="text-green-500"/> Nuevo Video</>}
            </h2>
            {editingId && <button onClick={resetForm} className="text-xs bg-white/10 px-3 py-1 rounded-full"><X size={12}/> Cancelar</button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* 1. CONFIGURACIÓN EDITORIAL (NUEVO BLOQUE DE CONTROL) */}
            <div className="space-y-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Configuración Editorial</p>
              
              <div className="grid grid-cols-2 gap-3">
                <select name="estado_publicacion" value={formData.estado_publicacion} onChange={handleChange} className="bg-transparent border-b border-white/10 p-2 text-xs [&>option]:bg-[#1d1d1f] outline-none focus:border-red-500 font-bold">
                  <option value="aprobado">✅ Aprobado (Público)</option>
                  <option value="pendiente">🕒 Pendiente (Oculto)</option>
                </select>
                
                <label className={`flex items-center justify-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors ${formData.es_comunidad ? 'bg-purple-600/20 border-purple-400 text-purple-300' : 'bg-blue-600/20 border-blue-400 text-blue-300'}`}>
                   <input type="checkbox" name="es_comunidad" checked={formData.es_comunidad} onChange={handleComunidadToggle} className="hidden" />
                   <span className="text-[10px] font-black uppercase tracking-widest">
                      {formData.es_comunidad ? '👥 Comunidad' : '🎬 Oficial GIMG'}
                   </span>
                </label>
              </div>

              <input 
                name="sello_editorial" 
                value={formData.sello_editorial} 
                onChange={handleChange} 
                placeholder="Sello Editorial (Ej. GIMG Studios)" 
                className="w-full bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-red-500 font-bold text-neutral-300" 
                required
              />
            </div>

            {/* Info Básica */}
            <div className="space-y-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">General</p>
              <input name="titulo" value={formData.titulo} onChange={handleChange} placeholder="Título" className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-red-500" required />
              <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Sinopsis..." rows="2" className="w-full bg-transparent border-b border-white/10 p-2 text-sm resize-none outline-none focus:border-red-500" />
              <div className="grid grid-cols-2 gap-3">
                 <select name="categoria" value={formData.categoria} onChange={handleChange} className="bg-transparent border-b border-white/10 p-2 text-sm [&>option]:bg-[#1d1d1f] outline-none focus:border-red-500">
                  <option value="Película">Película</option>
                  <option value="Serie">Serie</option>
                </select>
                <input name="generos" value={formData.generos} onChange={handleChange} placeholder="Acción, Drama..." className="bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-red-500" />
              </div>
            </div>

            {/* Multimedia */}
            <div className="space-y-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">IDs y Media</p>
              <div className="grid grid-cols-2 gap-3">
                  <input name="youtube_id" value={formData.youtube_id} onChange={handleChange} placeholder="YT Película" className="w-full bg-transparent border-b border-white/10 p-2 font-mono text-sm outline-none focus:border-red-500" />
                  <input name="trailer_id" value={formData.trailer_id} onChange={handleChange} placeholder="YT Trailer" className="w-full bg-transparent border-b border-white/10 p-2 font-mono text-sm outline-none focus:border-red-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input name="banner_url" value={formData.banner_url} onChange={handleChange} placeholder="Banner URL" className="bg-transparent border-b border-white/10 p-2 text-xs outline-none focus:border-red-500" />
                <input name="poster_url" value={formData.poster_url} onChange={handleChange} placeholder="Poster URL" className="bg-transparent border-b border-white/10 p-2 text-xs outline-none focus:border-red-500" />
              </div>
            </div>

            {/* Datos Técnicos */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
                <input name="año" value={formData.año} onChange={handleChange} placeholder="Año" className="bg-transparent border-b border-white/10 p-2 text-center text-sm outline-none focus:border-red-500" />
                <input name="duracion" value={formData.duracion} onChange={handleChange} placeholder="1h 30m" className="bg-transparent border-b border-white/10 p-2 text-center text-sm outline-none focus:border-red-500" />
                <input name="calificacion" value={formData.calificacion} onChange={handleChange} placeholder="B15" className="bg-transparent border-b border-white/10 p-2 text-center text-sm outline-none focus:border-red-500" />
            </div>

            {/* Reparto */}
            <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Reparto ({castList.length})</p>
                <button type="button" onClick={addActor} className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded flex items-center gap-1"><PlusCircle size={10}/> Añadir</button>
              </div>
              
              <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {castList.map((actor) => (
                  <div key={actor.id} className="flex gap-2 items-start bg-white/5 p-2 rounded-lg border border-white/5">
                    <div className="w-8 h-8 bg-neutral-700 rounded-full overflow-hidden flex-shrink-0">
                       {actor.foto_url && <img src={actor.foto_url} className="w-full h-full object-cover" alt="actor"/>}
                    </div>
                    <div className="flex-1 space-y-1">
                      <input placeholder="Nombre Real" value={actor.nombre_real} onChange={(e) => updateActor(actor.id, 'nombre_real', e.target.value)} className="w-full bg-transparent border-b border-white/5 text-xs font-bold outline-none placeholder-neutral-600"/>
                      <input placeholder="Personaje" value={actor.nombre_personaje} onChange={(e) => updateActor(actor.id, 'nombre_personaje', e.target.value)} className="w-full bg-transparent border-b border-white/5 text-[10px] text-neutral-400 outline-none placeholder-neutral-600"/>
                      <input placeholder="URL Foto" value={actor.foto_url} onChange={(e) => updateActor(actor.id, 'foto_url', e.target.value)} className="w-full bg-transparent border-b border-white/5 text-[10px] text-blue-400 outline-none placeholder-neutral-600"/>
                    </div>
                    <button type="button" onClick={() => removeActor(actor.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded"><X size={12}/></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Toggles Extra */}
            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer ${formData.en_hero ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/10'}`}>
                 <input type="checkbox" name="en_hero" checked={formData.en_hero} onChange={handleChange} className="hidden" />
                 <span className="text-[10px] font-black uppercase">En Hero</span>
              </label>
              <label className={`flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer ${formData.es_top_10 ? 'bg-yellow-600 border-yellow-400' : 'bg-white/5 border-white/10'}`}>
                 <input type="checkbox" name="es_top_10" checked={formData.es_top_10} onChange={handleChange} className="hidden" />
                 <span className="text-[10px] font-black uppercase">Top 10</span>
              </label>
            </div>

            {status && <div className={`p-3 rounded-xl text-xs text-center font-bold border ${status.type === 'error' ? 'text-red-300 bg-red-900/20 border-red-500/30' : 'text-green-300 bg-green-900/20 border-green-500/30'}`}>{status.msg}</div>}

            <button type="submit" disabled={loading} className={`w-full py-4 font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${editingId ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-white text-black hover:bg-neutral-200'}`}>
              <Save size={18}/> {editingId ? 'Guardar Cambios' : 'Publicar'}
            </button>

          </form>
        </div>
      </div>

      {/* LISTA DE CONTENIDO */}
      <div className="xl:col-span-2">
         <h2 className="text-2xl font-bold mb-6 text-neutral-400 font-serif italic">Catálogo de Videos</h2>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contentList.map((item) => (
            <div key={item.id} className="flex gap-4 bg-[#121212] border border-white/10 p-4 rounded-2xl hover:border-white/30 transition-all shadow-lg group">
              <div className="w-24 h-32 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0 relative">
                <img src={item.poster_url || item.banner_url || "https://images.unsplash.com/photo-1495020689067-958852a7765e"} className="w-full h-full object-cover filter group-hover:brightness-110 transition-all" alt={item.titulo} />
              </div>
              
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-lg text-white line-clamp-1">{item.titulo}</h3>
                    {item.es_comunidad ? (
                      <span className="text-[9px] bg-purple-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest shadow-md">Comunidad</span>
                    ) : (
                      <span className="text-[9px] bg-blue-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest shadow-md">GIMG</span>
                    )}
                  </div>
                  <p className="text-neutral-400 text-xs line-clamp-1 font-medium">{item.sello_editorial}</p>
                  
                  {/* ESTADÍSTICAS */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                      <Eye size={12} /> {item.vistas || 0} clics
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${item.estado_publicacion === 'aprobado' ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                       {item.estado_publicacion === 'aprobado' ? '✅ Aprobado' : '🕒 Pendiente'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleEdit(item)} className="bg-white/10 border border-white/10 hover:bg-white text-white hover:text-black px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 justify-center"><Edit3 size={14}/> Editar</button>
                  <button onClick={() => handleDelete(item.id)} className="bg-red-500/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
         </div>
         
         {contentList.length === 0 && (
           <div className="w-full py-20 text-center text-neutral-500 font-medium">
             No hay videos en el catálogo aún.
           </div>
         )}
      </div>
    </div>
  );
}
