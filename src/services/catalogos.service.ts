/**
 * ============================================================
 * Archivo: src/services/catalogos.service.ts
 * Propósito:
 *  - Proveer funciones para obtener catálogos usados en filtros:
 *    Técnicos, Clientes, Centros de Costo y Estados de Servicio.
 *  - Normalizar resultados (filtrar activados cuando aplique).
 *
 * Notas:
 *  - Este módulo exporta las *interfaces* directamente en su
 *    declaración (export interface ...). No re-exportar al final
 *    para evitar conflictos con TS2484.
 * ============================================================
 */

import api from './api';

/** Representa un usuario técnico (id_tipo_usuario = 1). */
export interface TecnicoItem {
  rut: string;
  nombre: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  id_tipo_usuario: number;
  activado?: number;
}

/** Representa un cliente. */
export interface ClienteItem {
  rut_cliente: string;
  nombre_cliente: string;
  activado?: number;
}

/** Representa un centro de costo. */
export interface CentroCostoItem {
  id_rut_empresa_cobro: string;
  nombre_centro_costo: string;
  activado?: number;
}

/** Representa un estado de servicio. */
export interface EstadoServicioItem {
  id_estado_servicio: number;
  descripcion: string;
}

/**
 * Obtiene el catálogo de técnicos.
 * @returns Lista de técnicos activados (si existe el flag) y con id_tipo_usuario = 1.
 */
async function getTecnicos(): Promise<TecnicoItem[]> {
  const { data } = await api.get<TecnicoItem[]>('/usuarios');
  return Array.isArray(data)
    ? data.filter(
        (u) =>
          Number(u.id_tipo_usuario) === 1 &&
          (u.activado === undefined || Number(u.activado) === 1),
      )
    : [];
}

/**
 * Obtiene el catálogo de clientes.
 */
async function getClientes(): Promise<ClienteItem[]> {
  const { data } = await api.get<ClienteItem[]>('/clientes');
  return Array.isArray(data)
    ? data.filter((c) => c.activado === undefined || Number(c.activado) === 1)
    : [];
}

/**
 * Obtiene el catálogo de centros de costo.
 */
async function getCentrosCosto(): Promise<CentroCostoItem[]> {
  const { data } = await api.get<CentroCostoItem[]>('/centrocostos');
  return Array.isArray(data)
    ? data.filter(
        (cc) => cc.activado === undefined || Number(cc.activado) === 1,
      )
    : [];
}

/**
 * Obtiene el catálogo de estados de servicio.
 */
async function getEstadosServicio(): Promise<EstadoServicioItem[]> {
  const { data } = await api.get<EstadoServicioItem[]>('/estadoservicios');
  return Array.isArray(data) ? data : [];
}

export const catalogosService = {
  getTecnicos,
  getClientes,
  getCentrosCosto,
  getEstadosServicio,
};
