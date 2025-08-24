/**
 * ============================================================
 * Archivo: src/types/reporte.ts
 * Propósito: Tipos fuertes para reportes
 * ============================================================
 */

export interface ReporteCreate {
  // Obligatorios
  direccion: string;
  rut_usuario: string;
  rut_responsable: string;
  rut_cliente: string;
  id_rut_empresa_cobro: string;
  hora_inicio: string; // "HH:mm"
  id_estado_servicio: number;

  // Opcionales
  fecha_reporte?: string;     // "YYYY-MM-DD"
  comentario?: string;
  hora_fin?: string;          // "HH:mm"
  numero?: string;
  sector?: string;
  edificio?: string;
  piso?: string;
  latitud?: number | null;
  longitud?: number | null;

  id_tipo_servicio?: number | null;
  id_tipo_hardware?: number | null;
  id_sistema_operativo?: number | null;
}

export interface Reporte extends ReporteCreate {
  id_reporte: number;
  timestamp?: string;
  nombre_cliente?: string;
  estado_servicio?: string;
}
