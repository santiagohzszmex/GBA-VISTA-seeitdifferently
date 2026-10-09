import React, { useState } from 'react';
import { Monitor, Film, Newspaper, ShieldCheck, Cpu, Megaphone, Terminal, Server, BrainCircuit, Mail, Users, Globe2 } from 'lucide-react';

// Importamos los submódulos subiendo un nivel en la estructura de carpetas (../)
import VideosTab from '../mothership/VideosTab';
import NoticiasTab from '../mothership/NoticiasTab';
import AduanaTab from '../mothership/AduanaTab';
import GBAForgeTab from '../mothership/GBAForgeTab'; // <-- Importación del Laboratorio
import CampaniasTab from '../mothership/CampaniasTab';
import InfrastructureTab from '../mothership/InfrastructureTab';
import AnimaTab from '../mothership/AnimaTab';
import CommunicationsTab from '../mothership/CommunicationsTab';
import AudienceTab from '../mothership/AudienceTab';
import SurveysTab from '../mothership/SurveysTab';
import NetworkAdminTab from '../mothership/NetworkAdminTab';

export default function Mothership({ previewMode = false }) {
  const [activeSection, setActiveSection] = useState(previewMode && new URLSearchParams(window.location.search).get('survey-preview') === '1' ? 'surveys' : 'videos');
  const [forgeArea, setForgeArea] = useState('development');

  // El enrutador interno del panel
  const renderSection = () => {
    switch (activeSection) {
      case 'videos':
        return <VideosTab previewMode={previewMode} />;
      case 'news':
        return <NoticiasTab previewMode={previewMode} />;
      case 'aduana':
        return <AduanaTab />;
      case 'forge': // <-- Ruta para GBA Forge
        return (
          <div>
            <div className="flex items-center gap-1 border-b border-white/10 mb-9 overflow-x-auto" role="tablist" aria-label="Áreas de GBA Forge">
              <button type="button" role="tab" aria-selected={forgeArea === 'development'} onClick={() => setForgeArea('development')} className={`h-11 px-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap ${forgeArea === 'development' ? 'border-[#0066FF] text-white' : 'border-transparent text-neutral-600 hover:text-neutral-300'}`}><Terminal size={14}/>Development</button>
              <button type="button" role="tab" aria-selected={forgeArea === 'infrastructure'} onClick={() => setForgeArea('infrastructure')} className={`h-11 px-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap ${forgeArea === 'infrastructure' ? 'border-[#0066FF] text-white' : 'border-transparent text-neutral-600 hover:text-neutral-300'}`}><Server size={14}/>Infrastructure</button>
            </div>
            {forgeArea === 'infrastructure' ? <InfrastructureTab /> : <GBAForgeTab />}
          </div>
        );
      case 'campanias':
        return <CampaniasTab />;
      case 'anima':
        return <AnimaTab />;
      case 'communications':
        return <CommunicationsTab />;
      case 'network':
        return <NetworkAdminTab previewMode={previewMode} />;
      case 'recruitment':
        return <section className="max-w-3xl py-10"><p className="text-emerald-400 text-xs uppercase tracking-widest mb-5">GIMG · Convocatoria editorial</p><h2 className="text-4xl font-serif mb-6">El primer equipo de GIMG.</h2><p className="text-neutral-400 leading-relaxed mb-8">Las postulaciones se revisan en un panel independiente de GBA: estadísticas por área, evaluación privada, publicación de resultados y contacto de personas seleccionadas.</p><a href="https://gba.software/convocatoria/gimg/gestion/" target="_blank" rel="noopener noreferrer" className="inline-flex px-6 py-4 rounded-xl bg-emerald-400 text-black font-semibold text-sm">Abrir gestión de postulaciones ↗</a><p className="text-neutral-500 text-xs mt-6">Accede con tu GBA ID. Dirección puede incorporar evaluadores sin darles acceso a Mothership.</p></section>;
      case 'surveys':
        return <SurveysTab previewMode={previewMode} />;
      case 'audience':
        return <AudienceTab />;
      default:
        return <VideosTab previewMode={previewMode} />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white pt-12 px-6 md:px-12 pb-24 selection:bg-red-500 selection:text-white font-sans">
      
      {/* HEADER & CONTROLES */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12 border-b border-white/10 pb-8">
        
        <div className="flex items-center gap-4 md:gap-5 min-w-0">
          <div className="w-12 h-12 md:w-16 md:h-16 shrink-0 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)] border border-red-500">
            <Monitor className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl md:text-5xl font-serif italic tracking-tighter text-white">
              Mothership Command.
            </h1>
            <p className="text-red-500 font-bold tracking-[0.2em] text-[10px] uppercase mt-2">
              Panel de Control Global • Acceso Clasificado
            </p>
          </div>
        </div>

        {/* NAVEGACIÓN INTERNA */}
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md w-full xl:w-auto min-w-0 overflow-x-auto scrollbar-none">
          <button 
            onClick={() => setActiveSection('videos')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'videos' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Film size={16} /> Videos
          </button>
          
          <button 
            onClick={() => setActiveSection('news')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'news' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Newspaper size={16} /> Periódicos
          </button>

          <button
            onClick={() => setActiveSection('campanias')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'campanias' ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Megaphone size={16} /> Campañas
          </button>

          <button 
            onClick={() => setActiveSection('forge')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'forge' ? 'bg-[#0066FF] text-white shadow-lg shadow-[#0066FF]/20' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Cpu size={16} /> GBA Forge
          </button>

          <button
            onClick={() => setActiveSection('anima')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'anima' ? 'bg-cyan-300 text-black shadow-lg shadow-cyan-300/10' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <BrainCircuit size={16} /> ANIMA
          </button>

          <button
            onClick={() => setActiveSection('communications')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'communications' ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/10' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Mail size={16} /> Comunicaciones
          </button>

          <button
            onClick={() => setActiveSection('audience')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'audience' ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-400/10' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Users size={16} /> Audiencia
          </button>

          <button onClick={() => setActiveSection('recruitment')} className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${activeSection === 'recruitment' ? 'bg-emerald-400 text-black' : 'text-neutral-500 hover:text-white'}`}><Users size={16} /> Convocatoria GIMG</button>

          <button onClick={() => setActiveSection('surveys')} className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 whitespace-nowrap ${activeSection === 'surveys' ? 'bg-emerald-400 text-black' : 'text-neutral-500 hover:text-white'}`}><Users size={16} /> Encuestas</button>

          <button
            onClick={() => setActiveSection('network')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${activeSection === 'network' ? 'bg-emerald-400 text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
          >
            <Globe2 size={16} /> Network / Partners
          </button>

          <button 
            onClick={() => setActiveSection('aduana')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'aduana' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <ShieldCheck size={16} /> Aduana
          </button>
        </div>
        
      </div>

      {/* RENDERIZADO DEL SUBMÓDULO */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {renderSection()}
      </div>

    </div>
  );
}
