/**
 * ============================================================
 * Archivo: src/services/gastosService.ts
 * Propósito:
 *  - Funciones HTTP para módulo de Gastos.
 *  - Upload correcto (un solo paso) a /api/gastos/upload:
 *    enviar metadatos OBLIGATORIOS + file en FormData.
 *  - Fallback a createGasto si /upload no existe.
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

export type UpdateGastoDTO = Partial<{
  id_tipo_gasto: number;
  monto: number;
  fecha_gasto: string;
  comentario: string;
}>;

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

// Se deja por si en el futuro deseas editar un gasto ya creado.
export async function updateGasto(idGasto: number, dto: UpdateGastoDTO) {
  const { data } = await api.put(`/gastos/${idGasto}`, dto);
  return data;
}

export async function eliminarGasto(id: number) {
  const { data } = await api.delete(`/gastos/${id}`);
  return data;
}

/**
 * Upload de gasto en UN PASO (lo que la API espera):
 *  - POST /api/gastos/upload
 *  - Campos obligatorios: id_reporte, id_tipo_gasto, monto, fecha_gasto
 *  - Campo opcional: comentario
 *  - Campo de archivo: file
 * Notas:
 *  - Los metadatos van ANTES del file.
 *  - Header multipart SOLO en esta llamada (no tocamos api.ts global).
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
  // Importante: metadatos antes del archivo para Multer/req.body
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
        if (!e.total) return onProgress(60);
        const p = Math.round((e.loaded * 100) / e.total);
        onProgress(Math.min(95, Math.max(5, p)));
      },
    });
    onProgress?.(100);
    return { ok: true, data };
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.response?.status === 405) {
      return { ok: false };
    }
    throw err;
  }
}
