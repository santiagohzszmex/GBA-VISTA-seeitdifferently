export const VIDEO_CATEGORY_OPTIONS = [
  ['General', 'General'], ['Tutorial', 'Tutoriales'], ['Guía', 'Guías'],
  ['Gameplay', 'Gameplay'], ['Evento', 'Eventos'], ['Entrevista', 'Entrevistas'],
  ['Actualidad', 'Actualidad'], ['Documental', 'Documentales'],
  ['Película', 'Películas'], ['Serie', 'Series'], ['Original', 'Originales'],
];

// Keep existing categories discoverable while new videos use the editor options.
export const VIDEO_CATEGORIES = [...new Set([
  ...VIDEO_CATEGORY_OPTIONS.flatMap(([value]) => [value, value.toUpperCase()]),
  'Pelicula', 'PELICULA', 'Video', 'VIDEO', 'Guia', 'GUIA',
])];
export const isVideoContent = item => VIDEO_CATEGORIES.includes(item?.categoria);
export const videoCategoryLabel = category => VIDEO_CATEGORY_OPTIONS.find(([value]) => value === category)?.[1] || category;
