/**
 * Servicio: api.ts
 * Descripción: Configuración base de Axios con interceptores para manejar token JWT.
 */

import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ✅ Interceptor para agregar token JWT en cada request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Interceptor para manejar errores de autenticación
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      const token = useAuthStore.getState().token;
      // 🔹 Solo cerrar sesión y redirigir si había token activo (usuario logueado)
      if (token) {
        useAuthStore.getState().logout();
        window.location.href = '/login';
      }
      // 🔹 Si no hay token (intento de login fallido), dejar que el catch del componente maneje el error
    }
    return Promise.reject(error);
  }
);

export default api;
