import React, { createContext, useContext, useEffect, useState } from 'react';
import { APPEARANCE_KEY, normalizeAppearance, readAppearance, applyAppearance } from '../utils/appearance';

const AppearanceContext = createContext();

export function AppearanceProvider({ children }) {
  const [preference, setPreferenceState] = useState(readAppearance);
  const setPreference = value => {
    const next = normalizeAppearance(value);
    applyAppearance(next);
    setPreferenceState(next);
    try { window.localStorage.setItem(APPEARANCE_KEY, next); } catch { /* The current choice still works when storage is unavailable. */ }
  };
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystem = () => applyAppearance(preference);
    const updateStorage = event => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        const next = readAppearance();
        applyAppearance(next);
        setPreferenceState(next);
      }
    };
    updateSystem();
    media.addEventListener('change', updateSystem);
    window.addEventListener('storage', updateStorage);
    return () => { media.removeEventListener('change', updateSystem); window.removeEventListener('storage', updateStorage); };
  }, [preference]);
  return <AppearanceContext.Provider value={{ preference, setPreference }}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);
