export const VISTA_PUBLIC_ORIGIN = 'https://vista.gba.software';

export function getVistaPublicOrigin() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    return window.location.origin;
  }

  return VISTA_PUBLIC_ORIGIN;
}

export function buildVistaPublicUrl(path = '/') {
  return new URL(path, `${getVistaPublicOrigin()}/`).toString();
}
