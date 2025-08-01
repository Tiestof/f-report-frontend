/**
 * Servicio: authService
 * Descripción: Funciones para autenticación contra la API de F-REPORT usando Axios con interceptores.
 */

import api from './api'; // ✅ Ahora usamos la instancia con interceptores

interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: {
    rut: string;
    nombre: string;
    tipo: number;
  };
}

/**
 * Función: login
 * Descripción: Autentica al usuario en la API con RUT y clave.
 * @param rut RUT limpio sin puntos ni guion (para la API)
 * @param clave Contraseña ingresada
 * @returns Token JWT y datos del usuario
 */
export async function login(rut: string, clave: string): Promise<LoginResponse> {
  try {
    const response = await api.post('/auth/login', { rut, clave });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.mensaje || 'Error de autenticación');
    }
    throw new Error('Error de conexión con el servidor');
  }
}
