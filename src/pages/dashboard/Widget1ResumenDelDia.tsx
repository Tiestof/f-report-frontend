/**
 * ============================================================
 * Archivo: src/pages/dashboard/Widget1ResumenDelDia.tsx
 * Widget 1: Resumen del día (Total de reportes + desglose por estado)
 * Descripción:
 *  - Llama a la API del dashboard para obtener:
 *      a) Total del día actual
 *      b) Distribución por estado (para hoy)
 *  - Muestra contadores y una lista compacta por estado.
 * Notas:
 *  - Endpoints esperados (API v4):
 *      GET  /dashboard/supervisor/reportes-hoy
 *      GET  /dashboard/supervisor/estado-reportes?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 *  - No recibe props; es auto-contenido para el Dashboard.
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

type EstadoResumen = { estado: string; cantidad: number };

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/50 ${className}`} />;
}

export default function Widget1ResumenDelDia() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [totalHoy, setTotalHoy] = useState<number>(0);
  const [estados, setEstados] = useState<EstadoResumen[]>([]);
  const hoy = useMemo(() => todayISO(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // ✅ Importante: NO usar prefijo /api porque baseURL ya lo incluye
        const [rTotal, rEstados] = await Promise.all([
          api.get('/dashboard/supervisor/reportes-hoy'),
          api.get('/dashboard/supervisor/estado-reportes', {
            params: { fechaInicio: hoy, fechaFin: hoy },
          }),
        ]);

        if (!mounted) return;
        setTotalHoy(rTotal?.data?.total_hoy ?? 0);
        setEstados(Array.isArray(rEstados?.data) ? rEstados.data : []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || 'Error al cargar el resumen del día.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
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
          <div className="mt-4 flex items-end gap-3">
            <div className="text-4xl font-extrabold text-gray-900 dark:text-gray-100" aria-live="polite">
              {totalHoy}
            </div>
            <div className="pb-1 text-sm text-gray-500 dark:text-gray-400">reportes con fecha de hoy</div>
          </div>

          <div className="mt-4">
            <h3 className="sr-only">Desglose por estado</h3>
            {estados.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Sin reportes para hoy.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {estados.map((e) => (
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
