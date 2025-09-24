/**
 * ============================================================
 * Archivo: src/services/evidenciasService.ts
 * Descripción:
 *   - Servicios HTTP para EvidenciaReporte.
 *   - COMPATIBLE hacia atrás con rutas legacy:
 *       • POST /evidencias-reporte
 *       • GET  /evidencias-reporte/:id_reporte
 *   - Rutas V12/V13 disponibles:
 *       • POST /evidencias          (JSON con url)
 *       • GET  /evidencias/reporte/:id_reporte
 *   - NUEVO flujo multipart:
 *       • POST /evidencias/upload   (FormData: file + id_reporte [+ id_tipo_evidencia])
 *
 * Notas de uso:
 *   - Para imágenes/adjuntos: `uploadEvidencia` (multipart).
 *   - Para firmas dataURL: `uploadFirmaDesdeDataURL` (convierte a Blob y sube).
 *   - Listado: `listarEvidenciasPorReporte` (alias `getEvidenciasPorReporte`).
 * ============================================================
 */

import api from './api';

/* ===================== Tipos ===================== */

export type EvidenciaDTO = {
  id_reporte: number;
  id_tipo_evidencia: number;
  url: string;                 // legacy: dataURL o URL
  modelo: string | null;
  numero_serie: string | null; // legacy
  ipv4: string | null;
  ipv6: string | null;
  macadd: string | null;
  nombre_maquina: string | null;
  comentario?: string | null;
};

export type EvidenciaCreate = {
  id_reporte: number;
  id_tipo_evidencia: number;   // 1=Foto, 2=Adjunto, 3=Firma, etc.
  url: string;                 // URL pública o dataURL según flujo
  modelo?: string | null;
  marca?: string | null;
  serie?: string | null;       // mapping desde numero_serie
  comentario?: string | null;
};

export type EvidenciaListadoItem = {
  id_evidencia: number;
  id_reporte: number;
  id_tipo_evidencia: number | null;
  url: string;
  modelo?: string | null;
  serie?: string | null;
  comentario?: string | null;
  created_at?: string;
};

export type EvidenciaUploadResponse = {
  mensaje: string;
  id: number;
  url: string; // /uploads/<archivo>
};

/* ============== Helpers sin Node.Buffer ============== */

/**
 * Convierte una dataURL (ej: "data:image/png;base64,....") a Blob.
 * Implementación 100% navegador (usa atob); no usa Buffer de Node.
 */
function dataURLtoBlob(dataURL: string): Blob {
  const parts = dataURL.split(',', 2);
  if (parts.length < 2) throw new Error('DataURL inválida');

  const header = parts[0]; // ej: data:image/png;base64
  const data = parts[1];

  const isBase64 = /;base64/i.test(header);
  const mimeMatch = header.match(/^data:([^;]+)(;.*)?$/i);
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';

  const byteString = isBase64 ? atob(data) : decodeURIComponent(data);
  const len = byteString.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = byteString.charCodeAt(i) & 0xff;

  return new Blob([u8], { type: mime });
}

/** Obtiene un nombre de archivo razonable para FormData sin usar @ts-expect-error */
function getFileName(file: File | Blob, provided?: string): string {
  if (provided && provided.trim().length > 0) return provided.trim();
  if (typeof File !== 'undefined' && file instanceof File && typeof file.name === 'string' && file.name) {
    return file.name;
  }
  return 'evidencia.bin';
}

/* ============== Compatibilidad LEGACY ============== */

/**
 * Legacy: crea evidencia posteando JSON a /evidencias-reporte (no multipart).
 * Mantener para no romper UI previa.
 */
export async function createEvidencia(payload: EvidenciaDTO) {
  const { data } = await api.post('/evidencias-reporte', payload);
  return data;
}

/**
 * “Lote” (simulado): postea una por una a /evidencias (JSON).
 * Útil si todavía envías base64 o URLs sin usar multipart.
 */
export async function crearEvidenciasLote(items: (EvidenciaDTO | EvidenciaCreate)[]): Promise<void> {
  await Promise.all(
    items.map((e) => {
      const body: EvidenciaCreate = {
        id_reporte: e.id_reporte,
        id_tipo_evidencia: (e as any).id_tipo_evidencia,
        url: (e as any).url,
        modelo: (e as any).modelo ?? null,
        comentario: (e as any).comentario ?? null,
        serie: (e as any).serie ?? (e as any).numero_serie ?? null,
        marca: (e as any).marca ?? null,
      };
      return api.post('/evidencias', body);
    })
  );
}

/**
 * Listar evidencias por reporte. Intenta V12/V13 y hace fallback a legacy.
 */
export async function listarEvidenciasPorReporte(idReporte: number) {
  try {
    const { data } = await api.get(`/evidencias/reporte/${idReporte}`); // V12/V13
    return Array.isArray(data) ? (data as EvidenciaListadoItem[]) : [];
  } catch {
    const { data } = await api.get(`/evidencias-reporte/${idReporte}`); // legacy
    return Array.isArray(data) ? (data as EvidenciaListadoItem[]) : [];
  }
}

/** Alias por compatibilidad con código que ya usa este nombre */
export const getEvidenciasPorReporte = listarEvidenciasPorReporte;

/**
 * Eliminar evidencia por id (intenta V12/V13 y hace fallback a legacy).
 */
export async function eliminarEvidencia(idEvidencia: number): Promise<void> {
  try {
    await api.delete(`/evidencias/${idEvidencia}`);
  } catch {
    await api.delete(`/evidencias-reporte/${idEvidencia}`);
  }
}

/* ============== NUEVO flujo MULTIPART ============== */

/**
 * Sube un archivo (imagen/pdf) como FormData a /evidencias/upload.
 */
export async function uploadEvidencia(args: {
  file: File | Blob;
  id_reporte: number;
  id_tipo_evidencia?: number | null;
  fileName?: string;
}) {
  const form = new FormData();
  form.append('file', args.file, getFileName(args.file, args.fileName));
  form.append('id_reporte', String(args.id_reporte));
  if (args.id_tipo_evidencia != null) {
    form.append('id_tipo_evidencia', String(args.id_tipo_evidencia));
  }

  // axios establece automáticamente el boundary del multipart
  const { data } = await api.post<EvidenciaUploadResponse>('/evidencias/upload', form);
  return data;
}

/**
 * Convierte una dataURL (firma dibujada) a PNG y la sube por multipart.
 */
export async function uploadFirmaDesdeDataURL(args: {
  dataURL: string;
  id_reporte: number;
  id_tipo_evidencia?: number;   // default 3: Firma Digital
  fileName?: string;            // default 'firma.png'
}) {
  const blob = dataURLtoBlob(args.dataURL);
  return uploadEvidencia({
    file: blob,
    id_reporte: args.id_reporte,
    id_tipo_evidencia: args.id_tipo_evidencia ?? 3,
    fileName: args.fileName ?? 'firma.png',
  });
}
