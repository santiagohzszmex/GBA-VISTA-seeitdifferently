export const APPEARANCE_KEY = 'vista:appearance';
export const normalizeAppearance = value => ['light', 'dark', 'system'].includes(value) ? value : 'light';

export function readAppearance() {
  try { return normalizeAppearance(window.localStorage.getItem(APPEARANCE_KEY)); }
  catch { return 'light'; }
}

export function applyAppearance(preference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.vistaTheme = dark ? 'dark' : 'light';
}
