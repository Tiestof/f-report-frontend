/**
 * ============================================================
 * Archivo: src/services/evidenciasService.ts
 * Propósito:
 *   - Capa HTTP para Evidencias (listar por reporte, subir, eliminar).
 *   - Compatibilidad con imports antiguos de V14 mediante ALIAS.
 *
 * Endpoints backend:
 *   - GET    /api/evidencias/reporte/:id_reporte
 *   - POST   /api/evidencias/upload              (multipart, campo 'file')
 *   - DELETE /api/evidencias/:id
 *
 * Notas importantes:
 *   - Para nombrar correctamente el archivo en el backend, los campos
 *     id_reporte e id_tipo_evidencia deben enviarse ANTES del 'file'
 *     dentro del FormData (Multer lee req.body en el filename()).
 *
 * Alias de compatibilidad:
 *   - listarEvidenciasPorReporte -> getEvidenciasByReporte
 *   - crearEvidencia             -> uploadEvidencia
 *   - eliminarEvidencia          -> deleteEvidencia
 * ============================================================
 */

import api from './api';
import type { EvidenciaListadoItem } from '../types/evidencias';

/** Tipo para subir una evidencia (firma JPG o archivo de imagen/PDF) */
export type EvidenciaCreateUploadInput = {
  id_reporte: number;
  id_tipo_evidencia: number;

  /** Firma digital: nombre del firmante (opcional) */
  firmante?: string;

  /** Metadatos para otros tipos */
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;

  /** Archivo a subir (campo 'file') */
  file: File;
};

/** GET /api/evidencias/reporte/:id_reporte */
export async function getEvidenciasByReporte(id_reporte: number): Promise<EvidenciaListadoItem[]> {
  const { data } = await api.get(`/evidencias/reporte/${id_reporte}`);
  return (Array.isArray(data) ? data : []) as EvidenciaListadoItem[];
}

/** POST /api/evidencias/upload (multipart + 'file') */
export async function uploadEvidencia(input: EvidenciaCreateUploadInput): Promise<{ id: number; url: string }> {
  const fd = new FormData();

  // ⚠️ Campos ANTES del archivo (Multer)
  fd.append('id_reporte', String(input.id_reporte));
  fd.append('id_tipo_evidencia', String(input.id_tipo_evidencia));

  if (input.firmante) fd.append('firmante', input.firmante);

  if (input.modelo) fd.append('modelo', input.modelo);
  if (input.numero_serie) fd.append('numero_serie', input.numero_serie);
  if (input.ipv4) fd.append('ipv4', input.ipv4);
  if (input.ipv6) fd.append('ipv6', input.ipv6);
  if (input.macadd) fd.append('macadd', input.macadd);
  if (input.nombre_maquina) fd.append('nombre_maquina', input.nombre_maquina);

  fd.append('file', input.file);

  const { data } = await api.post('/evidencias/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** DELETE /api/evidencias/:id */
export async function deleteEvidencia(id_evidencia: number): Promise<{ ok?: boolean; mensaje?: string }> {
  const { data } = await api.delete(`/evidencias/${id_evidencia}`);
  return data;
}

/* ============================================================
 * ALIAS DE COMPATIBILIDAD (V14) — NO ROMPER IMPORTS EXISTENTES
 * ============================================================ */
export const listarEvidenciasPorReporte = getEvidenciasByReporte;
export const crearEvidencia = uploadEvidencia;
export const eliminarEvidencia = deleteEvidencia;
