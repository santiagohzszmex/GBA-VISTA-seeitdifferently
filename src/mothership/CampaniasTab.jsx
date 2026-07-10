import React, { useEffect, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, Edit3, FileText, Megaphone, Pause, Play, Save, Trash2, UploadCloud, X } from 'lucide-react';
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
  { value: 'news_banner', label: 'Noticias Banner' },
  { value: 'spotlight_modal', label: 'Spotlight' },
  { value: 'campaign_center', label: 'Centro' }
];

const inferAssetType = (file) => {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.name.toLowerCase().endsWith('.glb')) return 'modelo_3d';
  if (file.type === 'application/pdf') return 'documento';
  if (file.type.startsWith('image/')) {
    const fileName = file.name.toLowerCase();
    if (/(banner|horizontal|wide|franja|strip)/.test(fileName)) return 'banner';
    return 'poster';
  }
  return 'otro';
};

const getImagePreview = (campaign) => (
  campaign.assets?.find(asset => asset.tipo === 'banner')
  || campaign.assets?.find(asset => asset.tipo === 'poster')
);

const getCampaignVisibilityLabel = (campaign) => {
  if (campaign.estado !== 'activa') return campaign.estado;

  const now = Date.now();
  const startsAt = campaign.fecha_inicio ? new Date(campaign.fecha_inicio).getTime() : null;
  const endsAt = campaign.fecha_fin ? new Date(campaign.fecha_fin).getTime() : null;

  if (startsAt && startsAt > now) return 'programada';
  if (endsAt && endsAt < now) return 'expirada';
  return 'activa';
};

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function CampaniasTab() {
  const { campaigns, fetchAllCampaigns, loading, error } = useCampaigns();
  const [formData, setFormData] = useState(initialForm);
  const [assetFiles, setAssetFiles] = useState([]);
  const [newsOptions, setNewsOptions] = useState([]);
  const [linkedContentIds, setLinkedContentIds] = useState([]);
  const [selectedContentByCampaign, setSelectedContentByCampaign] = useState({});
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [existingAssets, setExistingAssets] = useState([]);

  useEffect(() => {
    fetchAllCampaigns();
    fetchNewsOptions();
  }, [fetchAllCampaigns]);

  const fetchNewsOptions = async () => {
    let { data, error: newsError } = await supabase
      .from('contenido')
      .select('id, titulo, categoria, sello_editorial, estado_publicacion, created_at, campania_id')
      .in('categoria', ['Noticia', 'Periódico'])
      .eq('estado_publicacion', 'aprobado')
      .order('created_at', { ascending: false })
      .limit(40);

    if (newsError) {
      const fallback = await supabase
        .from('contenido')
        .select('id, titulo, categoria, sello_editorial, estado_publicacion, created_at')
        .in('categoria', ['Noticia', 'Periódico'])
        .eq('estado_publicacion', 'aprobado')
        .order('created_at', { ascending: false })
        .limit(40);

      data = fallback.data;
      newsError = fallback.error;
    }

    if (newsError) {
      console.error('Error al cargar ediciones para campañas:', newsError);
      return;
    }

    setNewsOptions(data || []);
  };

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

  const resetForm = (clearStatus = true) => {
    setFormData(initialForm);
    setAssetFiles([]);
    setExistingAssets([]);
    setLinkedContentIds([]);
    setEditingCampaign(null);
    if (clearStatus) setStatus(null);
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      titulo: campaign.titulo || '',
      descripcion: campaign.descripcion || '',
      estado: campaign.estado || 'borrador',
      fecha_inicio: toDateTimeLocal(campaign.fecha_inicio),
      fecha_fin: toDateTimeLocal(campaign.fecha_fin),
      prioridad: campaign.prioridad || 0,
      ubicaciones: campaign.ubicaciones?.length ? campaign.ubicaciones : ['home_banner'],
      cta_texto: campaign.cta_texto || 'Ver campaña',
      cta_tipo: campaign.cta_tipo || 'campania',
      cta_target: campaign.cta_target || ''
    });
    setExistingAssets(campaign.assets || []);
    setAssetFiles([]);
    setLinkedContentIds((campaign.linkedContent || []).map(item => item.id));
    setStatus({ type: 'info', msg: `Editando: ${campaign.titulo}` });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeExistingAsset = (assetId) => {
    setExistingAssets(prev => prev.filter(asset => asset.id !== assetId));
  };

  const moveExistingAsset = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= existingAssets.length) return;
    const next = [...existingAssets];
    [next[index], next[target]] = [next[target], next[index]];
    setExistingAssets(next);
  };

  const removeNewAsset = (index) => setAssetFiles(prev => prev.filter((_, fileIndex) => fileIndex !== index));

  const toggleLinkedContent = (contentId) => {
    setLinkedContentIds(prev => (
      prev.includes(contentId)
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus({ type: 'info', msg: editingCampaign ? 'Actualizando campaña...' : 'Creando campaña...' });

    try {
      const startsAt = formData.fecha_inicio ? new Date(formData.fecha_inicio).getTime() : null;
      const endsAt = formData.fecha_fin ? new Date(formData.fecha_fin).getTime() : null;

      if (startsAt && endsAt && startsAt > endsAt) {
        throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
      }

      const payload = {
        ...formData,
        fecha_inicio: formData.fecha_inicio || null,
        fecha_fin: formData.fecha_fin || null
      };

      const campaignQuery = editingCampaign
        ? supabase.from('campanias').update(payload).eq('id', editingCampaign.id).select().single()
        : supabase.from('campanias').insert([payload]).select().single();
      const { data: campaign, error: campaignError } = await campaignQuery;

      if (campaignError) throw campaignError;

      if (editingCampaign) {
        const retainedIds = new Set(existingAssets.map(asset => asset.id));
        const removedIds = (editingCampaign.assets || []).filter(asset => !retainedIds.has(asset.id)).map(asset => asset.id);

        if (removedIds.length > 0) {
          const { error: removeAssetsError } = await supabase.from('campania_assets').delete().in('id', removedIds);
          if (removeAssetsError) throw removeAssetsError;
        }

        for (let index = 0; index < existingAssets.length; index += 1) {
          const { error: reorderError } = await supabase
            .from('campania_assets')
            .update({ orden: index })
            .eq('id', existingAssets[index].id);
          if (reorderError) throw reorderError;
        }
      }

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
            orden: existingAssets.length + index,
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

      if (editingCampaign) {
        const previousIds = (editingCampaign.linkedContent || []).map(item => item.id);
        const removedContentIds = previousIds.filter(id => !linkedContentIds.includes(id));
        if (removedContentIds.length > 0) {
          const { error: unlinkError } = await supabase
            .from('contenido')
            .update({ campania_id: null })
            .in('id', removedContentIds);
          if (unlinkError) throw unlinkError;
        }
      }

      if (linkedContentIds.length > 0) {
        const { error: linkError } = await supabase
          .from('contenido')
          .update({ campania_id: campaign.id })
          .in('id', linkedContentIds);

        if (linkError) throw linkError;
      }

      const successMessage = editingCampaign ? 'Campaña actualizada correctamente.' : 'Campaña creada correctamente.';
      resetForm(false);
      setStatus({ type: 'success', msg: successMessage });
      await fetchAllCampaigns();
      await fetchNewsOptions();
    } catch (err) {
      console.error('Error al guardar campaña:', err);
      setStatus({ type: 'error', msg: err.message || 'No se pudo guardar la campaña.' });
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

    setStatus({ type: 'success', msg: `Campaña ${estado}.` });
    if (editingCampaign?.id === campaign.id) setFormData(prev => ({ ...prev, estado }));
    await fetchAllCampaigns();
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

    if (editingCampaign?.id === campaign.id) resetForm(false);
    setStatus({ type: 'success', msg: 'Campaña eliminada.' });
    await fetchAllCampaigns();
  };

  const linkContentToCampaign = async (campaign) => {
    const contentId = selectedContentByCampaign[campaign.id];
    if (!contentId) return;

    const { error: linkError } = await supabase
      .from('contenido')
      .update({ campania_id: campaign.id })
      .eq('id', contentId);

    if (linkError) {
      setStatus({ type: 'error', msg: 'No se pudo vincular la edición.' });
      return;
    }

    setSelectedContentByCampaign(prev => ({ ...prev, [campaign.id]: '' }));
    setStatus({ type: 'success', msg: 'Edición vinculada a la campaña.' });
    fetchAllCampaigns();
    fetchNewsOptions();
  };

  const unlinkContentFromCampaign = async (contentId) => {
    const { error: unlinkError } = await supabase
      .from('contenido')
      .update({ campania_id: null })
      .eq('id', contentId);

    if (unlinkError) {
      setStatus({ type: 'error', msg: 'No se pudo desvincular la edición.' });
      return;
    }

    setStatus({ type: 'success', msg: 'Edición desvinculada. Sigue disponible en Noticias.' });
    fetchAllCampaigns();
    fetchNewsOptions();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 text-white">
      <div className="xl:col-span-1">
        <div className="bg-[#121212] border border-white/10 p-8 rounded-[2.5rem] sticky top-8 shadow-2xl">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              {editingCampaign ? <Edit3 className="text-yellow-400" /> : <Megaphone className="text-[#0066FF]" />}
              <h2 className="text-2xl font-bold">{editingCampaign ? 'Editar Campaña' : 'Nueva Campaña'}</h2>
            </div>
            {editingCampaign && (
              <button type="button" onClick={() => resetForm()} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" title="Cancelar edición">
                <X size={16}/>
              </button>
            )}
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

            {existingAssets.length > 0 && (
              <div className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Assets publicados</p>
                  <span className="text-[10px] text-neutral-600">{existingAssets.length}</span>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                  {existingAssets.map((asset, index) => (
                    <div key={asset.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-2">
                      <div className="w-11 h-11 rounded-lg bg-black overflow-hidden flex items-center justify-center text-[8px] uppercase text-neutral-500">
                        {['banner', 'poster'].includes(asset.tipo) ? <img src={asset.url} alt="" className="w-full h-full object-cover"/> : asset.tipo}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold truncate">{asset.titulo || asset.tipo}</p>
                        <p className="text-[9px] text-neutral-500 uppercase">{asset.tipo}</p>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => moveExistingAsset(index, -1)} disabled={index === 0} className="w-7 h-7 bg-white/5 disabled:opacity-20 rounded flex items-center justify-center" title="Mover antes"><ChevronUp size={12}/></button>
                        <button type="button" onClick={() => moveExistingAsset(index, 1)} disabled={index === existingAssets.length - 1} className="w-7 h-7 bg-white/5 disabled:opacity-20 rounded flex items-center justify-center" title="Mover después"><ChevronDown size={12}/></button>
                        <button type="button" onClick={() => removeExistingAsset(asset.id)} className="w-7 h-7 bg-red-500/10 text-red-400 rounded flex items-center justify-center" title="Retirar asset"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="flex flex-col items-center justify-center gap-3 p-6 border border-dashed border-white/20 rounded-2xl bg-black/30 cursor-pointer hover:bg-white/5 transition-colors text-center">
              <UploadCloud className="text-[#0066FF]" />
              <span className="text-xs font-bold uppercase tracking-widest">
                {assetFiles.length > 0 ? `${assetFiles.length} asset(s) seleccionados` : 'Assets opcionales: posters, videos, audio, PDF o GLB'}
              </span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf,.glb"
                onChange={(e) => setAssetFiles(Array.from(e.target.files || []))}
                className="hidden"
              />
            </label>

            {assetFiles.length > 0 && (
              <div className="space-y-2">
                {assetFiles.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 bg-[#0066FF]/10 border border-[#0066FF]/20 rounded-xl p-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{file.name}</p>
                      <p className="text-[9px] uppercase text-blue-300 mt-1">Nuevo {inferAssetType(file)}</p>
                    </div>
                    <button type="button" onClick={() => removeNewAsset(index)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center" title="Quitar archivo"><X size={14}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold flex items-center gap-1.5">
                  <FileText size={12} /> Ediciones vinculadas
                </p>
                <span className="text-[10px] text-neutral-600 font-bold">{linkedContentIds.length} seleccionada(s)</span>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                {newsOptions.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleLinkedContent(item.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      linkedContentIds.includes(item.id)
                        ? 'bg-[#0066FF]/20 border-[#0066FF] text-white'
                        : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="block text-xs font-bold line-clamp-1">{item.titulo}</span>
                    <span className="block text-[9px] uppercase tracking-widest mt-1 text-neutral-500">
                      {item.categoria} {item.sello_editorial ? `• ${item.sello_editorial}` : ''}
                    </span>
                  </button>
                ))}
                {newsOptions.length === 0 && (
                  <p className="text-xs text-neutral-600 text-center py-4">No hay ediciones aprobadas para vincular.</p>
                )}
              </div>
            </div>

            {status && (
              <div className={`p-3 rounded-xl text-xs text-center font-bold border ${
                status.type === 'error' ? 'text-red-300 bg-red-900/20 border-red-500/30' :
                status.type === 'info' ? 'text-blue-300 bg-blue-900/20 border-blue-500/30' :
                'text-green-300 bg-green-900/20 border-green-500/30'
              }`}>
                {status.msg}
              </div>
            )}

            <button type="submit" disabled={saving} className={`w-full py-4 rounded-xl disabled:opacity-50 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 ${editingCampaign ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-[#0066FF] hover:bg-[#0052cc] text-white'}`}>
              <Save size={18} /> {saving ? 'Guardando...' : (editingCampaign ? 'Guardar cambios' : 'Crear Campaña')}
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
            const preview = getImagePreview(campaign);
            const visibilityLabel = getCampaignVisibilityLabel(campaign);

            return (
              <div key={campaign.id} className="bg-[#121212] border border-white/10 rounded-3xl overflow-hidden shadow-xl">
                <div className="h-52 bg-black relative">
                  {preview?.url ? (
                    <img src={preview.url} alt={campaign.titulo} className="w-full h-full object-cover opacity-80" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 gap-3">
                      <Megaphone size={42} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{campaign.assets?.length || 0} asset(s) sin imagen</span>
                    </div>
                  )}
                  <div className="absolute top-4 left-4 flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      visibilityLabel === 'activa' ? 'bg-white text-black' : 'bg-yellow-500 text-black'
                    }`}>
                      {visibilityLabel}
                    </span>
                    <span className="bg-black/60 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{campaign.assets?.length || 0} assets</span>
                    {campaign.linkedContent?.length > 0 && (
                      <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{campaign.linkedContent.length} notas</span>
                    )}
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

                  {campaign.linkedContent?.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {campaign.linkedContent.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 p-2">
                          <span className="text-[11px] text-neutral-300 font-bold line-clamp-1">{item.titulo}</span>
                          <button
                            type="button"
                            onClick={() => unlinkContentFromCampaign(item.id)}
                            className="text-[9px] text-red-400 hover:text-red-300 uppercase tracking-widest font-black"
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-4">
                    <select
                      value={selectedContentByCampaign[campaign.id] || ''}
                      onChange={(e) => setSelectedContentByCampaign(prev => ({ ...prev, [campaign.id]: e.target.value }))}
                      className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-neutral-300 outline-none [&>option]:bg-[#1d1d1f]"
                    >
                      <option value="">Vincular edición...</option>
                      {newsOptions.map(item => (
                        <option key={item.id} value={item.id}>{item.titulo}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => linkContentToCampaign(campaign)}
                      disabled={!selectedContentByCampaign[campaign.id]}
                      className="bg-[#0066FF] disabled:opacity-30 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      Añadir
                    </button>
                  </div>

                  <div className="flex gap-2 mt-5">
                    <button onClick={() => handleEditCampaign(campaign)} className="bg-yellow-500/10 hover:bg-yellow-500 border border-yellow-500/20 text-yellow-400 hover:text-black px-3 py-2 rounded-xl transition-colors" title="Editar campaña">
                      <Edit3 size={14}/>
                    </button>
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
