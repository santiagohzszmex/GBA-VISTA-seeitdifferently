import React from 'react';
import { FileUp, Settings2, ShieldCheck, Users } from 'lucide-react';

const ROLE_LABELS = {
  owner: 'Propietario',
  admin: 'Administrador',
  editor: 'Editor',
  collaborator: 'Colaborador',
  reviewer: 'Revisor'
};

const TABS = [
  { id: 'publish', label: 'Publicar', icon: FileUp },
  { id: 'profile', label: 'Perfil', icon: Settings2 },
  { id: 'team', label: 'Equipo', icon: Users }
];

export default function EditorialStudioHeader({ editorials, activeEditorial, activeSection, onSelectEditorial, onSelectSection }) {
  return (
    <header className="mb-8">
      <div className="flex flex-col lg:flex-row lg:items-end gap-5 justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[#0066FF] mb-3">
            <ShieldCheck size={18}/>
            <span className="text-[10px] font-bold tracking-widest uppercase">{ROLE_LABELS[activeEditorial?.role] || 'Equipo editorial'}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-serif italic tracking-tight text-[#1d1d1f]">VISTA Studio</h1>
          <p className="text-sm text-[#86868b] mt-2">Publica y administra como equipo usando tu GBA ID.</p>
        </div>
        <label className="w-full lg:w-80">
          <span className="block text-[9px] font-black uppercase tracking-widest text-[#86868b] mb-2">Editorial activa</span>
          <select value={activeEditorial?.id || ''} onChange={event => onSelectEditorial(event.target.value)} className="w-full h-12 bg-white border border-[#d2d2d7] rounded-md px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#0066FF]">
            {editorials.map(editorial => <option key={editorial.id} value={editorial.id}>{editorial.nombre} · {ROLE_LABELS[editorial.role]}</option>)}
          </select>
        </label>
      </div>
      <nav className="flex items-center gap-1 mt-7 border-b border-[#d2d2d7] overflow-x-auto" aria-label="Secciones de VISTA Studio">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return <button key={tab.id} type="button" onClick={() => onSelectSection(tab.id)} className={`h-11 px-4 flex items-center gap-2 text-xs font-bold border-b-2 whitespace-nowrap ${activeSection === tab.id ? 'border-[#0066FF] text-[#0066FF]' : 'border-transparent text-[#86868b] hover:text-[#1d1d1f]'}`}><Icon size={15}/>{tab.label}</button>;
        })}
      </nav>
    </header>
  );
}
