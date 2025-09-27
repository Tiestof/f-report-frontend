/**
 * ============================================================
 * Archivo: src/services/evidenciasService.ts
 * Propósito:
 *   Capa HTTP para Evidencias (listar por reporte + subir archivo).
 *   - GET /api/evidencias/reporte/:id
 *   - POST /api/evidencias/upload (multipart)
 * Requisitos:
 *   - axios instance central `api` con interceptores JWT.
 * Estándares:
 *   - JSDoc, comentarios inline y tipos estrictos.
 * Compatibilidad:
 *   - Mantengo alias listarEvidenciasPorReporte para no romper imports.
 * ============================================================
 */

import api from './api';
import type {
  EvidenciaListadoItem,
  EvidenciaCreateUploadInput,
  EvidenciaUploadResult,
} from '../types/evidencias';

/**
 * GET /api/evidencias/reporte/:id
 * Lista de evidencias de un reporte.
 */
export async function getEvidenciasByReporte(id_reporte: number): Promise<EvidenciaListadoItem[]> {
  const { data } = await api.get(`/evidencias/reporte/${id_reporte}`);
  return (Array.isArray(data) ? data : []) as EvidenciaListadoItem[];
}

/**
 * POST /api/evidencias/upload  (multipart)
 * Reglas:
 *  - Agregar campos (id_reporte, id_tipo_evidencia, metadatos) ANTES del file.
 *  - El campo del archivo debe llamarse "file".
 *  - El backend renombra con: EVI_<reporte>_<tipo>_<YYYYMMDDhhmmss>.<ext>
 */
export async function uploadEvidencia(input: EvidenciaCreateUploadInput): Promise<EvidenciaUploadResult> {
  const fd = new FormData();

  // ⚠️ Orden IMPORTANTE: primero metadatos, luego el archivo.
  fd.append('id_reporte', String(input.id_reporte));
  fd.append('id_tipo_evidencia', String(input.id_tipo_evidencia));

  if (input.firmante)       fd.append('firmante', input.firmante);
  if (input.modelo)         fd.append('modelo', input.modelo);
  if (input.numero_serie)   fd.append('numero_serie', input.numero_serie);
  if (input.ipv4)           fd.append('ipv4', input.ipv4);
  if (input.ipv6)           fd.append('ipv6', input.ipv6);
  if (input.macadd)         fd.append('macadd', input.macadd);
  if (input.nombre_maquina) fd.append('nombre_maquina', input.nombre_maquina);

  fd.append('file', input.file);

  const { data } = await api.post('/evidencias/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data as EvidenciaUploadResult;
}

/* ===== Alias de compatibilidad (no romper imports existentes) ===== */
export const listarEvidenciasPorReporte = getEvidenciasByReporte;
export const crearEvidencia = uploadEvidencia;
