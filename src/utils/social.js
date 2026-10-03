export function creditPayload(draft) {
  if (draft.length > 30) throw new Error('Puedes añadir hasta 30 créditos.');
  const seen = new Set();
  return draft.map((credit, index) => {
    const role = (credit.role || '').trim();
    const handle = (credit.handle || '').trim();
    const display_name = (credit.display_name || '').trim();
    if (role.length < 2 || role.length > 60) throw new Error(`Crédito ${index + 1}: escribe un rol de 2 a 60 caracteres.`);
    if (display_name.length < 2 || display_name.length > 80) throw new Error(`Crédito ${index + 1}: escribe un nombre de 2 a 80 caracteres.`);
    if (handle && !credit.verified) throw new Error(`Crédito ${index + 1}: selecciona la cuenta en la búsqueda de GBA ID.`);
    const key = `${(credit.contributor_id || handle.replace(/^@/, '') || display_name).toLowerCase()}|${role.toLowerCase()}`;
    if (seen.has(key)) throw new Error('No repitas una persona con el mismo rol.');
    seen.add(key);
    return { ...(credit.id ? { id: credit.id } : {}), role, handle, display_name, external: !handle && !credit.contributor_id };
  });
}

export const creditStatusLabel = credit => !credit.contributor_id ? 'Nombre externo' : ({ accepted: 'Participación confirmada', pending: 'Pendiente de confirmación', declined: 'Invitación rechazada' }[credit.status] || 'Se enviará una invitación');

export const contentLink = id => `/?content=${encodeURIComponent(id)}`;

export function notificationLink(notification) {
  if (notification.target_type === 'content' && notification.target_id) return contentLink(notification.target_id);
  if (notification.contenido_id) return contentLink(notification.contenido_id);
  if (notification.target_type === 'update' && notification.target_id) return `/?update=${encodeURIComponent(notification.target_id)}`;
  const url = notification.action_url;
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
}
