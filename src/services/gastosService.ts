/**
 * ============================================================
 * Archivo: src/services/gastosService.ts
 * Descripción:
 *   - Servicios HTTP para GastoReporte.
 *   - COMPATIBLE hacia atrás con `createGasto` y ruta /gastos-reporte
 *   - Rutas V12 disponibles: POST /gastos, GET /gastos/reporte/:id_reporte
 *
 * Notas:
 *   - Deja ambos estilos para no romper lo actual.
 *   - Puedes migrar paulatinamente a `crearGastosLote` y `listarGastosPorReporte`.
 * ============================================================
 */

import api from './api';

/** DTO legacy (actual en tu UI) */
export type GastoDTO = {
  id_reporte: number;
  id_tipo_gasto: number;
  monto: number;
  fecha_gasto: string;     // legacy
  comentario?: string;
  imagen_url?: string;
};

/** DTO “nuevo” (alineado al naming V12) */
export type GastoCreate = {
  id_reporte: number;
  id_tipo_gasto: number;
  monto: number;
  fecha?: string | null;       // ISO yyyy-mm-dd
  descripcion?: string | null; // mapea desde comentario
  imagen_url?: string | null;
};

/**
 * ---- COMPATIBILIDAD: createGasto (legacy)
 * Usa la ruta antigua /gastos-reporte para no romper tu UI actual.
 * Cuando migres, usa `crearGastosLote` (V12).
 */
export async function createGasto(payload: GastoDTO) {
  // Mantén la ruta legacy que hoy funciona en tu backend:
  const { data } = await api.post('/gastos-reporte', payload);
  return data;
}

/**
 * ---- NUEVO (V12): crearGastosLote
 * No hay endpoint bulk en V12, posteamos una por una a /gastos
 */
export async function crearGastosLote(items: (GastoDTO | GastoCreate)[]): Promise<void> {
  await Promise.all(
    items.map((g) => {
      // Mapeo para aceptar tanto DTO legacy como nuevo
      const body: GastoCreate = {
        id_reporte: g.id_reporte,
        id_tipo_gasto: g.id_tipo_gasto,
        monto: g.monto,
        fecha: (g as any).fecha ?? (g as any).fecha_gasto ?? null,
        descripcion: (g as any).descripcion ?? (g as any).comentario ?? null,
        imagen_url: (g as any).imagen_url ?? null,
      };
      return api.post('/gastos', body);
    })
  );
}

/**
 * ---- NUEVO (V12): listar gastos por reporte
 * Intenta la ruta V12 y hace fallback a la legacy si existe en tu backend.
 */
export async function listarGastosPorReporte(idReporte: number) {
  try {
    const { data } = await api.get(`/gastos/reporte/${idReporte}`); // V12
    return Array.isArray(data) ? data : [];
  } catch {
    // Fallback a tu ruta legacy si existe:
    const { data } = await api.get(`/gastos-reporte/${idReporte}`);
    return Array.isArray(data) ? data : [];
  }
}
