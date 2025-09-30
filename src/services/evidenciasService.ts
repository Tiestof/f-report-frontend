/**
 * ============================================================
 * Archivo: src/services/evidenciasService.ts
 * Propósito:
 *  - Servicio de Evidencias (listar / subir / eliminar).
 *  - Alineado con la API: POST /api/evidencias/upload (field: "file").
 *  - Compatibilidad retro: exporta nombres en ES y en español.
 * Notas:
 *  - Requiere una instancia Axios en ./api con baseURL '/api'.
 *  - onUploadProgress soportado para barra de progreso en UI.
 * ============================================================
 */

import api from './api';

/** Payload para subir evidencia (incluye firma o archivo genérico) */
export type UploadEvidenciaInput = {
  id_reporte: number;
  id_tipo_evidencia: number;
  // Firma
  firmante?: string;
  // Metadatos opcionales
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;
  // Archivo
  file: File;
};

type UploadOpts = {
  onUploadProgress?: (pct: number) => void;
};

/**
 * Lista evidencias por id_reporte
 * GET /api/evidencias/reporte/:id_reporte
 */
export async function getEvidenciasByReporte(id_reporte: number) {
  const { data } = await api.get(`/evidencias/reporte/${id_reporte}`);
  return data;
}

/** Alias retro-compatibilidad */
export const listarEvidenciasPorReporte = getEvidenciasByReporte;

/**
 * Elimina una evidencia por id
 * DELETE /api/evidencias/:id
 */
export async function deleteEvidencia(id_evidencia: number) {
  const { data } = await api.delete(`/evidencias/${id_evidencia}`);
  return data;
}

/** Alias retro-compatibilidad */
export const eliminarEvidencia = deleteEvidencia;

/**
 * Sube una evidencia (firma o archivo)
 * POST /api/evidencias/upload (field name: "file")
 */
export async function uploadEvidencia(
  payload: UploadEvidenciaInput,
  opts?: UploadOpts
) {
  const fd = new FormData();
  fd.append('id_reporte', String(payload.id_reporte));
  fd.append('id_tipo_evidencia', String(payload.id_tipo_evidencia));
  if (payload.firmante) fd.append('firmante', payload.firmante);

  if (payload.modelo) fd.append('modelo', payload.modelo);
  if (payload.numero_serie) fd.append('numero_serie', payload.numero_serie);
  if (payload.ipv4) fd.append('ipv4', payload.ipv4);
  if (payload.ipv6) fd.append('ipv6', payload.ipv6);
  if (payload.macadd) fd.append('macadd', payload.macadd);
  if (payload.nombre_maquina) fd.append('nombre_maquina', payload.nombre_maquina);

  fd.append('file', payload.file);

  await api.post(`/evidencias/upload`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (!opts?.onUploadProgress) return;
      const total = evt.total ?? 0;
      const pct = total ? Math.round((evt.loaded / total) * 100) : 0;
      opts.onUploadProgress(Math.max(0, Math.min(100, pct)));
    },
  });
}

/** Alias retro-compatibilidad */
export const subirEvidencia = uploadEvidencia;

// TODO: añadir tipos de retorno (EvidenciaListadoItem) desde src/types/evidencias
//       cuando estén definidos en el proyecto para tipado más estricto.
