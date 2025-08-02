/**
 * Store: authStore
 * Descripción: Maneja el estado global de autenticación,
 * guarda token, datos de usuario y provee funciones de login/logout.
 */

import { create } from 'zustand';

export interface Usuario {
  rut: string;
  nombre: string;
  tipo: number; // 1 = Técnico, 2 = Supervisor
  apellido_paterno?: string;
  apellido_materno?: string;
  email?: string;
}

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  setUser: (token: string, usuario: Usuario) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token') || null,
  usuario: localStorage.getItem('usuario')
    ? JSON.parse(localStorage.getItem('usuario') as string)
    : null,

  setUser: (token, usuario) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuario));
    set({ token, usuario });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    set({ token: null, usuario: null });
  },

  isAuthenticated: () => {
    return get().token !== null;
  },
}));

export default useAuthStore;
