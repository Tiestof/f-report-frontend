/**
 * ============================================================
 * Archivo: src/pages/supervisor/SupervisorDashboard.tsx
 * Página: Dashboard Supervisor (HOME)
 * Descripción:
 *  - Muestra:
 *    1) Resumen de reportes del día (Total + Desglose por estado)
 *    2) Técnicos disponibles/asignados (panel izquierdo)
 *    3) [Nuevo] Dentro del Resumen del día: “Técnicos con asignaciones hoy”
 *       agrupando por técnico y mostrando hora(s) de inicio y cliente(s).
 *
 * API utilizada:
 *  - GET /api/dashboard/supervisor/reportes-hoy
 *      -> { total_hoy: number }
 *  - GET /api/dashboard/supervisor/estado-reportes?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
 *      -> [{ estado: string, cantidad: number }]
 *  - GET /api/dashboard/supervisor/tecnicos-disponibles
 *      -> [{ rut, nombre, id_reporte|null, fecha_reporte|null, hora_inicio|null, nombre_cliente|null, estado: 'Asignado'|'Disponible' }]
 *
 * Notas:
 *  - Se mantiene todo desacoplado para luego poder mover los widgets a
 *    src/components/dashboard/ si lo deseas.
 *  - Accesibilidad y estados de carga/errores incluidos.
 *  - Usa Axios central (services/api.ts) con interceptores JWT.
 *
 * TODO:
 *  - Integrar React Query para caching.
 *  - Filtros de fecha/cliente.
 *  - Exportación a CSV/PNG.
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../services/api';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/** Tipos locales derivados de la API */
type EstadoResumen = { estado: string; cantidad: number };
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

/** Badge sencillo reutilizable */
function StatusPill({ label, tone }: { label: string; tone: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }) {
  const map: Record<string, string> = {
    green: 'bg-green-100 text-green-800 ring-green-200',
    yellow: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
    red: 'bg-red-100 text-red-800 ring-red-200',
    gray: 'bg-gray-100 text-gray-800 ring-gray-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${map[tone]}`}
      role="status"
      aria-label={label}
      title={label}
    >
      {label}
    </span>
  );
}

/** Mapea descripciones de estado a un color consistente */
function toneByEstado(estado: string): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
  const e = estado.toLowerCase();
  if (e.includes('final')) return 'green';
  if (e.includes('progreso') || e.includes('asign')) return 'blue';
  if (e.includes('pend')) return 'yellow';
  if (e.includes('cancel') || e.includes('elimin')) return 'red';
  return 'gray';
}

/** Skeleton básico para placeholders */
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/50 ${className}`} />;
}

/**
 * Widget: Resumen del Día
 * - Total reportes hoy
 * - Desglose por estado (usando endpoint de rango con hoy)
 * - [Nuevo] Técnicos con asignaciones hoy (agrupados y con múltiples horas)
 */
function ResumenDiaCard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [totalHoy, setTotalHoy] = useState<number>(0);
  const [estados, setEstados] = useState<EstadoResumen[]>([]);
  const [tecnicosAsignados, setTecnicosAsignados] = useState<
    { rut: string; nombre: string; asignaciones: { hora: string; cliente?: string | null }[] }[]
  >([]);

  const hoy = useMemo(() => todayISO(), []);
  const tituloFecha = useMemo(
    () => format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es }),
    []
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // Cargamos total + estados + técnicos (una sola vez aquí)
        const [rTotal, rEstados, rTecnicos] = await Promise.all([
          api.get('/dashboard/supervisor/reportes-hoy'),
          api.get('/dashboard/supervisor/estado-reportes', {
            params: { fechaInicio: hoy, fechaFin: hoy },
          }),
          api.get('/dashboard/supervisor/tecnicos-disponibles'),
        ]);

        if (!mounted) return;

        // Total y estados
        setTotalHoy(rTotal?.data?.total_hoy ?? 0);
        setEstados(Array.isArray(rEstados?.data) ? rEstados.data : []);

        // Agrupar técnicos con estado "Asignado"
        const items: TecnicoItem[] = Array.isArray(rTecnicos?.data) ? rTecnicos.data : [];
        const asignados = items.filter((t) => t.estado === 'Asignado');

        // Mapa por RUT para agrupar muchas asignaciones por técnico
        const map = new Map<string, { rut: string; nombre: string; asignaciones: { hora: string; cliente?: string | null }[] }>();

        for (const t of asignados) {
          const key = t.rut;
          if (!map.has(key)) {
            map.set(key, {
              rut: t.rut,
              nombre: t.nombre,
              asignaciones: [],
            });
          }
          map.get(key)!.asignaciones.push({
            hora: t.hora_inicio ? t.hora_inicio.slice(0, 5) : '—',
            cliente: t.nombre_cliente ?? null,
          });
        }

        // Ordenar por nombre técnico para presentación consistente
        const agrupado = Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        setTecnicosAsignados(agrupado);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || 'Error al cargar resumen del día.');
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
      aria-labelledby="resumen-dia-title"
      className="col-span-1 md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="resumen-dia-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Resumen del día
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">{tituloFecha}</p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-40" />
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full" />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-5 w-48" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </div>
      ) : err ? (
        <div role="alert" className="rounded-md bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 p-3 text-sm">
          {err}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Total del día */}
          <div className="flex items-end gap-3">
            <div className="text-4xl font-extrabold text-gray-900 dark:text-gray-100" aria-live="polite">
              {totalHoy}
            </div>
            <div className="pb-1 text-sm text-gray-500 dark:text-gray-400">reportes con fecha de hoy</div>
          </div>

          {/* Desglose por estado */}
          <div>
            <h3 className="sr-only">Desglose por estado</h3>
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {estados.length === 0 ? (
                <li className="text-sm text-gray-500 dark:text-gray-400">Sin reportes para hoy.</li>
              ) : (
                estados.map((e) => (
                  <li
                    key={e.estado}
                    className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{e.estado}</span>
                    <StatusPill label={`${e.cantidad}`} tone={toneByEstado(e.estado)} />
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* NUEVO: Técnicos con asignaciones hoy */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
              Técnicos con asignaciones hoy
            </h3>

            {tecnicosAsignados.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Ningún técnico tiene asignaciones por ahora.</p>
            ) : (
              <ul className="space-y-2">
                {tecnicosAsignados.map((t) => (
                  <li
                    key={t.rut}
                    className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {t.nombre} <span className="text-xs text-gray-500 dark:text-gray-400">({t.rut})</span>
                      </p>
                      <StatusPill label={`${t.asignaciones.length} asignación(es)`} tone="blue" />
                    </div>

                    {/* Lista compacta de horas/cliente */}
                    <ol className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                      {t.asignaciones
                        .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''))
                        .map((a, idx) => (
                          <li key={idx} className="text-xs text-gray-700 dark:text-gray-300">
                            <span className="font-semibold">{a.hora || '—'}</span>
                            {a.cliente ? ` — ${a.cliente}` : ''}
                          </li>
                        ))}
                    </ol>
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

/**
 * Widget: Técnicos disponibles / asignados (lista lateral)
 * - Pensado como panel rápido de estado individual.
 */
function TecnicosDisponiblesPanel() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<TecnicoItem[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
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

  return (
    <aside
      aria-labelledby="tecnicos-title"
      className="col-span-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm"
    >
      <h2 id="tecnicos-title" className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Técnicos hoy
      </h2>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : err ? (
        <div role="alert" className="rounded-md bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300 p-3 text-sm">
          {err}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No hay técnicos registrados.</p>
      ) : (
        <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((t) => {
            const asignado = t.estado === 'Asignado';
            return (
              <li key={t.rut} className="py-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900 dark:text-gray-100">{t.nombre}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">RUT: {t.rut}</p>
                  {asignado && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      {t.hora_inicio ? `Inicio ${t.hora_inicio.slice(0, 5)} — ` : ''}
                      {t.nombre_cliente ? `Cliente: ${t.nombre_cliente}` : ''}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  <StatusPill label={t.estado} tone={asignado ? 'blue' : 'green'} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

/** Página principal del Dashboard Supervisor */
const SupervisorDashboard = () => {
  return (
    <DashboardLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Dashboard Supervisor</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">
          Resumen del día, asignaciones y disponibilidad del equipo técnico.
        </p>
      </div>

      {/* Grid principal: lado izquierdo técnicos, lado derecho resumen del día */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TecnicosDisponiblesPanel />
        <ResumenDiaCard />
      </div>
    </DashboardLayout>
  );
};

export default SupervisorDashboard;
