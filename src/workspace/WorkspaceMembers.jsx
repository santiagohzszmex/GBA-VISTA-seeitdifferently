import React, { useState } from 'react';
import {
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react';
import { ROLE_LABELS, ROLE_OPTIONS } from './workspaceData';

export default function WorkspaceMembers({ access, members, collections, onAddMember, onSetMemberRole, onRemoveMember, onUpdateCollection }) {
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('reader');
  const [saving, setSaving] = useState(false);

  const addMember = async event => {
    event.preventDefault();
    setSaving(true);
    const saved = await onAddMember(handle, role);
    setSaving(false);
    if (saved) {
      setHandle('');
      setRole('reader');
    }
  };

  return (
    <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] border border-[#d9dce3] bg-white rounded-md overflow-hidden min-h-[calc(100vh-156px)]">
      <section className="min-w-0 border-b xl:border-b-0 xl:border-r border-[#e2e4e9]">
        <header className="min-h-16 px-5 md:px-6 border-b border-[#e2e4e9] flex items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099]">Directorio interno</p><h2 className="text-lg font-bold">Miembros de Workspace</h2></div><div className="flex items-center gap-2 text-[10px] text-[#8b9099]"><Users size={15}/>{members.filter(member => member.status === 'active').length} activos</div></header>
        <div className="divide-y divide-[#eceef2]">
          {members.map(member => {
            const initials = (member.display_name || member.handle || 'GB').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={member.id || member.user_id} className="grid md:grid-cols-[minmax(0,1fr)_180px_44px] gap-4 items-center p-4 md:px-6">
                <div className="flex items-center gap-3 min-w-0"><div className="w-10 h-10 rounded-md bg-[#eef2f8] border border-[#dfe3ea] text-[#2563eb] flex items-center justify-center text-xs font-black flex-shrink-0">{initials}</div><div className="min-w-0"><p className="text-sm font-bold truncate">{member.display_name}</p><div className="flex items-center gap-2 mt-1 text-[9px] text-[#8b9099]"><span>@{member.handle}</span><span>·</span><span>{member.platform_role || 'GBA ID'}</span>{member.status !== 'active' && <span className="text-red-500 font-bold">Suspendido</span>}</div></div></div>
                {access.can_manage && member.id ? <select value={member.workspace_role} onChange={event => onSetMemberRole(member.id, event.target.value)} className="ws-input" disabled={member.workspace_role === 'owner' && access.role !== 'owner'}>{ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <span className="text-xs font-bold text-[#6f747d]">{ROLE_LABELS[member.workspace_role]}</span>}
                {access.can_manage && member.id && member.workspace_role !== 'owner' ? <button type="button" className="ws-icon hover:text-red-600" title="Suspender acceso" onClick={() => onRemoveMember(member.id)}><Trash2 size={15}/></button> : <span/>}
              </div>
            );
          })}
          {!members.length && <div className="py-16 text-center"><Users size={24} className="mx-auto text-[#c5c8ce]"/><p className="text-xs font-bold mt-3 text-[#6f747d]">No hay miembros registrados</p></div>}
        </div>
      </section>

      <aside className="bg-[#fafbfc]">
        {access.can_manage ? (
          <form onSubmit={addMember} className="p-5 border-b border-[#e2e4e9] space-y-4">
            <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-md bg-[#eaf1ff] text-[#2563eb] flex items-center justify-center"><UserPlus size={17}/></div><div><p className="text-[9px] font-black uppercase tracking-widest text-[#8b9099]">Invitación interna</p><h3 className="text-sm font-bold">Añadir mediante GBA ID</h3></div></div>
            <label><span className="ws-label">GBA ID</span><input required value={handle} onChange={event => setHandle(event.target.value)} className="ws-input" placeholder="@nombre"/></label>
            <label><span className="ws-label">Rol inicial</span><select value={role} onChange={event => setRole(event.target.value)} className="ws-input">{ROLE_OPTIONS.filter(option => option.value !== 'owner' || access.role === 'owner').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <button type="submit" className="ws-primary w-full" disabled={saving}><UserPlus size={14}/>{saving ? 'Añadiendo' : 'Añadir a Workspace'}</button>
          </form>
        ) : (
          <div className="p-6 border-b border-[#e2e4e9]"><ShieldCheck size={20} className="text-[#2563eb]"/><h3 className="text-sm font-bold mt-3">Directorio protegido</h3><p className="text-[10px] leading-4 text-[#8b9099] mt-2">Puedes consultar quién participa. Solo administradores gestionan accesos.</p></div>
        )}

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4"><LockKeyhole size={15} className="text-[#6f747d]"/><p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8b9099]">Seguridad de colecciones</p></div>
          <div className="divide-y divide-[#e2e4e9] border-y border-[#e2e4e9]">
            {collections.map(collection => <div key={collection.id} className="py-4"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: collection.color }}/><span className="text-xs font-bold flex-1">{collection.name}</span></div><label className="block mt-3"><span className="ws-label">Acceso mínimo</span>{access.can_manage ? <select value={collection.minimum_role} onChange={event => onUpdateCollection(collection, event.target.value)} className="ws-input">{ROLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <div className="flex items-center gap-2 text-[10px] text-[#6f747d]"><KeyRound size={12}/>{ROLE_LABELS[collection.minimum_role]}</div>}</label></div>)}
          </div>
          <p className="text-[9px] leading-4 text-[#9a9ea6] mt-4">El rango público de VISTA no concede acceso automáticamente. Los permisos pertenecen a Workspace.</p>
        </div>
      </aside>
    </div>
  );
}
