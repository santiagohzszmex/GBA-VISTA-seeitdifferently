import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { EDITORIAL_CATEGORIES } from '../utils/editorialCategories';
import { 
  Save, 
  Edit3, 
  PlusCircle, 
  X, 
  Trash2, 
  Eye, 
  FileText, 
  Globe, 
  BookOpen,
  Image as ImageIcon,
  Plus,
  Languages,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Replace,
  Images
} from 'lucide-react';

const parseStoredPages = (value) => {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const existingPages = (urls = []) => (Array.isArray(urls) ? urls : []).map((url) => ({
  id: `existing-${url}`,
  type: 'existing',
  url,
  preview: url,
  name: url.split('/').pop() || 'Pagina publicada'
}));

const filePage = (file) => ({
  id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type: 'file',
  file,
  preview: URL.createObjectURL(file),
  name: file.name
});

function PagesEditor({ pages, onChange, onPreview, label, accent = 'blue' }) {
  const accentClasses = accent === 'green'
    ? 'text-green-400 border-green-500/30 hover:bg-green-500/10'
    : 'text-blue-400 border-blue-500/30 hover:bg-blue-500/10';

  const removePage = (index) => {
    const page = pages[index];
    if (page?.type === 'file') URL.revokeObjectURL(page.preview);
    onChange(pages.filter((_, pageIndex) => pageIndex !== index));
  };

  const movePage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addFiles = (files) => {
    const additions = Array.from(files || []).map(filePage);
    if (additions.length > 0) onChange([...pages, ...additions]);
  };

  const replacePage = (index, file) => {
    if (!file) return;
    const current = pages[index];
    if (current?.type === 'file') URL.revokeObjectURL(current.preview);
    const next = [...pages];
    next[index] = filePage(file);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-neutral-400 font-bold uppercase">{label}</p>
        <span className="text-[9px] text-neutral-500 font-mono">{pages.length} {pages.length === 1 ? 'pagina' : 'paginas'}</span>
      </div>

      {pages.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {pages.map((page, index) => (
            <div key={page.id} className="group/page overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <button
                type="button"
                onClick={() => onPreview({ src: page.preview, title: `Pagina ${index + 1}` })}
                className="relative block w-full aspect-[3/4] overflow-hidden bg-neutral-900"
                title={`Ver pagina ${index + 1}`}
              >
                <img src={page.preview} alt={`Vista previa de la pagina ${index + 1}`} className="w-full h-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/page:bg-black/45 transition-colors">
                  <Maximize2 size={20} className="text-white opacity-0 group-hover/page:opacity-100 transition-opacity" />
                </span>
                <span className="absolute top-2 left-2 bg-black/75 px-2 py-1 rounded-md text-[9px] font-black">{index + 1}</span>
                {page.type === 'file' && <span className="absolute top-2 right-2 bg-blue-500 px-2 py-1 rounded-md text-[8px] font-black uppercase">Nueva</span>}
              </button>

              <div className="p-2 space-y-2">
                <p className="text-[9px] text-neutral-400 truncate" title={page.name}>{page.name}</p>
                <div className="grid grid-cols-4 gap-1">
                  <button type="button" onClick={() => movePage(index, -1)} disabled={index === 0} className="h-8 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-25 flex items-center justify-center" title="Mover antes"><ChevronUp size={13}/></button>
                  <button type="button" onClick={() => movePage(index, 1)} disabled={index === pages.length - 1} className="h-8 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-25 flex items-center justify-center" title="Mover despues"><ChevronDown size={13}/></button>
                  <label className="h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer" title="Reemplazar pagina">
                    <Replace size={13}/>
                    <input type="file" accept="image/*" onChange={(event) => replacePage(index, event.target.files?.[0])} className="hidden" />
                  </label>
                  <button type="button" onClick={() => removePage(index)} className="h-8 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center" title="Eliminar solo esta pagina"><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages.length === 0 && (
        <div className="py-7 border border-dashed border-white/10 rounded-xl flex flex-col items-center gap-2 text-neutral-600">
          <Images size={22}/>
          <span className="text-[10px] font-bold uppercase">Sin paginas</span>
        </div>
      )}

      <label className={`flex items-center justify-center gap-2 w-full py-3 border border-dashed rounded-xl text-xs font-bold cursor-pointer transition-colors ${accentClasses}`}>
        <Plus size={14} /> Añadir paginas
        <input type="file" accept="image/*" multiple onChange={(event) => addFiles(event.target.files)} className="hidden"/>
      </label>
    </div>
  );
}

export default function NoticiasTab() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [gimgNews, setGimgNews] = useState([]); 
  const [kioscoNews, setKioscoNews] = useState([]); 
  const [editingItem, setEditingItem] = useState(null);

  // Estados para archivos físicos (Idioma Base)
  const [portadaArchivo, setPortadaArchivo] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [previewPage, setPreviewPage] = useState(null);

  // NUEVO: Estado para gestionar Múltiples Idiomas Simultáneos
  const [traducciones, setTraducciones] = useState([]);

  const initialFormState = {
    titulo: '',
    descripcion: '',
    portada_url: '', 
    enlace_pdf: '',  
    youtube_id: '',
    idioma_original: 'es',
    categoria_editorial: 'comunidad'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchNewsData();
  }, []);

  const fetchNewsData = async () => {
    try {
      const { data, error } = await supabase
        .from('contenido')
        .select('*')
        .in('categoria', ['Noticia', 'Periódico'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        setGimgNews(data.filter(item => !item.es_comunidad));
        setKioscoNews(data.filter(item => item.es_comunidad && item.estado_publicacion === 'aprobado'));
      }
    } catch (err) {
      console.error("Error al recopilar el archivo de prensa:", err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // ================= MANEJADORES DE TRADUCCIÓN =================
  const addTraduccion = () => {
    setTraducciones([...traducciones, { lang: 'en', titulo: '', descripcion: '', portadaArchivo: null, paginas: [], hasExistingPoster: false }]);
  };

  const removeTraduccion = (index) => {
    traducciones[index]?.paginas?.forEach((page) => {
      if (page.type === 'file') URL.revokeObjectURL(page.preview);
    });
    setTraducciones(traducciones.filter((_, i) => i !== index));
  };

  const updateTraduccion = (index, field, value) => {
    const newTrads = [...traducciones];
    newTrads[index][field] = value;
    setTraducciones(newTrads);
  };

  const updateTraduccionPaginas = (index, pages) => {
    const newTrads = [...traducciones];
    newTrads[index] = { ...newTrads[index], paginas: pages };
    setTraducciones(newTrads);
  };
  // ==============================================================

  const handleEdit = (item) => {
    setEditingItem(item);
    const baseLang = item.idioma_original || 'es';
    const storedBasePages = Object.prototype.hasOwnProperty.call(item.paginas_i18n || {}, baseLang)
      ? item.paginas_i18n[baseLang]
      : parseStoredPages(item.enlace_pdf);

    setFormData({
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      portada_url: item.poster_url || item.banner_url || '',
      enlace_pdf: item.enlace_pdf || '', 
      youtube_id: item.youtube_id || '',
      idioma_original: baseLang,
      categoria_editorial: item.categoria_editorial || 'comunidad'
    });

    // Cargar traducciones existentes al panel dinámico
    const loadedTraducciones = [];
    if (item.titulo_i18n) {
      Object.keys(item.titulo_i18n).forEach(l => {
        if (l !== baseLang) {
          loadedTraducciones.push({
            lang: l,
            titulo: item.titulo_i18n[l] || '',
            descripcion: item.descripcion_i18n?.[l] || '',
            portadaArchivo: null,
            paginas: existingPages(item.paginas_i18n?.[l] || []),
            hasExistingPoster: !!item.poster_i18n?.[l],
          });
        }
      });
    }
    
    setTraducciones(loadedTraducciones);
    setPortadaArchivo(null);
    setPaginas(existingPages(storedBasePages));
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setStatus({ type: 'info', msg: `Modificando: ${item.titulo}` });
  };

  const uploadPageList = async (pageList, folderPath) => {
    const urls = [];
    for (const page of pageList) {
      if (page.type === 'existing') {
        urls.push(page.url);
        continue;
      }
      const uploadedUrl = await uploadToCloudinary(page.file, folderPath);
      if (!uploadedUrl) throw new Error(`No se pudo subir ${page.name}.`);
      urls.push(uploadedUrl);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      let finalPortadaUrl = formData.portada_url;
      let finalPaginas = [];

      const isComunidad = editingItem ? editingItem.es_comunidad : false;
      const selloStr = isComunidad ? (editingItem.sello_editorial || 'Comunidad') : 'GIMG_Oficial';
      const sanitizedSello = selloStr.replace(/[^a-zA-Z0-9]/g, '_');
      const folderPath = `Mothership_Prensa/${sanitizedSello}/${Date.now()}`;

      // 1. Subida del Idioma Base (Portada)
      if (portadaArchivo) {
        setStatus({ type: 'info', msg: 'Subiendo ilustración principal...' });
        const uploadedUrl = await uploadToCloudinary(portadaArchivo, folderPath);
        if (!uploadedUrl) throw new Error("Fallo crítico al subir la ilustración.");
        finalPortadaUrl = uploadedUrl;
      } else if (!editingItem && !finalPortadaUrl) {
        throw new Error("Debes incluir una ilustración para la noticia base.");
      }

      // 2. Sincronización del Idioma Base (conserva, reordena o elimina páginas individuales)
      if (paginas.some((page) => page.type === 'file')) {
        setStatus({ type: 'info', msg: 'Subiendo páginas del documento base...' });
      }
      finalPaginas = await uploadPageList(paginas, folderPath);
      const finalPaginasJsonStr = JSON.stringify(finalPaginas);

      setStatus({ type: 'info', msg: 'Sincronizando traducciones y base de datos...' });

      // INGENIERÍA MULTI-IDIOMA EN BLOQUE
      const langBase = formData.idioma_original;
      // Preparamos los diccionarios y eliminamos idiomas retirados explícitamente del editor.
      const titulos = { ...(editingItem?.titulo_i18n || {}) };
      const descripciones = { ...(editingItem?.descripcion_i18n || {}) };
      const posters = { ...(editingItem?.poster_i18n || {}) };
      const paginasObj = { ...(editingItem?.paginas_i18n || {}) };
      const activeLanguages = new Set([langBase, ...traducciones.map((trad) => trad.lang)]);
      [titulos, descripciones, posters, paginasObj].forEach((dictionary) => {
        Object.keys(dictionary).forEach((lang) => {
          if (!activeLanguages.has(lang)) delete dictionary[lang];
        });
      });

      if (activeLanguages.size !== traducciones.length + 1) {
        throw new Error('Cada traducción debe utilizar un idioma diferente al idioma base.');
      }

      // Inyectar Idioma Base
      titulos[langBase] = formData.titulo;
      descripciones[langBase] = formData.descripcion;
      posters[langBase] = finalPortadaUrl;
      paginasObj[langBase] = finalPaginas;

      // Inyectar Traducciones Secundarias Dinámicas
      for (const trad of traducciones) {
        if (!trad.titulo) continue; // Si dejaron el título vacío, ignoramos este idioma

        titulos[trad.lang] = trad.titulo;
        descripciones[trad.lang] = trad.descripcion;
        
        let tPortada = posters[trad.lang]; // Mantenemos la que estaba si no suben nueva
        if (trad.portadaArchivo) {
          tPortada = await uploadToCloudinary(trad.portadaArchivo, folderPath);
        }
        if (tPortada) posters[trad.lang] = tPortada;

        paginasObj[trad.lang] = await uploadPageList(trad.paginas || [], folderPath);
      }

      // Empaquetar para Supabase
      const payload = {
        titulo: formData.titulo, 
        descripcion: formData.descripcion, 
        poster_url: finalPortadaUrl,
        banner_url: finalPortadaUrl,
        enlace_pdf: finalPaginasJsonStr || null, 
        youtube_id: formData.youtube_id || null,
        es_comunidad: isComunidad,
        categoria: editingItem ? editingItem.categoria : 'Noticia',
        categoria_editorial: formData.categoria_editorial,
        estado_publicacion: 'aprobado',
        anio: editingItem ? editingItem.anio : new Date().getFullYear().toString(),
        
        idioma_original: langBase,
        titulo_i18n: titulos,
        descripcion_i18n: descripciones,
        poster_i18n: posters,
        paginas_i18n: paginasObj
      };

      const successMessage = editingItem
        ? 'Publicación actualizada. Las páginas ya están sincronizadas.'
        : '¡Comunicado global GIMG publicado con éxito!';

      if (editingItem) {
        const { error } = await supabase.from('contenido').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contenido').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      setStatus({ type: 'success', msg: successMessage });
      await fetchNewsData();
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: err.message || 'Error al procesar la publicación.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Deseas eliminar definitivamente esta publicación del servidor de la Alianza?")) return;
    try {
      const { error } = await supabase.from('contenido').delete().eq('id', id);
      if (error) throw error;
      fetchNewsData();
      if (editingItem?.id === id) resetForm();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el registro.");
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData(initialFormState);
    setPortadaArchivo(null);
    paginas.forEach((page) => {
      if (page.type === 'file') URL.revokeObjectURL(page.preview);
    });
    traducciones.forEach((trad) => trad.paginas?.forEach((page) => {
      if (page.type === 'file') URL.revokeObjectURL(page.preview);
    }));
    setPaginas([]);
    setTraducciones([]); // Limpiar traducciones
    setStatus(null);
  };

  return (
    <>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 text-white">
      
      {/* FORMULARIO EDITORIAL INTELLIGENT (DARK MODE) */}
      <div className="xl:col-span-1">
        <div className="bg-[#121212] border border-white/10 p-8 rounded-[2.5rem] sticky top-8 shadow-2xl">
          
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              {editingItem ? <><Edit3 className="text-yellow-500"/> Editar Prensa</> : <><PlusCircle className="text-blue-500"/> Nuevo Reporte</>}
            </h2>
            {editingItem && (
              <button onClick={resetForm} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full flex items-center gap-1 transition-colors">
                <X size={12}/> Cancelar
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Bloque A: Texto Principal */}
            <div className="space-y-4 p-5 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest flex items-center gap-1.5">
                <FileText size={12}/> Datos del Idioma Base
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1 flex items-center gap-1">
                    <Globe size={10}/> Idioma Base
                  </label>
                  <select 
                    name="idioma_original"
                    value={formData.idioma_original} 
                    onChange={handleChange}
                    className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-blue-500 text-sm transition-colors cursor-pointer appearance-none text-white"
                  >
                    <option value="es" className="bg-neutral-900">Español (ES)</option>
                    <option value="en" className="bg-neutral-900">Inglés (EN)</option>
                    <option value="nah" className="bg-neutral-900">Náhuatl (NAH)</option>
                    <option value="pt" className="bg-neutral-900">Portugués (PT)</option>
                    <option value="fr" className="bg-neutral-900">Francés (FR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Titular Principal</label>
                  <input 
                    type="text" name="titulo" required placeholder="Ej. Comunicado..."
                    value={formData.titulo} onChange={handleChange}
                    className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-blue-500 text-sm transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Cuerpo del Reporte</label>
                <textarea 
                  name="descripcion" required rows="4" placeholder="Escribe el desglose completo..."
                  value={formData.descripcion} onChange={handleChange}
                  className="w-full bg-transparent border-b border-white/10 p-2 text-xs resize-none outline-none focus:border-blue-500 leading-relaxed custom-scrollbar transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Categoría editorial</label>
                <select name="categoria_editorial" value={formData.categoria_editorial} onChange={handleChange} className="w-full bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-blue-500 [&>option]:bg-[#1d1d1f]">
                  {EDITORIAL_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                </select>
              </div>
            </div>

            {/* Bloque B: Sistema de Archivos Dinámico */}
            <div className="space-y-4 p-5 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black uppercase text-neutral-500 tracking-widest flex items-center gap-1.5 mb-4">
                <Globe size={12}/> Servidor de Medios (Base)
              </p>

              <div className="relative flex items-center justify-center w-full mb-4">
                <label className="flex flex-col items-center justify-center w-full h-32 border border-white/10 border-dashed rounded-xl cursor-pointer bg-black/20 hover:bg-white/5 transition-all p-4 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <ImageIcon size={24} className={portadaArchivo || formData.portada_url ? 'text-blue-500 mb-2' : 'text-neutral-600 mb-2'} />
                    <p className="text-xs text-white font-bold truncate max-w-[200px]">
                      {portadaArchivo ? portadaArchivo.name : (formData.portada_url ? 'Sustituir Portada Actual' : 'Seleccionar Portada')}
                    </p>
                  </div>
                  <input type="file" accept="image/*" onChange={(e) => setPortadaArchivo(e.target.files[0])} className="hidden" />
                </label>
              </div>

              <PagesEditor
                pages={paginas}
                onChange={setPaginas}
                onPreview={setPreviewPage}
                label="Paginas del documento base"
              />
            </div>

            {/* =========================================================
                NUEVO BLOQUE: TRADUCCIONES DINÁMICAS (EN LÍNEA)
            ========================================================= */}
            <div className="pt-6 mt-6 border-t border-white/10 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Languages size={16} className="text-green-400"/> Multi-Idioma
                  </h3>
                  <p className="text-[10px] text-neutral-500 mt-1">Sube contenido traducido de golpe.</p>
                </div>
                <button 
                  type="button" 
                  onClick={addTraduccion}
                  className="bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Plus size={14}/> Idioma Secundario
                </button>
              </div>

              {traducciones.map((trad, idx) => (
                <div key={idx} className="p-5 bg-black/40 rounded-2xl border border-white/5 space-y-4 relative animate-in zoom-in-95">
                  <button 
                    type="button" 
                    onClick={() => removeTraduccion(idx)}
                    className="absolute top-4 right-4 text-red-500/50 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16}/>
                  </button>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Idioma de Destino</label>
                      <select 
                        value={trad.lang} 
                        onChange={(e) => updateTraduccion(idx, 'lang', e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-green-500 text-sm transition-colors text-white cursor-pointer appearance-none"
                      >
                        <option value="en" className="bg-neutral-900">Inglés (EN)</option>
                        <option value="nah" className="bg-neutral-900">Náhuatl (NAH)</option>
                        <option value="pt" className="bg-neutral-900">Portugués (PT)</option>
                        <option value="fr" className="bg-neutral-900">Francés (FR)</option>
                        <option value="es" className="bg-neutral-900">Español (ES)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Titular Traducido</label>
                      <input 
                        type="text" required placeholder="Traducción..."
                        value={trad.titulo} onChange={(e) => updateTraduccion(idx, 'titulo', e.target.value)}
                        className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-green-500 text-sm transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Cuerpo Traducido</label>
                    <textarea 
                      required rows="2" placeholder="Desglose en este idioma..."
                      value={trad.descripcion} onChange={(e) => updateTraduccion(idx, 'descripcion', e.target.value)}
                      className="w-full bg-transparent border-b border-white/10 p-2 text-xs resize-none outline-none focus:border-green-500 transition-colors"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-2">Portada exclusiva</label>
                    <label className="flex items-center justify-center w-full py-2 border border-white/10 border-dashed rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                      <span className="text-[10px] truncate px-2">{trad.portadaArchivo ? trad.portadaArchivo.name : (trad.hasExistingPoster ? 'Actualizar portada' : 'Subir portada')}</span>
                      <input type="file" accept="image/*" onChange={(e) => updateTraduccion(idx, 'portadaArchivo', e.target.files[0])} className="hidden" />
                    </label>
                  </div>

                  <PagesEditor
                    pages={trad.paginas || []}
                    onChange={(pages) => updateTraduccionPaginas(idx, pages)}
                    onPreview={setPreviewPage}
                    label={`Paginas en ${trad.lang.toUpperCase()}`}
                    accent="green"
                  />
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-white/10">
              <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">ID Video YouTube (Opcional)</label>
              <input 
                type="text" name="youtube_id" placeholder="Ej. dQw4w9WgXcQ"
                value={formData.youtube_id} onChange={handleChange}
                className="w-full bg-transparent border-b border-white/10 p-2 font-mono text-xs outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {status && (
              <div className={`p-3 rounded-xl text-xs text-center font-bold border ${
                status.type === 'error' ? 'text-red-300 bg-red-900/20 border-red-500/30' : 
                status.type === 'info' ? 'text-blue-300 bg-blue-900/20 border-blue-500/30 animate-pulse' :
                'text-green-300 bg-green-900/20 border-green-500/30'
              }`}>
                {status.msg}
              </div>
            )}

            <button 
              type="submit" disabled={loading}
              className={`w-full py-4 font-black uppercase tracking-widest text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                editingItem ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-[#0066FF] text-white hover:bg-blue-600'
              }`}
            >
              <Save size={18}/> {editingItem ? 'Actualizar Registro Global' : 'Publicar Multi-Idioma'}
            </button>

          </form>
        </div>
      </div>

      {/* HISTORIAL Y ARCHIVO DE FLUX */}
      <div className="xl:col-span-2 space-y-12">
        
        {/* LISTA 1: NUESTRAS NOTICIAS (GIMG) */}
        <div>
          <h3 className="text-xl font-bold mb-6 text-neutral-400 font-serif italic flex items-center gap-2">
            <Globe size={18} className="text-blue-500"/> Reportes y Campañas Oficiales GIMG
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gimgNews.map(item => (
              <div key={item.id} className="flex gap-4 bg-[#121212] border border-white/10 p-4 rounded-2xl hover:border-white/30 transition-all shadow-lg group">
                <div className="w-20 h-24 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={item.poster_url} className="w-full h-full object-cover" alt="Cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white line-clamp-1">{item.titulo}</h4>
                    <p className="text-neutral-500 text-[11px] line-clamp-2 mt-1 font-medium">{item.descripcion}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{item.idioma_original || 'ES'}</span>
                      {item.titulo_i18n && Object.keys(item.titulo_i18n).length > 1 && (
                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">+{Object.keys(item.titulo_i18n).length - 1} Lang</span>
                      )}
                      {item.enlace_pdf && <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Doc Guardado</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleEdit(item)} className="bg-white/10 border border-white/10 hover:bg-white text-white hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 justify-center"><Edit3 size={12}/> Editar</button>
                    <button onClick={() => handleDelete(item.id)} className="bg-red-500/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
            {gimgNews.length === 0 && <p className="text-neutral-600 text-sm italic">No hay notas emitidas por GIMG en este momento.</p>}
          </div>
        </div>

        {/* LISTA 2: PUBLICACIONES DEL KIOSCO (COMUNIDAD) */}
        <div>
          <h3 className="text-xl font-bold mb-6 text-neutral-400 font-serif italic flex items-center gap-2">
            <BookOpen size={18} className="text-green-500"/> Ediciones Autorizadas en el Kiosco
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kioscoNews.map(item => (
              <div key={item.id} className="flex gap-4 bg-[#121212] border border-white/10 p-4 rounded-2xl hover:border-white/30 transition-all shadow-lg group">
                <div className="w-20 h-24 bg-neutral-800 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={item.poster_url} className="w-full h-full object-cover" alt="Cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-white line-clamp-1 flex-1">{item.titulo}</h4>
                      <span className="text-[8px] font-bold tracking-widest uppercase bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full truncate max-w-[90px] ml-2 border border-green-500/20">
                        {item.sello_editorial || 'Sello Ext.'}
                      </span>
                    </div>
                    <p className="text-neutral-500 text-[11px] line-clamp-2 mt-1 font-medium">{item.descripcion}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{item.idioma_original || 'ES'}</span>
                      {item.titulo_i18n && Object.keys(item.titulo_i18n).length > 1 && (
                        <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">+{Object.keys(item.titulo_i18n).length - 1} Lang</span>
                      )}
                      <span className="flex items-center gap-1 text-[9px] text-neutral-400 font-mono">
                        <Eye size={10}/> {item.vistas || 0}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => handleEdit(item)} className="bg-white/10 border border-white/10 hover:bg-white text-white hover:text-black px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 flex-1 justify-center"><Edit3 size={12}/> Editar</button>
                    <button onClick={() => handleDelete(item.id)} className="bg-red-500/10 border border-red-500/20 hover:bg-red-600 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"><Trash2 size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
            {kioscoNews.length === 0 && <p className="text-neutral-600 text-sm italic">El Kiosco está despejado de material externo en este momento.</p>}
          </div>
        </div>

      </div>
    </div>

    {previewPage && (
      <div
        className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md p-4 md:p-8 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={`Vista previa de ${previewPage.title}`}
        onClick={() => setPreviewPage(null)}
      >
        <div className="relative w-full h-full flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between gap-4 z-10">
            <span className="bg-black/70 border border-white/10 px-4 py-2 rounded-lg text-xs font-bold text-white">{previewPage.title}</span>
            <button type="button" onClick={() => setPreviewPage(null)} className="w-10 h-10 rounded-full bg-white text-black hover:bg-neutral-200 flex items-center justify-center" title="Cerrar vista previa">
              <X size={20}/>
            </button>
          </div>
          <img src={previewPage.src} alt={previewPage.title} className="max-w-full max-h-full object-contain pt-14" />
        </div>
      </div>
    )}
    </>
  );
}
