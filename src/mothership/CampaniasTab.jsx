import React, { useEffect, useState } from 'react';
import { Calendar, Megaphone, Pause, Play, Save, Trash2, UploadCloud } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { uploadToCloudinary } from '../cloudinary';
import { useCampaigns } from '../hooks/useCampaigns';

const initialForm = {
  titulo: '',
  descripcion: '',
  estado: 'borrador',
  fecha_inicio: '',
  fecha_fin: '',
  prioridad: 0,
  ubicaciones: ['home_banner'],
  cta_texto: 'Ver campaña',
  cta_tipo: 'campania',
  cta_target: ''
};

const locationOptions = [
  { value: 'home_banner', label: 'Home Banner' },
  { value: 'home_hero', label: 'Home Hero' },
  { value: 'spotlight_modal', label: 'Spotlight' },
  { value: 'campaign_center', label: 'Centro' }
];

const inferAssetType = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.name.toLowerCase().endsWith('.glb')) return 'modelo_3d';
  if (file.type === 'application/pdf') return 'documento';
  if (file.type.startsWith('image/')) return 'poster';
  return 'otro';
};

export default function CampaniasTab() {
  const { campaigns, fetchAllCampaigns, loading, error } = useCampaigns();
  const [formData, setFormData] = useState(initialForm);
  const [assetFiles, setAssetFiles] = useState([]);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllCampaigns();
  }, [fetchAllCampaigns]);

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  const toggleLocation = (value) => {
    setFormData(prev => {
      const current = prev.ubicaciones || [];
      const next = current.includes(value)
        ? current.filter(item => item !== value)
        : [...current, value];

      return { ...prev, ubicaciones: next.length > 0 ? next : ['home_banner'] };
    });
  };

  const resetForm = () => {
    setFormData(initialForm);
    setAssetFiles([]);
    setStatus(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: 'info', msg: 'Creando campaña...' });

    try {
      const payload = {
        ...formData,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('campanias')
        .insert([payload])
        .select()
        .single();

      if (campaignError) throw campaignError;

      if (assetFiles.length > 0) {
        setStatus({ type: 'info', msg: `Subiendo ${assetFiles.length} asset(s) a Cloudinary...` });
        const folderPath = `Mothership_Campanias/${campaign.id}`;
        const rows = [];

        for (let index = 0; index < assetFiles.length; index += 1) {
          const file = assetFiles[index];
          const url = await uploadToCloudinary(file, folderPath);
          if (!url) throw new Error(`No se pudo subir ${file.name}`);

          rows.push({
            campania_id: campaign.id,
            tipo: inferAssetType(file),
            url,
            titulo: file.name,
            orden: index,
            metadata: {
              original_name: file.name,
              mime_type: file.type,
              size: file.size
            }
          });
        }

        const { error: assetsError } = await supabase.from('campania_assets').insert(rows);
        if (assetsError) throw assetsError;
      }

      setStatus({ type: 'success', msg: 'Campaña creada correctamente.' });
      resetForm();
      fetchAllCampaigns();
    } catch (err) {
      console.error('Error al crear campaña:', err);
      setStatus({ type: 'error', msg: err.message || 'No se pudo crear la campaña.' });
    } finally {
      setSaving(false);
    }
  };

  const updateCampaignStatus = async (campaign, estado) => {
    const { error: updateError } = await supabase
      .from('campanias')
      .update({ estado })
      .eq('id', campaign.id);

    if (updateError) {
      setStatus({ type: 'error', msg: 'No se pudo actualizar el estado.' });
      return;
    }

    fetchAllCampaigns();
  };

  const deleteCampaign = async (campaign) => {
    if (!window.confirm(`¿Eliminar la campaña "${campaign.titulo}"?`)) return;

    const { error: deleteError } = await supabase
      .from('campanias')
      .delete()
      .eq('id', campaign.id);

    if (deleteError) {
      setStatus({ type: 'error', msg: 'No se pudo eliminar la campaña.' });
      return;
    }

    fetchAllCampaigns();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 text-white">
      <div className="xl:col-span-1">
        <div className="bg-[#121212] border border-white/10 p-8 rounded-[2.5rem] sticky top-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Megaphone className="text-[#0066FF]" />
            <h2 className="text-2xl font-bold">Nueva Campaña</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4 p-4 bg-black/40 rounded-2xl border border-white/5">
              <input
                name="titulo"
                value={formData.titulo}
                onChange={handleChange}
                placeholder="Título de campaña"
                className="w-full bg-transparent border-b border-white/10 p-2 font-bold outline-none focus:border-[#0066FF]"
                required
              />
              <textarea
                name="descripcion"
                value={formData.descripcion}
                onChange={handleChange}
                placeholder="Descripción breve..."
                rows="3"
                className="w-full bg-transparent border-b border-white/10 p-2 text-sm resize-none outline-none focus:border-[#0066FF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
              <select name="estado" value={formData.estado} onChange={handleChange} className="bg-transparent border-b border-white/10 p-2 text-sm outline-none [&>option]:bg-[#1d1d1f]">
                <option value="borrador">Borrador</option>
                <option value="activa">Activa</option>
                <option value="pausada">Pausada</option>
                <option value="finalizada">Finalizada</option>
              </select>
              <input
                type="number"
                name="prioridad"
                value={formData.prioridad}
                onChange={handleChange}
                placeholder="Prioridad"
                className="bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-[#0066FF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                Inicio
                <input type="datetime-local" name="fecha_inicio" value={formData.fecha_inicio} onChange={handleChange} className="mt-2 w-full bg-transparent border-b border-white/10 p-2 text-xs text-white outline-none" />
              </label>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                Fin
                <input type="datetime-local" name="fecha_fin" value={formData.fecha_fin} onChange={handleChange} className="mt-2 w-full bg-transparent border-b border-white/10 p-2 text-xs text-white outline-none" />
              </label>
            </div>

            <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-3">Ubicación</p>
              <div className="grid grid-cols-2 gap-2">
                {locationOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleLocation(option.value)}
                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-colors ${
                      formData.ubicaciones.includes(option.value)
                        ? 'bg-[#0066FF] border-[#0066FF] text-white'
                        : 'bg-white/5 border-white/10 text-neutral-500 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-black/40 rounded-2xl border border-white/5">
              <input name="cta_texto" value={formData.cta_texto} onChange={handleChange} placeholder="CTA" className="bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-[#0066FF]" />
              <select name="cta_tipo" value={formData.cta_tipo} onChange={handleChange} className="bg-transparent border-b border-white/10 p-2 text-sm outline-none [&>option]:bg-[#1d1d1f]">
                <option value="campania">Campaña</option>
                <option value="video">Video</option>
                <option value="noticia">Noticia</option>
                <option value="url">URL</option>
              </select>
              <input name="cta_target" value={formData.cta_target} onChange={handleChange} placeholder="Destino opcional" className="col-span-2 bg-transparent border-b border-white/10 p-2 text-sm outline-none focus:border-[#0066FF]" />
            </div>

            <label className="flex flex-col items-center justify-center gap-3 p-6 border border-dashed border-white/20 rounded-2xl bg-black/30 cursor-pointer hover:bg-white/5 transition-colors text-center">
              <UploadCloud className="text-[#0066FF]" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {assetFiles.length > 0 ? `${assetFiles.length} asset(s) seleccionados` : 'Subir posters, videos, PDF o GLB'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,.pdf,.glb"
                onChange={(e) => setAssetFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
            </label>

            {status && (
              <div className={`p-3 rounded-xl text-xs text-center font-bold border ${
                status.type === 'error' ? 'text-red-300 bg-red-900/20 border-red-500/30' :
                status.type === 'info' ? 'text-blue-300 bg-blue-900/20 border-blue-500/30' :
                'text-green-300 bg-green-900/20 border-green-500/30'
              }`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={saving} className="w-full py-4 rounded-xl bg-[#0066FF] hover:bg-[#0052cc] disabled:opacity-50 text-white font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2">
              <Save size={18} /> {saving ? 'Publicando...' : 'Crear Campaña'}
            </button>
          </form>
        </div>
      </div>

      <div className="xl:col-span-2">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-serif italic text-neutral-300">Campañas registradas</h3>
          {loading && <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">Cargando...</span>}
        </div>

        {error && (
          <div className="p-4 mb-6 rounded-2xl border border-red-500/30 bg-red-900/20 text-red-300 text-sm font-bold">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {campaigns.map(campaign => {
            const preview = campaign.assets?.find(asset => asset.tipo === 'banner') || campaign.assets?.find(asset => asset.tipo === 'poster') || campaign.assets?.[0];

            return (
              <div key={campaign.id} className="bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                <div className="h-52 bg-black relative">
                  {preview?.url ? (
                    <img src={preview.url} alt={campaign.titulo} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600"><Megaphone size={42} /></div>
                  )}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className="bg-white text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{campaign.estado}</span>
                    <span className="bg-black/60 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{campaign.assets?.length || 0} assets</span>
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="font-bold text-xl text-white line-clamp-1">{campaign.titulo}</h4>
                  <p className="text-neutral-500 text-sm mt-2 line-clamp-2">{campaign.descripcion || 'Sin descripción.'}</p>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-4">
                    <Calendar size={12} />
                    <span>{campaign.fecha_inicio ? new Date(campaign.fecha_inicio).toLocaleDateString('es-MX') : 'Sin inicio'}</span>
                    <span>→</span>
                    <span>{campaign.fecha_fin ? new Date(campaign.fecha_fin).toLocaleDateString('es-MX') : 'Sin cierre'}</span>
                  </div>
                  <div className="flex gap-2 mt-5">
                    <button onClick={() => updateCampaignStatus(campaign, campaign.estado === 'activa' ? 'pausada' : 'activa')} className="flex-1 bg-white/10 hover:bg-white hover:text-black text-white px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2">
                      {campaign.estado === 'activa' ? <Pause size={14} /> : <Play size={14} />}
                      {campaign.estado === 'activa' ? 'Pausar' : 'Activar'}
                    </button>
                    <button onClick={() => deleteCampaign(campaign)} className="bg-red-500/10 hover:bg-red-600 border border-red-500/20 text-red-400 hover:text-white px-3 py-2 rounded-xl transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {campaigns.length === 0 && !loading && (
          <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center text-neutral-600">
            No hay campañas registradas todavía.
          </div>
        )}
      </div>
    </div>
  );
}
