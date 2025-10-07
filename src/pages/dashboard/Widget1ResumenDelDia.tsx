/**
 * ============================================================
 * Archivo: src/pages/dashboard/Widget1ResumenDelDia.tsx
 * Widget 1: Resumen del día (Total de reportes + desglose por estado)
 * Descripción:
 *  - Llama a la API del dashboard para obtener:
 *      a) Total del día actual
 *      b) Distribución por estado (para hoy)
 *  - Aplica normalización de fechas y fallback robusto
 * Notas:
 *  - Endpoints esperados:
 *      GET  /dashboard/supervisor/reportes-hoy
 *      GET  /dashboard/supervisor/estado-reportes?fechaInicio=YYYY-MM-DD HH:mm:ss&fechaFin=YYYY-MM-DD HH:mm:ss
 *      GET  /reportes   (fallback y agrupación local si fuera necesario)
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

type EstadoResumen = { estado: string; cantidad: number };
type ApiReporte = {
  id_reporte: number;
  fecha_reporte: string; // puede venir en ISO con "Z"
  estado_servicio?: string | null;
  id_estado_servicio?: number | null;
};

const DEBUG = (import.meta as any)?.env?.VITE_ENVIRONMENT !== 'production';
const dbg = {
  group(label: string) { if (DEBUG) console.groupCollapsed(label); },
  end() { if (DEBUG) console.groupEnd(); },
  log(...args: any[]) { if (DEBUG) console.log(...args); },
  table(data: any) { if (DEBUG) console.table?.(data); },
};

function pad2(n: number) { return String(n).padStart(2, '0'); }
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function normalizeYMD(raw: string) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : toYMD(d);
}
const todayISO = () => toYMD(new Date());
const todayStart = (d: string) => `${d} 00:00:00`;
const todayEnd = (d: string) => `${d} 23:59:59`;

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/50 ${className}`} />;
}

export default function Widget1ResumenDelDia() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [totalHoyApi, setTotalHoyApi] = useState<number>(0);
  const [estadosApi, setEstadosApi] = useState<EstadoResumen[]>([]);
  const [reportesAll, setReportesAll] = useState<ApiReporte[]>([]);

  const hoy = useMemo(() => todayISO(), []);

  // Derivados/fallbacks
  const totalDesdeEstados = useMemo(
    () => estadosApi.reduce((acc, e) => acc + (Number(e.cantidad) || 0), 0),
    [estadosApi]
  );

  const totalDesdeReportes = useMemo(() => {
    const normalizados = reportesAll.map(r => normalizeYMD(r.fecha_reporte));
    const total = normalizados.filter(f => f === hoy).length;
    dbg.group('🧮 Fallback totalDesdeReportes');
    dbg.log('hoy:', hoy, 'coinciden:', total);
    dbg.end();
    return total;
  }, [reportesAll, hoy]);

  // Valor final que se muestra (robusto)
  const totalFinalHoy = useMemo(() => {
    const max = Math.max(
      Number(totalHoyApi) || 0,
      Number(totalDesdeEstados) || 0,
      Number(totalDesdeReportes) || 0
    );
    dbg.group(' KPI Total Hoy (resuelto)');
    dbg.log({ totalHoyApi, totalDesdeEstados, totalDesdeReportes, totalFinal: max });
    dbg.end();
    return max;
  }, [totalHoyApi, totalDesdeEstados, totalDesdeReportes]);

  // Estados: si el endpoint viene vacío o inconsistente, los calculamos localmente
  const estadosFinales: EstadoResumen[] = useMemo(() => {
    if (estadosApi.length > 0) return estadosApi;

    // Agrupar localmente desde /reportes (solo los de HOY)
    const map = new Map<string, number>();
    reportesAll.forEach(r => {
      if (normalizeYMD(r.fecha_reporte) !== hoy) return;
      const key = (r.estado_servicio || (r.id_estado_servicio != null ? `Estado #${r.id_estado_servicio}` : 'SIN ESTADO')).toString();
      map.set(key, (map.get(key) || 0) + 1);
    });
    const arr = Array.from(map.entries()).map(([estado, cantidad]) => ({ estado, cantidad }));
    dbg.group('🧩 Fallback estadosFinales (local)');
    dbg.table(arr);
    dbg.end();
    return arr;
  }, [estadosApi, reportesAll, hoy]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Pedimos todo en paralelo:
        const [rTotal, rEstados, rTodos] = await Promise.all([
          api.get('/dashboard/supervisor/reportes-hoy'),
          api.get('/dashboard/supervisor/estado-reportes', {
            // Pasamos día completo (00:00:00 a 23:59:59) para incluir todos los registros del día
            params: { fechaInicio: todayStart(hoy), fechaFin: todayEnd(hoy) },
          }),
          api.get('/reportes'),
        ]);

        if (!mounted) return;

        // 1) Total "oficial" del endpoint
        setTotalHoyApi(rTotal?.data?.total_hoy ?? 0);

        // 2) Estados del endpoint (podrían venir vacíos si el backend exige sólo YYYY-MM-DD,
        //    pero con 00:00–23:59 suele quedar OK)
        setEstadosApi(Array.isArray(rEstados?.data) ? rEstados.data : []);

        // 3) Todos (para fallback y agrupación local)
        setReportesAll(Array.isArray(rTodos?.data) ? rTodos.data : []);

        // Logs de depuración
        dbg.group('📦 Widget1ResumenDelDia — DEBUG');
        dbg.log('hoy:', hoy);
        dbg.log('totalHoyApi:', rTotal?.data?.total_hoy);
        dbg.log('estadosApi:', rEstados?.data);
        dbg.log('reportesAll (primeros 6):');
        dbg.table((rTodos?.data || []).slice(0, 6).map((r: ApiReporte) => ({
          id: r.id_reporte,
          fecha_raw: r.fecha_reporte,
          fecha_norm: normalizeYMD(r.fecha_reporte),
        })));
        dbg.end();
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || 'Error al cargar el resumen del día.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [hoy]);

  return (
    <section
      aria-labelledby="w1-title"
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
    >
      <h2 id="w1-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Resumen del día — {hoy}
      </h2>

      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ) : err ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : (
        <>
          {/* KPI principal */}
          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-extrabold text-gray-900 dark:text-gray-100" aria-live="polite">
              {totalFinalHoy}
            </div>
            <div className="pb-1 text-sm text-gray-500 dark:text-gray-400">reportes con fecha de hoy</div>
          </div>

          {/* Desglose por estado */}
          <div className="mt-4">
            <h3 className="sr-only">Desglose por estado</h3>
            {estadosFinales.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin reportes para hoy.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {estadosFinales.map((e) => (
                  <li
                    key={e.estado}
                    className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{e.estado}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{e.cantidad}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
