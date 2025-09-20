/**
 * ============================================================
 * Archivo: src/services/catalogosService.ts
 * Propósito: Llamadas a catálogos (listas maestras) del backend.
 * Requiere: src/services/api.ts (con interceptores JWT configurados).
 *
 * Endpoints usados (base /api):
 *  - GET /estadoservicios
 *  - GET /tipo-servicio
 *  - GET /tipo-hardware
 *  - GET /sistema-operativo
 *  - GET /clientes
 *  - GET /tipoevidencias   <-- NUEVO (para EvidenciasModal)
 *  - GET /tipogastos       <-- NUEVO (para GastosModal)
 * ============================================================
 */

import api from './api';

export type ClienteMap = Record<string, string>;

export type EstadoServicio = {
  id_estado_servicio: number;
  descripcion: string;
};

export type TipoServicio = { id_tipo_servicio: number; descripcion: string };
export type TipoHardware = { id_tipo_hardware: number; descripcion: string };
export type SistemaOperativo = { id_sistema_operativo: number; descripcion: string };

/** NUEVOS TIPOS */
export type TipoEvidencia = {
  id_tipo_evidencia: number;
  descripcion_tipo_evidencia: string;
  activado?: number;
};

export type TipoGasto = {
  id_tipo_gasto: number;
  descripcion: string;
  activado?: number;
};

// --------- Catálogos existentes ----------
export async function getEstadosServicio(): Promise<EstadoServicio[]> {
  const { data } = await api.get('/estadoservicios');
  return data;
}

export async function getTiposServicio(): Promise<TipoServicio[]> {
  const { data } = await api.get('/tipo-servicio');
  return data;
}

export async function getTiposHardware(): Promise<TipoHardware[]> {
  const { data } = await api.get('/tipo-hardware');
  return data;
}

export async function getSO(): Promise<SistemaOperativo[]> {
  const { data } = await api.get('/sistema-operativo');
  return data;
}

export async function getClientes(): Promise<Array<{ rut: string; nombre: string }>> {
  const { data } = await api.get('/clientes');
  return data;
}

export async function getClientesMap(): Promise<ClienteMap> {
  const lista = await getClientes();
  return lista.reduce<ClienteMap>((acc, it) => {
    acc[it.rut] = it.nombre;
    return acc;
  }, {});
}

// --------- NUEVOS: necesarios para Evidencias/Gastos ----------
/**
 * GET /api/tipoevidencias
 * Rutas confirmadas en API v12 (routes/tipoEvidencia.routes.js).
 */
export async function getTiposEvidencia(): Promise<TipoEvidencia[]> {
  const { data } = await api.get('/tipoevidencias');
  return data;
}

/**
 * GET /api/tipogastos
 * Rutas confirmadas en API v12 (routes/tipoGasto.routes.js).
 */
export async function getTiposGasto(): Promise<TipoGasto[]> {
  const { data } = await api.get('/tipogastos');
  return data;
}
