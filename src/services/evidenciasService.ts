/**
 * ============================================================
 * Archivo: src/services/evidenciasService.ts
 * Descripción:
 *   - Servicios HTTP para EvidenciaReporte.
 *   - COMPATIBLE hacia atrás con `createEvidencia` y ruta /evidencias-reporte
 *   - Rutas V12 disponibles: POST /evidencias, GET /evidencias/reporte/:id_reporte
 *
 * Notas:
 *   - Deja los dos estilos para no romper el front actual.
 *   - Puedes migrar paulatinamente a `crearEvidenciasLote` y `listarEvidenciasPorReporte`.
 * ============================================================
 */

import api from './api';

/** DTO legacy (lo que ya usa tu UI hoy) */
export type EvidenciaDTO = {
  id_reporte: number;
  id_tipo_evidencia: number;
  url: string;                 // NOT NULL en DB
  modelo: string | null;
  numero_serie: string | null; // en V12 puede llamarse 'serie'
  ipv4: string | null;
  ipv6: string | null;
  macadd: string | null;
  nombre_maquina: string | null;
  comentario?: string | null;  // algunos flujos la envían
};

/** DTO “nuevo” (alineado al naming V12) */
export type EvidenciaCreate = {
  id_reporte: number;
  id_tipo_evidencia: number; // 1=Foto, 2=Adjunto, 3=Firma Digital, etc.
  url: string;               // Para Firma Digital: DataURL PNG del trazo
  modelo?: string | null;
  marca?: string | null;
  serie?: string | null;     // mapea de numero_serie si viene legacy
  comentario?: string | null;
};

/**
 * ---- COMPATIBILIDAD: createEvidencia (legacy)
 * Usa la ruta antigua /evidencias-reporte para no romper tu UI actual.
 * Cuando migres, usa `crearEvidenciasLote` (V12).
 */
export async function createEvidencia(payload: EvidenciaDTO) {
  // Mantén la ruta legacy que hoy funciona en tu backend:
  const { data } = await api.post('/evidencias-reporte', payload);
  return data;
}

/**
 * ---- NUEVO (V12): crearEvidenciasLote
 * No hay endpoint bulk en V12, posteamos una por una a /evidencias
 */
export async function crearEvidenciasLote(items: (EvidenciaDTO | EvidenciaCreate)[]): Promise<void> {
  await Promise.all(
    items.map((e) => {
      // Mapeo mínimo para aceptar tanto DTO legacy como nuevo
      const body: EvidenciaCreate = {
        id_reporte: e.id_reporte,
        id_tipo_evidencia: e.id_tipo_evidencia,
        url: (e as any).url,
        modelo: (e as any).modelo ?? null,
        comentario: (e as any).comentario ?? null,
        // numero_serie (legacy) -> serie (nuevo)
        serie: (e as any).serie ?? (e as any).numero_serie ?? null,
        // marca no existe en legacy: queda undefined/null si no viene
        marca: (e as any).marca ?? null,
      };
      return api.post('/evidencias', body);
    })
  );
}

/**
 * ---- NUEVO (V12): listar evidencias por reporte
 * Intenta la ruta V12 y hace fallback a la legacy si existe en tu backend.
 */
export async function listarEvidenciasPorReporte(idReporte: number) {
  try {
    const { data } = await api.get(`/evidencias/reporte/${idReporte}`); // V12
    return Array.isArray(data) ? data : [];
  } catch {
    // Fallback a tu ruta legacy si existe en tu backend:
    const { data } = await api.get(`/evidencias-reporte/${idReporte}`);
    return Array.isArray(data) ? data : [];
  }
}

/**
 * Elimina una evidencia por id (intenta ruta V12 y hace fallback a legacy).
 */
export async function eliminarEvidencia(idEvidencia: number): Promise<void> {
  try {
    await api.delete(`/evidencias/${idEvidencia}`);
  } catch {
    await api.delete(`/evidencias-reporte/${idEvidencia}`);
  }
}
