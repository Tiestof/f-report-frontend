/**
 * ============================================================
 * Widget 4 — Distribución de estados (autónomo, sin props)
 * Ruta: src/pages/dashboard/Widget4DistribucionEstados.tsx
 * Propósito:
 *  - Renderizar un pie con la distribución de estados del periodo,
 *    usando una paleta de colores accesible y consistente por estado.
 *
 * Cambios clave:
 *  - Colores por estado (map + fallback cíclico).
 *  - Etiquetas con nombre, cantidad y porcentaje.
 *  - Tooltip formateado.
 *  - Título dinámico con días de rango.
 * ============================================================
 */

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../../services/api";

type EstadoGlobal = { estado: string; cantidad: number };

type Props = {
  endpoint?: string;
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string;    // YYYY-MM-DD
};

/** Fecha actual en YYYY-MM-DD */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Diferencia de días (inclusive) entre dos YYYY-MM-DD */
function daysDiffInclusive(desde: string, hasta: string) {
  const a = new Date(desde + "T00:00:00");
  const b = new Date(hasta + "T00:00:00");
  const ms = b.getTime() - a.getTime();
  // +1 para incluir ambos extremos cuando procede
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

/** Paleta accesible de respaldo (se cicla) */
const FALLBACK_PALETTE = [
  "#2563EB", // azul
  "#16A34A", // verde
  "#EA580C", // naranja
  "#DC2626", // rojo
  "#7C3AED", // violeta
  "#0EA5E9", // celeste
  "#CA8A04", // mostaza
  "#059669", // verde teal
];

/** Mapa de estado -> color (normalizamos a MAYÚSCULAS y sin tildes) */
const ESTADO_COLORS: Record<string, string> = {
  ASIGNADO: "#2563EB",         // azul
  "EN PROGRESO": "#0EA5E9",    // celeste
  FINALIZADO: "#16A34A",       // verde
  REPROGRAMADO: "#CA8A04",     // mostaza
  CANCELADO: "#DC2626",        // rojo
  PENDIENTE: "#EA580C",        // naranja
  "SIN ESTADO": "#6B7280",     // gris
};

/** Normaliza etiquetas para mapear color (mayúsculas + sin tildes) */
function normalizeEstado(s: string) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

/** Obtiene color por estado con fallback cíclico */
function getEstadoColor(estado: string, idx: number) {
  const key = normalizeEstado(estado);
  return ESTADO_COLORS[key] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

export default function Widget4DistribucionEstados({
  endpoint = "/dashboard/supervisor/estado-reportes",
  fechaInicio,
  fechaFin,
}: Props) {
  const hoy = todayISO();
  const desde = fechaInicio || hoy;
  const hasta = fechaFin || hoy;

  const [data, setData] = useState<EstadoGlobal[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(endpoint, {
          params: { fechaInicio: desde, fechaFin: hasta },
        });
        if (!mounted) return;
        const items: EstadoGlobal[] = Array.isArray(res.data) ? res.data : [];
        setData(items);
      } catch (e: any) {
        setError(e?.response?.data?.mensaje || "No se pudo cargar la distribución de estados.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [endpoint, desde, hasta]);

  const total = useMemo(() => data.reduce((acc, it) => acc + (it.cantidad || 0), 0), [data]);

  /** Recharts data + color aplicado por item */
  const chartData = useMemo(
    () =>
      data.map((d, i) => ({
        name: d.estado,
        value: d.cantidad,
        fill: getEstadoColor(d.estado, i),
      })),
    [data]
  );

  const rangeDays = useMemo(() => daysDiffInclusive(desde, hasta), [desde, hasta]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
      <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-gray-100">
        Total reportes por estado — Rango {rangeDays} día(s)
      </h3>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : total === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Sin datos para el rango seleccionado.</p>
      ) : (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${Math.round((percent || 0) * 100)}%)`
                }
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>

              <Tooltip
                formatter={(value: any, name: any, props: any) => {
                  const pct =
                    props && typeof props.payload?.percent === "number"
                      ? Math.round(props.payload.percent * 100)
                      : Math.round(((value as number) / total) * 100);
                  return [`${value} (${pct}%)`, name];
                }}
              />

              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
