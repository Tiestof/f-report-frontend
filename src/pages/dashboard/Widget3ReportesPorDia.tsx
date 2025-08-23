/**
 * ============================================================
 * Widget 3 — Carga de reportes por técnico (por estado) [AUTO-FALLBACK]
 * Ruta: src/pages/dashboard/Widget3ReportesPorDia.tsx
 *
 * Qué hace:
 *  - Consulta el endpoint indicado (o default) con rango [fechaInicio, fechaFin].
 *  - Si la respuesta NO contiene "estado", reintenta automáticamente con
 *    /dashboard/supervisor/carga-reportes-estado para obtener el desglose correcto.
 *  - Grafica barras apiladas horizontales por técnico con series por estado.
 *
 * Props (opcionales):
 *  - endpoint    : string  -> default '/dashboard/supervisor/carga-reportes-estado'
 *  - fechaInicio : string  -> default hoy-6 (YYYY-MM-DD)
 *  - fechaFin    : string  -> default hoy   (YYYY-MM-DD)
 *
 * Notas:
 *  - Espera filas con: { rut?: string, nombre: string, estado: string, total: number }
 *  - Si algún estado viene con tildes/minúsculas, se normaliza a una clave canónica
 *    para agrupar y colorear, conservando una etiqueta "display" amigable.
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
  estado?: string;   // puede faltar si pegan al endpoint antiguo
  total: number;
};

type TechAgg = {
  rut?: string;
  nombre: string;
  total: number;
  // clave: estado CANÓNICO (normalizado). valor: cantidad
  estados: Record<string, number>;
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

// Colores base por CLAVE CANÓNICA
const ESTADO_COLORS: Record<string, string> = {
  ASIGNADO: "#2563EB",
  "EN PROGRESO": "#0EA5E9",
  FINALIZADO: "#16A34A",
  REPROGRAMADO: "#CA8A04",
  CANCELADO: "#DC2626",
  PENDIENTE: "#EA580C",
  "SIN ESTADO": "#6B7280",
};

/** Normaliza a clave canónica: mayúsculas, sin tildes, trim */
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
  // Rango por defecto: últimos 7 días
  const hoy = todayISO();
  const desde = fechaInicio || addDaysISO(hoy, -6);
  const hasta = fechaFin || hoy;

  const [loading, setLoading] = useState<boolean>(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<RowAPI[]>([]);

  // Para mostrar etiquetas "bonitas" por cada clave canónica
  const [estadoDisplayMap, setEstadoDisplayMap] = useState<Record<string, string>>({});
  const [usedEndpoint, setUsedEndpoint] = useState<string>(endpoint);
  const ALT_ENDPOINT = "/dashboard/supervisor/carga-reportes-estado";

  /** ===== Fetch con auto-fallback ===== */
  useEffect(() => {
    let mounted = true;

    const fetchData = async (ep: string) => {
      const { data } = await api.get<RowAPI[]>(ep, {
        params: { fechaInicio: desde, fechaFin: hasta },
      });
      return Array.isArray(data) ? data : [];
    };

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // 1) Primer intento: endpoint indicado
        let arr = await fetchData(endpoint);

        // Detectar si la respuesta carece de "estado"
        const hasEstado = arr.some((r) => typeof r?.estado === "string" && r.estado.trim() !== "");
        console.debug("Widget3 first try sample:", arr.slice(0, 5));

        // 2) Fallback automático si no hay estado y no estamos ya en el ALT_ENDPOINT
        if (!hasEstado && endpoint !== ALT_ENDPOINT) {
          const arr2 = await fetchData(ALT_ENDPOINT);
          const hasEstado2 = arr2.some((r) => typeof r?.estado === "string" && r.estado.trim() !== "");
          console.debug("Widget3 fallback sample:", arr2.slice(0, 5));

          if (hasEstado2) {
            arr = arr2;
            setUsedEndpoint(ALT_ENDPOINT);
          } else {
            // Si tampoco trae estado, mostramos aviso contextual
            setErr(
              "El endpoint no entrega 'estado' en las filas. Verifica que el backend exponga /dashboard/supervisor/carga-reportes-estado y esté reiniciado."
            );
          }
        } else {
          setUsedEndpoint(endpoint);
        }

        if (!mounted) return;

        // Construimos display map (solo para filas con estado)
        const display: Record<string, string> = {};
        for (const r of arr) {
          if (!r?.estado) continue;
          const canon = toCanonKey(r.estado) || "SIN ESTADO";
          if (!display[canon]) display[canon] = r.estado.trim() || "Sin estado";
        }

        setEstadoDisplayMap(display);
        setRows(arr);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.response?.data?.mensaje || "No se pudo cargar la carga por técnico.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [endpoint, desde, hasta]);

  /** ===== Agregación por técnico y estado (con clave canónica) ===== */
  const { techList, statesCanon } = useMemo(() => {
    const map = new Map<string, TechAgg>(); // clave técnico (rut || nombre) -> agregación
    const setStates = new Set<string>();    // claves canónicas presentes

    for (const r of rows) {
      const rut = r.rut?.toString().trim();
      const nombre = (r.nombre || rut || "Técnico").toString().trim();
      const inc = Number(r.total) || 0;

      const rawEstado = (r.estado || "").toString();
      const canonEstado = toCanonKey(rawEstado) || "SIN ESTADO";

      const keyTech = rut || nombre;
      if (!map.has(keyTech)) {
        map.set(keyTech, { rut, nombre, total: 0, estados: {} });
      }

      const agg = map.get(keyTech)!;
      agg.total += inc;
      agg.estados[canonEstado] = (agg.estados[canonEstado] || 0) + inc;

      setStates.add(canonEstado);
    }

    // Técnicos por total desc
    const techList = Array.from(map.values()).sort((a, b) => b.total - a.total);

    // Orden de estados: conocidos primero, luego resto alfabético
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
          Carga de reportes por técnico
        </h3>
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          fuente: {usedEndpoint}
        </span>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Rango: {desde} → {hasta}
      </p>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
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

              {/* Series: una Bar por estado CANÓNICO presente */}
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
