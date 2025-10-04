/**
 * ============================================================
 * Archivo: src/services/reportesConsulta.service.ts
 * Propósito:
 *  - Consumir /api/reportes/consulta con paginación y filtros.
 *  - Normalizar tipos (booleanos/fechas/números) para evitar 500.
 *  - Exponer tipos fuertes para el frontend (rows + params).
 *
 * Reglas:
 *  - 'con_evidencias' y 'con_gastos' se envían como '1' | '0'.
 *  - Fechas en formato YYYY-MM-DD.
 *  - page ≥ 1 y pageSize razonable (p.e. 15/20/50).
 *
 * Seguridad:
 *  - Usa instancia Axios con interceptores JWT (services/api.ts).
 *
 * TODO:
 *  - Incluir nuevos campos si la API crece (actividad, etc.).
 * ============================================================
 */

import api from './api';

export interface ReporteConsultaRow {
  id_reporte: number;
  rut_responsable: string | null;
  nombre_responsable?: string | null;
  estado_servicio?: string | null;
  fecha_reporte: string; // YYYY-MM-DD
  evidencias_count: number; // ← requerido para grilla
  gastos_count: number;     // ← requerido para grilla
  rut_cliente?: string | null;
  nombre_cliente?: string | null;
  id_rut_empresa_cobro?: string | null;
  nombre_centro_costo?: string | null;
}

export interface ReportesConsultaParams {
  // paginación
  page: number;
  pageSize: number;

  // filtros (opcionales)
  rut_responsable?: string;
  id_estado_servicio?: number;
  fecha_desde?: string; // YYYY-MM-DD
  fecha_hasta?: string; // YYYY-MM-DD
  con_evidencias?: boolean; // true/false → "1"/"0"
  con_gastos?: boolean;     // true/false → "1"/"0"
  rut_cliente?: string;
  id_rut_empresa_cobro?: string;
}

export interface ReportesConsultaResponse {
  data: ReporteConsultaRow[];
  total: number;
}

/** Normaliza booleanos a "1"/"0" y limpia undefined/null */
function sanitizeQuery(p: ReportesConsultaParams) {
  const q: Record<string, string> = {};

  // paginación segura
  const page = Math.max(1, Number(p.page || 1));
  const pageSize = Math.max(1, Number(p.pageSize || 15));
  q.page = String(page);
  q.pageSize = String(pageSize);

  // helpers
  const setIf = (k: string, v: any) => {
    if (v === undefined || v === null || v === '') return;
    q[k] = String(v);
  };

  setIf('rut_responsable', p.rut_responsable);
  setIf('id_estado_servicio', Number.isFinite(p.id_estado_servicio) ? p.id_estado_servicio : undefined);
  setIf('fecha_desde', p.fecha_desde);
  setIf('fecha_hasta', p.fecha_hasta);
  setIf('rut_cliente', p.rut_cliente);
  setIf('id_rut_empresa_cobro', p.id_rut_empresa_cobro);

  // booleanos como 1/0 (evita errores SQL y 500)
  if (typeof p.con_evidencias === 'boolean') q.con_evidencias = p.con_evidencias ? '1' : '0';
  if (typeof p.con_gastos === 'boolean') q.con_gastos = p.con_gastos ? '1' : '0';

  return q;
}

/**
 * GET /api/reportes/consulta
 * @param params Parámetros de paginación + filtros
 */
async function getReportesConsulta(params: ReportesConsultaParams): Promise<ReportesConsultaResponse> {
  const q = sanitizeQuery(params);
  const { data } = await api.get<ReportesConsultaResponse>('/reportes/consulta', { params: q });
  // Validaciones mínimas
  return {
    data: Array.isArray(data?.data) ? data.data : [],
    total: Number.isFinite(data?.total) ? data.total : (Array.isArray(data?.data) ? data.data.length : 0),
  };
}

const reportesConsultaService = { getReportesConsulta };
export default reportesConsultaService;
// Nota: 'ReporteConsultaRow' ya fue exportado arriba como 'interface'.
// Los consumidores pueden hacer: `import { type ReporteConsultaRow } from '...'`.
