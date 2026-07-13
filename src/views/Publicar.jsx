import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { 
  PenTool, 
  Upload, 
  Send, 
  ShieldCheck, 
  Clock, 
  FileText, 
  Building, 
  AlertCircle,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  FileImage,
  Crown,
  Globe,
  Languages,
  Tag
} from 'lucide-react';
import { EDITORIAL_CATEGORIES } from '../utils/editorialCategories';

export default function Publicar() {
  const { user, isDueño } = useAuth();
  const puedePublicar = user?.rol === 'Editor';

  const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1521553828674146485/0BIQdUirrZbiC5FwsU14f-6tuNhFOqJB7lNxBelruyFeQgmNGfVWiTdRxJB392gsafP_";

  // ================= ESTADOS CIUDADANO =================
  const [nombreNoticiero, setNombreNoticiero] = useState('');
  const [descripcionNoticiero, setDescripcionNoticiero] = useState('');
  const [solicitudExistente, setSolicitudExistente] = useState(false);
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(false);

  // ================= ESTADOS EDICIÓN BASE =================
  const [selloPublicacion, setSelloPublicacion] = useState(''); 
  const [idiomaOriginal, setIdiomaOriginal] = useState('es'); 
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [categoriaEditorial, setCategoriaEditorial] = useState('comunidad');
  const [portadaArchivo, setPortadaArchivo] = useState(null);
  const [paginasArchivos, setPaginasArchivos] = useState([]); 
  const [enviando, setEnviando] = useState(false);
  const [publicacionExitosa, setPublicacionExitosa] = useState(false);
  const [historialPublicaciones, setHistorialPublicaciones] = useState([]);

  // ================= NUEVO: ESTADOS DE TRADUCCIONES DINÁMICAS =================
  const [traducciones, setTraducciones] = useState([]);

  // ================= EFECTOS =================
  useEffect(() => {
    if (!user || isDueño) return; 
    
    if (user.sello_editorial) {
      setSelloPublicacion(user.sello_editorial);
    }

    if (puedePublicar) {
      cargarHistorialAduana();
    } else {
      comprobarSolicitudPrevia();
    }
  }, [user, puedePublicar, isDueño]);

  const comprobarSolicitudPrevia = async () => {
    try {
      const { data } = await supabase.from('solicitudes_editoriales').select('*').eq('usuario_id', user.id).maybeSingle();
      if (data) setSolicitudExistente(true);
    } catch (err) {
      console.error("Error al rastrear estatus previo:", err);
    }
  };

  const cargarHistorialAduana = async () => {
    try {
      const { data } = await supabase
        .from('contenido')
        .select('id, titulo, estado_publicacion, created_at')
        .eq('autor_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (data) setHistorialPublicaciones(data);
    } catch (err) {
      console.error("Error al cargar historial:", err);
    }
  };

  const handleAgregarPagina = (e) => {
    const file = e.target.files[0];
    if (file) setPaginasArchivos([...paginasArchivos, file]);
  };

  const handleEliminarPagina = (index) => {
    const nuevasPaginas = [...paginasArchivos];
    nuevasPaginas.splice(index, 1);
    setPaginasArchivos(nuevasPaginas);
  };

  // ================= MANEJADORES DE TRADUCCIÓN =================
  const addTraduccion = () => {
    const usedLanguages = new Set([idiomaOriginal, ...traducciones.map(trad => trad.lang)]);
    const nextLanguage = ['en', 'es', 'nah', 'pt', 'fr'].find(lang => !usedLanguages.has(lang));
    if (!nextLanguage) {
      alert('Ya añadiste todos los idiomas disponibles.');
      return;
    }
    setTraducciones([...traducciones, { lang: nextLanguage, titulo: '', descripcion: '', portadaArchivo: null, paginasArchivos: [] }]);
  };

  const removeTraduccion = (index) => {
    setTraducciones(traducciones.filter((_, i) => i !== index));
  };

  const updateTraduccion = (index, field, value) => {
    const newTrads = [...traducciones];
    newTrads[index][field] = value;
    setTraducciones(newTrads);
  };

  const handleTraduccionPagina = (index, file) => {
    if (!file) return;
    const newTrads = [...traducciones];
    newTrads[index].paginasArchivos.push(file);
    setTraducciones(newTrads);
  };

  // ================= MANEJADOR A: CIUDADANOS =================
  const handleSolicitarSello = async (e) => {
    e.preventDefault();
    if (!nombreNoticiero || !descripcionNoticiero || procesandoSolicitud) return;
    setProcesandoSolicitud(true);

    try {
      const { error: supabaseError } = await supabase.from('solicitudes_editoriales').insert([{
        usuario_id: user.id,
        nombre_noticiero: nombreNoticiero,
        descripcion: descripcionNoticiero,
        estado: 'pendiente'
      }]);

      if (supabaseError) throw supabaseError;

      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: "🚨 NUEVA SOLICITUD DE SELLO EDITORIAL",
            description: "Un ciudadano ha enviado una propuesta de prensa y espera su acreditación en la aduana.",
            color: 3447003, 
            fields: [
              { name: "Nombre del Noticiero", value: `\`${nombreNoticiero}\``, inline: true },
              { name: "Usuario UID", value: `\`${user.id}\``, inline: true },
              { name: "Línea Editorial", value: descripcionNoticiero }
            ]
          }]
        })
      });

      setSolicitudExistente(true);
    } catch (err) {
      console.error(err);
      alert("Error al procesar tu solicitud.");
    } finally {
      setProcesandoSolicitud(false);
    }
  };

  // ================= MANEJADOR B: EDITORES =================
  const handleSubirPublicacion = async (e) => {
    e.preventDefault();
    if (enviando) return;

    if (!portadaArchivo) {
      alert("La ilustración de portada es obligatoria.");
      return;
    }

    const selectedLanguages = [idiomaOriginal, ...traducciones.map(trad => trad.lang)];
    if (new Set(selectedLanguages).size !== selectedLanguages.length) {
      alert('El idioma base y cada traducción deben usar idiomas diferentes.');
      return;
    }

    const selloFinal = selloPublicacion.trim() || 'Editorial Independiente';
    setEnviando(true);

    try {
      // INGENIERÍA DE ORGANIZACIÓN
      const sanitizedSello = selloFinal.replace(/[^a-zA-Z0-9]/g, '_');
      const folderPath = `Kiosco_Alianza/${sanitizedSello}/${Date.now()}`;

      // 1. Subida del Idioma Base
      const urlPortada = await uploadToCloudinary(portadaArchivo, folderPath);
      if (!urlPortada) throw new Error("Fallo al subir la portada.");

      const urlsPaginas = [];
      for (const pagina of paginasArchivos) {
        const urlPagina = await uploadToCloudinary(pagina, folderPath);
        if (urlPagina) urlsPaginas.push(urlPagina);
      }

      // INGENIERÍA MULTI-IDIOMA EN BLOQUE
      const langBase = idiomaOriginal;
      const titulos = { [langBase]: titulo };
      const descripciones = { [langBase]: descripcion };
      const posters = { [langBase]: urlPortada };
      const paginasObj = {};
      if (urlsPaginas.length > 0) paginasObj[langBase] = urlsPaginas;

      // 2. Subida de Traducciones Secundarias
      for (const trad of traducciones) {
        if (!trad.titulo) continue; // Ignoramos si no pusieron título

        titulos[trad.lang] = trad.titulo;
        descripciones[trad.lang] = trad.descripcion;
        
        let tPortada = urlPortada; // Usar portada base si no suben una nueva
        if (trad.portadaArchivo) {
          const up = await uploadToCloudinary(trad.portadaArchivo, folderPath);
          if (up) tPortada = up;
        }
        posters[trad.lang] = tPortada;

        let tPaginas = [];
        if (trad.paginasArchivos.length > 0) {
          for (const p of trad.paginasArchivos) {
            const up = await uploadToCloudinary(p, folderPath);
            if (up) tPaginas.push(up);
          }
        }
        if (tPaginas.length > 0) paginasObj[trad.lang] = tPaginas;
      }

      const payload = {
        titulo: titulo, 
        descripcion: descripcion, 
        poster_url: urlPortada, 
        banner_url: urlPortada, 
        enlace_pdf: urlsPaginas.length > 0 ? JSON.stringify(urlsPaginas) : null, 
        
        idioma_original: langBase,
        titulo_i18n: titulos,
        descripcion_i18n: descripciones,
        poster_i18n: posters,
        paginas_i18n: Object.keys(paginasObj).length > 0 ? paginasObj : null,

        es_comunidad: true,
        estado_publicacion: 'pendiente', 
        autor_id: user.id,
        sello_editorial: selloFinal,
        categoria: 'Periódico',
        categoria_editorial: categoriaEditorial,
        anio: new Date().getFullYear().toString()
      };

      const { error } = await supabase.from('contenido').insert([payload]);
      if (error) throw error;

      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: "📦 NUEVA EDICIÓN EN ADUANA",
            description: `El sello **"${selloFinal}"** ha subido un documento multi-idioma a revisión.`,
            color: 15105570, 
            fields: [
              { name: "Titular", value: titulo, inline: true },
              { name: "Idioma Base", value: langBase.toUpperCase(), inline: true },
              { name: "Traducciones Extra", value: `${traducciones.length} idioma(s)`, inline: true }
            ]
          }]
        })
      });

      setPublicacionExitosa(true);
      setTitulo(''); setDescripcion(''); setCategoriaEditorial('comunidad'); setPortadaArchivo(null); setPaginasArchivos([]); setTraducciones([]);
      cargarHistorialAduana();
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al inyectar el documento.");
    } finally {
      setEnviando(false);
    }
  };

  // ========================================================
  // RENDER INTERFAZ ZERO: INTERCEPTOR PARA DUEÑOS/ADMINS
  // ========================================================
  if (isDueño || user?.rol === 'Admin') {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] pt-12 px-6 md:px-12 flex flex-col items-center justify-center animate-in fade-in">
        <div className="bg-white border border-[#d2d2d7] rounded-3xl p-12 max-w-lg mx-auto text-center shadow-[0_20px_40px_rgba(0,0,0,0.02)]">
          <div className="w-20 h-20 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Crown size={36} strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl font-serif italic text-[#1d1d1f] mb-4">Autoridad Máxima</h2>
          <p className="text-[#86868b] text-sm leading-relaxed font-medium mb-8">
            Este módulo es exclusivamente para que los ciudadanos y editores independientes soliciten y despachen contenido hacia la Aduana. Como administrador del ecosistema, tus publicaciones oficiales se inyectan directamente desde el núcleo.
          </p>
          <button 
            onClick={() => window.location.href = '/mothership'}
            className="w-full bg-[#1d1d1f] hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            Ir a Mothership Command
          </button>
        </div>
      </div>
    );
  }

  // ================= RENDER INTERFAZ A: CIUDADANOS =================
  if (!puedePublicar) {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] pt-12 px-6 md:px-12 flex flex-col items-center">
         <div className="w-full max-w-3xl mt-12 text-center">
          
          <div className="w-20 h-20 bg-blue-50 text-[#0066FF] rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-sm">
            <PenTool size={36} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif italic tracking-tight text-[#1d1d1f] mb-4">
            Tu voz, en la Alianza.
          </h2>
          <p className="text-[#86868b] text-base md:text-lg font-medium max-w-xl mx-auto mb-12">
            VISTA Studio es el motor periodístico de GlobalBank. Registra tu marca informativa independiente para desbloquear las herramientas de carga.
          </p>

          {solicitudExistente ? (
            <div className="bg-white border border-[#d2d2d7] rounded-3xl p-8 max-w-lg mx-auto flex flex-col items-center shadow-[0_10px_30px_rgba(0,0,0,0.02)] animate-in fade-in">
              <Clock className="text-[#0066FF] mb-4 animate-pulse" size={36} />
              <h3 className="text-xl font-serif italic text-[#1d1d1f] mb-2">Estatus: En Revisión</h3>
              <p className="text-[#86868b] text-sm leading-relaxed font-medium">
                Mothership Command recibió tu solicitud y propuesta editorial. Permisos en proceso de acreditación por la aduana del panel administrativo.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSolicitarSello} className="bg-white border border-[#d2d2d7] rounded-3xl p-8 shadow-[0_30px_60px_rgba(0,0,0,0.04)] max-w-lg mx-auto text-left space-y-6 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Building size={14}/> Nombre del Noticiero / Sello
                </label>
                <input 
                  type="text" required placeholder="Ej. El Informador, GBA Chronicle..."
                  value={nombreNoticiero} onChange={(e) => setNombreNoticiero(e.target.value)}
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0066FF] transition-all font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#86868b] uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <FileText size={14}/> Línea Editorial y Descripción
                </label>
                <textarea 
                  required rows="4" placeholder="Describe brevemente de qué hablará tu noticiero o periódico..."
                  value={descripcionNoticiero} onChange={(e) => setDescripcionNoticiero(e.target.value)}
                  className="w-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0066FF] transition-all resize-none text-sm font-medium leading-relaxed"
                />
              </div>
              <button type="submit" disabled={procesandoSolicitud} className={`w-full bg-[#1d1d1f] hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 text-sm uppercase tracking-wider ${procesandoSolicitud ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {procesandoSolicitud ? 'Estableciendo Enlace...' : <><Send size={16} /> Solicitar Sello Editorial</>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ================= RENDER INTERFAZ B (EDITORES) =================
  return (
    <div className="w-full min-h-screen bg-[#fbfbfd] pt-12 px-6 md:px-12 pb-24">
      <div className="max-w-4xl mx-auto">
        
        <header className="mb-10">
          <div className="flex items-center gap-2 text-[#0066FF] mb-3">
            <ShieldCheck size={18} />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Operador Acreditado • Sello: {user?.sello_editorial || 'Autor Independiente'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-serif italic tracking-tight text-[#1d1d1f]">
            Aduana Editorial.
          </h2>
          <div className="h-px w-full bg-[#d2d2d7]/50 mt-6"></div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2">
            {publicacionExitosa ? (
              <div className="bg-white border border-[#d2d2d7] rounded-3xl p-12 text-center shadow-sm animate-in fade-in">
                <div className="w-20 h-20 bg-blue-50 text-[#0066FF] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send size={32} />
                </div>
                <h3 className="text-3xl font-serif italic text-[#1d1d1f] mb-4">Enviado a Revisión</h3>
                <p className="text-[#86868b] text-sm mb-8">El archivo está en la Aduana esperando aprobación de Mothership.</p>
                <button onClick={() => setPublicacionExitosa(false)} className="bg-[#f5f5f7] hover:bg-[#e8e8ed] text-black font-bold py-3 px-8 rounded-xl">
                  Subir otro documento
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubirPublicacion} className="space-y-6 animate-in fade-in">
                
                <div className="bg-white border border-[#d2d2d7] rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1d1d1f] mb-4 flex items-center gap-2"><FileText size={16} className="text-[#86868b]"/> Metadatos Base</h3>
                  <div className="space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] text-[#86868b] uppercase tracking-widest mb-1.5 font-bold">Sello Editorial</label>
                        <input 
                          type="text" required placeholder="Tu marca editorial..."
                          value={selloPublicacion} onChange={(e) => setSelloPublicacion(e.target.value)}
                          className="w-full bg-[#f0f5ff] border border-blue-200 text-[#0066FF] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0066FF] font-bold text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-[#86868b] uppercase tracking-widest mb-1.5 font-bold flex items-center gap-1">
                          <Globe size={12}/> Idioma Original
                        </label>
                        <select 
                          value={idiomaOriginal} onChange={(e) => setIdiomaOriginal(e.target.value)}
                          className="w-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0066FF] font-bold text-sm outline-none appearance-none cursor-pointer"
                        >
                          <option value="es">Español (ES)</option>
                          <option value="en">Inglés (EN)</option>
                          <option value="nah">Náhuatl (NAH)</option>
                          <option value="pt">Portugués (PT)</option>
                          <option value="fr">Francés (FR)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#86868b] uppercase tracking-widest mb-1.5 font-bold flex items-center gap-1"><Tag size={12}/> Categoría editorial</label>
                      <select value={categoriaEditorial} onChange={(e) => setCategoriaEditorial(e.target.value)} className="w-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0066FF] font-bold text-sm outline-none appearance-none cursor-pointer">
                        {EDITORIAL_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#86868b] uppercase tracking-widest mb-1.5 font-bold">Titular Principal</label>
                      <input 
                        type="text" required placeholder="Ej. Informe Financiero Semanal..."
                        value={titulo} onChange={(e) => setTitulo(e.target.value)}
                        className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0066FF] font-serif text-lg outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#86868b] uppercase tracking-widest mb-1.5 font-bold">Sinopsis</label>
                      <textarea 
                        required rows="3" placeholder="Sinopsis de la edición..."
                        value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                        className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-xl px-4 py-3 focus:ring-2 focus:ring-[#0066FF] text-sm resize-none outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#d2d2d7] rounded-3xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-[#1d1d1f] mb-4 flex items-center gap-2"><ImageIcon size={16} className="text-[#86868b]"/> Archivos de Lectura</h3>
                  
                  <label className="flex items-center justify-between p-4 border border-[#d2d2d7] rounded-xl mb-4 bg-[#fbfbfd] cursor-pointer hover:bg-[#f5f5f7] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#1d1d1f] text-white rounded-lg flex items-center justify-center"><ImageIcon size={18}/></div>
                      <div>
                        <p className="text-sm font-bold text-[#1d1d1f]">{portadaArchivo ? portadaArchivo.name : 'Adjuntar Portada'}</p>
                        <p className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">Obligatorio</p>
                      </div>
                    </div>
                    <input type="file" accept="image/*" onChange={(e) => setPortadaArchivo(e.target.files[0])} className="hidden" required={!portadaArchivo}/>
                  </label>

                  <div className="space-y-3">
                    {paginasArchivos.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-[#d2d2d7] rounded-xl bg-white animate-in slide-in-from-left-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#f5f5f7] text-[#86868b] rounded-lg flex items-center justify-center"><FileImage size={14}/></div>
                          <div>
                            <p className="text-xs font-bold text-[#1d1d1f]">Página {index + 1}</p>
                            <p className="text-[10px] text-[#86868b] truncate max-w-[150px]">{file.name}</p>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleEliminarPagina(index)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))}

                    <label className="flex items-center justify-center gap-2 w-full py-4 border-2 border-dashed border-[#d2d2d7] rounded-xl text-sm font-bold text-[#0066FF] cursor-pointer hover:bg-blue-50/50 transition-colors">
                      <Plus size={18} /> Añadir Página a la Edición
                      <input type="file" accept="image/*" onChange={handleAgregarPagina} className="hidden"/>
                    </label>
                  </div>
                </div>

                {/* =========================================================
                    NUEVO BLOQUE: TRADUCCIONES DINÁMICAS PARA CIUDADANOS
                ========================================================= */}
                <div className="pt-6 mt-6 border-t border-[#d2d2d7]/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#1d1d1f] flex items-center gap-2">
                        <Languages size={16} className="text-[#0066FF]"/> Multi-Idioma
                      </h3>
                      <p className="text-[10px] text-[#86868b] mt-1">Sube versiones traducidas de tu edición.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={addTraduccion}
                      className="bg-blue-50 text-[#0066FF] hover:bg-blue-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm border border-blue-200"
                    >
                      <Plus size={14}/> Idioma Secundario
                    </button>
                  </div>

                  {traducciones.map((trad, idx) => (
                    <div key={idx} className="p-5 bg-white border border-[#d2d2d7] rounded-2xl space-y-4 relative animate-in zoom-in-95 shadow-sm">
                      <button 
                        type="button" 
                        onClick={() => removeTraduccion(idx)}
                        className="absolute top-4 right-4 text-red-500/60 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16}/>
                      </button>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] text-[#86868b] font-bold uppercase mb-1">Idioma de Destino</label>
                          <select 
                            value={trad.lang} 
                            onChange={(e) => updateTraduccion(idx, 'lang', e.target.value)}
                            className="w-full bg-[#f5f5f7] border border-[#d2d2d7] p-2 font-bold outline-none focus:ring-2 focus:ring-[#0066FF] rounded-xl text-sm transition-colors text-[#1d1d1f] cursor-pointer appearance-none"
                          >
                            <option value="en">Inglés (EN)</option>
                            <option value="nah">Náhuatl (NAH)</option>
                            <option value="pt">Portugués (PT)</option>
                            <option value="fr">Francés (FR)</option>
                            <option value="es">Español (ES)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#86868b] font-bold uppercase mb-1">Titular Traducido</label>
                          <input 
                            type="text" required placeholder="Traducción..."
                            value={trad.titulo} onChange={(e) => updateTraduccion(idx, 'titulo', e.target.value)}
                            className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-xl p-2 font-bold outline-none focus:ring-2 focus:ring-[#0066FF] text-sm transition-colors"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] text-[#86868b] font-bold uppercase mb-1">Cuerpo Traducido</label>
                        <textarea 
                          required rows="2" placeholder="Desglose en este idioma..."
                          value={trad.descripcion} onChange={(e) => updateTraduccion(idx, 'descripcion', e.target.value)}
                          className="w-full bg-[#f5f5f7] border border-[#d2d2d7] rounded-xl p-2 text-xs resize-none outline-none focus:ring-2 focus:ring-[#0066FF] transition-colors"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <label className="block text-[10px] text-[#86868b] font-bold uppercase mb-2">Portada Exclusiva</label>
                          <label className="flex items-center justify-center w-full py-2 border border-[#d2d2d7] border-dashed rounded-lg cursor-pointer bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors">
                            <span className="text-[10px] text-[#1d1d1f] font-bold truncate px-2">{trad.portadaArchivo ? trad.portadaArchivo.name : 'Subir Portada'}</span>
                            <input type="file" accept="image/*" onChange={(e) => updateTraduccion(idx, 'portadaArchivo', e.target.files[0])} className="hidden" />
                          </label>
                        </div>
                        <div>
                          <label className="block text-[10px] text-[#86868b] font-bold uppercase mb-2">Páginas ({trad.paginasArchivos.length})</label>
                          <label className="flex items-center justify-center w-full py-2 border border-[#d2d2d7] border-dashed rounded-lg cursor-pointer bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors">
                            <span className="text-[10px] text-[#1d1d1f] font-bold truncate px-2">+ Agregar Página</span>
                            <input type="file" accept="image/*" onChange={(e) => handleTraduccionPagina(idx, e.target.files[0])} className="hidden" />
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* ========================================================= */}

                <button type="submit" disabled={enviando} className={`w-full bg-[#0066FF] hover:bg-blue-600 text-white font-bold py-5 rounded-2xl shadow-xl transition-all flex justify-center items-center gap-2 uppercase tracking-wider ${enviando ? 'opacity-70' : ''}`}>
                  {enviando ? 'Enviando a Servidores...' : <><Send size={20} /> Entregar a Aduana</>}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-[#d2d2d7] rounded-3xl p-6 shadow-sm sticky top-8">
              <h3 className="text-sm font-bold text-[#1d1d1f] mb-4 flex items-center gap-2"><Clock size={16} className="text-[#86868b]" /> Estatus de Documentos</h3>
              
              {historialPublicaciones.length > 0 ? (
                <div className="space-y-4">
                  {historialPublicaciones.map((pub) => (
                    <div key={pub.id} className="border-b border-[#d2d2d7]/50 pb-3 last:border-0 last:pb-0">
                      <p className="text-xs font-bold text-[#1d1d1f] line-clamp-1 mb-1">{pub.titulo}</p>
                      
                      {pub.estado_publicacion === 'pendiente' && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"><Clock size={10}/> En Revisión</span>
                      )}
                      {pub.estado_publicacion === 'aprobado' && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"><CheckCircle size={10}/> Aprobado</span>
                      )}
                      {pub.estado_publicacion === 'rechazado' && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"><XCircle size={10}/> Rechazado</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#86868b] font-medium text-center py-4">No tienes documentos en el historial de la aduana.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
