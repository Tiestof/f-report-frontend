/**
 * ============================================================
 * Archivo: src/types/evidencias.ts
 * Propósito:
 *   Tipos TS alineados al esquema actual:
 *   - Tabla TipoEvidencia (id, descripcion_tipo_evidencia, activado)
 *   - Tabla EvidenciaReporte (ver campos).
 * Notas:
 *   - Estos tipos los consumen servicios y UI del modal.
 * ============================================================
 */

/** Catálogo: Tipo de Evidencia */
export interface TipoEvidenciaCatalogo {
  id_tipo_evidencia: number;
  descripcion_tipo_evidencia: string;
  activado: 0 | 1;
}

/** Fila de EvidenciaReporte devuelta por la API */
export interface EvidenciaListadoItem {
  id_evidencia: number;
  id_reporte: number;
  id_tipo_evidencia: number | null;
  id_tarea?: number | null;

  /** URL pública servida por Nginx (/uploads/.. o CDN externo). */
  url: string;

  /** Metadatos opcionales */
  modelo?: string | null;
  numero_serie?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  macadd?: string | null;
  nombre_maquina?: string | null;

  /** Fecha de subida (MySQL DATETIME) */
  fecha_subida?: string | null;

  /** Join de catálogo (si backend lo incluye) */
  descripcion_tipo_evidencia?: string;
}

/** Payload para subir evidencia (multipart) */
export interface EvidenciaCreateUploadInput {
  id_reporte: number;
  id_tipo_evidencia: number; // 1: Imagen, 2: PDF, 3: Firma Digital, etc.
  file: File;                 // imagen/pdf o imagen de la firma

  // Metadatos opcionales (no-firma)
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;

  // Firma Digital: nombre de la persona que firma
  firmante?: string;
}

export interface EvidenciaUploadResult {
  mensaje: string;
  id: number;
  url: string; // /uploads/EVI_<reporte>_<tipo>_<YYYYMMDDhhmmss>.<ext>
}
