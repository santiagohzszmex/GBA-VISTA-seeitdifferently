import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  ChevronRight,
  CircleDot,
  Clock3,
  Compass,
  Globe2,
  Handshake,
  MapPin,
  Newspaper,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  UsersRound,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  NETWORK_CATEGORIES,
  NETWORK_OPPORTUNITIES,
  NETWORK_PROFILES
} from '../network/networkData';
import NetworkBusinessStudio from '../components/studio/NetworkBusinessStudio';
import CreditsPanel from '../components/social/CreditsPanel';
import ConversationPanel from '../components/social/ConversationPanel';

const NETWORK_STYLES = `
  .net-button,.net-button-secondary,.net-icon{height:40px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:11px;font-weight:800;white-space:nowrap;transition:background .18s,border-color .18s,color .18s}
  .net-button{background:#17191d;color:#fff;padding:0 14px}.net-button:hover{background:#2d3035}
  .net-partner-button{background:#fff;color:#17191d}.net-partner-button:hover{background:#eceef2}
  .net-button-secondary{background:#fff;border:1px solid #d9dce3;color:#454a52;padding:0 14px}.net-button-secondary:hover{border-color:#aeb3bc;background:#f8f9fa}
  .net-icon{width:40px;background:#fff;border:1px solid #d9dce3;color:#656a73}.net-icon:hover{color:#17191d;border-color:#aeb3bc}
  .net-input{width:100%;min-height:42px;border:1px solid #d9dce3;border-radius:6px;background:#fff;padding:10px 12px;color:#25282d;font-size:12px;outline:none}
  .net-input:focus{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.08)}
  .net-label{display:block;margin-bottom:6px;color:#858a93;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}
  .net-eyebrow{color:#8d929b;font-size:9px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
  .net-tab{height:52px;padding:0 16px;border-bottom:2px solid transparent;display:flex;align-items:center;gap:8px;color:#858a93;font-size:10px;font-weight:900;text-transform:uppercase;white-space:nowrap}
  .net-tab-active{border-color:#17191d;color:#17191d}
  .net-overlay{position:fixed;inset:0;z-index:1500;background:rgba(0,0,0,.34);backdrop-filter:blur(5px);display:flex;align-items:center;justify-content:center;padding:16px}
  .net-modal{width:100%;max-height:92vh;overflow-y:auto;background:#fff;border:1px solid #d9dce3;border-radius:8px;box-shadow:0 24px 70px rgba(0,0,0,.24)}
  .net-modal-header{min-height:68px;padding:12px 20px;border-bottom:1px solid #e2e4e9;display:flex;align-items:center;justify-content:space-between;gap:16px}
`;

const PROFILE_ICONS = {
  Negocios: Store,
  Talento: Sparkles,
  Proyectos: Building2,
  Medios: Newspaper
};

const PALETTE = ['#2563eb', '#0f766e', '#7c3aed', '#b45309', '#be123c'];

const mapBusiness = (business, index) => {
  const editorial = Array.isArray(business.editorial) ? business.editorial[0] : business.editorial;
  return {
    id: business.id,
    name: business.nombre,
    initials: business.nombre?.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'VN',
    kind: editorial ? 'Empresa editorial' : business.account_type === 'company' ? 'Empresa' : 'Negocio',
    category: business.categoria,
    location: business.ubicacion || 'Empyria',
    headline: business.headline || business.nombre,
    description: business.descripcion,
    tags: business.tags || [],
    color: PALETTE[index % PALETTE.length],
    contact: business.contacto,
    logoUrl: business.logo_url,
    coverUrl: business.portada_url,
    action: business.categoria === 'Talento' ? 'Ver portafolio' : 'Ver perfil',
    promoted: Boolean(business.promocionada),
    verified: Boolean(business.verificada),
    isRecruiting: Boolean(business.busca_colaboradores),
    opportunityTitle: business.oportunidad_titulo,
    opportunityDescription: business.oportunidad_descripcion,
    linkedEditorial: editorial ? { id: editorial.id, slug: editorial.slug, name: editorial.nombre, verified: editorial.verificada } : null
  };
};

const mapOpportunity = profile => ({
  id: `opportunity-${profile.id}`,
  organization: profile.name,
  initials: profile.initials,
  color: profile.color,
  logoUrl: profile.logoUrl,
  type: 'Convocatoria',
  title: profile.opportunityTitle || `${profile.name} busca colaboradores`,
  summary: profile.opportunityDescription || profile.description,
  areas: profile.tags,
  deadline: 'Convocatoria abierta',
  contact: profile.contact
});

function IdentityMark({ item, large = false }) {
  return item.logoUrl ? <img src={item.logoUrl} alt="" className={`${large ? 'w-14 h-14' : 'w-10 h-10'} rounded-md object-cover flex-shrink-0`}/> : (
    <span className={`${large ? 'w-14 h-14 text-sm' : 'w-10 h-10 text-[10px]'} rounded-md flex items-center justify-center text-white font-black flex-shrink-0`} style={{ backgroundColor: item.color }}>{item.initials}</span>
  );
}

function BetaBadge({ dark = false }) {
  return <span className={`h-6 px-2 rounded inline-flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.14em] ${dark ? 'bg-white/12 text-white' : 'bg-[#e8f0ff] text-[#1d5fd1]'}`}><CircleDot size={10}/>Beta · Solo Empyria</span>;
}

function PartnerHero({ partners, onOpen, onOpenStudio }) {
  const featured = partners[0] || null;
  return (
    <section className="relative min-h-[330px] overflow-hidden bg-[#111317] text-white border-b border-white/10">
      {featured?.coverUrl && <img src={featured.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-35"/>}
      <div className="absolute inset-0 bg-black/45"/>
      <div className="relative max-w-[1440px] mx-auto min-h-[330px] px-5 md:px-10 py-10 flex flex-col justify-between gap-10">
        <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/65"><Handshake size={14}/>GBA Partners</span><span className="text-[8px] font-black uppercase tracking-[0.16em] text-white/45">Espacio patrocinado</span></div>
        <div className="max-w-2xl">
          <BetaBadge dark/>
          <h2 className="text-3xl md:text-5xl font-black mt-5 leading-tight">{featured ? featured.name : 'Proyectos que impulsan a Empyria.'}</h2>
          <p className="text-sm md:text-base text-white/70 leading-6 mt-4 max-w-xl">{featured?.headline || 'Un espacio para los negocios y empresas que forman parte de GBA Partners.'}</p>
          <button type="button" className="net-button net-partner-button mt-7" onClick={() => featured ? onOpen(featured) : onOpenStudio()}>{featured ? 'Conocer Partner' : 'Administrar en Studio'}<ArrowUpRight size={14}/></button>
        </div>
        {partners.length > 0 && <div className="flex items-center gap-3 overflow-x-auto pb-1">{partners.slice(0, 4).map(partner => <button key={partner.id} type="button" onClick={() => onOpen(partner)} className="h-11 min-w-0 px-3 rounded-md border border-white/15 bg-black/25 hover:bg-white/10 flex items-center gap-2.5 text-left"><IdentityMark item={partner}/><span className="min-w-0"><strong className="block text-[10px] truncate">{partner.name}</strong><span className="block text-[8px] text-white/50 mt-0.5">GBA Partner</span></span></button>)}</div>}
      </div>
    </section>
  );
}

function ProfileCard({ profile, onOpen }) {
  const Icon = PROFILE_ICONS[profile.category] || Compass;
  return (
    <article className="min-h-[280px] bg-white border border-[#dfe2e8] rounded-md overflow-hidden flex flex-col">
      {profile.coverUrl && <div className="h-24 overflow-hidden bg-[#e8ebef]"><img src={profile.coverUrl} alt="" className="w-full h-full object-cover"/></div>}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start gap-3"><IdentityMark item={profile}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2 min-w-0"><h3 className="font-bold text-sm truncate">{profile.name}</h3>{profile.verified && <ShieldCheck size={13} className="text-[#2563eb] flex-shrink-0"/>}</div><p className="text-[9px] text-[#8e939c] mt-1">{profile.kind}</p></div>{profile.promoted && <span className="flex-shrink-0 text-[8px] font-black uppercase tracking-wider text-[#9a6700]">Promocionado</span>}</div>
        <span className="mt-5 inline-flex self-start items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-[#5e646d]"><Icon size={12}/>{profile.category}</span>
        {profile.linkedEditorial && <span className="mt-2 inline-flex self-start items-center gap-1.5 text-[9px] font-bold text-[#2563eb]"><Newspaper size={11}/>{profile.linkedEditorial.name}</span>}
        <h4 className="font-bold text-lg leading-6 mt-3">{profile.headline}</h4>
        <p className="text-[11px] text-[#757a83] leading-5 mt-2 line-clamp-3">{profile.description}</p>
        <div className="mt-auto pt-5"><div className="flex flex-wrap gap-1.5 mb-5">{profile.tags.map(tag => <span key={tag} className="h-6 px-2 rounded bg-[#f1f3f6] text-[8px] font-bold text-[#737882] flex items-center">{tag}</span>)}</div><button type="button" className="net-button-secondary w-full" onClick={() => onOpen(profile)}>{profile.action}<ArrowUpRight size={13}/></button></div>
      </div>
    </article>
  );
}

function OpportunityRow({ opportunity, onOpen }) {
  return <button type="button" onClick={() => onOpen(opportunity)} className="w-full text-left px-4 md:px-5 py-5 grid md:grid-cols-[minmax(0,1fr)_190px_28px] gap-4 items-center border-b border-[#e7e9ed] last:border-b-0 hover:bg-[#fafbfc] transition-colors"><span className="flex gap-3 min-w-0"><IdentityMark item={opportunity}/><span className="min-w-0"><span className="block text-[9px] font-black uppercase tracking-wider text-[#2563eb]">{opportunity.type}</span><span className="block text-sm font-bold mt-1">{opportunity.title}</span><span className="block text-[10px] leading-4 text-[#858a93] mt-2 line-clamp-2">{opportunity.summary}</span></span></span><span className="md:text-right"><span className="block text-[10px] font-bold">{opportunity.organization}</span><span className="flex md:justify-end items-center gap-1 text-[9px] text-[#9297a0] mt-1.5"><Clock3 size={10}/>{opportunity.deadline}</span></span><ChevronRight size={16} className="hidden md:block text-[#a4a8af]"/></button>;
}

function DetailModal({ item, onClose, onOpenEditorial }) {
  const isOpportunity = Boolean(item.organization);
  return (
    <div className="net-overlay"><div className="net-modal max-w-2xl"><header className="net-modal-header"><div><p className="net-eyebrow">{isOpportunity ? item.type : item.kind}</p><h3 className="font-bold mt-1">{isOpportunity ? item.title : item.name}</h3></div><button type="button" className="net-icon" title="Cerrar" onClick={onClose}><X size={16}/></button></header><div className="p-5 md:p-7"><div className="flex items-center gap-3"><IdentityMark item={item} large/><div><strong className="block text-base">{isOpportunity ? item.organization : item.headline}</strong><span className="flex items-center gap-1 text-[10px] text-[#8b9099] mt-1"><MapPin size={11}/>{item.location || 'Empyria'}</span></div></div><p className="text-sm leading-6 text-[#626770] mt-6">{isOpportunity ? item.summary : item.description}</p><div className="flex flex-wrap gap-2 mt-6 pt-5 border-t border-[#e5e7eb]">{(isOpportunity ? item.areas : item.tags).map(tag => <span key={tag} className="h-7 px-2.5 rounded bg-[#f1f3f6] text-[9px] font-bold text-[#686d75] flex items-center">{tag}</span>)}</div>{!isOpportunity && item.linkedEditorial && onOpenEditorial && <button type="button" onClick={() => { onClose(); onOpenEditorial(item.linkedEditorial.slug || item.linkedEditorial.name); }} className="net-button-secondary mt-6"><Newspaper size={13}/>Ver {item.linkedEditorial.name}</button>}{item.contact && <div className="mt-6 px-4 py-3 border-l-2 border-[#2563eb] bg-[#f4f7fd]"><span className="net-label">Contacto aprobado</span><strong className="text-sm">{item.contact}</strong></div>}{!isOpportunity && <div className="mt-7"><CreditsPanel subjectType="business" subjectId={item.id}/><ConversationPanel subjectType="business" subjectId={item.id}/></div>}</div></div></div>
  );
}

export default function NetworkPreview({ previewMode = false, onOpenStudio, onOpenEditorial }) {
  const [previewStudio, setPreviewStudio] = useState(false);
  const [view, setView] = useState('discover');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState(null);
  const [profiles, setProfiles] = useState(previewMode ? NETWORK_PROFILES : []);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState('');

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: requestError } = await supabase.from('network_businesses').select('*, editorial:editoriales(id,slug,nombre,verificada)').eq('estado', 'aprobado').order('promocionada', { ascending: false }).order('updated_at', { ascending: false });
      if (!active) return;
      if (requestError) {
        setError(requestError.message || 'No se pudo abrir Network.');
        setProfiles([]);
      } else {
        setError('');
        setProfiles((data || []).map(mapBusiness));
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [previewMode]);

  const opportunities = previewMode ? NETWORK_OPPORTUNITIES : profiles.filter(profile => profile.isRecruiting).map(mapOpportunity);
  const partners = profiles.filter(profile => profile.promoted);
  const visibleProfiles = useMemo(() => profiles.filter(profile => {
    const haystack = `${profile.name} ${profile.kind} ${profile.headline} ${profile.description} ${profile.tags.join(' ')}`.toLowerCase();
    return (category === 'Todos' || profile.category === category) && haystack.includes(search.trim().toLowerCase());
  }), [category, profiles, search]);

  const openStudio = () => {
    if (onOpenStudio) onOpenStudio();
    else if (previewMode) setPreviewStudio(true);
  };

  if (previewStudio) return <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] py-10 px-5"><style>{NETWORK_STYLES}</style><div className="max-w-6xl mx-auto"><button type="button" onClick={() => setPreviewStudio(false)} className="net-button-secondary mb-7"><PenTool size={14}/>Volver a Network</button><NetworkBusinessStudio userId="preview-owner" previewMode/></div></div>;

  return (
    <div className="min-h-screen bg-[#f5f6f8] text-[#202328] pb-24 md:pb-16"><style>{NETWORK_STYLES}</style>
      <header className="bg-white border-b border-[#dfe2e8]"><div className="max-w-[1440px] mx-auto min-h-20 px-4 md:px-8 flex items-center gap-3"><div className="w-10 h-10 bg-[#17191d] rounded-md text-white flex items-center justify-center"><Globe2 size={19}/></div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-lg font-bold tracking-tight">VISTA Network</h1><BetaBadge/></div><p className="text-[10px] text-[#8b9099] mt-0.5 truncate">Negocios, proyectos y oportunidades de Empyria</p></div><button type="button" className="net-button-secondary ml-auto" onClick={openStudio}><PenTool size={14}/><span className="hidden sm:inline">Administrar en</span> Studio</button></div></header>
      <PartnerHero partners={partners} onOpen={setSelected} onOpenStudio={openStudio}/>
      <nav className="bg-white border-b border-[#dfe2e8] sticky top-0 z-30"><div className="max-w-[1440px] mx-auto px-4 md:px-8 flex items-center"><button type="button" onClick={() => setView('discover')} className={`net-tab ${view === 'discover' ? 'net-tab-active' : ''}`}><Compass size={14}/>Descubrir</button><button type="button" onClick={() => setView('opportunities')} className={`net-tab ${view === 'opportunities' ? 'net-tab-active' : ''}`}><Briefcase size={14}/>Oportunidades</button><span className="ml-auto hidden md:inline-flex items-center gap-1.5 text-[9px] text-[#8d929b]"><MapPin size={12}/>Disponible solo en Empyria</span></div></nav>

      {view === 'discover' && <main className="max-w-[1440px] mx-auto px-4 md:px-8 py-8"><div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-6"><div><p className="net-eyebrow">Directorio curado</p><h2 className="text-2xl font-bold mt-1">Descubre Empyria</h2><p className="text-xs text-[#7f848d] mt-2">Perfiles y proyectos revisados por VISTA.</p></div><label className="relative lg:ml-auto lg:w-80"><Search size={14} className="absolute left-3 top-3.5 text-[#9ba0a8]"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar en Network" className="net-input pl-9"/></label></div><div className="flex gap-2 overflow-x-auto pb-4">{NETWORK_CATEGORIES.map(item => <button key={item} type="button" onClick={() => setCategory(item)} className={`h-8 px-3 rounded text-[9px] font-black whitespace-nowrap border ${category === item ? 'bg-[#17191d] border-[#17191d] text-white' : 'bg-white border-[#dfe2e8] text-[#6c717a]'}`}>{item}</button>)}</div>{loading ? <div className="py-20 text-center text-xs font-bold uppercase tracking-widest text-[#8b9099]">Abriendo Network...</div> : error ? <div className="py-12 border border-red-200 bg-red-50 rounded-md text-center text-sm text-red-700">{error}</div> : visibleProfiles.length > 0 ? <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">{visibleProfiles.map(profile => <ProfileCard key={profile.id} profile={profile} onOpen={setSelected}/>)}</div> : <div className="py-16 border-y border-[#dfe2e8] text-center"><Compass size={22} className="mx-auto text-[#a1a6ae]"/><p className="text-sm font-bold mt-3">Network esta abriendo sus puertas</p><p className="text-[10px] text-[#90959d] mt-1">Los primeros perfiles aprobados de Empyria apareceran aqui.</p><button type="button" className="net-button mt-5" onClick={openStudio}><PenTool size={14}/>Solicitar cuenta</button></div>}</main>}

      {view === 'opportunities' && <main className="max-w-[1080px] mx-auto px-4 md:px-8 py-8"><div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6"><div><p className="net-eyebrow">Convocatorias activas</p><h2 className="text-2xl font-bold mt-1">Encuentra donde participar</h2><p className="text-xs text-[#7f848d] mt-2">Equipos y proyectos de Empyria que buscan nuevas personas.</p></div><button type="button" className="net-button-secondary sm:ml-auto" onClick={openStudio}><PenTool size={14}/>Administrar perfil</button></div>{opportunities.length > 0 ? <section className="bg-white border border-[#dfe2e8] rounded-md overflow-hidden">{opportunities.map(opportunity => <OpportunityRow key={opportunity.id} opportunity={opportunity} onOpen={setSelected}/>)}</section> : <div className="py-16 border-y border-[#dfe2e8] text-center"><UsersRound size={22} className="mx-auto text-[#a1a6ae]"/><p className="text-sm font-bold mt-3">No hay convocatorias activas</p><p className="text-[10px] text-[#90959d] mt-1">Los negocios aprobados pueden anunciar que buscan colaboradores desde Studio.</p></div>}<div className="mt-6 py-5 border-t border-[#dfe2e8] flex flex-col sm:flex-row sm:items-center gap-3 text-[10px] text-[#858a93]"><span className="flex items-center gap-2"><ShieldCheck size={14} className="text-[#2563eb]"/>Los perfiles pasan por revision de VISTA.</span><span className="sm:ml-auto flex items-center gap-2"><UsersRound size={14}/>Beta limitada a la comunidad de Empyria.</span></div></main>}
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} onOpenEditorial={onOpenEditorial}/>}
    </div>
  );
}
