/**
 * ============================================================
 * Archivo: src/services/gastosService.ts
 * Propósito:
 *  - Funciones HTTP para módulo de Gastos.
 *  - Incluye upload con progreso a /api/gastos/upload (si existe).
 *  - Fallback a createGasto si /upload no está disponible.
 * Seguridad:
 *  - Usa interceptores de api.ts (tokens, manejo de errores).
 * ============================================================
 */

import api from './api';

export type CreateGastoDTO = {
  id_reporte: number;
  id_tipo_gasto: number;
  monto: number;
  fecha_gasto: string;
  comentario: string;
  imagen_url: string; // puede ser dataURL si no hay upload
};

export async function getGasto(id: number) {
  const { data } = await api.get(`/gastos/${id}`);
  return data;
}

export async function listarGastosPorReporte(idReporte: number) {
  const { data } = await api.get(`/gastos/reporte/${idReporte}`);
  return data;
}

export async function createGasto(dto: CreateGastoDTO) {
  const { data } = await api.post('/gastos', dto);
  return data;
}

export async function eliminarGasto(id: number) {
  const { data } = await api.delete(`/gastos/${id}`);
  return data;
}

/**
 * Sube archivo a /api/gastos/upload con metadatos obligatorios.
 * - field name: "file"
 * - onProgress: callback de progreso [0..100]
 * Devuelve {ok:boolean, data?:any} o lanza Error.
 */
export async function uploadGasto(
  payload: {
    id_reporte: number;
    id_tipo_gasto: number;
    monto: number;
    fecha_gasto: string;
    comentario: string;
    file: File;
  },
  onProgress?: (p: number) => void
): Promise<{ ok: boolean; data?: any }> {
  const fd = new FormData();
  // IMPORTANTE: estos campos deben ir ANTES del file para que Multer los vea en req.body (como en evidencias)
  fd.append('id_reporte', String(payload.id_reporte));
  fd.append('id_tipo_gasto', String(payload.id_tipo_gasto));
  fd.append('monto', String(payload.monto));
  fd.append('fecha_gasto', payload.fecha_gasto);
  fd.append('comentario', payload.comentario ?? '');
  fd.append('file', payload.file);

  try {
    const { data } = await api.post('/gastos/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (!onProgress) return;
        if (!e.total) return onProgress(60); // estimación
        const p = Math.round((e.loaded * 100) / e.total);
        onProgress(Math.min(95, Math.max(5, p))); // dejamos 5% para post-proceso
      },
    });
    onProgress?.(100);
    return { ok: true, data };
  } catch (err: any) {
    // Si el backend devuelve 404 o 405, interpretamos que no existe /upload
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      return { ok: false };
    }
    throw err;
  }
}
