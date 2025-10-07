/**
 * ============================================================
 * Archivo: src/pages/dashboard/Widget2TecnicosHoy.tsx
 * Widget 2: Técnicos (asignados hoy y disponibles)
 * Descripción:
 *  - Llama a:
 *      GET /dashboard/supervisor/tecnicos-disponibles
 *      GET /reportes  (fallback/validación)
 *  - Normaliza fechas (YYYY-MM-DD) y cruza datos para corregir:
 *      • Timezone/ISO "Z"
 *      • Casos donde sólo se filtra por rut_usuario (ignorando rut_responsable)
 *  - Agrupa asignaciones por técnico y lista todas sus horas/cliente del día.
 * ============================================================
 */

import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

// ============ Tipos ============
type TecnicoItem = {
  rut: string;
  nombre: string;
  id_reporte: number | null;
  fecha_reporte: string | null;
  hora_inicio: string | null;
  nombre_cliente: string | null;
  estado: 'Asignado' | 'Disponible';
};

type ApiReporte = {
  id_reporte: number;
  fecha_reporte: string; // puede venir ISO con "Z"
  hora_inicio?: string | null;
  rut_usuario?: string | null;
  rut_responsable?: string | null;
  nombre_cliente?: string | null;
};

// ============ DEBUG ============
const DEBUG = (import.meta as any)?.env?.VITE_ENVIRONMENT !== 'production';
const dbg = {
  group(label: string) { if (DEBUG) console.groupCollapsed(label); },
  end() { if (DEBUG) console.groupEnd(); },
  log(...args: any[]) { if (DEBUG) console.log(...args); },
  table(data: any) { if (DEBUG) console.table?.(data); },
};

// ============ Helpers ============
function pad2(n: number) { return String(n).padStart(2, '0'); }
function toYMD(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayISO() { return toYMD(new Date()); }

function normalizeYMD(raw?: string | null) {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : toYMD(d);
}

function normalizeRut(r?: string | null) {
  return (r || '').toString().replace(/[^0-9kK]/g, '').toUpperCase();
}

function horaCorta(h?: string | null) {
  return (h || '').slice(0, 5) || '—';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-gray-200/70 dark:bg-gray-700/50 ${className}`} />;
}

export default function Widget2TecnicosHoy() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<TecnicoItem[]>([]);
  const [reportes, setReportes] = useState<ApiReporte[]>([]);

  const hoy = useMemo(() => todayISO(), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [rTec, rRep] = await Promise.all([
          api.get('/dashboard/supervisor/tecnicos-disponibles'),
          api.get('/reportes'),
        ]);

        if (!mounted) return;

        const tecnicos: TecnicoItem[] = Array.isArray(rTec?.data) ? rTec.data : [];
        const repAll: ApiReporte[] = Array.isArray(rRep?.data) ? rRep.data : [];

        setItems(tecnicos);
        setReportes(repAll);

        dbg.group(' Widget2TecnicosHoy — DEBUG');
        dbg.log('Hoy:', hoy);
        dbg.log('Técnicos (sample):'); dbg.table(tecnicos.slice(0, 6));
        dbg.log('Reportes (sample):'); dbg.table(repAll.slice(0, 6).map(r => ({
          id: r.id_reporte, fecha_raw: r.fecha_reporte, fecha_norm: normalizeYMD(r.fecha_reporte),
          u: r.rut_usuario, resp: r.rut_responsable, hora: r.hora_inicio
        })));
        dbg.end();
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || 'Error al cargar técnicos.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [hoy]);

  // 1) Construir mapa de "asignados hoy" a partir de /reportes (fiable y completo)
  //    Preferimos rut_responsable; si no viene, usamos rut_usuario.
  const asignadosDesdeReportes = useMemo(() => {
    const map = new Map<string, { rut: string; horas: { hora: string; cliente?: string | null }[] }>();
    reportes.forEach((r) => {
      const fecha = normalizeYMD(r.fecha_reporte);
      if (fecha !== hoy) return;

      const rutResp = normalizeRut(r.rut_responsable);
      const rutUser = normalizeRut(r.rut_usuario);
      const rut = rutResp || rutUser; // preferimos responsable

      if (!rut) return;
      const rec = map.get(rut) || { rut, horas: [] };
      rec.horas.push({ hora: horaCorta(r.hora_inicio), cliente: r.nombre_cliente });
      map.set(rut, rec);
    });

    // ordenar horas por HH:mm
    for (const rec of map.values()) {
      rec.horas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }

    dbg.group(' asignadosDesdeReportes');
    dbg.table(Array.from(map.values()).slice(0, 10));
    dbg.end();

    return map;
  }, [reportes, hoy]);

  // 2) Set de ruts asignados según endpoint, **sólo si la fecha del endpoint es HOY**
  const asignadosDesdeEndpoint = useMemo(() => {
    const set = new Set<string>(
      items
        .filter(t => t.estado === 'Asignado' && normalizeYMD(t.fecha_reporte) === hoy)
        .map(t => normalizeRut(t.rut))
    );
    dbg.group(' asignadosDesdeEndpoint (filtrados por HOY)');
    dbg.log('Total:', set.size, 'Ejemplos:', Array.from(set).slice(0, 10));
    dbg.end();
    return set;
  }, [items, hoy]);

  // 3) Unión de ruts asignados (endpoint ∪ reportes)
  const rutsAsignados = useMemo(() => {
    const union = new Set<string>();
    for (const rut of asignadosDesdeEndpoint) union.add(rut);
    for (const rut of asignadosDesdeReportes.keys()) union.add(rut);
    dbg.group('✅ rutsAsignados (unión)');
    dbg.log('Total:', union.size, 'Ejemplos:', Array.from(union).slice(0, 10));
    dbg.end();
    return union;
  }, [asignadosDesdeEndpoint, asignadosDesdeReportes]);

  // 4) Armar grupos de asignados HOY (nombre, rut, horas[]) SOLO HOY
  const asignados = useMemo(() => {
    // Base desde reportes (más fiable para horas)
    const grupos = new Map<string, { rut: string; nombre: string; horas: { hora: string; cliente?: string | null }[] }>();

    // 4.1) Cargar con lo que dice /reportes (sólo HOY)
    for (const [rut, rec] of asignadosDesdeReportes.entries()) {
      const tec = items.find(t => normalizeRut(t.rut) === rut);
      grupos.set(rut, {
        rut,
        nombre: tec?.nombre || '(Técnico)',
        horas: [...rec.horas],
      });
    }

    // 4.2) Completar/añadir desde endpoint “Asignado” **sólo si es HOY**
    items
      .filter(t => t.estado === 'Asignado' && normalizeYMD(t.fecha_reporte) === hoy)
      .forEach((t) => {
        const rut = normalizeRut(t.rut);
        if (!rutsAsignados.has(rut)) return; // coherencia
        const g = grupos.get(rut) || { rut, nombre: t.nombre, horas: [] };
        if (t.hora_inicio) {
          const entry = { hora: horaCorta(t.hora_inicio), cliente: t.nombre_cliente };
          // evitar duplicados
          if (!g.horas.some(h => h.hora === entry.hora && h.cliente === entry.cliente)) {
            g.horas.push(entry);
          }
        }
        g.horas.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
        grupos.set(rut, g);
      });

    const res = Array.from(grupos.values());
    // ordenar por primer horario
    res.sort((a, b) => (a.horas[0]?.hora || '').localeCompare(b.horas[0]?.hora || ''));
    dbg.group('🧩 asignados (resultado final)');
    dbg.table(res);
    dbg.end();
    return res;
  }, [items, asignadosDesdeReportes, rutsAsignados, hoy]);

  // 5) Disponibles: técnicos del endpoint cuyo RUT no esté en rutsAsignados (de HOY)
  const disponibles = useMemo(() => {
    const res = items
      .filter(t => !rutsAsignados.has(normalizeRut(t.rut)))
      .map(t => ({ rut: t.rut, nombre: t.nombre }));
    dbg.group('🟢 disponibles (resultado final)');
    dbg.table(res);
    dbg.end();
    return res;
  }, [items, rutsAsignados]);

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
            {asignados.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-300">No hay asignaciones.</p>
            ) : (
              <ul className="space-y-2 max-h-[320px] overflow-auto pr-1">
                {asignados.map((g) => (
                  <li
                    key={g.rut}
                    className="rounded-md bg-white dark:bg-gray-800 border dark:border-gray-600 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                        {g.nombre} <span className="text-xs text-gray-500 dark:text-gray-400">({g.rut})</span>
                      </p>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-blue-600 text-white">
                        {g.horas.length} asignación(es)
                      </span>
                    </div>
                    <ol className="mt-2 grid sm:grid-cols-2 gap-1.5">
                      {g.horas.map((a, idx) => (
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
