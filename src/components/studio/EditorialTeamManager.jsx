import React, { useCallback, useEffect, useState } from 'react';
import { Crown, MailPlus, RefreshCw, Shield, Trash2, UserRound, Users } from 'lucide-react';
import { supabase } from '../../supabaseClient';

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'editor', label: 'Editor' },
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'reviewer', label: 'Revisor' }
];

const ROLE_LABELS = { owner: 'Propietario', ...Object.fromEntries(ROLES.map(role => [role.value, role.label])) };

const PREVIEW_MEMBERS = [
  { member_id: 'preview-owner', usuario_id: 'preview-owner-user', handle: 'leandro', nombre_publico: 'Leandro', role: 'owner', status: 'active' },
  { member_id: 'preview-editor', usuario_id: 'preview-editor-user', handle: 'gustavito2001', nombre_publico: 'Gustavito', role: 'editor', status: 'active' },
  { member_id: 'preview-collaborator', usuario_id: 'preview-collab-user', handle: 'santi21j', nombre_publico: 'Santi21J', role: 'collaborator', status: 'active' },
  { member_id: null, invitation_id: 'preview-invite', usuario_id: 'preview-invited-user', handle: 'corresponsal', nombre_publico: 'Corresponsal', role: 'reviewer', status: 'invited' }
];

export default function EditorialTeamManager({ editorial, onEditorialRefresh, previewMode = false }) {
  const canManage = ['owner', 'admin'].includes(editorial.role);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('collaborator');
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    if (previewMode) {
      setMembers(PREVIEW_MEMBERS);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc('vista_editorial_member_directory', { p_editorial_id: editorial.id });
    if (error) setNotice({ type: 'error', message: error.message });
    else setMembers(data || []);
    setLoading(false);
  }, [editorial.id, previewMode]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const invite = async event => {
    event.preventDefault();
    if (!handle.trim() || processing) return;
    setProcessing(true);
    setNotice(null);
    if (previewMode) {
      setMembers(current => [...current, { member_id: null, invitation_id: `preview-${Date.now()}`, usuario_id: `preview-user-${Date.now()}`, handle: handle.replace(/^@/, ''), nombre_publico: handle.replace(/^@/, ''), role, status: 'invited' }]);
      setHandle('');
      setNotice({ type: 'success', message: 'Invitación simulada.' });
      setProcessing(false);
      return;
    }
    const { error } = await supabase.rpc('vista_editorial_invite_member', {
      p_editorial_id: editorial.id,
      p_handle: handle,
      p_role: role
    });
    if (error) setNotice({ type: 'error', message: error.message });
    else {
      setHandle('');
      setNotice({ type: 'success', message: 'Invitación enviada al GBA ID.' });
      await loadMembers();
    }
    setProcessing(false);
  };

  const changeRole = async (member, nextRole) => {
    setNotice(null);
    if (previewMode) {
      setMembers(current => current.map(item => item.member_id === member.member_id ? { ...item, role: nextRole } : item));
      return;
    }
    const { error } = await supabase.rpc('vista_editorial_set_member_role', {
      p_editorial_id: editorial.id,
      p_member_id: member.member_id,
      p_role: nextRole
    });
    if (error) setNotice({ type: 'error', message: error.message });
    else await loadMembers();
  };

  const remove = async member => {
    const label = member.status === 'invited' ? 'revocar esta invitación' : `retirar a @${member.handle} del equipo`;
    if (!window.confirm(`¿Quieres ${label}?`)) return;
    if (previewMode) {
      setMembers(current => current.filter(item => (member.invitation_id ? item.invitation_id !== member.invitation_id : item.member_id !== member.member_id)));
      return;
    }
    const rpc = member.status === 'invited' ? 'vista_editorial_revoke_invitation' : 'vista_editorial_remove_member';
    const params = member.status === 'invited'
      ? { p_editorial_id: editorial.id, p_invitation_id: member.invitation_id }
      : { p_editorial_id: editorial.id, p_member_id: member.member_id };
    const { error } = await supabase.rpc(rpc, params);
    if (error) setNotice({ type: 'error', message: error.message });
    else await loadMembers();
  };

  const transferOwnership = async member => {
    if (!window.confirm(`¿Transferir la propiedad de ${editorial.nombre} a @${member.handle}? Tú pasarás a ser administrador.`)) return;
    if (previewMode) {
      setMembers(current => current.map(item => item.role === 'owner' ? { ...item, role: 'admin' } : item.member_id === member.member_id ? { ...item, role: 'owner' } : item));
      setNotice({ type: 'success', message: 'Propiedad transferida en la demostración.' });
      return;
    }
    const { error } = await supabase.rpc('vista_editorial_transfer_ownership', {
      p_editorial_id: editorial.id,
      p_member_id: member.member_id
    });
    if (error) setNotice({ type: 'error', message: error.message });
    else {
      setNotice({ type: 'success', message: 'Propiedad transferida.' });
      await Promise.all([loadMembers(), onEditorialRefresh?.()]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <section className="flex flex-col md:flex-row md:items-center gap-4 justify-between border-b border-[#d2d2d7] pb-6">
        <div><div className="flex items-center gap-2"><Users size={18}/><h2 className="text-xl font-bold">Equipo editorial</h2></div><p className="text-xs text-[#86868b] mt-2">Cada integrante accede con su propio GBA ID.</p></div>
        <button type="button" onClick={loadMembers} className="w-10 h-10 rounded-md border border-[#d2d2d7] flex items-center justify-center text-[#86868b] hover:text-[#1d1d1f]" title="Actualizar equipo"><RefreshCw size={15}/></button>
      </section>

      {notice && <div className={`border rounded-md px-4 py-3 text-xs font-bold ${notice.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.message}</div>}

      {canManage && <form onSubmit={invite} className="grid md:grid-cols-[1fr_220px_auto] gap-3 items-end border border-[#d2d2d7] rounded-md p-5 bg-white">
        <label><span className="studio-label">Invitar GBA ID</span><input required value={handle} onChange={event => setHandle(event.target.value)} className="studio-input" placeholder="@usuario"/></label>
        <label><span className="studio-label">Rol inicial</span><select value={role} onChange={event => setRole(event.target.value)} className="studio-input">{ROLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <button type="submit" disabled={processing} className="h-11 px-4 rounded-md bg-[#0066FF] text-white flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-50"><MailPlus size={15}/>{processing ? 'Enviando' : 'Invitar'}</button>
      </form>}

      <section className="divide-y divide-[#e5e5e7] border-y border-[#d2d2d7]">
        {loading ? <div className="py-14 text-center text-xs font-bold text-[#86868b]">Cargando equipo...</div> : members.map(member => {
          const isOwner = member.role === 'owner';
          const pending = member.status === 'invited';
          return <div key={member.member_id || member.invitation_id} className="min-h-20 py-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${isOwner ? 'bg-amber-50 text-amber-600' : 'bg-[#f5f5f7] text-[#5f6368]'}`}>{isOwner ? <Crown size={18}/> : <UserRound size={18}/>}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate">{member.nombre_publico}</p><p className="text-[10px] text-[#86868b] truncate">@{member.handle}{pending ? ' · Invitación pendiente' : ''}</p></div>
            {canManage && !isOwner && !pending ? <select value={member.role} onChange={event => changeRole(member, event.target.value)} className="h-10 max-w-40 border border-[#d2d2d7] rounded-md px-2 text-xs font-bold bg-white">{ROLES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <span className="text-[10px] font-black uppercase tracking-wider text-[#86868b]">{pending ? `Invitado · ${ROLE_LABELS[member.role]}` : ROLE_LABELS[member.role]}</span>}
            {editorial.role === 'owner' && !isOwner && !pending && <button type="button" onClick={() => transferOwnership(member)} className="w-10 h-10 rounded-md flex items-center justify-center text-[#86868b] hover:bg-amber-50 hover:text-amber-600" title="Transferir propiedad"><Crown size={15}/></button>}
            {canManage && !isOwner && <button type="button" onClick={() => remove(member)} className="w-10 h-10 rounded-md flex items-center justify-center text-[#86868b] hover:bg-red-50 hover:text-red-600" title={pending ? 'Revocar invitación' : 'Retirar del equipo'}><Trash2 size={15}/></button>}
          </div>;
        })}
        {!loading && !members.length && <div className="py-14 text-center"><Shield size={24} className="mx-auto text-[#c7c7cc]"/><p className="text-xs font-bold text-[#86868b] mt-3">No hay integrantes registrados.</p></div>}
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px bg-[#d2d2d7] border border-[#d2d2d7] rounded-md overflow-hidden">
        {[
          ['Propietario', 'Control total y transferencia'],
          ['Administrador', 'Perfil, equipo y publicaciones'],
          ['Editor', 'Revisa, edita y publica'],
          ['Colaborador', 'Carga contenido propio'],
          ['Revisor', 'Consulta borradores']
        ].map(([title, description]) => <div key={title} className="bg-white p-4"><p className="text-xs font-bold">{title}</p><p className="text-[9px] text-[#86868b] mt-1 leading-relaxed">{description}</p></div>)}
      </div>
    </div>
  );
}
