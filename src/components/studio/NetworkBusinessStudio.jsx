import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock3,
  Image as ImageIcon,
  Link2,
  Newspaper,
  Save,
  ShieldCheck,
  Store,
  Upload,
  UsersRound,
  XCircle
} from 'lucide-react';
import { uploadToCloudinary } from '../../cloudinary';
import { supabase } from '../../supabaseClient';
import { useNetworkBusiness } from '../../hooks/useNetworkBusiness';

const CATEGORIES = ['Negocios', 'Talento', 'Proyectos', 'Medios'];
const BUSINESS_STYLES = `.studio-input{width:100%;min-height:44px;border:1px solid #d2d2d7;border-radius:6px;background:#fff;padding:10px 12px;color:#1d1d1f;font-size:13px;outline:none}.studio-input:focus{border-color:#0066ff;box-shadow:0 0 0 2px rgba(0,102,255,.09)}.studio-input:disabled{background:#f5f5f7;color:#6e6e73}.studio-label{display:flex;align-items:center;gap:5px;margin-bottom:7px;color:#86868b;font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}`;

const emptyRequest = {
  nombre: '',
  account_type: 'business',
  categoria: 'Negocios',
  headline: '',
  descripcion: '',
  contacto: '',
  editorial_id: ''
};

const profileToForm = profile => ({
  nombre: profile?.nombre || '',
  account_type: profile?.account_type || 'business',
  categoria: profile?.categoria || 'Negocios',
  headline: profile?.headline || '',
  descripcion: profile?.descripcion || '',
  ubicacion: profile?.ubicacion || 'Empyria',
  contacto: profile?.contacto || '',
  logo_url: profile?.logo_url || '',
  portada_url: profile?.portada_url || '',
  tags: (profile?.tags || []).join(', '),
  busca_colaboradores: Boolean(profile?.busca_colaboradores),
  oportunidad_titulo: profile?.oportunidad_titulo || '',
  oportunidad_descripcion: profile?.oportunidad_descripcion || '',
  editorial_id: profile?.editorial_id || ''
});

const statusConfig = {
  pendiente: { label: 'En revision', className: 'bg-amber-50 border-amber-200 text-amber-700', icon: Clock3 },
  aprobado: { label: 'Cuenta activa', className: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: ShieldCheck },
  rechazado: { label: 'Requiere cambios', className: 'bg-red-50 border-red-200 text-red-700', icon: XCircle },
  suspendido: { label: 'Suspendida', className: 'bg-neutral-100 border-neutral-200 text-neutral-700', icon: XCircle }
};

export default function NetworkBusinessStudio({ userId, previewMode = false }) {
  const { profile, editorials, loading, error, requestProfile, updateProfile, linkEditorial } = useNetworkBusiness(userId, previewMode);
  const [request, setRequest] = useState(emptyRequest);
  const [form, setForm] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const eligibleEditorials = useMemo(
    () => editorials.filter(editorial => ['owner', 'admin'].includes(editorial.role)),
    [editorials]
  );

  useEffect(() => {
    if (!profile) return;
    setForm(profileToForm(profile));
    setLogoFile(null);
    setCoverFile(null);
  }, [profile]);

  const previewLogo = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : form?.logo_url, [logoFile, form?.logo_url]);
  const previewCover = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : form?.portada_url, [coverFile, form?.portada_url]);

  useEffect(() => () => {
    if (previewLogo?.startsWith('blob:')) URL.revokeObjectURL(previewLogo);
    if (previewCover?.startsWith('blob:')) URL.revokeObjectURL(previewCover);
  }, [previewLogo, previewCover]);

  const notifyRequest = async business => {
    if (previewMode) return;
    try {
      await supabase.functions.invoke('vista-discord-notify', {
        body: {
          event: 'admin_log',
          title: 'NUEVA SOLICITUD DE VISTA NETWORK',
          description: `El GBA ID \`${userId}\` solicito una cuenta para **${business?.nombre || request.nombre}**.`,
          color: 255
        }
      });
    } catch (notificationError) {
      console.warn('La solicitud se guardo, pero Discord no recibio el aviso:', notificationError);
    }
  };

  const submitRequest = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const business = await requestProfile({
        p_nombre: request.nombre,
        p_account_type: request.account_type,
        p_categoria: request.categoria,
        p_headline: request.headline,
        p_descripcion: request.descripcion,
        p_contacto: request.contacto
      });
      if (request.editorial_id) await linkEditorial(business.id, request.editorial_id);
      await notifyRequest(business);
      setNotice({ type: 'success', message: 'Solicitud enviada a la Aduana de VISTA.' });
    } catch (requestError) {
      setNotice({ type: 'error', message: requestError.message || 'No se pudo enviar la solicitud.' });
    } finally {
      setSaving(false);
    }
  };

  const saveProfile = async event => {
    event.preventDefault();
    if (!profile || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const folder = `VISTA_Network/${profile.slug || userId}`;
      let logoUrl = form.logo_url;
      let coverUrl = form.portada_url;
      if (logoFile) logoUrl = await uploadToCloudinary(logoFile, folder);
      if (coverFile) coverUrl = await uploadToCloudinary(coverFile, folder);

      await updateProfile({
        p_business_id: profile.id,
        p_nombre: form.nombre,
        p_account_type: form.account_type,
        p_categoria: form.categoria,
        p_headline: form.headline,
        p_descripcion: form.descripcion,
        p_contacto: form.contacto,
        p_ubicacion: form.ubicacion,
        p_logo_url: logoUrl || '',
        p_portada_url: coverUrl || '',
        p_tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 6),
        p_busca_colaboradores: form.busca_colaboradores,
        p_oportunidad_titulo: form.oportunidad_titulo,
        p_oportunidad_descripcion: form.oportunidad_descripcion
      });
      if ((profile.editorial_id || '') !== form.editorial_id) {
        await linkEditorial(profile.id, form.editorial_id);
      }
      setLogoFile(null);
      setCoverFile(null);
      setNotice({ type: 'success', message: profile.estado === 'rechazado' ? 'Cambios enviados nuevamente a revision.' : 'Perfil de Network actualizado.' });
    } catch (saveError) {
      setNotice({ type: 'error', message: saveError.message || 'No se pudo guardar el perfil.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-24 text-center text-xs font-bold uppercase tracking-widest text-[#86868b]">Abriendo cuenta de Network...</div>;

  if (error) return <div className="border border-red-200 bg-red-50 rounded-md p-6 text-sm text-red-700"><strong className="block">Network no pudo abrir tu cuenta.</strong><span className="block mt-2 text-xs">{error}</span></div>;

  if (!profile) {
    return (
      <><style>{BUSINESS_STYLES}</style><div className="max-w-4xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_280px] gap-8 items-start">
        <form onSubmit={submitRequest} className="bg-white border border-[#d2d2d7] rounded-md p-6 md:p-8 space-y-5">
          <div className="pb-5 border-b border-[#d2d2d7]"><span className="w-11 h-11 rounded-md bg-blue-50 text-[#0066FF] flex items-center justify-center"><Store size={20}/></span><h2 className="text-2xl font-bold mt-5">Solicita una cuenta de negocio</h2><p className="text-sm text-[#86868b] leading-6 mt-2">Para negocios o empresas que operan dentro de Empyria.</p></div>
          {notice && <div className={`border rounded-md px-4 py-3 text-xs font-bold ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.message}</div>}
          <div className="grid sm:grid-cols-2 gap-5">
            <label className="sm:col-span-2"><span className="studio-label">Nombre publico</span><input required minLength="2" maxLength="80" value={request.nombre} onChange={event => setRequest({ ...request, nombre: event.target.value })} className="studio-input" placeholder="Nombre del negocio o empresa"/></label>
            <label><span className="studio-label">Tipo de cuenta</span><select value={request.account_type} onChange={event => setRequest({ ...request, account_type: event.target.value })} className="studio-input"><option value="business">Negocio</option><option value="company">Empresa</option></select></label>
            <label><span className="studio-label">Categoria</span><select value={request.categoria} onChange={event => setRequest({ ...request, categoria: event.target.value })} className="studio-input">{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
            <label className="sm:col-span-2"><span className="studio-label">Presentacion breve</span><input maxLength="160" value={request.headline} onChange={event => setRequest({ ...request, headline: event.target.value })} className="studio-input" placeholder="Una frase que presente lo que haces"/></label>
            <label className="sm:col-span-2"><span className="studio-label">Descripcion</span><textarea required minLength="20" maxLength="800" rows="5" value={request.descripcion} onChange={event => setRequest({ ...request, descripcion: event.target.value })} className="studio-input resize-none" placeholder="Que hace, para quien trabaja y que lo distingue."/></label>
            <label className="sm:col-span-2"><span className="studio-label"><Link2 size={12}/>Contacto</span><input required maxLength="160" value={request.contacto} onChange={event => setRequest({ ...request, contacto: event.target.value })} className="studio-input" placeholder="Usuario de Discord o enlace de contacto"/></label>
            {eligibleEditorials.length > 0 && <label className="sm:col-span-2"><span className="studio-label"><Newspaper size={12}/>Editorial vinculada</span><select value={request.editorial_id} onChange={event => setRequest({ ...request, editorial_id: event.target.value })} className="studio-input"><option value="">Ninguna editorial</option>{eligibleEditorials.map(editorial => <option key={editorial.id} value={editorial.id}>{editorial.nombre}</option>)}</select><span className="block mt-1 text-[9px] text-[#86868b]">Solo puedes vincular editoriales donde administras el equipo.</span></label>}
          </div>
          <button type="submit" disabled={saving} className="h-12 px-5 rounded-md bg-[#1d1d1f] text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"><ShieldCheck size={16}/>{saving ? 'Enviando' : 'Solicitar cuenta'}</button>
        </form>

        <aside className="border-t-2 border-[#0066FF] pt-5">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#0066FF]">Network Beta</p>
          <h3 className="font-bold mt-2">Una identidad separada</h3>
          <p className="text-xs leading-5 text-[#86868b] mt-2">Tu cuenta editorial y tu negocio usan el mismo GBA ID, pero mantienen perfiles y permisos diferentes.</p>
          <div className="mt-5 space-y-3 text-[10px] text-[#62676f]"><span className="flex items-center gap-2"><Check size={13} className="text-emerald-600"/>Disponible para ciudadanos y editores</span><span className="flex items-center gap-2"><Check size={13} className="text-emerald-600"/>Limitada a Empyria durante la beta</span><span className="flex items-center gap-2"><Check size={13} className="text-emerald-600"/>Publicacion sujeta a revision</span></div>
        </aside>
      </div></>
    );
  }

  if (!form) return null;
  const status = statusConfig[profile.estado] || statusConfig.pendiente;
  const StatusIcon = status.icon;
  const editable = profile.estado !== 'suspendido';

  return (
    <><style>{BUSINESS_STYLES}</style><form onSubmit={saveProfile} className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-b border-[#d2d2d7] pb-6">
        <div><p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#0066FF]">Network Beta · Empyria</p><h2 className="text-2xl font-bold mt-1">Perfil de {form.account_type === 'company' ? 'empresa' : 'negocio'}</h2></div>
        <span className={`sm:ml-auto h-8 px-3 rounded-md border inline-flex self-start items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${status.className}`}><StatusIcon size={12}/>{status.label}</span>
      </div>
      {notice && <div className={`border rounded-md px-4 py-3 text-xs font-bold ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.message}</div>}
      {profile.estado === 'pendiente' && <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-800">Puedes completar el perfil mientras Mothership lo revisa. Aparecera en Network cuando sea aprobado.</div>}
      {profile.estado === 'rechazado' && <div className="border-l-2 border-red-500 bg-red-50 px-4 py-3 text-xs text-red-800">Corrige el perfil y guardalo para enviarlo nuevamente a revision.</div>}
      {profile.estado === 'suspendido' && <div className="border-l-2 border-neutral-500 bg-neutral-100 px-4 py-3 text-xs text-neutral-700">La cuenta esta suspendida y no puede editarse.</div>}

      <section className="border-b border-[#d2d2d7] pb-8">
        <div className="flex items-center gap-2 mb-5"><ImageIcon size={17}/><h3 className="text-lg font-bold">Identidad visual</h3></div>
        <div className="grid grid-cols-[112px_1fr] md:grid-cols-[180px_1fr] gap-3 md:gap-5">
          <label className="aspect-square border border-[#d2d2d7] rounded-md overflow-hidden bg-[#f5f5f7] relative cursor-pointer">
            {previewLogo ? <img src={previewLogo} alt="Logotipo del negocio" className="w-full h-full object-cover"/> : <span className="absolute inset-0 flex items-center justify-center text-[#86868b]"><Building2 size={34}/></span>}
            {editable && <span className="absolute inset-x-0 bottom-0 h-10 bg-black/70 text-white flex items-center justify-center gap-2 text-[10px] font-bold"><Upload size={13}/>Logotipo</span>}
            {editable && <input type="file" accept="image/*" className="hidden" onChange={event => setLogoFile(event.target.files?.[0] || null)}/>}
          </label>
          <label className="min-h-44 border border-[#d2d2d7] rounded-md overflow-hidden bg-[#f5f5f7] relative cursor-pointer">
            {previewCover ? <img src={previewCover} alt="Portada del negocio" className="absolute inset-0 w-full h-full object-cover"/> : <span className="absolute inset-0 flex items-center justify-center text-[#86868b]"><ImageIcon size={34}/></span>}
            {editable && <span className="absolute right-3 bottom-3 h-9 px-3 bg-black/75 text-white rounded-md flex items-center gap-2 text-[10px] font-bold"><Upload size={13}/>Portada</span>}
            {editable && <input type="file" accept="image/*" className="hidden" onChange={event => setCoverFile(event.target.files?.[0] || null)}/>}
          </label>
        </div>
      </section>

      <section className="grid sm:grid-cols-2 gap-5 border-b border-[#d2d2d7] pb-8">
        <label className="sm:col-span-2"><span className="studio-label">Nombre publico</span><input required minLength="2" maxLength="80" disabled={!editable} value={form.nombre} onChange={event => setForm({ ...form, nombre: event.target.value })} className="studio-input"/></label>
        <label><span className="studio-label">Tipo de cuenta</span><select disabled={!editable} value={form.account_type} onChange={event => setForm({ ...form, account_type: event.target.value })} className="studio-input"><option value="business">Negocio</option><option value="company">Empresa</option></select></label>
        <label><span className="studio-label">Categoria</span><select disabled={!editable} value={form.categoria} onChange={event => setForm({ ...form, categoria: event.target.value })} className="studio-input">{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="studio-label">Presentacion breve</span><input maxLength="160" disabled={!editable} value={form.headline} onChange={event => setForm({ ...form, headline: event.target.value })} className="studio-input"/></label>
        <label className="sm:col-span-2"><span className="studio-label">Descripcion</span><textarea required minLength="20" maxLength="800" rows="5" disabled={!editable} value={form.descripcion} onChange={event => setForm({ ...form, descripcion: event.target.value })} className="studio-input resize-none"/></label>
        <label><span className="studio-label">Ubicacion</span><input disabled={!editable} value={form.ubicacion} onChange={event => setForm({ ...form, ubicacion: event.target.value })} className="studio-input" placeholder="Distrito o ciudad de Empyria"/></label>
        <label><span className="studio-label"><Link2 size={12}/>Contacto</span><input disabled={!editable} value={form.contacto} onChange={event => setForm({ ...form, contacto: event.target.value })} className="studio-input"/></label>
        <label className="sm:col-span-2"><span className="studio-label">Etiquetas</span><input disabled={!editable} value={form.tags} onChange={event => setForm({ ...form, tags: event.target.value })} className="studio-input" placeholder="Libros, Cultura, Comercio"/><span className="block mt-1 text-[9px] text-[#86868b]">Separa hasta seis etiquetas con comas.</span></label>
        <label className="sm:col-span-2"><span className="studio-label"><Newspaper size={12}/>Editorial vinculada</span><select disabled={!editable} value={form.editorial_id} onChange={event => setForm({ ...form, editorial_id: event.target.value })} className="studio-input"><option value="">Ninguna editorial</option>{eligibleEditorials.map(editorial => <option key={editorial.id} value={editorial.id}>{editorial.nombre}</option>)}</select><span className="block mt-1 text-[9px] text-[#86868b]">Vincularla presenta este negocio como la empresa de esa editorial. Se requiere rol de dueño o administrador.</span></label>
      </section>

      <section className="border-b border-[#d2d2d7] pb-8">
        <label className="min-h-16 border border-[#d2d2d7] rounded-md px-4 py-3 flex items-center gap-3 bg-white">
          <input type="checkbox" disabled={!editable} checked={form.busca_colaboradores} onChange={event => setForm({ ...form, busca_colaboradores: event.target.checked })} className="w-4 h-4 accent-[#0066FF]"/>
          <span><strong className="flex items-center gap-2 text-sm"><UsersRound size={15}/>Buscar colaboradores</strong><span className="text-[10px] text-[#86868b]">La convocatoria aparecera en Oportunidades.</span></span>
        </label>
        {form.busca_colaboradores && <div className="grid gap-5 mt-5"><label><span className="studio-label">Titulo de la oportunidad</span><input required minLength="5" maxLength="120" disabled={!editable} value={form.oportunidad_titulo} onChange={event => setForm({ ...form, oportunidad_titulo: event.target.value })} className="studio-input" placeholder="Buscamos colaboradores para..."/></label><label><span className="studio-label">Descripcion de la oportunidad</span><textarea maxLength="500" rows="4" disabled={!editable} value={form.oportunidad_descripcion} onChange={event => setForm({ ...form, oportunidad_descripcion: event.target.value })} className="studio-input resize-none"/></label></div>}
      </section>

      {editable && <div className="flex justify-end"><button type="submit" disabled={saving} className="h-11 px-5 rounded-md bg-[#0066FF] text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"><Save size={16}/>{saving ? 'Guardando' : 'Guardar perfil'}</button></div>}
    </form></>
  );
}
