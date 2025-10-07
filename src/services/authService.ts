/**
 * src/services/authService.ts
 * Servicio: authService
 * Descripción: Funciones para autenticación contra la API de F-REPORT usando Axios con interceptores.
 * Nota: Normalizamos el RUT (dejando solo dígitos) antes de enviarlo a la API.
 */

import api from './api'; // Instancia con interceptores (baseURL debería ser /api en prod)

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
 * Normaliza el RUT dejando solo dígitos.
 * Ejemplos:
 *  - "1-9"       -> "19"
 *  - "12.345.678-9" -> "123456789"
 */
const normalizeRut = (rut: string) => rut.replace(/\D/g, '');

/**
 * Función: login
 * Descripción: Autentica al usuario en la API con RUT y clave.
 * @param rut RUT ingresado por el usuario (puede venir con guion/puntos)
 * @param clave Contraseña ingresada
 * @returns Token JWT y datos del usuario
 */
export async function login(rut: string, clave: string): Promise<LoginResponse> {
  try {
    const rutLimpio = normalizeRut(rut);            // normalización 
    const response = await api.post('/auth/login', { rut: rutLimpio, clave });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data?.mensaje || 'Error de autenticación');
    }
    throw new Error('Error de conexión con el servidor');
  }
}
