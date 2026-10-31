export function validateEditionCredits(value, {required = false} = {}) {
  if (!Array.isArray(value) || value.length > 80) throw new Error('Puedes registrar hasta 80 créditos por edición.');
  if (value.some(row => !row || typeof row !== 'object' || ['role','name','detail'].some(key=>row[key]!=null && typeof row[key]!=='string'))) throw new Error('Revisa los nombres y funciones de los créditos.');
  const credits = value.filter(row => row?.role?.trim() || row?.name?.trim() || row?.detail?.trim()).map(row => {
    const role = String(row.role || '').trim(), name = String(row.name || '').trim(), detail = String(row.detail || '').trim();
    if (!role || !name) throw new Error('Cada crédito necesita una función y un nombre.');
    if (role.length > 80 || name.length > 120 || detail.length > 240) throw new Error('Revisa la longitud de los créditos.');
    return {role, name, detail};
  });
  if (required && !credits.length) throw new Error('Añade al menos un crédito antes de publicar la edición.');
  if (new TextEncoder().encode(JSON.stringify(credits)).length > 28000) throw new Error('Los créditos exceden el espacio disponible. Reduce los detalles.');
  return credits;
}
