/**
 * Archivo: src/services/reportesService.ts
 * Propósito: Encapsular llamadas al backend para Reportes.
 * Requiere: src/services/api.ts con interceptores JWT.
 *
 * Endpoints esperados:
 *  - GET    /reportes
 *  - GET    /reportes/:id
 *  - POST   /reportes
 *  - PUT    /reportes/:id
 *  - DELETE /reportes/:id
 */

import api from './api';
import type { Reporte, ReporteCreate } from '../types/reporte';

export async function listarReportes(): Promise<Reporte[]> {
  const { data } = await api.get('/reportes');
  return data;
}

export async function crearReporte(payload: ReporteCreate): Promise<{ id_reporte: number }> {
  const { data } = await api.post('/reportes', payload);
  // La API responde { mensaje, id_reporte }
  return { id_reporte: data?.id_reporte };
}

export async function actualizarReporte(id: number, payload: Partial<ReporteCreate>): Promise<void> {
  await api.put(`/reportes/${id}`, payload);
}

export async function eliminarReporte(id: number): Promise<void> {
  await api.delete(`/reportes/${id}`);
}

export async function obtenerReporte(id: number): Promise<Reporte> {
  const { data } = await api.get(`/reportes/${id}`);
  return data;
}
