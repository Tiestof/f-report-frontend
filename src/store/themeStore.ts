/**
 * Store: themeStore
 * Maneja el estado de modo oscuro/claro y lo persiste en localStorage.
 */
import { create } from 'zustand';

interface ThemeState {
  darkMode: boolean;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'f-report-theme';
const canUseDom = typeof window !== 'undefined' && typeof document !== 'undefined';

const readInitialMode = (): boolean => {
  if (!canUseDom) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'dark';
  } catch (err) {
    console.warn('themeStore: no se pudo leer localStorage', err);
    return false;
  }
};

const applyDomTheme = (enabled: boolean) => {
  if (!canUseDom) return;
  document.documentElement.classList.toggle('dark', enabled);
};

const initialMode = readInitialMode();
applyDomTheme(initialMode);

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: initialMode,
  toggleTheme: () =>
    set((state) => {
      const newMode = !state.darkMode;
      applyDomTheme(newMode);

      if (canUseDom) {
        try {
          window.localStorage.setItem(STORAGE_KEY, newMode ? 'dark' : 'light');
        } catch (err) {
          console.warn('themeStore: no se pudo guardar localStorage', err);
        }
      }

      return { darkMode: newMode };
    }),
}));
