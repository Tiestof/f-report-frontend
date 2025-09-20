/**
 * ============================================================
 * Archivo: src/services/reportesService.ts
 * Propósito: Encapsular llamadas al backend para Reportes.
 * Requiere: src/services/api.ts con interceptores JWT.
 *
 * Endpoints backend (V12):
 *  - GET    /api/reportes
 *  - GET    /api/reportes/:id
 *  - POST   /api/reportes
 *  - PUT    /api/reportes/:id
 *  - DELETE /api/reportes/:id
 *
 * Notas:
 *  - Para la vista del TÉCNICO, filtramos en el cliente por rut_responsable
 *    y excluimos estado = 5 (eliminado), cumpliendo las reglas del negocio.
 * ============================================================
 */

import api from './api';
import type { Reporte, ReporteCreate } from '../types';

export const ESTADO_ELIMINADO = 5 as const;

/** Lista general (sin filtros de backend) */
export async function listarReportes(): Promise<Reporte[]> {
  const { data } = await api.get('/reportes');
  return data;
}

/** Lista SOLO los reportes del técnico (rut_responsable = rut) y excluye estado 5 */
export async function listarReportesTecnico(rut: string): Promise<Reporte[]> {
  const { data } = await api.get('/reportes');
  const arr: Reporte[] = Array.isArray(data) ? data : [];
  return arr.filter(
    (r) => r.rut_responsable === rut && r.id_estado_servicio !== ESTADO_ELIMINADO
  );
}

/** Crear (general) */
export async function crearReporte(payload: ReporteCreate): Promise<{ id_reporte: number }> {
  const { data } = await api.post('/reportes', payload);
  // La API responde { mensaje, id_reporte }
  return { id_reporte: data?.id_reporte };
}

/** Update */
export async function actualizarReporte(id: number, payload: Partial<ReporteCreate>): Promise<void> {
  await api.put(`/reportes/${id}`, payload);
}

/** Delete físico (supervisor) */
export async function eliminarReporte(id: number): Promise<void> {
  await api.delete(`/reportes/${id}`);
}

/** Delete lógico (técnico) -> pone estado = 5, validando reglas */
export async function eliminarReporteLogicoTecnico(id: number, rutTecnico: string): Promise<void> {
  const rep = await obtenerReporte(id);
  const esAutor = rep.rut_usuario === rutTecnico;
  const esResponsable = rep.rut_responsable === rutTecnico;

  if (!esAutor || !esResponsable) {
    throw new Error('No autorizado: solo puedes eliminar reportes donde eres autor y responsable.');
  }
  await api.put(`/reportes/${id}`, { id_estado_servicio: ESTADO_ELIMINADO });
}

/** Obtener por id */
export async function obtenerReporte(id: number): Promise<Reporte> {
  const { data } = await api.get(`/reportes/${id}`);
  return data;
}

/** Helpers permisos (técnico) */
export function puedeEditarTecnico(reporte: Reporte, rutTecnico: string): boolean {
  return (reporte.rut_responsable ?? '') === rutTecnico;
}

export function puedeEliminarTecnico(reporte: Reporte, rutTecnico: string): boolean {
  return (
    (reporte.rut_usuario ?? '') === rutTecnico &&
    (reporte.rut_responsable ?? '') === rutTecnico
  );
}

/** (Opcional) re-export de tipo para conveniencia desde otros módulos */
export type { Reporte as ReporteType } from '../types';
