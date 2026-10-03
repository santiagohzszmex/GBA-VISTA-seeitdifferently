import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { EDITORIAL_CATEGORIES } from '../utils/editorialCategories';
import CreditsPanel from '../components/social/CreditsPanel';
import { youtubeId, validateEditionRelease } from '../utils/publishing';
import EditionDraftPreview from './EditionDraftPreview';
import './publishing.css';
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
  Images,
  Film,
  Clock3,
  UploadCloud
} from 'lucide-react';

const toDateTimeLocal = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const toIsoDate = value => value ? new Date(value).toISOString() : null;

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

export default function NoticiasTab({ previewMode = false }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [gimgNews, setGimgNews] = useState([]); 
  const [kioscoNews, setKioscoNews] = useState([]); 
  const [editingItem, setEditingItem] = useState(null);

  // Estados para archivos físicos (Idioma Base)
  const [portadaArchivo, setPortadaArchivo] = useState(null);
  const [gimgVideoArchivo, setGimgVideoArchivo] = useState(null);
  const [gimgVideoPortadaArchivo, setGimgVideoPortadaArchivo] = useState(null);
  const [paginas, setPaginas] = useState([]);
  const [previewPage, setPreviewPage] = useState(null);
  const [previewEdition, setPreviewEdition] = useState(false);
  const [releaseMode, setReleaseMode] = useState('now');
  const [coverPreview, setCoverPreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');

  // NUEVO: Estado para gestionar Múltiples Idiomas Simultáneos
  const [traducciones, setTraducciones] = useState([]);

  const initialFormState = {
    titulo: '',
    descripcion: '',
    portada_url: '', 
    enlace_pdf: '',  
    youtube_id: '',
    gimg_video_url: '',
    gimg_video_portada_url: '',
    gimg_video_titulo: '',
    gimg_video_descripcion: '',
    gimg_video_estreno_at: '',
    publicar_at: '',
    idioma_original: 'es',
    categoria_editorial: 'comunidad'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchNewsData();
  }, []);

  const fetchNewsData = async () => {
    if (previewMode) return;
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

  useEffect(() => {
    if (!portadaArchivo) { setCoverPreview(formData.portada_url); return; }
    const url = URL.createObjectURL(portadaArchivo);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [portadaArchivo, formData.portada_url]);

  useEffect(() => {
    if (!gimgVideoArchivo) { setVideoPreview(formData.gimg_video_url); return; }
    const url = URL.createObjectURL(gimgVideoArchivo);
    setVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [gimgVideoArchivo, formData.gimg_video_url]);

  const openEditionPreview = () => {
    try {
      validateEditionRelease(releaseMode, formData, Boolean(gimgVideoArchivo || formData.gimg_video_url));
      setPreviewEdition(true);
    } catch (error) { setStatus({ type: 'error', msg: error.message }); }
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
    setReleaseMode(item.gimg_video_url ? 'video' : item.publicar_at && new Date(item.publicar_at).getTime() > Date.now() ? 'cover' : 'now');
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
      gimg_video_url: item.gimg_video_url || '',
      gimg_video_portada_url: item.gimg_video_portada_url || '',
      gimg_video_titulo: item.gimg_video_titulo || '',
      gimg_video_descripcion: item.gimg_video_descripcion || '',
      gimg_video_estreno_at: toDateTimeLocal(item.gimg_video_estreno_at || (item.gimg_video_url ? new Date() : null)),
      publicar_at: toDateTimeLocal(item.publicar_at),
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
    setGimgVideoArchivo(null);
    setGimgVideoPortadaArchivo(null);
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
      const uploadedUrl = previewMode ? page.preview : await uploadToCloudinary(page.file, folderPath);
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
      validateEditionRelease(releaseMode, formData, Boolean(gimgVideoArchivo || formData.gimg_video_url));
      const linkedYoutubeId = formData.youtube_id.trim() ? youtubeId(formData.youtube_id) : '';
      if (formData.youtube_id.trim() && !linkedYoutubeId) throw new Error('El enlace complementario de YouTube no es válido.');
      let finalPortadaUrl = formData.portada_url;
      let finalGimgVideoUrl = releaseMode === 'video' ? formData.gimg_video_url : '';
      let finalGimgVideoPortadaUrl = releaseMode === 'video' ? formData.gimg_video_portada_url : '';
      let finalPaginas = [];

      const isComunidad = editingItem ? editingItem.es_comunidad : false;
      const selloStr = isComunidad ? (editingItem.sello_editorial || 'Comunidad') : 'GIMG_Oficial';
      const sanitizedSello = selloStr.replace(/[^a-zA-Z0-9]/g, '_');
      const folderPath = `Mothership_Prensa/${sanitizedSello}/${Date.now()}`;

      if (!isComunidad && releaseMode === 'video' && gimgVideoArchivo) {
        setStatus({ type: 'info', msg: 'Subiendo presentación de Global Insight...' });
        finalGimgVideoUrl = previewMode ? URL.createObjectURL(gimgVideoArchivo) : await uploadToCloudinary(gimgVideoArchivo, `${folderPath}/Premiere`);
        if (!finalGimgVideoUrl) throw new Error('No se pudo subir el video de la presentación.');
      }

      if (!isComunidad && releaseMode === 'video' && gimgVideoPortadaArchivo) {
        setStatus({ type: 'info', msg: 'Subiendo imagen previa del estreno...' });
        finalGimgVideoPortadaUrl = previewMode ? URL.createObjectURL(gimgVideoPortadaArchivo) : await uploadToCloudinary(gimgVideoPortadaArchivo, `${folderPath}/Premiere`);
        if (!finalGimgVideoPortadaUrl) throw new Error('No se pudo subir la imagen previa.');
      }

      const videoReleaseAt = releaseMode === 'video' ? toIsoDate(formData.gimg_video_estreno_at) : null;
      const editionReleaseAt = releaseMode === 'now' ? null : toIsoDate(formData.publicar_at);
      if (!isComunidad && finalGimgVideoUrl && !videoReleaseAt) {
        throw new Error('Indica la fecha y hora en que se estrenará el video.');
      }
      if (!isComunidad && finalGimgVideoUrl && editionReleaseAt && new Date(videoReleaseAt) >= new Date(editionReleaseAt)) {
        throw new Error('El estreno del video debe ocurrir antes de publicar la edición.');
      }
      // 1. Subida del Idioma Base (Portada)
      if (portadaArchivo) {
        setStatus({ type: 'info', msg: 'Subiendo ilustración principal...' });
        const uploadedUrl = previewMode ? coverPreview : await uploadToCloudinary(portadaArchivo, folderPath);
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
          tPortada = previewMode ? URL.createObjectURL(trad.portadaArchivo) : await uploadToCloudinary(trad.portadaArchivo, folderPath);
          if (!tPortada) throw new Error('No se pudo subir la portada traducida.');
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
        enlace_pdf: finalPaginas.length ? finalPaginasJsonStr : (/^https:\/\//.test(formData.enlace_pdf) ? formData.enlace_pdf : finalPaginasJsonStr),
        youtube_id: linkedYoutubeId || null,
        gimg_video_url: isComunidad ? null : (finalGimgVideoUrl || null),
        gimg_video_portada_url: isComunidad ? null : (finalGimgVideoPortadaUrl || null),
        gimg_video_titulo: isComunidad || releaseMode !== 'video' ? null : (formData.gimg_video_titulo || null),
        gimg_video_descripcion: isComunidad || releaseMode !== 'video' ? null : (formData.gimg_video_descripcion || null),
        gimg_video_estreno_at: isComunidad ? null : videoReleaseAt,
        publicar_at: editionReleaseAt,
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
        : releaseMode === 'cover' ? 'Portada anunciada. Las páginas se abrirán en la fecha indicada.' : 'Edición publicada correctamente.';

      if (previewMode) {
        const next = { ...editingItem, ...payload, id: editingItem?.id || `preview-${Date.now()}` };
        const update = current => [next, ...current.filter(item => item.id !== next.id)];
        if (isComunidad) setKioscoNews(update); else setGimgNews(update);
      } else if (editingItem) {
        const { error } = await supabase.from('contenido').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('contenido').insert([payload]);
        if (error) throw error;
      }

      resetForm();
      setStatus({ type: 'success', msg: previewMode ? 'Vista de desarrollo: edición guardada solo en esta página.' : successMessage });
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
      if (previewMode) {
        setGimgNews(current => current.filter(item => item.id !== id));
        setKioscoNews(current => current.filter(item => item.id !== id));
      } else {
        const { error } = await supabase.from('contenido').delete().eq('id', id);
        if (error) throw error;
        await fetchNewsData();
      }
      if (editingItem?.id === id) resetForm();
    } catch (err) {
      console.error(err);
      alert("No se pudo eliminar el registro.");
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setReleaseMode('now');
    setFormData(initialFormState);
    setPortadaArchivo(null);
    setGimgVideoArchivo(null);
    setGimgVideoPortadaArchivo(null);
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
    <div className="ms-publishing">
      
      {/* FORMULARIO EDITORIAL INTELLIGENT (DARK MODE) */}
      <div>
        <div className="ms-editor">
          
          <div className="ms-editor-head">
            <h2 className="flex items-center gap-3">
              {editingItem ? <><Edit3 className="text-yellow-500"/> Editar edición.</> : <><PlusCircle className="text-blue-500"/> Publicar una edición.</>}
            </h2>
            {editingItem && (
              <button onClick={resetForm} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full flex items-center gap-1 transition-colors">
                <X size={12}/> Cancelar
              </button>
            )}
          </div>

          {previewMode && <p className="ms-preview-note mb-6">Vista de desarrollo. Las ediciones no se publican en VISTA.</p>}
          <form onSubmit={handleSubmit}>
            <section className="ms-step"><h3><span className="ms-step-number">1</span>Presenta la edición</h3>
              <label className="ms-field"><span>Título de la edición</span><input name="titulo" value={formData.titulo} onChange={handleChange} required placeholder="Ej. Edición 1 · Un nuevo comienzo"/></label>
              <label className="ms-field"><span>Descripción</span><textarea name="descripcion" value={formData.descripcion} onChange={handleChange} rows={3} required placeholder="Lo que encontrará la comunidad en esta edición."/></label>
              <div className="ms-fields"><label className="ms-field"><span>Idioma principal</span><select name="idioma_original" value={formData.idioma_original} onChange={handleChange}>{[['es','Español'],['en','Inglés'],['nah','Náhuatl'],['pt','Portugués'],['fr','Francés']].map(([value,text]) => <option key={value} value={value}>{text}</option>)}</select></label><label className="ms-field"><span>Categoría editorial</span><select name="categoria_editorial" value={formData.categoria_editorial} onChange={handleChange}>{EDITORIAL_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></label></div>
            </section>
            <section className="ms-step"><h3><span className="ms-step-number">2</span>Portada y páginas</h3>
              <div className="flex flex-wrap gap-5 items-center">{coverPreview && <img className="ms-cover-preview" src={coverPreview} alt="Vista previa de la portada"/>}<label className="ms-upload flex-1"><ImageIcon size={21}/><span><span className="block mb-2">{portadaArchivo?.name || (formData.portada_url ? 'Cambiar portada' : 'Subir portada')}</span><input aria-label="Subir portada del periódico" type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setPortadaArchivo(e.target.files?.[0] || null)}/></span></label></div>
              <label className="ms-field"><span>O utiliza una imagen ya publicada</span><input type="url" name="portada_url" value={formData.portada_url} onChange={handleChange} placeholder="https://…"/></label>
              <PagesEditor pages={paginas} onChange={setPaginas} onPreview={setPreviewPage} label="Páginas de la edición"/>
              <p className="ms-help">Puedes ordenar o reemplazar cada página. Si anuncias solo la portada, puedes añadir las páginas antes del estreno.</p>
              <label className="ms-field"><span>PDF de la edición (opcional)</span><input type="url" value={/^https:\/\//.test(formData.enlace_pdf) ? formData.enlace_pdf : ''} onChange={e => setFormData(current => ({...current,enlace_pdf:e.target.value}))} placeholder="https://…/edicion.pdf"/><small>Si utilizas imágenes para las páginas, VISTA mostrará esas imágenes.</small></label>
            </section>
            <section className="ms-step"><h3><span className="ms-step-number">3</span>Cómo quieres publicarla</h3>
              <div className="ms-release-options">
                <label className="ms-option"><input type="radio" name="edition-release" checked={releaseMode === 'now'} onChange={() => setReleaseMode('now')}/><span><strong>Publicar la edición completa</strong><small>Portada y páginas disponibles al guardar. Sin video de presentación.</small></span></label>
                <label className="ms-option"><input type="radio" name="edition-release" checked={releaseMode === 'cover'} onChange={() => setReleaseMode('cover')}/><span><strong>Portada primero, edición después</strong><small>Anuncia la portada ahora y elige cuándo abrir las páginas. No requiere video.</small></span></label>
                {(!editingItem || !editingItem.es_comunidad) && <label className="ms-option"><input type="radio" name="edition-release" checked={releaseMode === 'video'} onChange={() => setReleaseMode('video')}/><span><strong>Presentación en video</strong><small>Estrena un video de GIMG antes de abrir la edición.</small></span></label>}
              </div>
              {releaseMode !== 'now' && <label className="ms-field"><span>{releaseMode === 'cover' ? 'Las páginas se abrirán el' : 'Apertura de las páginas (opcional)'}</span><input aria-label="Fecha de apertura de la edición" type="datetime-local" name="publicar_at" value={formData.publicar_at} onChange={handleChange} required={releaseMode === 'cover'}/></label>}
              {releaseMode === 'cover' && <p className="ms-preview-note">Se mostrará la portada y el aviso de la próxima edición. El lector de páginas estará disponible a partir de la fecha que elijas.</p>}
              {releaseMode === 'video' && <div className="grid gap-4 border border-white/15 rounded-lg p-4">
                <label className="ms-upload"><UploadCloud size={20}/><span><span className="block mb-2">{gimgVideoArchivo?.name || (formData.gimg_video_url ? 'Sustituir video de presentación' : 'Subir video de presentación')}</span><input aria-label="Subir video de presentación" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setGimgVideoArchivo(e.target.files?.[0] || null)}/></span></label>
                <label className="ms-field"><span>O enlace al archivo del video</span><input type="url" name="gimg_video_url" value={formData.gimg_video_url} onChange={handleChange} placeholder="https://…/presentacion.mp4"/></label>
                <label className="ms-field"><span>Estreno del video</span><input type="datetime-local" name="gimg_video_estreno_at" value={formData.gimg_video_estreno_at} onChange={handleChange} required/></label>
                <label className="ms-field"><span>Título del video (opcional)</span><input name="gimg_video_titulo" value={formData.gimg_video_titulo} onChange={handleChange} placeholder="Se utilizará el título de la edición"/></label>
                <label className="ms-field"><span>Descripción del video (opcional)</span><textarea name="gimg_video_descripcion" value={formData.gimg_video_descripcion} onChange={handleChange} rows={2}/></label>
                <label className="ms-field"><span>Imagen previa del video (opcional)</span><input type="url" name="gimg_video_portada_url" value={formData.gimg_video_portada_url} onChange={handleChange} placeholder="https://…"/></label>
                <label className="ms-field"><span>O subir imagen previa</span><input aria-label="Subir imagen previa del video" type="file" accept="image/*" onChange={e => setGimgVideoPortadaArchivo(e.target.files?.[0] || null)}/></label>
              </div>}
            </section>
            <details className="ms-more" open={traducciones.length > 0 ? true : undefined}><summary>Traducciones · otros idiomas</summary><div>
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


            </div></details>
            <details className="ms-more"><summary>Enlace de YouTube complementario</summary><div><label className="ms-field"><span>Video vinculado a la edición (opcional)</span><input name="youtube_id" value={formData.youtube_id} onChange={handleChange} placeholder="Enlace de YouTube o ID"/></label></div></details>
            {status && <p role={status.type === 'error' ? 'alert' : 'status'} className={`ms-notice ms-notice-${status.type}`}>{status.msg}</p>}
            <div className="ms-actions"><button type="button" className="ms-button" onClick={openEditionPreview}><Eye size={15}/>Vista previa</button><button type="submit" className="ms-button ms-button-primary" disabled={loading}><Save size={15}/>{loading ? 'Guardando…' : editingItem ? 'Guardar cambios' : releaseMode === 'cover' ? 'Anunciar portada' : 'Publicar edición'}</button></div>
          </form>

          {editingItem && !previewMode && <CreditsPanel subjectType="content" subjectId={editingItem.id} editable dark className="mt-7"/>}
        </div>
      </div>

      {/* HISTORIAL Y ARCHIVO DE FLUX */}
      <div className="ms-catalogue space-y-12">
        
        {/* LISTA 1: NUESTRAS NOTICIAS (GIMG) */}
        <div>
          <h3 className="text-xl font-bold mb-6 text-neutral-400 font-serif italic flex items-center gap-2">
            <Globe size={18} className="text-blue-500"/> Ediciones de GIMG.
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
            <BookOpen size={18} className="text-green-500"/> Ediciones de la comunidad.
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

    {previewEdition && <EditionDraftPreview form={{...formData, gimg_video_url: videoPreview}} cover={coverPreview} pages={paginas} mode={releaseMode} onClose={() => setPreviewEdition(false)}/>}
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
