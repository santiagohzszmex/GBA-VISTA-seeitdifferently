import React, { useEffect, useState } from 'react';
import { Building2, Check, Image as ImageIcon, Link2, Save, Upload } from 'lucide-react';
import { uploadToCloudinary } from '../../cloudinary';
import { supabase } from '../../supabaseClient';
import { EDITORIAL_CATEGORIES } from '../../utils/editorialCategories';

const LANGUAGES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'fr', label: 'Francés' },
  { value: 'pt', label: 'Portugués' },
  { value: 'nah', label: 'Náhuatl' }
];

const cleanUrl = value => {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/+/, '')}`;
};

export default function EditorialProfileSettings({ editorial, onUpdated, previewMode = false }) {
  const canManage = ['owner', 'admin'].includes(editorial?.role);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!editorial) return;
    setForm({
      nombre: editorial.nombre || '',
      descripcion: editorial.descripcion || '',
      logo_url: editorial.logo_url || '',
      portada_url: editorial.portada_url || '',
      categorias: editorial.categorias || [],
      idiomas: editorial.idiomas?.length ? editorial.idiomas : ['es'],
      servidor: editorial.servidor || '',
      nacion: editorial.nacion || '',
      discord_url: editorial.discord_url || '',
      acepta_colaboradores: Boolean(editorial.acepta_colaboradores)
    });
    setLogoFile(null);
    setCoverFile(null);
    setNotice(null);
  }, [editorial]);

  if (!form) return null;

  const toggleArrayValue = (field, value) => {
    setForm(current => {
      const values = new Set(current[field]);
      if (values.has(value)) values.delete(value);
      else values.add(value);
      return { ...current, [field]: [...values] };
    });
  };

  const save = async event => {
    event.preventDefault();
    if (!canManage || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      if (previewMode) {
        const updated = { ...editorial, ...form };
        onUpdated?.(updated);
        setLogoFile(null);
        setCoverFile(null);
        setNotice({ type: 'success', message: 'Perfil actualizado en la demostración.' });
        setSaving(false);
        return;
      }
      const folder = `Editoriales/${editorial.slug}/perfil`;
      let logoUrl = form.logo_url;
      let coverUrl = form.portada_url;
      if (logoFile) logoUrl = await uploadToCloudinary(logoFile, folder);
      if (coverFile) coverUrl = await uploadToCloudinary(coverFile, folder);

      const { data, error } = await supabase.rpc('vista_editorial_update_profile', {
        p_editorial_id: editorial.id,
        p_nombre: form.nombre,
        p_descripcion: form.descripcion,
        p_logo_url: logoUrl || '',
        p_portada_url: coverUrl || '',
        p_categorias: form.categorias,
        p_idiomas: form.idiomas,
        p_servidor: form.servidor,
        p_nacion: form.nacion,
        p_discord_url: cleanUrl(form.discord_url),
        p_acepta_colaboradores: form.acepta_colaboradores
      });
      if (error) throw error;
      const updated = Array.isArray(data) ? data[0] : data;
      if (!updated) throw new Error('El servidor no devolvio el perfil actualizado.');
      setForm(current => ({ ...current, logo_url: updated.logo_url || '', portada_url: updated.portada_url || '', discord_url: updated.discord_url || '' }));
      setLogoFile(null);
      setCoverFile(null);
      onUpdated?.({ ...editorial, ...updated, role: editorial.role });
      setNotice({ type: 'success', message: 'Perfil editorial actualizado.' });
    } catch (error) {
      setNotice({ type: 'error', message: error.message || 'No se pudo guardar el perfil.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="max-w-5xl mx-auto space-y-8">
      {!canManage && <div className="border border-amber-200 bg-amber-50 text-amber-800 rounded-md px-4 py-3 text-xs font-bold">Puedes consultar el perfil, pero solo propietarios y administradores pueden modificarlo.</div>}
      {notice && <div className={`border rounded-md px-4 py-3 text-xs font-bold ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.message}</div>}

      <section className="border-b border-[#d2d2d7] pb-8">
        <div className="flex items-center gap-2 mb-5"><ImageIcon size={17}/><h2 className="text-lg font-bold">Identidad visual</h2></div>
        <div className="grid grid-cols-[112px_1fr] md:grid-cols-[180px_1fr] gap-3 md:gap-5">
          <label className="aspect-square border border-[#d2d2d7] rounded-md overflow-hidden bg-[#f5f5f7] relative cursor-pointer group">
            {(logoFile || form.logo_url) ? <img src={logoFile ? URL.createObjectURL(logoFile) : form.logo_url} alt="Logotipo editorial" className="w-full h-full object-cover"/> : <span className="absolute inset-0 flex items-center justify-center text-[#86868b]"><Building2 size={34}/></span>}
            {canManage && <span className="absolute inset-x-0 bottom-0 h-10 bg-black/70 text-white flex items-center justify-center gap-2 text-[10px] font-bold"><Upload size={13}/>Logotipo</span>}
            {canManage && <input type="file" accept="image/*" className="hidden" onChange={event => setLogoFile(event.target.files?.[0] || null)}/>}
          </label>
          <label className="min-h-44 border border-[#d2d2d7] rounded-md overflow-hidden bg-[#f5f5f7] relative cursor-pointer group">
            {(coverFile || form.portada_url) ? <img src={coverFile ? URL.createObjectURL(coverFile) : form.portada_url} alt="Portada editorial" className="absolute inset-0 w-full h-full object-cover"/> : <span className="absolute inset-0 flex items-center justify-center text-[#86868b]"><ImageIcon size={34}/></span>}
            {canManage && <span className="absolute right-3 bottom-3 h-9 px-3 bg-black/75 text-white rounded-md flex items-center gap-2 text-[10px] font-bold"><Upload size={13}/>Portada</span>}
            {canManage && <input type="file" accept="image/*" className="hidden" onChange={event => setCoverFile(event.target.files?.[0] || null)}/>}
          </label>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-5 border-b border-[#d2d2d7] pb-8">
        <label className="md:col-span-2"><span className="studio-label">Nombre público</span><input required minLength="2" maxLength="80" disabled={!canManage} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} className="studio-input"/></label>
        <label className="md:col-span-2"><span className="studio-label">Presentación editorial</span><textarea maxLength="800" rows="5" disabled={!canManage} value={form.descripcion} onChange={event => setForm({ ...form, descripcion: event.target.value })} className="studio-input resize-none" placeholder="Qué publica el equipo y qué lo distingue."/><span className="block mt-1 text-right text-[9px] text-[#86868b]">{form.descripcion.length}/800</span></label>
        <label><span className="studio-label">Servidor o comunidad</span><input disabled={!canManage} value={form.servidor} onChange={event => setForm({ ...form, servidor: event.target.value })} className="studio-input" placeholder="Empyria"/></label>
        <label><span className="studio-label">Nación de origen</span><input disabled={!canManage} value={form.nacion} onChange={event => setForm({ ...form, nacion: event.target.value })} className="studio-input" placeholder="Opcional"/></label>
      </section>

      <section className="grid md:grid-cols-2 gap-7 border-b border-[#d2d2d7] pb-8">
        <div><span className="studio-label">Categorías</span><div className="flex flex-wrap gap-2">{EDITORIAL_CATEGORIES.map(category => <button key={category.value} type="button" disabled={!canManage} onClick={() => toggleArrayValue('categorias', category.value)} className={`h-9 px-3 rounded-md border text-xs font-bold flex items-center gap-1.5 disabled:cursor-default ${form.categorias.includes(category.value) ? 'bg-[#1d1d1f] border-[#1d1d1f] text-white' : 'bg-white border-[#d2d2d7] text-[#5f6368]'}`}>{form.categorias.includes(category.value) && <Check size={12}/>} {category.label}</button>)}</div></div>
        <div><span className="studio-label">Idiomas</span><div className="flex flex-wrap gap-2">{LANGUAGES.map(language => <button key={language.value} type="button" disabled={!canManage} onClick={() => toggleArrayValue('idiomas', language.value)} className={`h-9 px-3 rounded-md border text-xs font-bold flex items-center gap-1.5 disabled:cursor-default ${form.idiomas.includes(language.value) ? 'bg-[#0066FF] border-[#0066FF] text-white' : 'bg-white border-[#d2d2d7] text-[#5f6368]'}`}>{form.idiomas.includes(language.value) && <Check size={12}/>} {language.label}</button>)}</div></div>
      </section>

      <section className="grid gap-5 border-b border-[#d2d2d7] pb-8">
        <label><span className="studio-label"><Link2 size={12}/> Discord</span><input disabled={!canManage} value={form.discord_url} onChange={event => setForm({ ...form, discord_url: event.target.value })} className="studio-input" placeholder="discord.gg/..."/></label>
        <label className="md:col-span-2 min-h-14 border border-[#d2d2d7] rounded-md px-4 py-3 flex items-center gap-3 bg-white">
          <input type="checkbox" disabled={!canManage} checked={form.acepta_colaboradores} onChange={event => setForm({ ...form, acepta_colaboradores: event.target.checked })} className="w-4 h-4 accent-[#0066FF]"/>
          <span><strong className="block text-sm">Recibir propuestas de colaboración</strong><span className="text-[10px] text-[#86868b]">El perfil público mostrará que el equipo está abierto a nuevos integrantes.</span></span>
        </label>
      </section>

      {canManage && <div className="flex justify-end"><button type="submit" disabled={saving || !form.idiomas.length} className="h-11 px-5 rounded-md bg-[#0066FF] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"><Save size={16}/>{saving ? 'Guardando' : 'Guardar perfil'}</button></div>}
    </form>
  );
}
