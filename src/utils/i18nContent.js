// Nombres cortos a mostrar en los selectores de idioma.
// Cualquier idioma que no esté aquí simplemente se muestra en mayúsculas (ej. "PT").
export const LANG_LABELS = {
  es: 'ES',
  en: 'EN',
  nah: 'NAH',
  fr: 'FR',
  pt: 'PT',
  de: 'DE',
  it: 'IT',
};
 
export function langLabel(lang) {
  return LANG_LABELS[lang] || (lang || '').toUpperCase();
}
 
// Idiomas disponibles para una noticia, en el orden en que fueron guardados.
// Si el contenido todavía no fue migrado a i18n, asumimos español.
export function getAvailableLangs(item) {
  const keys = item?.titulo_i18n ? Object.keys(item.titulo_i18n) : [];
  return keys.length > 0 ? keys : ['es'];
}
 
// Detecta el idioma preferido del navegador, SOLO si esa noticia lo tiene disponible.
export function detectBrowserLang(availableLangs) {
  if (typeof navigator === 'undefined') return null;
  const candidates = navigator.languages && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];
 
  for (const c of candidates) {
    if (!c) continue;
    const short = c.split('-')[0].toLowerCase();
    if (availableLangs.includes(short)) return short;
  }
  return null;
}
 
// Idioma con el que se debe abrir la noticia por defecto:
// 1) el del navegador si esa noticia lo tiene, 2) el idioma original de la
// publicación, 3) el primer idioma disponible.
export function getDefaultLang(item) {
  const availableLangs = getAvailableLangs(item);
  return detectBrowserLang(availableLangs) || item?.idioma_original || availableLangs[0];
}
 
// Páginas del documento en un idioma, con fallback al formato viejo
// (enlace_pdf como string JSON) para contenido aún no migrado.
export function resolvePaginas(item, lang) {
  if (item?.paginas_i18n) {
    const hasRequestedLanguage = Object.prototype.hasOwnProperty.call(item.paginas_i18n, lang);
    const fallbackLang = getAvailableLangs(item)[0];
    const hasFallbackLanguage = Object.prototype.hasOwnProperty.call(item.paginas_i18n, fallbackLang);
    const arr = hasRequestedLanguage
      ? item.paginas_i18n[lang]
      : (hasFallbackLanguage ? item.paginas_i18n[fallbackLang] : null);
    if (Array.isArray(arr)) return arr;
  }
 
  if (item?.enlace_pdf) {
    try {
      const parsed = JSON.parse(item.enlace_pdf);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignoramos, caemos al fallback de abajo
    }
  }
 
  return [item?.poster_url || item?.banner_url].filter(Boolean);
}
 
// Resuelve todo el contenido visible (título, descripción, portada, páginas)
// para un idioma dado, con fallback a los campos viejos si la noticia no
// tiene aún datos i18n.
export function resolveContent(item, lang) {
  if (!item) {
    return { lang: 'es', titulo: '', descripcion: '', poster: null, paginas: [] };
  }
 
  const availableLangs = getAvailableLangs(item);
  const effectiveLang = availableLangs.includes(lang) ? lang : (item.idioma_original || availableLangs[0]);
 
  return {
    lang: effectiveLang,
    titulo: item.titulo_i18n?.[effectiveLang] ?? item.titulo ?? '',
    descripcion: item.descripcion_i18n?.[effectiveLang] ?? item.descripcion ?? '',
    poster: item.poster_i18n?.[effectiveLang] ?? item.poster_url ?? item.banner_url,
    paginas: resolvePaginas(item, effectiveLang),
  };
}
