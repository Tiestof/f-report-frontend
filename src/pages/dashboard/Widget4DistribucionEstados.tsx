/**
 * ============================================================
 * Widget 4 - Distribucion de estados
 * Ruta: src/pages/dashboard/Widget4DistribucionEstados.tsx
 *
 * Lógica:
 *  - Obtiene los reportes del backend (/reportes) y filtra por el rango indicado.
 *  - Agrupa por estado utilizando la descripcion disponible (estado_servicio) y
 *    usa id_estado_servicio como respaldo para mapear etiquetas conocidas.
 *  - Calcula cantidades y porcentajes reales sobre la base de los datos de reportes.
 *
 * Fixes:
 *  - TS2362: coerción segura de percent/value a number en label/Tooltip.
 *  - Guards para evitar NaN cuando total = 0 o percent undefined.
 * ============================================================
 */

import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import api from "../../services/api";

type EstadoGlobal = { estado: string; cantidad: number };

type Props = {
  endpoint?: string;
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string;    // YYYY-MM-DD
};

type ApiReporte = {
  id_reporte: number;
  fecha_reporte: string;
  estado_servicio?: string | null;
  id_estado_servicio?: number | null;
};

/** Fecha actual en YYYY-MM-DD */
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function normalizeYMD(raw?: string | null) {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isWithinRange(day: string, start: string, end: string) {
  if (!day) return false;
  return (!start || day >= start) && (!end || day <= end);
}

/** Diferencia de dias (inclusive) entre dos YYYY-MM-DD */
function daysDiffInclusive(desde: string, hasta: string) {
  const a = new Date(desde + "T00:00:00");
  const b = new Date(hasta + "T00:00:00");
  const ms = b.getTime() - a.getTime();
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

/** Mapa de estado -> color (normalizamos a MAYUSCULAS y sin tildes) */
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

/** Normaliza etiquetas para mapear color (mayusculas + sin tildes) */
function normalizeEstado(s: string) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Obtiene color por estado con fallback cíclico */
function getEstadoColor(estado: string, idx: number) {
  const key = normalizeEstado(estado);
  return ESTADO_COLORS[key] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

function resolveEstado(rep: ApiReporte): string {
  const raw = (rep.estado_servicio || "").toString().trim();
  if (raw) return raw;
  const id = typeof rep.id_estado_servicio === "number" ? rep.id_estado_servicio : Number(rep.id_estado_servicio);
  if (!Number.isNaN(id) && ESTADO_ID_MAP[id]) return ESTADO_ID_MAP[id];
  return "Sin estado";
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

  // Mantener prop para compatibilidad externa
  void endpoint;

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await api.get<ApiReporte[]>("/reportes");
        if (!mounted) return;

        const reportes: ApiReporte[] = Array.isArray(res.data) ? res.data : [];
        const conteo = new Map<string, number>();

        reportes.forEach((rep) => {
          const fecha = normalizeYMD(rep.fecha_reporte);
          if (!isWithinRange(fecha, desde, hasta)) return;
          const estado = resolveEstado(rep);
          const current = conteo.get(estado) || 0;
          conteo.set(estado, current + 1);
        });

        const items: EstadoGlobal[] = Array.from(conteo.entries())
          .map(([estado, cantidad]) => ({ estado, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad);

        setData(items);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.response?.data?.mensaje || "No se pudo cargar la distribucion de estados.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [desde, hasta]);

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
        Total reportes por estado - Rango {rangeDays} día(s)
      </h3>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Cargando...</p>
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
                // FIX TS2362: forzamos percent a number seguro antes de multiplicar
                label={(props: any) => {
                  const name: string = props?.name ?? "";
                  const valueNum: number = Number(props?.value) || 0;
                  const percentNum: number = typeof props?.percent === "number" ? props.percent : 0;
                  const pct = Math.round(percentNum * 100);
                  return `${name}: ${valueNum} (${pct}%)`;
                }}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>

              <Tooltip
                // FIX: coerción segura de value y percent para evitar NaN y errores de tipo
                formatter={(value: any, name: any, tooltipProps: any) => {
                  const valueNum = Number(value) || 0;
                  const percentNum: number =
                    typeof tooltipProps?.payload?.percent === "number"
                      ? tooltipProps.payload.percent
                      : total > 0
                      ? valueNum / total
                      : 0;
                  const pct = Math.round(percentNum * 100);
                  return [`${valueNum} (${pct}%)`, name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
