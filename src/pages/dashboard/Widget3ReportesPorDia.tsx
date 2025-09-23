/**
 * ============================================================
 * Widget 3 - Carga de reportes por tecnico (usa rut_responsable)
 * Ruta: src/pages/dashboard/Widget3ReportesPorDia.tsx
 *
 * Objetivo:
 *  - Mostrar la carga de reportes por tecnico (solo usuarios tipo tecnico).
 *  - Agrupar por estado utilizando la asignacion real (rut_responsable) dentro del rango indicado.
 *
 * Estrategia:
 *  - Se consultan /usuarios y /reportes.
 *  - Se filtran los usuarios cuyo id_tipo_usuario === 1 (tecnicos) y se construye un mapa rut -> nombre.
 *  - Se filtran los reportes por rango de fecha y se asignan al tecnico utilizando rut_responsable (fallback a rut_usuario si tambien es tecnico).
 *  - Se genera un registro por reporte con total = 1 y el estado correspondiente para alimentar el grafico apilado.
 * ============================================================
 */

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import api from "../../services/api";

/** ===== Tipos ===== */
type RowAPI = {
  rut?: string;
  nombre: string;
  estado?: string;
  total: number;
};

type ApiUsuario = {
  rut: string;
  nombre: string;
  apellido_paterno?: string | null;
  id_tipo_usuario: number | string;
  activado?: number | null;
};

type ApiReporte = {
  id_reporte: number;
  fecha_reporte: string;
  hora_inicio?: string | null;
  rut_usuario?: string | null;
  rut_responsable?: string | null;
  estado_servicio?: string | null;
  id_estado_servicio?: number | null;
};

/** ===== Utilidades de fecha ===== */
function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, delta: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeYMD(raw?: string | null): string {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeRut(raw?: string | null): string {
  return (raw || "").toString().replace(/[^0-9kK]/g, "").toUpperCase();
}

function isWithinRange(day: string, start: string, end: string): boolean {
  if (!day) return false;
  return (!start || day >= start) && (!end || day <= end);
}

/** ===== Paleta por estado ===== */
const FALLBACK_PALETTE = [
  "#2563EB", // azul
  "#16A34A", // verde
  "#EA580C", // naranja
  "#DC2626", // rojo
  "#7C3AED", // violeta
  "#0EA5E9", // celeste
  "#CA8A04", // mostaza
  "#059669", // teal
];

// Colores base por clave canonica
const ESTADO_COLORS: Record<string, string> = {
  ASIGNADO: "#2563EB",
  "EN PROGRESO": "#0EA5E9",
  FINALIZADO: "#16A34A",
  REPROGRAMADO: "#CA8A04",
  CANCELADO: "#DC2626",
  PENDIENTE: "#EA580C",
  "SIN ESTADO": "#6B7280",
};

const ESTADO_ID_MAP: Record<number, string> = {
  1: "Pendiente",
  2: "En progreso",
  3: "Finalizado",
  4: "Asignado",
  5: "Reprogramado",
  6: "Cancelado",
};

/** Normaliza a clave canonica: mayusculas, sin tildes, trim */
function toCanonKey(s?: string | null) {
  return (s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getEstadoColor(canonKey: string, idx: number) {
  return ESTADO_COLORS[canonKey] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function resolveEstado(rep: ApiReporte): string {
  const raw = (rep.estado_servicio || "").toString().trim();
  if (raw) return raw;
  const id = typeof rep.id_estado_servicio === "number" ? rep.id_estado_servicio : Number(rep.id_estado_servicio);
  if (!Number.isNaN(id) && ESTADO_ID_MAP[id]) return ESTADO_ID_MAP[id];
  return "Sin estado";
}

/** ===== Props ===== */
type Props = {
  endpoint?: string;
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string;    // YYYY-MM-DD
};

export default function Widget3ReportesPorDia({
  endpoint = "/dashboard/supervisor/carga-reportes-estado",
  fechaInicio,
  fechaFin,
}: Props) {
  // Rango por defecto: ultimos 7 dias
  const hoy = todayISO();
  const desde = fechaInicio || addDaysISO(hoy, -6);
  const hasta = fechaFin || hoy;

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<RowAPI[]>([]);

  // Etiquetas "bonitas" por estado
  const [estadoDisplayMap, setEstadoDisplayMap] = useState<Record<string, string>>({});
  const [usedEndpoint, setUsedEndpoint] = useState<string>("local:/reportes");

  // Evitar lint por prop sin uso (se mantiene para compatibilidad externa)
  void endpoint;

  /** ===== Fetch basado en rut_responsable ===== */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const [resUsuarios, resReportes] = await Promise.all([
          api.get<ApiUsuario[]>("/usuarios"),
          api.get<ApiReporte[]>("/reportes"),
        ]);

        if (!mounted) return;

        const usuarios: ApiUsuario[] = Array.isArray(resUsuarios.data) ? resUsuarios.data : [];
        const reportes: ApiReporte[] = Array.isArray(resReportes.data) ? resReportes.data : [];

        const tecnicosMap = new Map<string, { rut: string; nombre: string }>();
        usuarios.forEach((u) => {
          const tipo = Number(u.id_tipo_usuario);
          if (tipo !== 1) return;
          const rut = normalizeRut(u.rut);
          if (!rut) return;
          const nombre = [u.nombre, u.apellido_paterno].filter(Boolean).join(" ").trim() || u.nombre || rut;
          tecnicosMap.set(rut, { rut, nombre });
        });

        const display: Record<string, string> = {};
        const rowsLocal: RowAPI[] = [];

        reportes.forEach((rep) => {
          const fecha = normalizeYMD(rep.fecha_reporte);
          if (!isWithinRange(fecha, desde, hasta)) return;

          const rutResp = normalizeRut(rep.rut_responsable);
          const rutUser = normalizeRut(rep.rut_usuario);
          let rutSeleccionado = "";

          if (rutResp && tecnicosMap.has(rutResp)) {
            rutSeleccionado = rutResp;
          } else if (rutUser && tecnicosMap.has(rutUser)) {
            rutSeleccionado = rutUser;
          } else {
            return; // ignorar registros que no pertenecen a tecnicos
          }

          const tecnico = tecnicosMap.get(rutSeleccionado)!;
          const estado = resolveEstado(rep);
          const canon = toCanonKey(estado) || "SIN ESTADO";

          if (!display[canon]) display[canon] = estado.trim() || "Sin estado";

          rowsLocal.push({
            rut: tecnico.rut,
            nombre: tecnico.nombre,
            estado,
            total: 1,
          });
        });

        setEstadoDisplayMap(display);
        setRows(rowsLocal);
        setUsedEndpoint("local:/reportes (rut_responsable)");
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || "No se pudo cargar la carga por tecnico.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [desde, hasta]);

  /** ===== Agregacion por tecnico y estado (con clave canonica) ===== */
  const { techList, statesCanon } = useMemo(() => {
    const map = new Map<string, { rut?: string; nombre: string; total: number; estados: Record<string, number> }>();
    const setStates = new Set<string>();

    for (const r of rows) {
      const rut = r.rut?.toString().trim();
      const nombre = (r.nombre || rut || "Tecnico").toString().trim();
      const inc = Number(r.total) || 0;

      const canonEstado = toCanonKey(r.estado) || "SIN ESTADO";

      const keyTech = rut || nombre;
      if (!map.has(keyTech)) {
        map.set(keyTech, { rut, nombre, total: 0, estados: {} });
      }

      const agg = map.get(keyTech)!;
      agg.total += inc;
      agg.estados[canonEstado] = (agg.estados[canonEstado] || 0) + inc;

      setStates.add(canonEstado);
    }

    const techList = Array.from(map.values()).sort((a, b) => b.total - a.total);

    const knownOrder = Object.keys(ESTADO_COLORS);
    const present = Array.from(setStates);

    const knownPresent = knownOrder.filter((k) => present.includes(k));
    const unknown = present.filter((k) => !knownOrder.includes(k)).sort((a, b) => a.localeCompare(b));

    const statesCanon = [...knownPresent, ...unknown];

    return { techList, statesCanon };
  }, [rows]);

  /** ===== Data para Recharts ===== */
  const chartData = useMemo(() => {
    return techList.map((t) => {
      const row: Record<string, any> = {
        tecnico: `${t.nombre}${t.rut ? ` (${t.rut})` : ""}`,
        total: t.total,
      };
      statesCanon.forEach((canon) => {
        row[canon] = t.estados[canon] || 0;
      });
      return row;
    });
  }, [techList, statesCanon]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Carga de reportes por tecnico
        </h3>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          fuente: {usedEndpoint}
        </span>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Rango: {desde} {'->'} {hasta}
      </p>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
      ) : err ? (
        <div className="text-sm rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-2">
          {err}
        </div>
      ) : chartData.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos para el rango seleccionado.</p>
      ) : (
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="tecnico" width={220} />

              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const tech = techList.find((t) => `${t.nombre}${t.rut ? ` (${t.rut})` : ""}` === label);
                  if (!tech) return null;

                  return (
                    <div className="bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-3 rounded shadow-lg max-w-xs">
                      <div className="text-sm font-semibold mb-2">{label}</div>
                      <div className="text-xs">
                        <div className="font-semibold mb-1">Estados:</div>
                        <ul className="list-disc pl-4">
                          {statesCanon.map((canon, idx) => {
                            const count = tech.estados[canon] || 0;
                            if (!count) return null;
                            const display = estadoDisplayMap[canon] || canon;
                            return (
                              <li key={canon} style={{ color: getEstadoColor(canon, idx) }}>
                                {display}: {count}
                              </li>
                            );
                          })}
                        </ul>
                        <div className="font-semibold mt-2">Total: {tech.total}</div>
                      </div>
                    </div>
                  );
                }}
              />

              {statesCanon.map((canon, idx) => (
                <Bar
                  key={canon}
                  dataKey={canon}
                  stackId="carga"
                  fill={getEstadoColor(canon, idx)}
                  name={estadoDisplayMap[canon] || canon}
                />
              ))}

              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

