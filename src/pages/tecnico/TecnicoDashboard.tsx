/**
 * ============================================================
 * Archivo: src/pages/tecnico/TecnicoDashboard.tsx
 * Propósito:
 *  - Dashboard del Técnico:
 *    • KPI: Reportes asignados HOY (con fallback si el endpoint devuelve 0)
 *    • “Proximos hasta viernes” (HOY ∪ mañana→viernes, sin duplicados)
 *    • “Proximo servicio” (más cercano a la hora actual, muestra ID, FECHA, estado)
 *    • “Estados Ultimos 31 dias” (agrupa por estado_servicio, con total)
 * Notas:
 *  - Normaliza todas las fechas a YYYY-MM-DD para comparar sin errores de zona.
 *  - Un reporte “es mío” si rut_usuario === rut || rut_responsable === rut.
 *  - Mantiene logs de depuración (activos si VITE_ENVIRONMENT !== 'production').
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import useAuthStore from '../../store/authStore';
import api from '../../services/api';
import { MapPinIcon } from '@heroicons/react/24/outline';

// ====== DEBUG ======
const DEBUG = (import.meta as any)?.env?.VITE_ENVIRONMENT !== 'production';
const dbg = {
  group(label: string) { if (DEBUG) console.groupCollapsed(label); },
  end() { if (DEBUG) console.groupEnd(); },
  log(...args: any[]) { if (DEBUG) console.log(...args); },
  table(data: any) { if (DEBUG) console.table(data); },
  error(...args: any[]) { if (DEBUG) console.error(...args); },
};

// ====== Tipos mínimos que usamos aquí (coinciden con tu API) ======
type ApiReporte = {
  id_reporte: number;
  fecha_reporte: string;
  hora_inicio?: string | null;
  comentario?: string | null;
  rut_usuario?: string | null;
  rut_responsable?: string | null;
  nombre_cliente?: string | null;
  cliente?: string | null;
  estado_servicio?: string | null;
  tipo_servicio?: string | null;
  direccion?: string | null;
  numero?: string | null;
  sector?: string | null;
  edificio?: string | null;
  piso?: string | null;
  id_estado_servicio?: number | null;
  id_tipo_servicio?: number | null;
};

type UiReporte = ApiReporte & { _fecha: string }; // YYYY-MM-DD

// ====== Helpers fecha/RUT ======
function pad2(n: number) { return String(n).padStart(2, '0'); }
function toYMD(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function normalizeFechaYMD(raw: string): string {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return toYMD(d);
}

function nextFridayInclusive(from: Date) {
  const d = new Date(from);
  const day = d.getDay(); // 0=Dom, 5=Vie
  const diff = day <= 5 ? 5 - day : 12 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function normalizeRut(r?: string | null) {
  return (r || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();
}
function esMio(r: ApiReporte, rut: string) {
  const R = normalizeRut(rut);
  return normalizeRut(r.rut_usuario) === R || normalizeRut(r.rut_responsable) === R;
}

function toUi(r: ApiReporte): UiReporte {
  return { ...r, _fecha: normalizeFechaYMD(r.fecha_reporte) };
}

function hmToMinutes(hm?: string | null) {
  if (!hm) return 24 * 60 + 1;
  const [h, m] = hm.split(':').map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 24 * 60 + 1;
  return h * 60 + m;
}

function buildAddressText(r: ApiReporte) {
  const parts: string[] = [];
  if (r.direccion) parts.push(r.direccion);
  if (r.numero) parts.push(`numero: ${r.numero}`);
  if (r.sector) parts.push(`Sector: ${r.sector}`);
  if (r.edificio) parts.push(`Edificio: ${r.edificio}`);
  if (r.piso) parts.push(`Piso: ${r.piso}`);
  return parts.join(', ');
}
function buildMapsLink(r: ApiReporte) {
  const direccion = (r.direccion || '').toString().trim();
  const numero = (r.numero || '').toString().trim();
  const query = [direccion, numero].filter(Boolean).join(' ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '#';
}

const allowedEstadosProximo = ['ASIGNADO'];

function normalizeEstadoNombre(raw?: string | null) {
  const base = (raw || '').toString().trim();
  if (!base) return '';
  const withoutDiacritics = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return withoutDiacritics.toUpperCase();
}

function esEstadoPermitido(estado?: string | null) {
  const normalized = normalizeEstadoNombre(estado);
  if (!normalized) return false;
  if (allowedEstadosProximo.some((estado) => normalized.startsWith(estado))) return true;
  return normalized.startsWith('REPROG');
}


export default function TecnicoDashboard() {
  const { usuario } = useAuthStore();
  const rut = usuario?.rut ?? '';

  const [hoyApi, setHoyApi] = useState<UiReporte[]>([]);
  const [todos, setTodos] = useState<UiReporte[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ahora = new Date();
  const hoyISO = toYMD(ahora);
  const finSemanaISO = toYMD(nextFridayInclusive(ahora));
  const minHoy = ahora.getHours() * 60 + ahora.getMinutes();

  useEffect(() => {
    (async () => {
      try {
        setCargando(true);
        setError(null);

        dbg.group(' RUT');
        dbg.log('rut (store):', rut, 'rut(normalized):', normalizeRut(rut));
        dbg.end();

        // 1) Endpoint HOY
        dbg.group(' GET /dashboard/tecnico/reportes-hoy/:rut');
        const respHoy = await api.get<ApiReporte[]>(`/dashboard/tecnico/reportes-hoy/${normalizeRut(rut)}`);
        const hoyRows = (respHoy?.data || []).map(toUi);
        setHoyApi(hoyRows);
        dbg.log('Total HOY endpoint:', hoyRows.length);
        dbg.table(hoyRows.slice(0, 6).map(r => ({ id: r.id_reporte, _fecha: r._fecha, hora: r.hora_inicio, u: r.rut_usuario, resp: r.rut_responsable })));
        dbg.end();

        // 2) Todos
        dbg.group(' GET /reportes');
        const respTodos = await api.get<ApiReporte[]>(`/reportes`);
        const allRows = (respTodos?.data || []).map(toUi);
        setTodos(allRows);
        dbg.log('Total /reportes:', allRows.length);
        dbg.table(allRows.slice(0, 6).map(r => ({ id: r.id_reporte, _fecha: r._fecha, hora: r.hora_inicio, u: r.rut_usuario, resp: r.rut_responsable })));
        dbg.end();
      } catch (e: any) {
        dbg.error(e);
        setError(e?.message || 'Error al cargar dashboard');
      } finally {
        setCargando(false);
      }
    })();
  }, [rut]);

  //  KPI HOY -- endpoint con fallback a /reportes
  const totalHoy = useMemo(() => {
    const viaEndpoint = hoyApi.filter(r => esMio(r, rut) && r._fecha === hoyISO).length;
    const viaTodos = todos.filter(r => esMio(r, rut) && r._fecha === hoyISO).length;
    const total = viaEndpoint || viaTodos;
    dbg.group('🔢 Derivado: totalHoy');
    dbg.log({ viaEndpoint, viaTodos, total });
    dbg.end();
    return total;
  }, [hoyApi, todos, rut, hoyISO]);

  //  Proximos hasta viernes (HOY ∪ mañana→viernes)
  const proximosSemana = useMemo(() => {
    const hoySolo = [
      ...hoyApi.filter(r => esMio(r, rut) && r._fecha === hoyISO),
      ...todos.filter(r => esMio(r, rut) && r._fecha === hoyISO),
    ];
    const manianaAViernes = todos.filter(
      r => esMio(r, rut) && r._fecha > hoyISO && r._fecha <= finSemanaISO
    );

    const merged = [...hoySolo, ...manianaAViernes];
    const uniq = new Map<number, UiReporte>();
    merged.forEach(r => r.id_reporte && uniq.set(r.id_reporte, r));
    const res = Array.from(uniq.values()).sort((a, b) =>
      a._fecha === b._fecha
        ? hmToMinutes(a.hora_inicio) - hmToMinutes(b.hora_inicio)
        : a._fecha.localeCompare(b._fecha)
    );

    dbg.group(' Derivado: proximosSemana (HOY ∪ mañana→viernes)');
    dbg.log('hoySolo:', hoySolo.length, 'mañana→viernes:', manianaAViernes.length, 'merged(unique):', res.length);
    dbg.table(res.slice(0, 8).map(r => ({ id: r.id_reporte, _fecha: r._fecha, hora: r.hora_inicio })));
    dbg.end();
    return res;
  }, [hoyApi, todos, rut, hoyISO, finSemanaISO]);

  //  Proximo servicio
  const proximoServicio = useMemo(() => {
    const candidatos = [...hoyApi, ...todos]
      .filter(r => esMio(r, rut))
      .filter(r => esEstadoPermitido(r.estado_servicio))
      .filter(r => (r._fecha > hoyISO) || (r._fecha === hoyISO && hmToMinutes(r.hora_inicio) >= minHoy))
      .sort((a, b) =>
        a._fecha === b._fecha
          ? hmToMinutes(a.hora_inicio) - hmToMinutes(b.hora_inicio)
          : a._fecha.localeCompare(b._fecha)
      );
    const first = candidatos[0] || null;

    dbg.group(' Derivado: proximoServicio');
    dbg.log('futuros total:', candidatos.length);
    dbg.table(candidatos.slice(0, 5).map(r => ({ id: r.id_reporte, _fecha: r._fecha, hora: r.hora_inicio, estado: r.estado_servicio })));
    dbg.end();
    return first;
  }, [hoyApi, todos, rut, hoyISO, minHoy]);

  //  Estados (Ultimos 31 dias)
  const estados31d = useMemo(() => {
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - 31);
    const desdeISO = toYMD(desde);

    const rango = todos.filter(r => esMio(r, rut) && r._fecha >= desdeISO && r._fecha <= hoyISO);
    const map = new Map<string, number>();
    rango.forEach(r => {
      const key = r.estado_servicio?.toString().trim() || 'SIN ESTADO';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const arr = Array.from(map.entries())
      .map(([estado, total]) => ({ estado, total }))
      .sort((a, b) => b.total - a.total);
    const total = arr.reduce((s, x) => s + x.total, 0);

    dbg.group('📊 Derivado: estados31d');
    dbg.log('desde:', desdeISO, 'hasta:', hoyISO, 'registros:', rango.length);
    dbg.table(arr);
    dbg.end();

    return { arr, total };
  }, [todos, rut, ahora, hoyISO]);

  // ====== Render ======
  if (cargando) {
    return (
      <DashboardLayout>
        <div className="animate-pulse grid gap-4">
          <div className="h-24 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-40 bg-gray-200 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          {error}
        </div>
      </DashboardLayout>
    );
  }

  const addr = proximoServicio ? buildAddressText(proximoServicio) : '';
  const mapsUrl = proximoServicio ? buildMapsLink(proximoServicio) : '#';

  const estadoActual = proximoServicio
    ? (proximoServicio.estado_servicio || (proximoServicio.id_estado_servicio ? `#${proximoServicio.id_estado_servicio}` : '--'))
    : '--';

  const proximoInfoTiles = proximoServicio
    ? [
        { label: 'ID REPORTE', value: `#${proximoServicio.id_reporte}` },
        { label: 'Fecha', value: proximoServicio._fecha || '--' },
        { label: 'Hora de inicio', value: proximoServicio.hora_inicio || '--:--', emphasis: true },
        { label: 'Servicio', value: proximoServicio.tipo_servicio || (proximoServicio.id_tipo_servicio ? `Servicio #${proximoServicio.id_tipo_servicio}` : '--'), span: 2 },
        { label: 'Cliente', value: proximoServicio.nombre_cliente || proximoServicio.cliente || '--', span: 2 },
      ]
    : [];

  const comentarioProximo = (proximoServicio?.comentario || '').trim();

  return (
    <DashboardLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">Dashboard Tecnico</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-300">Resumen de tareas y reportes asignados.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Reportes HOY */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-sm">
          <div className="text-sm text-gray-500 dark:text-gray-400">Reportes asignados HOY</div>
          <div className="mt-2 text-3xl font-black text-gray-900 dark:text-gray-100">{totalHoy}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">({hoyISO})</div>
        </div>

        {/* Proximos hasta viernes */}
        <div className="rounded-2xl p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-sm md:col-span-2">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Proximos hasta viernes ({finSemanaISO})
          </div>
          {proximosSemana.length === 0 ? (
            <div className="mt-2 text-gray-600 dark:text-gray-300">Sin reportes proximos.</div>
          ) : (
            <ul className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-2">
              {proximosSemana.map((r) => (
                <li key={r.id_reporte} className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 pb-2 last:border-none">
                  <div className="min-w-0">
                    <div className="font-semibold truncate text-gray-900 dark:text-gray-100">
                      {r._fecha} - {r.hora_inicio || '--:--'} - {r.nombre_cliente || r.cliente || 'Cliente'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {(r.tipo_servicio || (r.id_tipo_servicio ? `Servicio #${r.id_tipo_servicio}` : 'Servicio'))} - {buildAddressText(r)}
                    </div>
                  </div>
                  <a
                    className="inline-flex items-center gap-1 rounded-md border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 px-3 py-1 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                    href={buildMapsLink(r)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir en Maps"
                  >
                    <MapPinIcon className="h-4 w-4" />
                    <span>Abrir</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Proximo servicio */}
      <div className="rounded-2xl p-5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-sm">
        <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100">Proximo servicio</h2>
        {!proximoServicio ? (
          <div className="text-gray-600 dark:text-gray-300">No hay servicios proximos.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {proximoInfoTiles.map((item) => {
                  const spanClass =
                    item.span === 2 ? 'sm:col-span-2' : item.span === 3 ? 'sm:col-span-3' : '';
                  const valueClass = item.emphasis
                    ? 'mt-2 text-xl font-extrabold text-gray-900 dark:text-gray-100'
                    : 'mt-2 font-semibold text-gray-900 dark:text-gray-100';
                  return (
                    <div
                      key={item.label}
                      className={`rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-3 ${spanClass}`}
                    >
                      <div className="text-xs uppercase text-gray-500 dark:text-gray-400">{item.label}</div>
                      <div className={valueClass}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4">
                <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Comentario</div>
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">{comentarioProximo || '--'}</div>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 p-4">
                <div className="text-xs uppercase text-gray-500 dark:text-gray-400">Direccion</div>
                <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">{addr || '--'}</div>
                <a
                  className="mt-3 inline-flex items-center gap-2 self-start rounded-md border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 px-3 py-1 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir en Maps"
                >
                  <MapPinIcon className="h-4 w-4" />
                  <span>Abrir en Maps</span>
                </a>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-xl border border-blue-200 dark:border-blue-500/40 bg-blue-50/60 dark:bg-blue-500/10 p-4">
              <div>
                <div className="text-xs uppercase text-blue-700 dark:text-blue-200">Estado actual</div>
                <div className="mt-2 text-2xl font-bold text-blue-900 dark:text-blue-100">{estadoActual}</div>
                <p className="mt-3 text-sm text-blue-800/90 dark:text-blue-200/80">Organiza este servicio y revisa los materiales necesarios.</p>
              </div>
              <div className="rounded-lg border border-blue-200 dark:border-blue-500/40 bg-white dark:bg-gray-900/40 p-3">
                <div className="text-xs uppercase text-blue-700 dark:text-blue-200">Horario objetivo</div>
                <div className="mt-2 text-lg font-semibold text-blue-900 dark:text-blue-100">{proximoServicio.hora_inicio || '--:--'}</div>
                <div className="text-xs text-blue-800/90 dark:text-blue-200/70">Fecha {proximoServicio._fecha || '--'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estados Ultimos 31 dias */}
      <div className="rounded-2xl p-5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shadow-sm mt-4">
        <h2 className="text-lg font-bold mb-3 text-gray-900 dark:text-gray-100">Estados (Ultimos 31 dias)</h2>
        {estados31d.arr.length === 0 ? (
          <div className="text-gray-600 dark:text-gray-300">No hay datos para el rango.</div>
        ) : (
          <>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {estados31d.arr.map((e) => (
                <li key={e.estado} className="flex items-center justify-between py-2">
                  <span className="text-gray-700 dark:text-gray-200">{e.estado}</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{e.total}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 pt-3 border-t border-gray-300 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Total</span>
              <span className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{estados31d.total}</span>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
