export const VIDEO_CATEGORIES = ['Película', 'Pelicula', 'PELÍCULA', 'PELICULA', 'Serie', 'SERIE', 'Original', 'ORIGINAL'];

export const isVideoContent = (item) => {
  if (!item?.categoria) return false;
  return VIDEO_CATEGORIES.includes(item.categoria);
};
