/**
 * ============================================================
 * Archivo: src/types/index.ts
 * Descripción: Tipos TS compartidos para F-REPORT (Reportes, Catálogos).
 * Notas:
 *  - El campo id_estado_servicio referencia a EstadoServicio.
 *  - El valor 5 se usa como "eliminado" (convención de negocio).
 *
 * Autor: Equipo F-REPORT
 * ============================================================
 */

/**
 * Reporte: coincide con columnas de la tabla Reporte.
 * - fecha_reporte: ISO (yyyy-mm-dd)
 * - hora_inicio / hora_fin: HH:mm:ss (o HH:mm)
 * - latitud / longitud: números (pueden venir null).
 */
export type Reporte = {
  id_reporte?: number;
  fecha_reporte?: string;          // ISO yyyy-mm-dd
  timestamp?: string | null;
  comentario?: string | null;
  hora_inicio?: string | null;
  hora_fin?: string | null;

  // Dirección (no editable por técnico en edición)
  direccion?: string | null;
  numero?: string | null;

  // Reglas de acceso / auditoría
  rut_usuario?: string | null;      // quien creó
  rut_responsable?: string | null;  // técnico asignado

  // Relacionales
  rut_cliente?: string | null;
  id_tipo_servicio?: number | null;
  id_tipo_hardware?: number | null;
  id_sistema_operativo?: number | null;
  id_estado_servicio?: number | null;
  id_rut_empresa_cobro?: string | null;

  // Ubicación / opcionales
  sector?: string | null;
  edificio?: string | null;
  piso?: string | null;
  latitud?: number | null;
  longitud?: number | null;

  // Extras de joins (cuando la API retorna descripciones):
  nombre_usuario?: string | null;
  nombre_cliente?: string | null;
  tipo_servicio?: string | null;
  tipo_hardware?: string | null;
  nombre_sistema?: string | null;
  estado_servicio?: string | null;
};

/**
 * ReporteCreate: payload para crear/actualizar reportes.
 * Usamos todos opcionales para facilitar updates parciales desde UI.
 * (El backend valida requeridos; p. ej. id_estado_servicio, etc.)
 */
export type ReporteCreate = Partial<{
  fecha_reporte: string;
  comentario: string;
  hora_inicio: string;
  hora_fin: string;
  direccion: string;
  numero: string;
  rut_usuario: string;
  rut_responsable: string;
  rut_cliente: string | null;
  id_tipo_servicio: number | null;
  id_tipo_hardware: number | null;
  id_sistema_operativo: number | null;
  id_estado_servicio: number | null;
  sector: string | null;
  edificio: string | null;
  piso: string | null;
  latitud: number | null;
  longitud: number | null;
  id_rut_empresa_cobro: string | null;
}>;

/** Catálogo EstadoServicio */
export type EstadoServicio = {
  id_estado_servicio: number;
  descripcion: string;
};

/** Map de clientes: rut_cliente -> nombre_cliente */
export type ClienteMap = Record<string, string>;

/** Constante de negocio: estado "eliminado" */
export const ESTADO_ELIMINADO = 5 as const;

/** TODO:
 * - Extraer los "joins" a un tipo ReporteView si se quiere separar payload vs. vista.
 * - Agregar tipos de Gasto/Evidencia cuando integremos sus modales.
 */
