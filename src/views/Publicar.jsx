import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { useEditorialWorkspace } from '../hooks/useEditorialWorkspace';
import EditorialInvitations from '../components/studio/EditorialInvitations';
import EditorialProfileSettings from '../components/studio/EditorialProfileSettings';
import EditorialStudioHeader from '../components/studio/EditorialStudioHeader';
import EditorialTeamManager from '../components/studio/EditorialTeamManager';
import NetworkBusinessStudio from '../components/studio/NetworkBusinessStudio';
import CreditsPanel from '../components/social/CreditsPanel';
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

const StudioStyles = () => <style>{`.studio-input{width:100%;min-height:44px;border:1px solid #d2d2d7;border-radius:6px;background:#fff;padding:10px 12px;color:#1d1d1f;font-size:13px;outline:none}.studio-input:focus{border-color:#0066ff;box-shadow:0 0 0 2px rgba(0,102,255,.09)}.studio-input:disabled{background:#f5f5f7;color:#6e6e73}.studio-label{display:flex;align-items:center;gap:5px;margin-bottom:7px;color:#86868b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}`}</style>;

export default function Publicar({ initialSection = 'publish' }) {
  const { user, isDueño } = useAuth();
  const {
    editorials,
    invitations,
    activeEditorial,
    loading: workspaceLoading,
    error: workspaceError,
    refresh: refreshEditorials,
    selectEditorial,
    respondToInvitation,
    updateEditorial,
    previewMode
  } = useEditorialWorkspace(user?.id);
  const [studioSection, setStudioSection] = useState(initialSection);
  const puedePublicar = Boolean(activeEditorial && ['owner', 'admin', 'editor', 'collaborator'].includes(activeEditorial.role));

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
  const [creditsPublicationId, setCreditsPublicationId] = useState(null);

  // ================= NUEVO: ESTADOS DE TRADUCCIONES DINÁMICAS =================
  const [traducciones, setTraducciones] = useState([]);

  // ================= EFECTOS =================
  useEffect(() => {
    if (!user || workspaceLoading) return;

    if (activeEditorial) {
      setSelloPublicacion(activeEditorial.nombre);
      setCreditsPublicationId(null);
      cargarHistorialAduana();
    } else {
      comprobarSolicitudPrevia();
    }
  }, [user, activeEditorial?.id, activeEditorial?.nombre, workspaceLoading]);

  useEffect(() => {
    if (initialSection === 'network' || initialSection === 'publish') setStudioSection(initialSection);
  }, [initialSection]);

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
      if (previewMode) {
        setHistorialPublicaciones([
          { id: 'preview-edition-18', titulo: 'Edición N.º 18 · The Liberty Times', estado_publicacion: 'aprobado', autor_id: user.id },
          { id: 'preview-edition-19', titulo: 'Edición N.º 19 · Nuevas fronteras', estado_publicacion: 'pendiente', autor_id: 'preview-leandro' }
        ]);
        return;
      }
      const { data } = await supabase
        .from('contenido')
        .select('id, titulo, estado_publicacion, created_at, autor_id')
        .eq('editorial_id', activeEditorial.id)
        .order('created_at', { ascending: false });
      
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

  const notifyDiscord = async (event, payload) => {
    try {
      const { error } = await supabase.functions.invoke('vista-discord-notify', {
        body: { event, ...payload }
      });
      if (error) throw error;
    } catch (err) {
      console.warn('La operación se guardó, pero Discord no recibió la notificación:', err);
    }
  };

  // ================= MANEJADOR A: CIUDADANOS =================
  const handleSolicitarSello = async (e) => {
    e.preventDefault();
    if (!nombreNoticiero || !descripcionNoticiero || procesandoSolicitud) return;
    setProcesandoSolicitud(true);

    try {
      const { data: solicitud, error: supabaseError } = await supabase.from('solicitudes_editoriales').insert([{
        usuario_id: user.id,
        nombre_noticiero: nombreNoticiero,
        descripcion: descripcionNoticiero,
        estado: 'pendiente'
      }]).select('id').single();

      if (supabaseError) throw supabaseError;

      await notifyDiscord('editorial_request', { request_id: solicitud.id });

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

    if (!activeEditorial || !puedePublicar) {
      alert('Tu GBA ID no tiene permisos para publicar en esta editorial.');
      return;
    }

    const selloFinal = activeEditorial.nombre;
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
        editorial_id: activeEditorial.id,
        sello_editorial: selloFinal,
        categoria: 'Periódico',
        categoria_editorial: categoriaEditorial,
        anio: new Date().getFullYear().toString()
      };

      const { data: publicacion, error } = await supabase.from('contenido').insert([payload]).select('id').single();
      if (error) throw error;

      await notifyDiscord('edition_submitted', { edition_id: publicacion.id });

      setPublicacionExitosa(true);
      setTitulo(''); setDescripcion(''); setCategoriaEditorial('comunidad'); setPortadaArchivo(null); setPaginasArchivos([]); setTraducciones([]);
      cargarHistorialAduana();
    } catch (err) {
      console.error(err);
      const permissionDenied = err?.code === '42501'
        || /row-level security|permission denied/i.test(err?.message || '');
      alert(permissionDenied
        ? 'Tu GBA ID no tiene permisos para publicar en esta organización. Solicita a un administrador editorial que revise tu membresía.'
        : err.message || "Error al inyectar el documento.");
    } finally {
      setEnviando(false);
    }
  };

  // ========================================================
  // RENDER INTERFAZ ZERO: INTERCEPTOR PARA DUEÑOS/ADMINS
  // ========================================================
  if (workspaceLoading) {
    return <div className="min-h-screen flex items-center justify-center text-xs font-bold uppercase tracking-widest text-[#86868b]">Abriendo VISTA Studio...</div>;
  }

  if (studioSection === 'network') {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] pb-24">
        <StudioStyles/>
        <div className="max-w-6xl mx-auto pt-10 px-6 md:px-10">
          <header className="mb-8 border-b border-[#d2d2d7] pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div><div className="flex items-center gap-2 text-[#0066FF] mb-3"><ShieldCheck size={18}/><span className="text-[10px] font-bold tracking-widest uppercase">GBA ID · Network Beta</span></div><h1 className="text-4xl md:text-5xl font-serif italic tracking-tight text-[#1d1d1f]">VISTA Studio</h1><p className="text-sm text-[#86868b] mt-2">Administra una cuenta de negocio o empresa dentro de Empyria.</p></div>
              <button type="button" onClick={() => setStudioSection('publish')} className="sm:ml-auto h-10 px-4 rounded-md border border-[#d2d2d7] bg-white text-xs font-bold text-[#5f6368] hover:text-[#1d1d1f]">Volver a Editorial</button>
            </div>
            <nav className="flex items-center gap-1 mt-7 -mb-6 overflow-x-auto" aria-label="Areas de VISTA Studio"><button type="button" onClick={() => setStudioSection('publish')} className="h-11 px-4 flex items-center gap-2 text-xs font-bold border-b-2 border-transparent text-[#86868b]"><FileText size={15}/>Editorial</button><button type="button" className="h-11 px-4 flex items-center gap-2 text-xs font-bold border-b-2 border-[#0066FF] text-[#0066FF]"><Building size={15}/>Network Beta</button></nav>
          </header>
          <NetworkBusinessStudio userId={user?.id} previewMode={previewMode}/>
        </div>
      </div>
    );
  }

  if (workspaceError) {
    return <div className="min-h-screen flex items-center justify-center px-6"><div className="max-w-lg border border-red-200 bg-red-50 rounded-md p-6 text-center"><AlertCircle size={24} className="mx-auto text-red-600"/><h2 className="font-bold mt-3">Studio no pudo cargar las organizaciones</h2><p className="text-xs text-red-700 mt-2">{workspaceError}</p></div></div>;
  }

  if ((isDueño || user?.rol === 'Admin') && !activeEditorial && invitations.length === 0) {
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
          <button type="button" onClick={() => setStudioSection('network')} className="w-full mt-3 border border-[#d2d2d7] bg-white text-[#1d1d1f] font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-sm"><Building size={16}/>Cuenta de negocio o empresa</button>
        </div>
      </div>
    );
  }

  // ================= RENDER INTERFAZ A: CIUDADANOS =================
  if (!activeEditorial) {
    return (
      <div className="w-full min-h-screen bg-[#fbfbfd] pt-12 flex flex-col">
        <EditorialInvitations invitations={invitations} onRespond={respondToInvitation}/>
        <div className="px-6 md:px-12 flex flex-col items-center">
         <div className="w-full max-w-3xl mt-12 text-center">
          
          <div className="w-20 h-20 bg-blue-50 text-[#0066FF] rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-sm">
            <PenTool size={36} strokeWidth={1.5} />
          </div>
          
          <h2 className="text-4xl md:text-5xl font-serif italic tracking-tight text-[#1d1d1f] mb-4">
            Tu voz, en la Alianza.
          </h2>
          <p className="text-[#86868b] text-base md:text-lg font-medium max-w-xl mx-auto mb-12">
            VISTA Studio es el espacio de publicación para equipos editoriales. Registra una organización o acepta una invitación con tu GBA ID.
          </p>

          <button type="button" onClick={() => setStudioSection('network')} className="h-11 px-4 mb-8 mx-auto rounded-md border border-[#d2d2d7] bg-white text-sm font-bold flex items-center justify-center gap-2"><Building size={16} className="text-[#0066FF]"/>Solicitar cuenta de negocio o empresa</button>

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
      </div>
    );
  }

  const studioFrame = children => (
    <div className="w-full min-h-screen bg-[#fbfbfd] pb-24">
      <StudioStyles/>
      <EditorialInvitations invitations={invitations} onRespond={respondToInvitation}/>
      <div className="max-w-6xl mx-auto pt-10 px-6 md:px-10">
        <EditorialStudioHeader
          editorials={editorials}
          activeEditorial={activeEditorial}
          activeSection={studioSection}
          onSelectEditorial={selectEditorial}
          onSelectSection={setStudioSection}
        />
        {children}
      </div>
    </div>
  );

  if (studioSection === 'profile') {
    return studioFrame(<EditorialProfileSettings editorial={activeEditorial} onUpdated={updateEditorial} previewMode={previewMode}/>);
  }

  if (studioSection === 'team') {
    return studioFrame(<EditorialTeamManager editorial={activeEditorial} onEditorialRefresh={refreshEditorials} previewMode={previewMode}/>);
  }

  // ================= RENDER INTERFAZ B (EDITORES) =================
  return studioFrame(
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          <div className="lg:col-span-2">
            {!puedePublicar ? (
              <div className="border border-[#d2d2d7] rounded-md p-8 bg-white">
                <ShieldCheck size={24} className="text-[#86868b]"/>
                <h2 className="text-xl font-bold mt-4">Acceso de revisión</h2>
                <p className="text-sm text-[#86868b] mt-2 leading-relaxed">Puedes consultar el archivo y el equipo. Para cargar páginas necesitas el rol Colaborador, Editor, Administrador o Propietario.</p>
              </div>
            ) : publicacionExitosa ? (
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
                          value={selloPublicacion} readOnly
                          className="w-full bg-[#f0f5ff] border border-blue-200 text-[#0066FF] rounded-xl px-4 py-3 font-bold text-sm outline-none"
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
                      {puedePublicar && <button type="button" onClick={() => setCreditsPublicationId(current => current === pub.id ? null : pub.id)} className="block mt-2 text-[10px] font-bold text-[#0066FF] hover:underline">{creditsPublicationId === pub.id ? 'Cerrar créditos' : 'Editar créditos y colaboraciones'}</button>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#86868b] font-medium text-center py-4">No tienes documentos en el historial de la aduana.</p>
              )}
              {creditsPublicationId && <CreditsPanel subjectType="content" subjectId={creditsPublicationId} editable className="mt-5"/>}
            </div>
          </div>

      </div>
    </div>
  );
}
