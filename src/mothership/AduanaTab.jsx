import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Check, X, Eye, FileText, ExternalLink, ShieldAlert, ShieldCheck, Image, Layers, UserCheck, Edit3, Save } from 'lucide-react';

export default function AduanaTab() {
  const [activeSubTab, setActiveSubTab] = useState('ediciones'); 
  const [loading, setLoading] = useState(false);
  
  const [pendingContent, setPendingContent] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingReview, setEditingReview] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [reviewDraft, setReviewDraft] = useState({ titulo: '', descripcion: '', sello_editorial: '', categoria: 'Noticia', nombre_noticiero: '' });

  const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1521553828674146485/0BIQdUirrZbiC5FwsU14f-6tuNhFOqJB7lNxBelruyFeQgmNGfVWiTdRxJB392gsafP_";

  useEffect(() => {
    fetchAduanaData();
  }, [activeSubTab]);

  const fetchAduanaData = async () => {
    setLoading(true);
    try {
      if (activeSubTab === 'ediciones') {
        const { data, error } = await supabase
          .from('contenido')
          .select('*')
          .eq('estado_publicacion', 'pendiente')
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        setPendingContent(data || []);
      } else {
        const { data, error } = await supabase
          .from('solicitudes_editoriales')
          .select('*')
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        setPendingRequests(data || []);
      }
    } catch (err) {
      console.error("Error al recopilar datos de la aduana:", err);
    } finally {
      setLoading(false);
    }
  };

  const enviarLogDiscord = async (tituloLog, mensajeLog, colorCode) => {
    try {
      await fetch(DISCORD_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          embeds: [{
            title: tituloLog,
            description: mensajeLog,
            color: colorCode,
            timestamp: new Date().toISOString(),
            footer: { text: "Mothership Command • Sistema de Aduanas VISTA" }
          }]
        })
      });
    } catch (err) {
      console.error("Error al despachar log a Discord:", err);
    }
  };

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    setEditingReview(false);
    setReviewDraft({
      titulo: item.titulo || '',
      descripcion: item.descripcion || '',
      sello_editorial: item.sello_editorial || '',
      categoria: item.categoria || 'Noticia',
      nombre_noticiero: item.nombre_noticiero || ''
    });
  };

  const getEditionCorrections = (item) => {
    const baseLang = item.idioma_original || 'es';
    return {
      titulo: reviewDraft.titulo,
      descripcion: reviewDraft.descripcion,
      sello_editorial: reviewDraft.sello_editorial,
      categoria: reviewDraft.categoria,
      titulo_i18n: item.titulo_i18n ? { ...item.titulo_i18n, [baseLang]: reviewDraft.titulo } : item.titulo_i18n,
      descripcion_i18n: item.descripcion_i18n ? { ...item.descripcion_i18n, [baseLang]: reviewDraft.descripcion } : item.descripcion_i18n
    };
  };

  const handleSaveCorrections = async () => {
    if (!selectedItem) return;
    setSavingReview(true);
    try {
      const table = activeSubTab === 'ediciones' ? 'contenido' : 'solicitudes_editoriales';
      const payload = activeSubTab === 'ediciones'
        ? getEditionCorrections(selectedItem)
        : { nombre_noticiero: reviewDraft.nombre_noticiero, descripcion: reviewDraft.descripcion };
      const { data, error } = await supabase.from(table).update(payload).eq('id', selectedItem.id).select().single();
      if (error) throw error;
      setSelectedItem(data);
      setEditingReview(false);
      if (activeSubTab === 'ediciones') {
        setPendingContent(prev => prev.map(item => item.id === data.id ? data : item));
      } else {
        setPendingRequests(prev => prev.map(item => item.id === data.id ? data : item));
      }
    } catch (err) {
      console.error('No se pudieron guardar las correcciones de Aduana:', err);
      alert('No se pudieron guardar las correcciones.');
    } finally {
      setSavingReview(false);
    }
  };

  // ==========================================
  // RESOLUCIÓN DE EDICIONES DE PRENSA
  // ==========================================
  const handleAprobarEdicion = async (item) => {
    const estadoPrevio = [...pendingContent];
    setPendingContent(prev => prev.filter(p => p.id !== item.id));
    setSelectedItem(null);

    try {
      const { error } = await supabase
        .from('contenido')
        .update({ ...getEditionCorrections(item), estado_publicacion: 'aprobado' })
        .eq('id', item.id);

      if (error) throw error; 

      await enviarLogDiscord(
        "📰 ¡EDICIÓN DE PRENSA APROBADA!",
        `El periódico **"${reviewDraft.titulo}"** del sello **"${reviewDraft.sello_editorial || 'Independiente'}"** ha pasado la inspección y ya está en el Kiosco.`,
        65280
      );
    } catch (err) {
      console.error("Fallo al aprobar edición en Supabase:", err);
      alert("Error en el servidor: No se pudo cambiar el estado de la publicación.");
      setPendingContent(estadoPrevio); 
    }
  };

  const handleRechazarEdicion = async (item) => {
    if (!window.confirm("¿Seguro que deseas rechazar y eliminar esta edición del servidor?")) return;
    
    const estadoPrevio = [...pendingContent];
    setPendingContent(prev => prev.filter(p => p.id !== item.id));
    setSelectedItem(null);

    try {
      const { error } = await supabase
        .from('contenido')
        .delete()
        .eq('id', item.id);

      if (error) throw error; 

      await enviarLogDiscord(
        "❌ EDICIÓN RECHAZADA Y DESTRUIDA",
        `El documento titulado **"${item.titulo}"** no cumplió con las pautas y fue retirado del servidor.`,
        16711680
      );
    } catch (err) {
      console.error("Fallo al eliminar edición en Supabase:", err);
      alert("Error en el servidor: No se pudo eliminar el registro físico.");
      setPendingContent(estadoPrevio);
    }
  };

  // ==========================================
  // RESOLUCIÓN DE SOLICITUDES DE SELLOS
  // ==========================================
  const handleAprobarSello = async (req) => {
    const estadoPrevio = [...pendingRequests];
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    setSelectedItem(null);

    try {
      const { error: userError } = await supabase
        .from('usuarios')
        .update({ 
          rol: 'Editor',
          sello_editorial: reviewDraft.nombre_noticiero
        })
        .eq('id', req.usuario_id);

      if (userError) throw userError;

      const { error: deleteError } = await supabase
        .from('solicitudes_editoriales')
        .delete()
        .eq('id', req.id);

      if (deleteError) throw deleteError; 

      await enviarLogDiscord(
        "✨ NUEVO SELLO EDITORIAL AUTORIZADO",
        `La solicitud para el noticiero **"${reviewDraft.nombre_noticiero}"** ha sido concedida.\n\n**Estatus:** Ascendido a **Editor** en la base maestro.`,
        255
      );
    } catch (err) {
      console.error("Fallo al autorizar sello en Supabase:", err);
      alert("Error de privilegios: No se pudo completar el ascenso del usuario.");
      setPendingRequests(estadoPrevio);
    }
  };

  const handleRechazarSello = async (req) => {
    if (!window.confirm("¿Rechazar la solicitud editorial de este GBA ID?")) return;
    
    const estadoPrevio = [...pendingRequests];
    setPendingRequests(prev => prev.filter(r => r.id !== req.id));
    setSelectedItem(null);

    try {
      const { error } = await supabase
        .from('solicitudes_editoriales')
        .delete()
        .eq('id', req.id);

      if (error) throw error;

      await enviarLogDiscord(
        "⚠️ SOLICITUD EDITORIAL DENEGADA",
        `La administración rechazó la apertura del sello **"${req.nombre_noticiero}"** para el operador \`${req.usuario_id}\`.`,
        16753920
      );
    } catch (err) {
      console.error("Fallo al denegar sello en Supabase:", err);
      alert("Error en el servidor: No se pudo eliminar la solicitud de la cola.");
      setPendingRequests(estadoPrevio);
    }
  };

  // Función Auxiliar para Decodificar el JSON de las páginas o devolver el string plano (PDF antiguo)
  const parseLecturaContent = (contentString) => {
    if (!contentString) return { type: 'none', data: null };
    try {
      const parsed = JSON.parse(contentString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { type: 'images', data: parsed };
      }
      return { type: 'link', data: contentString }; // Si el parse falló (era un string que por coincidencia era parseable)
    } catch {
      return { type: 'link', data: contentString }; // Es un string normal (URL de PDF viejo)
    }
  };

  const currentLecturaContent = selectedItem ? parseLecturaContent(selectedItem.enlace_pdf) : { type: 'none', data: null };


  return (
    <div className="space-y-8 text-white">
      
      {/* TABS DE CONTROL */}
      <div className="flex gap-4 border-b border-white/5 pb-4">
        <button 
          onClick={() => { setActiveSubTab('ediciones'); setSelectedItem(null); }}
          className={`pb-2 text-sm font-bold tracking-wider uppercase transition-colors relative ${activeSubTab === 'ediciones' ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Ediciones de Prensa ({pendingContent.length})
          {activeSubTab === 'ediciones' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 animate-in fade-in" />}
        </button>
        <button 
          onClick={() => { setActiveSubTab('sellos'); setSelectedItem(null); }}
          className={`pb-2 text-sm font-bold tracking-wider uppercase transition-colors relative ${activeSubTab === 'sellos' ? 'text-red-500' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Peticiones de Sellos ({pendingRequests.length})
          {activeSubTab === 'sellos' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 animate-in fade-in" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* COLUMNA IZQUIERDA: LISTAS PENDIENTES */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <p className="text-neutral-500 italic py-6">Escaneando servidores remotos...</p>
          ) : activeSubTab === 'ediciones' ? (
            pendingContent.map(item => (
              <div 
                key={item.id} 
                onClick={() => handleSelectItem(item)}
                className={`flex items-center justify-between p-5 bg-[#121212] border rounded-2xl cursor-pointer transition-all ${selectedItem?.id === item.id ? 'border-red-500 bg-red-500/5 shadow-[0_0_20px_rgba(220,38,38,0.1)]' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-4 truncate">
                  <div className="w-12 h-16 bg-neutral-800 rounded-lg overflow-hidden flex-shrink-0 border border-white/5 shadow-md">
                    <img src={item.poster_url} className="w-full h-full object-cover" alt="Port" />
                  </div>
                  <div className="truncate text-left">
                    <h4 className="font-bold text-white text-base truncate">{item.titulo}</h4>
                    <p className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider mt-0.5">Sello: {item.sello_editorial || 'Externo'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex-shrink-0">
                  <Layers size={10}/> Pendiente Auditoría
                </div>
              </div>
            ))
          ) : (
            pendingRequests.map(req => (
              <div 
                key={req.id} 
                onClick={() => handleSelectItem(req)}
                className={`flex items-center justify-between p-5 bg-[#121212] border rounded-2xl cursor-pointer transition-all ${selectedItem?.id === req.id ? 'border-red-500 bg-red-500/5 shadow-[0_0_20px_rgba(220,38,38,0.1)]' : 'border-white/10 hover:border-white/20'}`}
              >
                <div className="flex items-center gap-4 text-left">
                  <div className="w-10 h-10 bg-neutral-800 border border-white/10 rounded-xl flex items-center justify-center text-red-400">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Noticiero: "{req.nombre_noticiero}"</h4>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">Operador UID: {req.usuario_id.slice(0, 18)}...</p>
                  </div>
                </div>
                <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider flex-shrink-0">
                  Petición Rol
                </div>
              </div>
            ))
          )}

          {!loading && (activeSubTab === 'ediciones' ? pendingContent.length === 0 : pendingRequests.length === 0) && (
            <div className="p-12 border border-dashed border-white/10 rounded-2xl text-center bg-white/5">
              <ShieldCheck className="text-neutral-600 mx-auto mb-3" size={32} />
              <p className="text-neutral-500 text-sm font-medium">Frontera despejada. No hay registros pendientes de revisión.</p>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: TERMINAL DE INSPECCIÓN STICKY */}
        <div className="lg:col-span-1">
          {selectedItem ? (
            <div className="bg-[#121212] border border-white/10 rounded-[2.5rem] p-6 shadow-2xl sticky top-8 animate-in fade-in slide-in-from-right-4 duration-300 text-left max-h-[90vh] overflow-y-auto custom-scrollbar">
              
              <div className="flex justify-between items-center mb-6">
                <span className="text-[9px] font-black tracking-widest bg-red-600/20 text-red-400 px-3 py-1 rounded-full border border-red-500/20 uppercase">
                  Terminal de Verificación
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingReview(prev => !prev)} className={`w-8 h-8 rounded-lg flex items-center justify-center ${editingReview ? 'bg-yellow-500 text-black' : 'bg-white/10 text-neutral-300 hover:text-white'}`} title="Corregir datos"><Edit3 size={13}/></button>
                  <button onClick={() => setSelectedItem(null)} className="text-xs text-neutral-500 hover:text-white uppercase font-bold tracking-wider">Cerrar</button>
                </div>
              </div>

              {activeSubTab === 'ediciones' ? (
                <div className="space-y-6">
                  {/* Vista de la Portada Principal */}
                  <div className="relative aspect-[4/5] w-full bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 shadow-inner group">
                    <img src={selectedItem.poster_url} className="w-full h-full object-cover" alt="Preview Inspector" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                    <div className="absolute bottom-4 left-4 flex items-center gap-1.5 text-xs font-bold text-white/80">
                      <Image size={14}/> Previsualización de Portada
                    </div>
                  </div>

                  {editingReview ? (
                    <div className="space-y-3 p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                      <input value={reviewDraft.titulo} onChange={(event) => setReviewDraft(prev => ({ ...prev, titulo: event.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500" placeholder="Título"/>
                      <textarea value={reviewDraft.descripcion} onChange={(event) => setReviewDraft(prev => ({ ...prev, descripcion: event.target.value }))} rows="4" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs resize-none outline-none focus:border-yellow-500" placeholder="Descripción"/>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={reviewDraft.sello_editorial} onChange={(event) => setReviewDraft(prev => ({ ...prev, sello_editorial: event.target.value }))} className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs outline-none focus:border-yellow-500" placeholder="Sello editorial"/>
                        <select value={reviewDraft.categoria} onChange={(event) => setReviewDraft(prev => ({ ...prev, categoria: event.target.value }))} className="bg-black/40 border border-white/10 rounded-lg p-3 text-xs outline-none [&>option]:bg-[#1d1d1f]">
                          <option value="Noticia">Noticia</option>
                          <option value="Periódico">Periódico</option>
                        </select>
                      </div>
                      <button type="button" onClick={handleSaveCorrections} disabled={savingReview} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"><Save size={14}/> Guardar correcciones</button>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-xl font-bold font-serif italic text-white mb-2">{selectedItem.titulo}</h3>
                      <p className="text-xs text-neutral-400 font-medium leading-relaxed bg-black/40 p-4 rounded-xl border border-white/5 max-h-32 overflow-y-auto custom-scrollbar">{selectedItem.descripcion || 'Sin descripción provista.'}</p>
                    </div>
                  )}

                  {/* INSPECCIÓN DE ARCHIVOS ADJUNTOS (DINÁMICO) */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black tracking-widest text-neutral-500 uppercase">Archivos Adjuntos (Lectura)</p>
                    
                    {currentLecturaContent.type === 'images' && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
                        {currentLecturaContent.data.map((url, index) => (
                          <button 
                            key={index}
                            onClick={() => window.open(url, '_blank')}
                            className="relative aspect-[3/4] rounded-lg overflow-hidden group hover:ring-2 hover:ring-blue-500 transition-all border border-white/5"
                            title={`Ver Página ${index + 1}`}
                          >
                            <img src={url} alt={`Página ${index + 1}`} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ExternalLink size={18} className="text-white drop-shadow-lg" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/80 py-1 text-center text-[9px] font-bold uppercase tracking-widest text-white">
                              Página {index + 1}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {currentLecturaContent.type === 'link' && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                            <FileText size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white">Enlace Estático PDF</p>
                            <p className="text-[10px] text-neutral-500 font-medium">Archivo del ecosistema anterior</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => window.open(currentLecturaContent.data, '_blank')}
                          className="p-2.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl transition-all flex items-center justify-center border border-white/10 shadow-md group"
                        >
                          <ExternalLink size={16} className="group-hover:scale-110 transition-transform"/>
                        </button>
                      </div>
                    )}

                    {currentLecturaContent.type === 'none' && (
                      <div className="p-4 border border-dashed border-white/10 rounded-xl text-center bg-black/20 text-neutral-500 text-[10px] uppercase font-bold tracking-widest">
                        Sin archivos adjuntos
                      </div>
                    )}
                  </div>

                  {/* CONTROLES DE DECISIÓN */}
                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/10 mt-6">
                    <button 
                      onClick={() => handleAprobarEdicion(selectedItem)}
                      className="bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-green-600/10 transition-colors"
                    >
                      <Check size={16} strokeWidth={2.5}/> Autorizar
                    </button>
                    <button 
                      onClick={() => handleRechazarEdicion(selectedItem)}
                      className="bg-white/5 border border-white/10 hover:bg-red-600/20 hover:border-red-500/50 text-neutral-400 hover:text-red-400 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <X size={16} strokeWidth={2.5}/> Purgar
                    </button>
                  </div>

                </div>
              ) : (
                <div className="space-y-6">
                  {/* ... (Peticiones de Sellos se mantiene igual) ... */}
                  {editingReview ? (
                    <div className="p-5 bg-yellow-500/5 rounded-2xl border border-yellow-500/20 space-y-3">
                      <input value={reviewDraft.nombre_noticiero} onChange={(event) => setReviewDraft(prev => ({ ...prev, nombre_noticiero: event.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-bold outline-none focus:border-yellow-500" placeholder="Nombre del sello"/>
                      <textarea value={reviewDraft.descripcion} onChange={(event) => setReviewDraft(prev => ({ ...prev, descripcion: event.target.value }))} rows="4" className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-xs resize-none outline-none focus:border-yellow-500" placeholder="Propuesta editorial"/>
                      <button type="button" onClick={handleSaveCorrections} disabled={savingReview} className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black rounded-lg text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"><Save size={14}/> Guardar correcciones</button>
                    </div>
                  ) : <div className="p-6 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                    <div>
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Nombre Solicitado para la Marca</span>
                      <p className="text-lg font-bold text-white font-serif italic">"{selectedItem.nombre_noticiero}"</p>
                    </div>
                    <div className="h-px w-full bg-white/5" />
                    <div>
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest block mb-1">Línea o Propuesta Editorial</span>
                      <p className="text-xs text-neutral-300 leading-relaxed font-medium">
                        {selectedItem.descripcion || 'El usuario no adjuntó una descripción editorial.'}
                      </p>
                    </div>
                  </div>}

                  <div className="p-4 bg-yellow-500/5 border border-yellow-500/10 text-yellow-400/80 rounded-xl text-[11px] font-medium leading-normal flex gap-3">
                    <ShieldAlert size={24} className="flex-shrink-0 text-yellow-500" />
                    <span>Aprobar este registro modificará permanentemente el perfil del ciudadano a <strong>Editor</strong>, otorgándole permisos para inyectar datos al servidor sin restricciones de Aduana.</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                      onClick={() => handleAprobarSello(selectedItem)}
                      className="bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 transition-colors"
                    >
                      <Check size={16} strokeWidth={2.5}/> Conceder Sello
                    </button>
                    <button 
                      onClick={() => handleRechazarSello(selectedItem)}
                      className="bg-white/5 border border-white/10 hover:bg-red-600/20 hover:border-red-500/50 text-neutral-400 hover:text-red-400 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                      <X size={16} strokeWidth={2.5}/> Denegar
                    </button>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="border border-dashed border-white/10 rounded-[2.5rem] p-8 text-center text-neutral-600 font-medium text-xs h-64 flex flex-col items-center justify-center sticky top-8">
              <Eye size={24} className="mb-2 text-neutral-700"/>
              Selecciona una solicitud de la lista de espera para inicializar el escáner biométrico.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
