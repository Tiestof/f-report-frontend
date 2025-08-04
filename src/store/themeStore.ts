/**
 * Store: themeStore
 * Maneja el estado de modo oscuro/claro y lo persiste en localStorage.
 */
import { create } from 'zustand';

interface ThemeState {
  darkMode: boolean;
  toggleTheme: () => void;
}

const initialMode = localStorage.getItem('f-report-theme') === 'dark';

export const useThemeStore = create<ThemeState>((set) => ({
  darkMode: initialMode,
  toggleTheme: () =>
    set((state) => {
      const newMode = !state.darkMode;
      localStorage.setItem('f-report-theme', newMode ? 'dark' : 'light');
      console.log('💾 Guardando preferencia en localStorage:', newMode ? 'dark' : 'light');
      return { darkMode: newMode };
    }),
}));
