export const REFERENCE_KINDS = { concept: 'Concepto', creative_direction: 'Dirección creativa', moodboard: 'Moodboard', instructions: 'Instrucciones de trabajo' };
export const ORIGINAL_LIMIT = 25 * 1024 * 1024;
export const STORAGE_LIMIT = 10_000_000_000;
export function referencePermission(kind) { return kind === 'instructions' ? 'reference.manage_instructions' : 'reference.manage_creative'; }
export function canManageReference(kind, areaId, permissions, areaPermissions = {}) { return Boolean((areaId ? areaPermissions[areaId] : permissions)?.[referencePermission(kind)]); }
export function parsePalette(value) { return [...new Set(String(value || '').split(/[\s,;]+/).filter(Boolean).map(color => color.toUpperCase()))]; }
export function validatePalette(colors) { return Array.isArray(colors) && colors.length <= 24 && colors.every(color => /^#[\da-f]{6}$/i.test(color)); }
export function fileSize(bytes) { return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.ceil(bytes / 1000)} KB`; }
export function originalMime(file) { return file.type || ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',tif:'image/tiff',tiff:'image/tiff',avif:'image/avif',heic:'image/heic',heif:'image/heif',pdf:'application/pdf'})[file.name?.split('.').pop().toLowerCase()] || ''; }
export function validateOriginal(file, kind) {
  if (!file || file.size < 1 || file.size > ORIGINAL_LIMIT) throw Error('El archivo debe pesar entre 1 byte y 25 MB.');
  const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/avif', 'image/heic', 'image/heif'];
  if (originalMime(file) === 'application/pdf' && kind !== 'moodboard') throw Error('El PDF sólo está disponible para moodboards.');
  if (!types.includes(originalMime(file)) && !(kind === 'moodboard' && originalMime(file) === 'application/pdf')) throw Error('Selecciona una imagen original; los moodboards también admiten PDF.');
}
