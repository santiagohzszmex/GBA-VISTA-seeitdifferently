import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { 
  BarChart3, Eye, FileText, Clock, CheckCircle, TrendingUp, Archive, Activity, 
  Edit3, X, Save, Globe, Languages, Plus, Trash2, Image as ImageIcon, FileImage, Heart
} from 'lucide-react';

export default function Estadisticas({ embedded = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Estados de datos
  const [kpis, setKpis] = useState({ vistasTotales: 0, likesTotales: 0, publicadas: 0, pendientes: 0 });
  const [topPublicaciones, setTopPublicaciones] = useState([]);
  const [historial, setHistorial] = useState([]);

  // ================= ESTADOS PARA EL MODAL DE EDICIÓN =================
  const [editingItem, setEditingItem] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  // Formulario Base
  const [formData, setFormData] = useState({ titulo: '', descripcion: '', idioma_original: 'es' });
  
  // Traducciones
  const [traducciones, setTraducciones] = useState([]);

  useEffect(() => {
    if (user) fetchMetricas();
  }, [user]);

  const fetchMetricas = async () => {
    try {
      // Necesitamos todos los campos i18n para poder editarlos y contar los likes (si los tienes en una tabla o campo)
      // Nota: Si los likes están en otra tabla, tendríamos que cruzarlos. Asumimos aquí un campo 'likes_count' o similar
      // Si no existe, lo calcularemos desde 0 por ahora para la UI.
      const { data, error } = await supabase
        .from('contenido')
        .select('*')
        .eq('autor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const publicadas = data.filter(item => item.estado_publicacion === 'aprobado');
        const pendientes = data.filter(item => item.estado_publicacion === 'pendiente');
        const vistasTotales = publicadas.reduce((sum, item) => sum + (item.vistas || 0), 0);
        // Fallback de likes si tienes una columna. Si usas useLikes, requeriría una consulta a la tabla interrelacional
        const likesTotales = publicadas.reduce((sum, item) => sum + (item.likes_count || 0), 0); 

        setKpis({ vistasTotales, likesTotales, publicadas: publicadas.length, pendientes: pendientes.length });

        const sortedTop = [...publicadas].sort((a, b) => (b.vistas || 0) - (a.vistas || 0)).slice(0, 3);
        setTopPublicaciones(sortedTop);
        setHistorial(data.slice(0, 10));
      }
    } catch (err) {
      console.error("Error al recopilar métricas:", err);
    } finally {
      setLoading(false);
    }
  };

  // ================= LÓGICA DE EDICIÓN (MODAL) =================
  const openEditModal = (item) => {
    setEditingItem(item);
    const baseLang = item.idioma_original || 'es';

    setFormData({
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      idioma_original: baseLang 
    });

    const loadedTraducciones = [];
    if (item.titulo_i18n) {
      Object.keys(item.titulo_i18n).forEach(l => {
        if (l !== baseLang) {
          loadedTraducciones.push({
            lang: l,
            titulo: item.titulo_i18n[l] || '',
            descripcion: item.descripcion_i18n?.[l] || '',
            portadaArchivo: null,
            paginasArchivos: [],
            hasExistingPoster: !!item.poster_i18n?.[l],
            existingPagesCount: item.paginas_i18n?.[l]?.length || 0
          });
        }
      });
    }
    
    setTraducciones(loadedTraducciones);
    setStatusMsg(null);
  };

  const closeEditModal = () => {
    setEditingItem(null);
    setTraducciones([]);
  };

  const addTraduccion = () => {
    setTraducciones([...traducciones, { lang: 'en', titulo: '', descripcion: '', portadaArchivo: null, paginasArchivos: [], hasExistingPoster: false, existingPagesCount: 0 }]);
  };

  const updateTraduccion = (index, field, value) => {
    const newTrads = [...traducciones];
    newTrads[index][field] = value;
    setTraducciones(newTrads);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSavingEdit(true);
    setStatusMsg({ type: 'info', text: 'Guardando cambios en el ecosistema...' });

    try {
      const langBase = formData.idioma_original;
      const folderPath = `Kiosco_Alianza/${(user?.sello_editorial || 'Editor').replace(/[^a-zA-Z0-9]/g, '_')}/${Date.now()}`;

      // Clonar los diccionarios existentes
      const titulos = { ...(editingItem.titulo_i18n || {}) };
      const descripciones = { ...(editingItem.descripcion_i18n || {}) };
      const posters = { ...(editingItem.poster_i18n || {}) };
      const paginasObj = { ...(editingItem.paginas_i18n || {}) };

      // Actualizar Base
      titulos[langBase] = formData.titulo;
      descripciones[langBase] = formData.descripcion;
      // Si no suben nueva portada base, mantenemos la anterior
      if (!posters[langBase]) posters[langBase] = editingItem.poster_url; 

      // Actualizar Traducciones (Nuevas portadas y páginas si subieron)
      for (const trad of traducciones) {
        if (!trad.titulo) continue;

        titulos[trad.lang] = trad.titulo;
        descripciones[trad.lang] = trad.descripcion;
        
        if (trad.portadaArchivo) {
          const up = await uploadToCloudinary(trad.portadaArchivo, folderPath);
          if (up) posters[trad.lang] = up;
        }

        if (trad.paginasArchivos && trad.paginasArchivos.length > 0) {
          const tPaginas = [];
          for (const p of trad.paginasArchivos) {
            const up = await uploadToCloudinary(p, folderPath);
            if (up) tPaginas.push(up);
          }
          if (tPaginas.length > 0) paginasObj[trad.lang] = tPaginas;
        }
      }

      const payload = {
        titulo: formData.titulo, // Mantiene sincronía con el registro original viejo
        descripcion: formData.descripcion,
        idioma_original: langBase,
        titulo_i18n: titulos,
        descripcion_i18n: descripciones,
        poster_i18n: posters,
        paginas_i18n: Object.keys(paginasObj).length > 0 ? paginasObj : editingItem.paginas_i18n
      };

      const { error } = await supabase.from('contenido').update(payload).eq('id', editingItem.id);
      if (error) throw error;

      setStatusMsg({ type: 'success', text: '¡Edición actualizada correctamente!' });
      fetchMetricas();
      setTimeout(closeEditModal, 1500);

    } catch (error) {
      console.error(error);
      setStatusMsg({ type: 'error', text: 'Ocurrió un error al guardar los datos.' });
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className={`w-full bg-[#fbfbfd] flex items-center justify-center ${embedded ? 'min-h-80' : 'min-h-screen pt-12 px-6'}`}>
        <div className="flex flex-col items-center gap-4 text-[#86868b]">
          <Activity className="animate-pulse" size={32} />
          <p className="text-[10px] font-bold uppercase tracking-widest">Sincronizando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full bg-[#fbfbfd] font-sans selection:bg-[#0066FF] selection:text-white relative ${embedded ? 'pt-10 pb-6' : 'min-h-screen pt-12 px-6 md:px-12 pb-24'}`}>
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER */}
        <header className={embedded ? 'mb-8' : 'mb-12'}>
          <div className="flex items-center gap-2 text-[#0066FF] mb-3">
            <BarChart3 size={18} />
            <span className="text-[10px] font-bold tracking-widest uppercase">
              Panel Analítico
            </span>
          </div>
          <h2 className={`${embedded ? 'text-3xl md:text-4xl' : 'text-4xl md:text-5xl'} font-serif italic tracking-tight text-[#1d1d1f] mb-2`}>
            Métricas Editoriales.
          </h2>
          <p className="text-[#86868b] font-medium text-sm">
            Rendimiento en tiempo real para el sello: <strong className="text-[#1d1d1f]">"{user?.sello_editorial || 'Independiente'}"</strong>
          </p>
        </header>

        {/* 1. KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          
          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">Impacto</p>
              <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center"><Eye size={14}/></div>
            </div>
            <p className="text-4xl font-bold text-[#1d1d1f] tracking-tighter">{kpis.vistasTotales}</p>
            <p className="text-[10px] text-[#86868b] font-medium mt-1">Lecturas</p>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">Aprobación</p>
              <div className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center"><Heart size={14}/></div>
            </div>
            <p className="text-4xl font-bold text-[#1d1d1f] tracking-tighter">{kpis.likesTotales}</p>
            <p className="text-[10px] text-[#86868b] font-medium mt-1">Interacciones</p>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">Kiosco</p>
              <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center"><FileText size={14}/></div>
            </div>
            <p className="text-4xl font-bold text-[#1d1d1f] tracking-tighter">{kpis.publicadas}</p>
            <p className="text-[10px] text-[#86868b] font-medium mt-1">Ediciones Activas</p>
          </div>

          <div className="bg-white border border-[#d2d2d7] rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">Aduana</p>
              <div className="w-7 h-7 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center"><Clock size={14}/></div>
            </div>
            <p className="text-4xl font-bold text-[#1d1d1f] tracking-tighter">{kpis.pendientes}</p>
            <p className="text-[10px] text-[#86868b] font-medium mt-1">En Revisión</p>
          </div>

        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* 2. RENDIMIENTO PRINCIPAL (TOP 3) */}
          <div className="bg-white border border-[#d2d2d7] rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
              <TrendingUp size={20} className="text-[#0066FF]"/> Mayor Tráfico Registrado
            </h3>
            
            <div className="space-y-4">
              {topPublicaciones.length > 0 ? (
                topPublicaciones.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl bg-[#f5f5f7] border border-[#d2d2d7]/50">
                    <div className="w-6 font-serif italic text-2xl text-[#86868b] font-bold">
                      {index + 1}
                    </div>
                    <div className="w-12 h-16 bg-black/5 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={item.poster_i18n?.[item.idioma_original] || item.poster_url} className="w-full h-full object-cover" alt="Cover" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className="font-bold text-[#1d1d1f] text-sm truncate">{item.titulo_i18n?.[item.idioma_original] || item.titulo}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#86868b]">
                          <Eye size={12}/> {item.vistas || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-[#86868b] font-medium">No hay datos suficientes para generar el reporte.</p>
                </div>
              )}
            </div>
          </div>

          {/* 3. REGISTRO DE OPERACIONES */}
          <div className="bg-white border border-[#d2d2d7] rounded-[2rem] p-8 shadow-sm">
            <h3 className="text-lg font-bold text-[#1d1d1f] mb-6 flex items-center gap-2">
              <Archive size={20} className="text-[#0066FF]"/> Registro de Operaciones
            </h3>

            <div className="space-y-1">
              {historial.length > 0 ? (
                historial.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors border border-transparent hover:border-[#d2d2d7]">
                    <div className="overflow-hidden pr-4 flex-1">
                      <p className="font-bold text-[#1d1d1f] text-sm truncate">{item.titulo_i18n?.[item.idioma_original] || item.titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-[#86868b] font-mono">
                          {new Date(item.created_at).toLocaleDateString('es-MX')}
                        </p>
                        {item.titulo_i18n && Object.keys(item.titulo_i18n).length > 1 && (
                          <span className="text-[8px] bg-blue-50 text-[#0066FF] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            +{Object.keys(item.titulo_i18n).length - 1} Idiomas
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {item.estado_publicacion === 'aprobado' && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                          <CheckCircle size={12}/> Autorizado
                        </span>
                      )}
                      {item.estado_publicacion === 'pendiente' && (
                        <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-md">
                          <Clock size={12}/> En Aduana
                        </span>
                      )}
                      <button 
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-[#86868b] hover:text-[#0066FF] bg-white border border-[#d2d2d7] hover:border-[#0066FF] rounded-lg transition-colors"
                        title="Añadir Idioma o Editar"
                      >
                        <Edit3 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-[#86868b] font-medium">Aún no se han enviado documentos a la base de datos.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================
          MODAL DE EDICIÓN RÁPIDA E INYECCIÓN DE IDIOMAS
      ======================================================== */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 border-b border-[#d2d2d7] flex items-center justify-between bg-[#fbfbfd]">
              <div className="flex items-center gap-2">
                <div className="bg-blue-50 text-[#0066FF] p-2 rounded-lg border border-blue-100">
                  <Languages size={16} />
                </div>
                <h3 className="font-bold text-[#1d1d1f]">Edición y Traducción</h3>
              </div>
              <button onClick={closeEditModal} className="text-[#86868b] hover:text-[#1d1d1f]"><X size={20}/></button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Información Base (Solo Texto) */}
              <div className="p-5 border border-[#d2d2d7] rounded-2xl bg-[#f5f5f7] space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={14} className="text-[#86868b]"/> 
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#86868b]">Idioma Original</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-[#86868b] mb-1 uppercase">Cambiar Idioma Base</label>
                    <select 
                      value={formData.idioma_original} 
                      onChange={(e) => setFormData({...formData, idioma_original: e.target.value})}
                      className="w-full bg-white border border-[#d2d2d7] p-2 rounded-xl text-xs font-bold text-[#1d1d1f] outline-none focus:ring-1 focus:ring-[#0066FF]"
                    >
                      <option value="es">Español (ES)</option>
                      <option value="en">Inglés (EN)</option>
                      <option value="nah">Náhuatl (NAH)</option>
                      <option value="pt">Portugués (PT)</option>
                      <option value="fr">Francés (FR)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#86868b] mb-1 uppercase">Titular Principal</label>
                    <input 
                      type="text" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})}
                      className="w-full bg-white border border-[#d2d2d7] p-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#0066FF]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#86868b] mb-1 uppercase">Sinopsis</label>
                  <textarea 
                    rows="2" value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    className="w-full bg-white border border-[#d2d2d7] p-2 rounded-xl text-xs resize-none outline-none focus:ring-1 focus:ring-[#0066FF]"
                  />
                </div>
                <p className="text-[10px] text-[#86868b] italic">* Nota: Las portadas y páginas originales no se pueden cambiar aquí. Para eso debes contactar a Aduana.</p>
              </div>

              {/* Traducciones Secundarias */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-[#1d1d1f]">Ediciones Traducidas</h4>
                  <button 
                    onClick={addTraduccion}
                    className="flex items-center gap-1 text-[10px] bg-blue-50 text-[#0066FF] border border-blue-200 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest hover:bg-blue-100 transition-colors"
                  >
                    <Plus size={12}/> Agregar
                  </button>
                </div>

                <div className="space-y-4">
                  {traducciones.length === 0 && (
                    <div className="text-center p-6 border border-dashed border-[#d2d2d7] rounded-xl text-[#86868b] text-xs font-medium">
                      No hay versiones traducidas de este documento.
                    </div>
                  )}

                  {traducciones.map((trad, idx) => (
                    <div key={idx} className="p-4 border border-[#d2d2d7] rounded-xl relative bg-white shadow-sm">
                      <button onClick={() => removeTraduccion(idx)} className="absolute top-3 right-3 text-red-400 hover:text-red-500"><Trash2 size={14}/></button>
                      
                      <div className="grid grid-cols-2 gap-3 mb-3 pr-6">
                        <select 
                          value={trad.lang} onChange={(e) => updateTraduccion(idx, 'lang', e.target.value)}
                          className="w-full bg-[#f5f5f7] border border-[#d2d2d7] p-2 rounded-lg text-[11px] font-bold text-[#1d1d1f] outline-none"
                        >
                          <option value="en">Inglés (EN)</option>
                          <option value="nah">Náhuatl (NAH)</option>
                          <option value="pt">Portugués (PT)</option>
                          <option value="fr">Francés (FR)</option>
                          <option value="es">Español (ES)</option>
                        </select>
                        <input 
                          type="text" placeholder="Titular..." value={trad.titulo} onChange={(e) => updateTraduccion(idx, 'titulo', e.target.value)}
                          className="w-full bg-[#f5f5f7] border border-[#d2d2d7] p-2 rounded-lg text-[11px] outline-none"
                        />
                      </div>
                      
                      <textarea 
                        rows="2" placeholder="Sinopsis..." value={trad.descripcion} onChange={(e) => updateTraduccion(idx, 'descripcion', e.target.value)}
                        className="w-full bg-[#f5f5f7] border border-[#d2d2d7] p-2 rounded-lg text-[11px] resize-none mb-3 outline-none"
                      />

                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center justify-center py-2 border border-dashed border-[#d2d2d7] rounded-lg cursor-pointer bg-[#fbfbfd] hover:bg-[#f5f5f7] transition-colors">
                          <span className="text-[9px] font-bold uppercase truncate px-2 text-[#1d1d1f]">{trad.portadaArchivo ? trad.portadaArchivo.name : (trad.hasExistingPoster ? 'Sustituir Portada' : 'Subir Portada')}</span>
                          <input type="file" accept="image/*" onChange={(e) => updateTraduccion(idx, 'portadaArchivo', e.target.files[0])} className="hidden" />
                        </label>
                        <label className="flex items-center justify-center py-2 border border-dashed border-[#d2d2d7] rounded-lg cursor-pointer bg-[#fbfbfd] hover:bg-[#f5f5f7] transition-colors">
                          <span className="text-[9px] font-bold uppercase truncate px-2 text-[#1d1d1f]">{trad.existingPagesCount > 0 && !trad.paginasArchivos?.length ? 'Sustituir Páginas' : `Añadir Páginas (${trad.paginasArchivos?.length || 0})`}</span>
                          <input type="file" accept="image/*" onChange={(e) => {
                             const newTrads = [...traducciones];
                             if(!newTrads[idx].paginasArchivos) newTrads[idx].paginasArchivos = [];
                             newTrads[idx].paginasArchivos.push(e.target.files[0]);
                             setTraducciones(newTrads);
                          }} className="hidden" />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-[#d2d2d7] bg-[#fbfbfd]">
              {statusMsg && (
                <div className={`mb-3 p-2 rounded-lg text-[11px] font-bold text-center border ${statusMsg.type === 'error' ? 'text-red-600 bg-red-50 border-red-200' : statusMsg.type === 'info' ? 'text-[#0066FF] bg-blue-50 border-blue-200' : 'text-emerald-600 bg-emerald-50 border-emerald-200'}`}>
                  {statusMsg.text}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={closeEditModal} className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#86868b] hover:bg-[#f5f5f7]">Cancelar</button>
                <button 
                  onClick={handleSaveEdit} disabled={savingEdit}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0066FF] hover:bg-blue-600 flex items-center gap-2 shadow-md disabled:opacity-50"
                >
                  {savingEdit ? 'Guardando...' : <><Save size={14}/> Guardar Versiones</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
