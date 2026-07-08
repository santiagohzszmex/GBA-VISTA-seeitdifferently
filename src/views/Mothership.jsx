import React, { useState } from 'react';
import { Monitor, Film, Newspaper, ShieldCheck, Cpu, Megaphone } from 'lucide-react';

// Importamos los submódulos subiendo un nivel en la estructura de carpetas (../)
import VideosTab from '../mothership/VideosTab';
import NoticiasTab from '../mothership/NoticiasTab';
import AduanaTab from '../mothership/AduanaTab';
import GBAForgeTab from '../mothership/GBAForgeTab'; // <-- Importación del Laboratorio
import CampaniasTab from '../mothership/CampaniasTab';

export default function Mothership() {
  const [activeSection, setActiveSection] = useState('videos');

  // El enrutador interno del panel
  const renderSection = () => {
    switch (activeSection) {
      case 'videos':
        return <VideosTab />;
      case 'news':
        return <NoticiasTab />;
      case 'aduana':
        return <AduanaTab />;
      case 'forge': // <-- Ruta para GBA Forge
        return <GBAForgeTab />;
      case 'campanias':
        return <CampaniasTab />;
      default:
        return <VideosTab />;
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0a0a0a] text-white pt-12 px-6 md:px-12 pb-24 selection:bg-red-500 selection:text-white font-sans">
      
      {/* HEADER & CONTROLES */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 mb-12 border-b border-white/10 pb-8">
        
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.3)] border border-red-500">
            <Monitor className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-serif italic tracking-tighter text-white">
              Mothership Command.
            </h1>
            <p className="text-red-500 font-bold tracking-[0.2em] text-[10px] uppercase mt-2">
              Panel de Control Global • Acceso Clasificado
            </p>
          </div>
        </div>

        {/* NAVEGACIÓN INTERNA */}
        <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md w-full xl:w-auto overflow-x-auto scrollbar-none">
          <button 
            onClick={() => setActiveSection('videos')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'videos' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Film size={16} /> GIMG Videos
          </button>
          
          <button 
            onClick={() => setActiveSection('news')}
            className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSection === 'news' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'
            }`}
          >
            <Newspaper size={16} /> GIMG Noticias
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
