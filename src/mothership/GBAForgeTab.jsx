import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Activity, GitCommit, Database, Send, Terminal, Server, Code, Edit3, Trash2, X, Save } from 'lucide-react';

// Constantes de configuración estricta
const CATEGORIAS = [
  'Periódico', 
  'Campaña de Marketing', 
  'IA', 
  'Videos publicitarios', 
  'Videos', 
  'Producciones', 
  'Desarrollo Web'
];

const HERRAMIENTAS_PREDEFINIDAS = [
  'Kaggle',
  'Lightning AI',
  'Datasets Propios',
  'BlockBench',
  'Recursos Gráficos Google',
  'Fotografía Propia',
  'Blender',
  'Pixelmator Pro',
  'Canva',
  'Shapr3D',
  'Final Cut Pro'
];

const ESTADOS_DEV = [
  'Investigación',
  'Desarrollo / Prototipado',
  'Entrenamiento IA',
  'Implementado'
];

const initialForgeForm = {
  titulo_experimento: '',
  categoria: 'IA',
  estado: 'Investigación',
  herramientas: [],
  otra_herramienta: '',
  log_tecnico: '',
  enviar_discord: false
};

export default function GBAForgeTab() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [editingLog, setEditingLog] = useState(null);

  const [formData, setFormData] = useState(initialForgeForm);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    // Obtenemos los logs y hacemos join con usuarios para mostrar quién hizo el commit
    const { data, error } = await supabase
      .from('gba_forge_logs')
      .select('*, usuarios(nombre)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error al cargar GBA Forge:", error);
    } else {
      setLogs(data);
    }
  };

  const handleToolToggle = (tool) => {
    setFormData(prev => {
      const exists = prev.herramientas.includes(tool);
      if (exists) {
        return { ...prev, herramientas: prev.herramientas.filter(t => t !== tool) };
      } else {
        return { ...prev, herramientas: [...prev.herramientas, tool] };
      }
    });
  };

  const resetForm = (clearStatus = true) => {
    setEditingLog(null);
    setFormData(initialForgeForm);
    if (clearStatus) setStatusMsg(null);
  };

  const handleEdit = (log) => {
    const tools = Array.isArray(log.herramientas) ? log.herramientas : [];
    const predefined = tools.filter(tool => HERRAMIENTAS_PREDEFINIDAS.includes(tool));
    const custom = tools.filter(tool => !HERRAMIENTAS_PREDEFINIDAS.includes(tool));
    setEditingLog(log);
    setFormData({
      titulo_experimento: log.titulo_experimento || '',
      categoria: log.categoria || 'IA',
      estado: log.estado || 'Investigación',
      herramientas: predefined,
      otra_herramienta: custom.join(', '),
      log_tecnico: log.log_tecnico || '',
      enviar_discord: false
    });
    setStatusMsg({ type: 'info', msg: `Editando: ${log.titulo_experimento}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (log) => {
    if (!window.confirm(`¿Eliminar el registro técnico "${log.titulo_experimento}"?`)) return;
    const { error } = await supabase.from('gba_forge_logs').delete().eq('id', log.id);
    if (error) {
      setStatusMsg({ type: 'error', msg: 'No se pudo eliminar el registro técnico.' });
      return;
    }
    if (editingLog?.id === log.id) resetForm(false);
    setStatusMsg({ type: 'success', msg: 'Registro técnico eliminado.' });
    await fetchLogs();
  };

  // Función para integrar con webhook de Discord
  const sendToDiscord = async (logData) => {
    // URL Real de tu Webhook
    const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1521960813752090804/a1T0biY6qYNxNc9MxneYp4-GWQ0dppU_dWvkW2zVzZhDj1OYLbqLTLmZCpBv-8-tML66"; 
    
    // Extraemos el nombre del usuario logueado
    const nombreUsuario = user?.user_metadata?.nombre || user?.email || 'Ingeniero';
    
    // Armamos la tarjeta (Embed) con formato profesional para Discord
    const embed = {
      title: `[${logData.categoria}] ${logData.titulo_experimento}`,
      color: 0x0066FF, // Azul técnico
      fields: [
        { name: "Estado", value: logData.estado, inline: true },
        { name: "Ingeniero", value: nombreUsuario, inline: true },
        { name: "Herramientas", value: logData.herramientas.length > 0 ? logData.herramientas.join(', ') : 'Ninguna', inline: false },
        { name: "Log Técnico", value: logData.log_tecnico || 'Sin descripción detallada.', inline: false }
      ],
      timestamp: new Date().toISOString()
    };

    try {
      // Hacemos el envío (POST) directo a los servidores de Discord
      const response = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      });
      
      if (!response.ok) {
        console.error("Discord rechazó el mensaje. Status:", response.status);
      }
    } catch (err) {
      console.error("Error enviando a Discord:", err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);

    // Consolidar herramientas (predefinidas + manual)
    let finalTools = [...formData.herramientas];
    if (formData.otra_herramienta.trim() !== '') {
      finalTools.push(...formData.otra_herramienta.split(',').map(tool => tool.trim()).filter(Boolean));
    }

    const newLog = {
      titulo_experimento: formData.titulo_experimento,
      categoria: formData.categoria,
      estado: formData.estado,
      herramientas: finalTools,
      log_tecnico: formData.log_tecnico,
      enviado_discord: editingLog?.enviado_discord || formData.enviar_discord,
      usuario_id: user.id
    };

    try {
      const query = editingLog
        ? supabase.from('gba_forge_logs').update(newLog).eq('id', editingLog.id).select()
        : supabase.from('gba_forge_logs').insert([newLog]).select();
      const { error } = await query;
      if (error) throw error;

      if (formData.enviar_discord) {
        await sendToDiscord(newLog);
      }

      const successMessage = editingLog ? 'Registro técnico actualizado.' : 'Registro técnico guardado exitosamente.';
      resetForm(false);
      setStatusMsg({ type: 'success', msg: successMessage });
      await fetchLogs();
    } catch (error) {
      console.error("Error guardando log:", error);
      setStatusMsg({ type: 'error', msg: 'Fallo en la escritura de la base de datos.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 font-sans text-white">
      
      {/* PANEL IZQUIERDO: CONSOLA DE REGISTRO */}
      <div className="xl:col-span-1">
        <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl sticky top-8 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-6 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              {editingLog ? <Edit3 className="text-yellow-400" size={24}/> : <Terminal className="text-[#0066FF]" size={24} />}
              <h2 className="text-xl font-bold tracking-tight">{editingLog ? 'Editar registro' : 'GBA Forge Console'}</h2>
            </div>
            {editingLog && <button type="button" onClick={() => resetForm()} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" title="Cancelar edición"><X size={14}/></button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nomenclatura / Título</label>
              <input 
                value={formData.titulo_experimento}
                onChange={e => setFormData({...formData, titulo_experimento: e.target.value})}
                placeholder="Ej. Implementación ANIMA v1.2"
                className="w-full bg-black/50 border border-white/10 p-3 rounded-lg text-sm font-bold outline-none focus:border-[#0066FF] transition-colors"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Categoría</label>
                <select 
                  value={formData.categoria}
                  onChange={e => setFormData({...formData, categoria: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#0066FF]"
                >
                  {CATEGORIAS.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Estado Técnico</label>
                <select 
                  value={formData.estado}
                  onChange={e => setFormData({...formData, estado: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 p-3 rounded-lg text-sm outline-none focus:border-[#0066FF]"
                >
                  {ESTADOS_DEV.map(est => <option key={est} value={est}>{est}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Entorno y Herramientas</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-2 bg-black/30 rounded-lg border border-white/5">
                {HERRAMIENTAS_PREDEFINIDAS.map(tool => (
                  <label key={tool} className="flex items-center gap-2 cursor-pointer text-xs text-neutral-300 hover:text-white">
                    <input 
                      type="checkbox" 
                      checked={formData.herramientas.includes(tool)}
                      onChange={() => handleToolToggle(tool)}
                      className="accent-[#0066FF]"
                    />
                    {tool}
                  </label>
                ))}
              </div>
              <input 
                value={formData.otra_herramienta}
                onChange={e => setFormData({...formData, otra_herramienta: e.target.value})}
                placeholder="Otra herramienta (manual)..."
                className="w-full bg-transparent border-b border-white/10 p-2 text-xs outline-none focus:border-[#0066FF]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Log Output (Bitácora)</label>
              <textarea 
                value={formData.log_tecnico}
                onChange={e => setFormData({...formData, log_tecnico: e.target.value})}
                placeholder="Resultados del entrenamiento, hiperparámetros, resoluciones de bugs..."
                rows="4"
                className="w-full bg-black/50 border border-white/10 p-3 rounded-lg text-sm font-mono outline-none focus:border-[#0066FF] resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-white/5">
               <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                 <input 
                   type="checkbox" 
                   checked={formData.enviar_discord}
                   onChange={e => setFormData({...formData, enviar_discord: e.target.checked})}
                   className="accent-[#5865F2]"
                 />
                 <span className="text-[#5865F2] flex items-center gap-1"><Send size={14}/> {editingLog ? 'Reenviar actualización' : 'Push to Discord'}</span>
               </label>
            </div>

            {statusMsg && (
              <div className={`p-3 rounded-lg text-xs font-bold text-center ${
                statusMsg.type === 'success' ? 'bg-green-500/20 text-green-400' :
                statusMsg.type === 'info' ? 'bg-blue-500/20 text-blue-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {statusMsg.msg}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className={`w-full font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors ${editingLog ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-white text-black hover:bg-neutral-200'}`}
            >
              {loading ? <Activity className="animate-spin" size={18} /> : (editingLog ? <Save size={18}/> : <Code size={18} />)}
              {editingLog ? 'Guardar cambios' : 'Registrar Commit'}
            </button>
          </form>
        </div>
      </div>

      {/* PANEL DERECHO: LÍNEA DE TIEMPO (TIMELINE) */}
      <div className="xl:col-span-2">
        <h2 className="text-2xl font-bold mb-8 font-serif italic text-neutral-300">Historial de Desarrollo</h2>
        
        {logs.length === 0 ? (
          <div className="text-neutral-500 text-sm font-mono border border-dashed border-white/10 p-10 rounded-2xl text-center">
            No hay registros en el servidor. Esperando el primer commit...
          </div>
        ) : (
          <div className="relative border-l-2 border-white/10 ml-4 md:ml-6 space-y-10 pb-20">
            {logs.map((log) => (
              <div key={log.id} className="relative pl-8 md:pl-10">
                {/* Punto de la línea de tiempo */}
                <div className="absolute -left-[11px] top-1 bg-[#121212] border-2 border-[#0066FF] w-5 h-5 rounded-full flex items-center justify-center">
                  <GitCommit size={12} className="text-[#0066FF]" />
                </div>
                
                <div className="bg-[#121212] border border-white/10 p-5 rounded-2xl hover:border-white/20 transition-colors shadow-lg">
                  <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight">{log.titulo_experimento}</h3>
                      <p className="text-xs text-neutral-400 mt-1 font-mono flex items-center gap-2">
                         <Server size={12}/> 
                         Autor: {log.usuarios?.nombre || 'Desconocido'} 
                         <span className="text-neutral-600">|</span> 
                         {new Date(log.created_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="bg-white/10 text-white text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-bold">
                        {log.categoria}
                      </span>
                      <span className="bg-[#0066FF]/20 text-[#0066FF] text-[10px] px-2 py-1 rounded-md uppercase tracking-wider font-bold">
                        {log.estado}
                      </span>
                      <button type="button" onClick={() => handleEdit(log)} className="w-8 h-8 rounded-lg bg-yellow-500/10 hover:bg-yellow-500 text-yellow-400 hover:text-black flex items-center justify-center" title="Editar registro"><Edit3 size={13}/></button>
                      <button type="button" onClick={() => handleDelete(log)} className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white flex items-center justify-center" title="Eliminar registro"><Trash2 size={13}/></button>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm text-neutral-300 leading-relaxed font-mono bg-black/30 p-4 rounded-lg border border-white/5 whitespace-pre-wrap">
                      {log.log_tecnico}
                    </p>
                  </div>
                  
                  {log.herramientas && log.herramientas.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <Database size={14} className="text-neutral-500" />
                      {log.herramientas.map((h, i) => (
                        <span key={i} className="text-[10px] text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded-full">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {log.enviado_discord && (
                    <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold text-[#5865F2] uppercase tracking-wider">
                      <Send size={12} /> Commit sincronizado en Discord
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
