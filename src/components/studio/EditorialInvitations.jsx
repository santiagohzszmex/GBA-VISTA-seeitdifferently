import React, { useState } from 'react';
import { Check, Mail, X } from 'lucide-react';

const ROLE_LABELS = {
  admin: 'Administrador',
  editor: 'Editor',
  collaborator: 'Colaborador',
  reviewer: 'Revisor'
};

export default function EditorialInvitations({ invitations = [], onRespond }) {
  const [processing, setProcessing] = useState(null);
  const [error, setError] = useState('');

  if (!invitations.length) return null;

  const respond = async (invitationId, accept) => {
    setProcessing(invitationId);
    setError('');
    try {
      await onRespond(invitationId, accept);
    } catch (responseError) {
      setError(responseError.message || 'No se pudo responder la invitación.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <section className="border-y border-blue-100 bg-blue-50/70">
      <div className="max-w-5xl mx-auto px-6 md:px-10 py-5">
        <div className="flex items-center gap-2 text-blue-700 mb-3">
          <Mail size={16}/>
          <h2 className="text-xs font-black uppercase tracking-widest">Invitaciones editoriales</h2>
        </div>
        <div className="space-y-2">
          {invitations.map(invitation => (
            <div key={invitation.id} className="min-h-14 flex flex-wrap items-center gap-3 bg-white border border-blue-100 px-4 py-3 rounded-md">
              <div className="w-9 h-9 rounded-md bg-[#1d1d1f] text-white flex items-center justify-center text-xs font-black flex-shrink-0">
                {invitation.editorial_name?.slice(0, 2).toUpperCase() || 'ED'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{invitation.editorial_name}</p>
                <p className="text-[10px] text-[#86868b]">{invitation.invited_by_name} te invitó como {ROLE_LABELS[invitation.role] || invitation.role}.</p>
              </div>
              <button type="button" onClick={() => respond(invitation.id, false)} disabled={processing === invitation.id} className="w-9 h-9 border border-[#d2d2d7] rounded-md flex items-center justify-center text-[#86868b] hover:text-red-600 disabled:opacity-50" title="Rechazar"><X size={15}/></button>
              <button type="button" onClick={() => respond(invitation.id, true)} disabled={processing === invitation.id} className="h-9 px-4 bg-[#0066FF] text-white rounded-md flex items-center gap-2 text-xs font-bold disabled:opacity-50"><Check size={15}/>Aceptar</button>
            </div>
          ))}
        </div>
        {error && <p className="mt-3 text-xs font-bold text-red-600">{error}</p>}
      </div>
    </section>
  );
}
