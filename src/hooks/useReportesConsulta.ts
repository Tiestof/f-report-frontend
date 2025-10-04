/**
 * ============================================================
 * Archivo: src/hooks/useReportesConsulta.ts
 * Propósito:
 *  - Hook con React Query para consultar /reportes/consulta
 *    bajo demanda (enabled = false por defecto).
 *  - Manejar paginación y cache por clave.
 *
 * Notas:
 *  - React Query v5: 'keepPreviousData' fue removido.
 *    Usamos 'placeholderData: (prev) => prev' para mantener
 *    los datos previos durante la transición de páginas.
 * ============================================================
 */

import { useQuery } from '@tanstack/react-query';
import reportesConsultaService from '../services/reportesConsulta.service';
import type {
  ReportesConsultaParams,
  ReportesConsultaResponse,
} from '../services/reportesConsulta.service';

interface UseReportesConsultaArgs {
  params: ReportesConsultaParams;
  enabled?: boolean; // default false → consulta bajo demanda
}

export function useReportesConsulta({ params, enabled = false }: UseReportesConsultaArgs) {
  return useQuery({
    queryKey: ['reportes-consulta', params],
    queryFn: () => reportesConsultaService.getReportesConsulta(params),
    enabled,
    // Mantiene el resultado previo (UX más suave al paginar / filtrar)
    placeholderData: (prev?: ReportesConsultaResponse) => prev,
    // Evita recargar al cambiar de pestaña/ventana
    refetchOnWindowFocus: false,
    // Tiempo razonable de “frescura”
    staleTime: 30_000,
  });
}

export type { ReportesConsultaParams, ReportesConsultaResponse };
