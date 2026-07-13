export const EDITORIAL_CATEGORIES = [
  { value: 'comunidad', label: 'Comunidad' },
  { value: 'politica', label: 'Política' },
  { value: 'economia', label: 'Economía' },
  { value: 'internacional', label: 'Internacional' },
  { value: 'cultura', label: 'Cultura' },
  { value: 'sociedad', label: 'Sociedad' },
  { value: 'opinion', label: 'Opinión' },
  { value: 'historia', label: 'Historia' },
  { value: 'ciencia_tecnologia', label: 'Ciencia y tecnología' },
  { value: 'deportes', label: 'Deportes' }
];

export const getEditorialCategoryLabel = (value) => (
  EDITORIAL_CATEGORIES.find(category => category.value === value)?.label || 'Comunidad'
);
