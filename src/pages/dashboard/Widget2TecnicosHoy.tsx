/**
 * ============================================================
 * Archivo: src/pages/dashboard/Widget2TecnicosHoy.tsx
 * Widget 2: Técnicos (asignados hoy y disponibles)
 * Descripción:
 *  - Llama a: GET /dashboard/supervisor/tecnicos-disponibles
 *  - Muestra listados con asignaciones del día y técnicos en standby.
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

type TecnicoItem = {
  rut: string;
  nombre: string;
  id_reporte: number | null;
  fecha_reporte: string | null;
  hora_inicio: string | null;
  nombre_cliente: string | null;
  estado: 'Asignado' | 'Disponible';
};

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

export default function Widget2TecnicosHoy() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<TecnicoItem[]>([]);
  const hoy = useMemo(() => todayISO(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        // ✅ Sin prefijo /api: api.ts ya lo agrega
        const { data } = await api.get('/dashboard/supervisor/tecnicos-disponibles');
        if (!mounted) return;
        setItems(Array.isArray(data) ? data : []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || 'Error al cargar técnicos.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Agrupar asignados por técnico para listar todas sus horas/cliente del día
  const asignados = useMemo(() => {
    const result: Record<
      string,
      { rut: string; nombre: string; horas: { hora: string; cliente?: string | null }[] }
    > = {};
    items
      .filter((t) => t.estado === 'Asignado')
      .forEach((t) => {
        if (!result[t.rut]) result[t.rut] = { rut: t.rut, nombre: t.nombre, horas: [] };
        result[t.rut].horas.push({ hora: t.hora_inicio ? t.hora_inicio.slice(0, 5) : '—', cliente: t.nombre_cliente });
      });
    return result;
  }, [items]);

  const disponibles = useMemo(() => items.filter((t) => t.estado !== 'Asignado'), [items]);

  return (
    <section
      aria-labelledby="w2-title"
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
    >
      <h2 id="w2-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Técnicos — Asignaciones de hoy y disponibles
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400">Fecha: {hoy}</p>

      {loading ? (
        <div className="mt-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : err ? (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : (
        <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Asignados */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Con asignaciones hoy</h3>
            {Object.keys(asignados).length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">No hay asignaciones.</p>
            ) : (
              <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
                {Object.entries(asignados).map(([key, grupo]) => (
                  <li
                    key={key}
                    className="rounded-md bg-white dark:bg-gray-800 border dark:border-gray-600 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {grupo.nombre} <span className="text-xs text-gray-500 dark:text-gray-400">({grupo.rut})</span>
                      </p>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
                        {grupo.horas.length} asignación(es)
                      </span>
                    </div>
                    <ol className="mt-2 grid sm:grid-cols-2 gap-1.5">
                      {grupo.horas
                        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
                        .map((a, idx) => (
                          <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">{a.hora}</span>
                            {a.cliente ? ` — ${a.cliente}` : ''}
                          </li>
                        ))}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Disponibles */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Disponibles</h3>
            {disponibles.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">Sin técnicos disponibles.</p>
            ) : (
              <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
                {disponibles.map((t) => (
                  <li
                    key={t.rut}
                    className="rounded-md bg-white dark:bg-gray-800 border dark:border-gray-600 p-3 flex items-center justify-between gap-3"
                  >
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                      {t.nombre} <span className="text-xs text-gray-500 dark:text-gray-400">({t.rut})</span>
                    </p>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-green-600 text-white">Disponible</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
