/**
 * ============================================================
 * Archivo: src/services/catalogosService.ts
 * Prop?sito: Llamadas a cat?logos (listas maestras) del backend.
 * Requiere: src/services/api.ts (con interceptores JWT configurados).
 *
 * Endpoints usados (base /api):
 *  - GET /estadoservicios
 *  - GET /tiposervicios
 *  - GET /tipohardware
 *  - GET /sistemasoperativos
 *  - GET /clientes
 *  - GET /tipoevidencias
 *  - GET /tipogastos
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

export type Cliente = {
  rut_cliente: string;
  nombre_cliente: string;
};

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

// ---------- Helpers de normalizaci?n ----------
const pick = (obj: any, keys: string[]) => {
  for (const key of keys) {
    const value = obj?.[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const num = Number(value);
    if (!Number.isNaN(num)) return num;
  }
  return undefined;
};

const pickNumber = (obj: any, keys: string[]): number | undefined => {
  const value = pick(obj, keys);
  return toNumber(value);
};

const pickText = (obj: any, keys: string[]): string => {
  const value = pick(obj, keys);
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value);
  return '';
};

const isValidId = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

// --------- Cat?logos existentes ----------
export async function getEstadosServicio(): Promise<EstadoServicio[]> {
  const { data } = await api.get('/estadoservicios');
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item: any): EstadoServicio | null => {
      const id = pickNumber(item, ['id_estado_servicio', 'id', 'codigo', 'value']);
      const descripcion = pickText(item, ['descripcion', 'nombre', 'label', 'estado']);
      if (!isValidId(id) || !descripcion) return null;
      return { id_estado_servicio: id, descripcion };
    })
    .filter((x): x is EstadoServicio => Boolean(x));
}

export async function getTiposServicio(): Promise<TipoServicio[]> {
  const { data } = await api.get('/tiposervicios');
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item: any): TipoServicio | null => {
      const id = pickNumber(item, ['id_tipo_servicio', 'id', 'codigo', 'value']);
      const descripcion = pickText(item, ['descripcion', 'nombre', 'label', 'tipo_servicio', 'tipo']);
      if (!isValidId(id) || !descripcion) return null;
      return { id_tipo_servicio: id, descripcion };
    })
    .filter((x): x is TipoServicio => Boolean(x));
}

export async function getTiposHardware(): Promise<TipoHardware[]> {
  const { data } = await api.get('/tipohardware');
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item: any): TipoHardware | null => {
      const id = pickNumber(item, ['id_tipo_hardware', 'id', 'codigo', 'value']);
      const descripcion = pickText(item, ['descripcion', 'nombre', 'label', 'tipo_hardware', 'tipo']);
      if (!isValidId(id) || !descripcion) return null;
      return { id_tipo_hardware: id, descripcion };
    })
    .filter((x): x is TipoHardware => Boolean(x));
}

export async function getSO(): Promise<SistemaOperativo[]> {
  const { data } = await api.get('/sistemasoperativos');
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item: any): SistemaOperativo | null => {
      const id = pickNumber(item, ['id_sistema_operativo', 'id', 'codigo', 'value']);
      const descripcion = pickText(item, ['descripcion', 'nombre_sistema', 'nombre', 'label']);
      if (!isValidId(id) || !descripcion) return null;
      return { id_sistema_operativo: id, descripcion };
    })
    .filter((x): x is SistemaOperativo => Boolean(x));
}

export async function getClientes(): Promise<Cliente[]> {
  const { data } = await api.get('/clientes');
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((item: any): Cliente | null => {
      const rut = pickText(item, ['rut_cliente', 'rut', 'rutcliente', 'id_rut_cliente']);
      const nombre = pickText(item, ['nombre_cliente', 'nombre', 'razon_social', 'descripcion', 'nombreCliente']);
      if (!rut || !nombre) return null;
      return { rut_cliente: rut, nombre_cliente: nombre };
    })
    .filter((x): x is Cliente => Boolean(x));
}

export async function getClientesMap(): Promise<ClienteMap> {
  const lista = await getClientes();
  return lista.reduce<ClienteMap>((acc, it) => {
    acc[it.rut_cliente] = it.nombre_cliente;
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


