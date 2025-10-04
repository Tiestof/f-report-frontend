/**
 * ============================================================
 * Componente: src/components/informes/InformeGlobal.tsx
 * Propósito:
 *  - Informe Global con plantillas A/B (cabecera, estilos de secciones,
 *    colores de gráficos y tablas).
 *  - KPIs, gráficos y tabla de detalle.
 *  - Exportación a PDF en una sola captura (html2canvas + jsPDF).
 *  - Supervisor desde authStore (useUserProfile dispara carga).
 *
 * Props clave:
 *  - filters: filtros usados para la consulta global.
 *  - plantilla: 'A' | 'B'  -> control del formato visual.
 *  - showExportButton?: boolean
 *  - autoExport?: boolean
 *
 * Nombre de archivo PDF:
 *  - Informe_Global_YYYY-MM-DD_HH-mm.pdf
 * ============================================================
 */

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import api from '../../services/api';
import { formatISODateToCL } from '../../utils/dateFormat';
import { formatRUTDisplay } from '../../utils/rutFormatter';

import useUserProfile from '../../hooks/useUserProfile'; // dispara setUser(...)
import useAuthStore from '../../store/authStore';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Title as ChartTitle,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  ChartTitle,
  ChartDataLabels
);

// ------------ Tipos ------------
type ReporteConsultaRow = {
  id_reporte: number;
  fecha_reporte: string;
  rut_responsable?: string | null;
  nombre_responsable?: string | null;
  estado_servicio?: string | null;
  evidencias_count?: number | null;
  gastos_count?: number | null;
  rut_cliente?: string | null;
  nombre_cliente?: string | null;
  id_rut_empresa_cobro?: string | null;
  nombre_centro_costo?: string | null;
  [k: string]: any;
};

type ReportesConsultaResponse = {
  data: ReporteConsultaRow[];
  total: number;
};

export type GlobalFilters = Partial<{
  rut_responsable: string;
  id_estado_servicio: number;
  fecha_desde: string;
  fecha_hasta: string;
  con_evidencias: boolean;
  con_gastos: boolean;
  rut_cliente: string;
  id_rut_empresa_cobro: string;
}>;

export interface InformeGlobalProps {
  filters: GlobalFilters;
  plantilla?: 'A' | 'B';
  autoExport?: boolean;
  showExportButton?: boolean;
  onExported?: () => void;
}

export type InformeGlobalHandle = {
  exportPDF: () => Promise<void>;
};

// ------------ Headers por plantilla ------------
const HeaderA: React.FC = () => (
  <div className="mb-4 flex items-center justify-between">
    <h1 className="text-2xl font-extrabold tracking-tight text-blue-600">F-REPORT</h1>
    <div className="text-right text-xs text-zinc-500">
      <div>Documento: Informe Global</div>
      <div>Formato A — Corporate Clean</div>
    </div>
  </div>
);

const HeaderB: React.FC = () => (
  <div className="mb-6 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="h-10 w-1 rounded bg-zinc-900" />
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">F-REPORT</h1>
    </div>
    <div className="text-right text-xs text-zinc-500">
      <div>Documento: Informe Global</div>
      <div>Formato B — Minimal Solid</div>
    </div>
  </div>
);

// Paletas por plantilla (gráficos)
const PALETTE_A = [
  '#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#7c3aed',
  '#0891b2', '#db2777', '#84cc16', '#f97316', '#0ea5e9',
];
const PALETTE_B = [
  '#111827', '#4b5563', '#6b7280', '#9ca3af', '#374151',
  '#1f2937', '#6d28d9', '#047857', '#b45309', '#b91c1c',
];

// Espera a que todos los <canvas> tengan dimensiones válidas
async function waitForChartsRendered(root: HTMLElement, timeoutMs = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const canvases = Array.from(root.querySelectorAll('canvas'));
    const ready = canvases.length === 0 || canvases.every((c) => c.width > 0 && c.height > 0);
    if (ready) return;
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 80)));
  }
}

// Captura un único nodo grande (paginación automática si es alto)
async function exportSingleNodeToPDF(node: HTMLElement, fileName: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const A4_W = 210;
  const A4_H = 297;
  const margin = 10;

  const canvas = await html2canvas(node, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    windowWidth: node.scrollWidth,
  });

  const imgData = canvas.toDataURL('image/png');
  const pageWidth = A4_W - margin * 2;
  const pageHeight = A4_H - margin * 2;

  const imgW = pageWidth;
  const imgH = (canvas.height * imgW) / canvas.width;

  pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);

  let heightLeft = imgH - pageHeight;
  let position = margin - pageHeight;

  while (heightLeft > 0) {
    pdf.addPage('a4', 'p');
    pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH);
    heightLeft -= pageHeight;
    position -= pageHeight;
  }

  pdf.save(fileName);
}

// Construir query params
function buildQuery(filters: GlobalFilters, page: number, pageSize: number) {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('pageSize', String(pageSize));

  if (filters.rut_responsable) sp.set('rut_responsable', filters.rut_responsable);
  if (typeof filters.id_estado_servicio === 'number')
    sp.set('id_estado_servicio', String(filters.id_estado_servicio));
  if (filters.fecha_desde) sp.set('fecha_desde', filters.fecha_desde);
  if (filters.fecha_hasta) sp.set('fecha_hasta', filters.fecha_hasta);
  if (typeof filters.con_evidencias === 'boolean')
    sp.set('con_evidencias', String(filters.con_evidencias));
  if (typeof filters.con_gastos === 'boolean')
    sp.set('con_gastos', String(filters.con_gastos));
  if (filters.rut_cliente) sp.set('rut_cliente', filters.rut_cliente);
  if (filters.id_rut_empresa_cobro)
    sp.set('id_rut_empresa_cobro', filters.id_rut_empresa_cobro);

  return sp.toString();
}

// Formato de nombre de archivo: Informe_Global_YYYY-MM-DD_HH-mm.pdf
function buildReportFileName() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Informe_Global_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}.pdf`;
}

// ============ Componente principal (con forwardRef) ============
const InformeGlobal = forwardRef<InformeGlobalHandle, InformeGlobalProps>(
  ({ filters, plantilla = 'A', autoExport = false, showExportButton = true, onExported }, ref) => {
    const [rows, setRows] = useState<ReporteConsultaRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Dispara carga del perfil → authStore.setUser(...)
    const profileLoading = useUserProfile();

    // container raíz para exportación
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Traer TODOS los reportes que cumplan los filtros (paginado)
    useEffect(() => {
      let active = true;
      setLoading(true);
      setErr(null);

      (async () => {
        try {
          const pageSize = 500;
          let page = 1;
          let list: ReporteConsultaRow[] = [];
          let totalItems = 0;

          // Primera llamada
          const q1 = buildQuery(filters, page, pageSize);
          const r1 = await api.get(`/reportes/consulta?${q1}`);
          const data1: ReportesConsultaResponse = r1?.data?.data ? r1.data : r1.data ?? r1;
          list = (data1?.data ?? []) as ReporteConsultaRow[];
          totalItems = Number(data1?.total ?? list.length);

          // Siguientes páginas si faltan
          const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
          while (page < totalPages) {
            page += 1;
            const q = buildQuery(filters, page, pageSize);
            const rr = await api.get(`/reportes/consulta?${q}`);
            const dd: ReportesConsultaResponse = rr?.data?.data ? rr.data : rr.data ?? rr;
            const chunk = (dd?.data ?? []) as ReporteConsultaRow[];
            list = list.concat(chunk);
          }

          if (!active) return;
          setRows(list);
          setLoading(false);
        } catch (e: any) {
          if (!active) return;
          setErr(e?.message || 'Error consultando reportes.');
          setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [filters]);

    // Listados únicos para cabecera (Nombre — RUT)
    const tecnicosUnicos = useMemo(() => {
      const set = new Set<string>();
      const arr: string[] = [];
      rows.forEach((r) => {
        const nom = (r.nombre_responsable || '').trim();
        const rut = r.rut_responsable ? formatRUTDisplay(r.rut_responsable) : '';
        const key = (nom ? `${nom} — ${rut}` : rut || 'N/A').trim();
        if (key && !set.has(key)) {
          set.add(key);
          arr.push(key);
        }
      });
      return arr;
    }, [rows]);

    const clientesUnicos = useMemo(() => {
      const set = new Set<string>();
      const arr: string[] = [];
      rows.forEach((r) => {
        const nom = (r.nombre_cliente || '').trim();
        const rut = r.rut_cliente ? formatRUTDisplay(r.rut_cliente) : '';
        const key = (nom ? `${nom} — ${rut}` : rut || 'N/A').trim();
        if (key && !set.has(key)) {
          set.add(key);
          arr.push(key);
        }
      });
      return arr;
    }, [rows]);

    const centrosUnicos = useMemo(() => {
      const set = new Set<string>();
      const arr: string[] = [];
      rows.forEach((r) => {
        const nom = (r.nombre_centro_costo || '').trim();
        const rut = r.id_rut_empresa_cobro ? formatRUTDisplay(r.id_rut_empresa_cobro) : '';
        const key = (nom ? `${nom} — ${rut}` : rut || 'N/A').trim();
        if (key && !set.has(key)) {
          set.add(key);
          arr.push(key);
        }
      });
      return arr;
    }, [rows]);

    // Estadísticas
    const kpis = useMemo(() => {
      const totalReportes = rows.length;
      const totalEvidencias = rows.reduce((acc, r) => acc + (r.evidencias_count ?? 0), 0);
      const totalGastos = rows.reduce((acc, r) => acc + (r.gastos_count ?? 0), 0);

      const porEstado = new Map<string, number>();
      rows.forEach((r) => {
        const k = (r.estado_servicio || 'N/A').trim();
        porEstado.set(k, (porEstado.get(k) || 0) + 1);
      });

      const porTecnico = new Map<string, number>();
      rows.forEach((r) => {
        const nom = (r.nombre_responsable || '').trim();
        const rut = r.rut_responsable ? formatRUTDisplay(r.rut_responsable) : '';
        const key = (nom ? `${nom} — ${rut}` : rut || 'N/A').trim();
        porTecnico.set(key, (porTecnico.get(key) || 0) + 1);
      });

      const topTecnicos = Array.from(porTecnico.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      return { totalReportes, totalEvidencias, totalGastos, porEstado, topTecnicos };
    }, [rows]);

    // Paleta según plantilla
    const palette = plantilla === 'B' ? PALETTE_B : PALETTE_A;

    // Datos Chart.js (con datalabels: números; sin valores 0)
    const chartEstado = useMemo(() => {
      const entries = Array.from(kpis.porEstado.entries()).filter(([, v]) => v > 0);
      const labels = entries.map(([k]) => k);
      const values = entries.map(([, v]) => v);
      const colors = labels.map((_, i) => palette[i % palette.length]);
      return {
        data: {
          labels,
          datasets: [
            {
              label: 'Reportes por estado',
              data: values,
              backgroundColor: colors,
              borderColor: colors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: true, position: 'bottom' as const },
            title: { display: false },
            tooltip: { enabled: true },
            datalabels: {
              color: '#111827',
              formatter: (val: number) => `${val}`,
              font: { weight: 'bold' as const, size: 11 },
            },
          },
        } as const,
      };
    }, [kpis, palette]);

    const chartTopTecnicos = useMemo(() => {
      const labels = kpis.topTecnicos.map(([k]) => k);
      const values = kpis.topTecnicos.map(([, v]) => v);
      const color = plantilla === 'B' ? '#111827' : '#2563eb';
      return {
        data: {
          labels,
          datasets: [
            {
              label: 'Reportes por técnico (Top 10)',
              data: values,
              backgroundColor: color,
              borderColor: color,
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          indexAxis: 'y' as const,
          plugins: {
            legend: { display: false },
            title: { display: false },
            tooltip: { enabled: true },
            datalabels: {
              color: '#111827',
              anchor: 'end' as const,
              align: 'end' as const,
              formatter: (val: number) => `${val}`,
              font: { weight: 'bold' as const, size: 10 },
              clamp: true,
              clip: true,
            },
          },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { ticks: { autoSkip: false } },
          },
        } as const,
      };
    }, [kpis, plantilla]);

    // Exportación unificada (modal o botón)
    const doExport = async () => {
      if (!rootRef.current) return;
      await waitForChartsRendered(rootRef.current, 2000);
      await new Promise((r) => setTimeout(r, 150));
      await exportSingleNodeToPDF(rootRef.current, buildReportFileName());
      onExported?.();
    };

    useImperativeHandle(ref, () => ({ exportPDF: doExport }), [onExported]);

    // Auto export (espera que termine el perfil)
    useEffect(() => {
      if (autoExport && !loading && !err && !profileLoading) {
        const t = setTimeout(() => {
          doExport();
        }, 350);
        return () => clearTimeout(t);
      }
      return;
    }, [autoExport, loading, err, profileLoading]); // eslint-disable-line

    const Header = plantilla === 'B' ? HeaderB : HeaderA;

    // ---- Render ----
    if (loading) return <p className="text-sm text-zinc-500">Cargando informe global…</p>;
    if (err) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {err}
        </div>
      );
    }

    // Supervisor desde Zustand (ya set por useUserProfile)
    const { usuario: u } = useAuthStore.getState();
    const supervisorNombre =
      u && (u.nombre || u.apellido_paterno || u.apellido_materno)
        ? `${u.nombre ?? ''} ${u.apellido_paterno ?? ''} ${u.apellido_materno ?? ''}`.trim()
        : '';

    // Variantes de caja según plantilla
    const cardCls =
      plantilla === 'B'
        ? 'rounded-xl border border-zinc-300 p-4'
        : 'rounded-xl border border-zinc-200 p-4';

    return (
      <div
        ref={rootRef}
        className={
          plantilla === 'B'
            ? 'mx-auto w-full max-w-5xl rounded-2xl border border-zinc-300 bg-white p-6 shadow-sm'
            : 'mx-auto w-full max-w-5xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm'
        }
      >
        <Header />

        {/* Cabecera principal */}
        <section className={`${cardCls} mb-4 text-sm`}>
          {supervisorNombre && (
            <div className="mb-3">
              <span className="text-zinc-500">Supervisor:&nbsp;</span>
              <span className="font-medium">{supervisorNombre}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Izquierda: Fechas + Técnicos */}
            <div>
              <div className="mb-2">
                <div><span className="text-zinc-500">Fecha desde:</span> {filters.fecha_desde || '—'}</div>
                <div><span className="text-zinc-500">Fecha hasta:</span> {filters.fecha_hasta || '—'}</div>
              </div>

              <div className="mt-2">
                <div className="text-zinc-500">Técnico(s):</div>
                {tecnicosUnicos.length ? (
                  <ul className="mt-1 list-inside list-disc">
                    {tecnicosUnicos.map((t) => (
                      <li key={t} className="font-medium">{t}</li>
                    ))}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </div>
            </div>

            {/* Derecha: Clientes + Centros */}
            <div>
              <div className="mb-2">
                <div className="text-zinc-500">Cliente(s):</div>
                {clientesUnicos.length ? (
                  <ul className="mt-1 list-inside list-disc">
                    {clientesUnicos.map((c) => (
                      <li key={c} className="font-medium">{c}</li>
                    ))}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </div>

              <div className="mb-0">
                <div className="text-zinc-500">Centro(s) de costo:</div>
                {centrosUnicos.length ? (
                  <ul className="mt-1 list-inside list-disc">
                    {centrosUnicos.map((cc) => (
                      <li key={cc} className="font-medium">{cc}</li>
                    ))}
                  </ul>
                ) : (
                  <div>—</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* KPIs */}
        <section className="mb-4 grid grid-cols-3 gap-3 text-center">
          <div className={cardCls}>
            <div className="text-xs text-zinc-500">Total de reportes</div>
            <div className="text-xl font-semibold">{kpis.totalReportes}</div>
          </div>
          <div className={cardCls}>
            <div className="text-xs text-zinc-500">Total evidencias</div>
            <div className="text-xl font-semibold">{kpis.totalEvidencias}</div>
          </div>
          <div className={cardCls}>
            <div className="text-xs text-zinc-500">Total gastos</div>
            <div className="text-xl font-semibold">{kpis.totalGastos}</div>
          </div>
        </section>

        {/* Gráficos */}
        <section className="mb-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className={cardCls}>
            <h4 className="mb-2 text-sm font-medium">Distribución por estado</h4>
            <Pie data={chartEstado.data} options={chartEstado.options} />
          </div>
          <div className={cardCls}>
            <h4 className="mb-2 text-sm font-medium">Top 10 técnicos por # reportes</h4>
            <Bar data={chartTopTecnicos.data} options={chartTopTecnicos.options} />
          </div>
        </section>

        {/* Tabla de reportes */}
        <section>
          <h3 className="mb-3 text-base font-semibold">Detalle de reportes</h3>
          <div className={cardCls}>
            <div className="overflow-auto">
              <table className="min-w-full table-fixed text-sm">
                <thead
                  className={
                    plantilla === 'B'
                      ? 'bg-zinc-100 text-left uppercase tracking-wide text-zinc-700'
                      : 'bg-zinc-50 text-left uppercase tracking-wide text-zinc-600'
                  }
                >
                  <tr>
                    <th className="w-16 px-3 py-2">ID</th>
                    <th className="px-3 py-2">Técnico</th>
                    <th className="w-40 px-3 py-2">Estado</th>
                    <th className="w-28 px-3 py-2">Fecha</th>
                    <th className="w-20 px-3 py-2 text-center">Evid.</th>
                    <th className="w-20 px-3 py-2 text-center">Gastos</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Centro costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {rows.map((r, i) => (
                    <tr
                      key={r.id_reporte}
                      className={
                        i % 2 === 0 ? 'bg-white' : 'bg-zinc-50'
                      }
                    >
                      <td className="px-3 py-2 font-medium">{r.id_reporte}</td>
                      <td className="px-3 py-2">
                        {(r.nombre_responsable ? r.nombre_responsable : '—') +
                          (r.rut_responsable ? ` — ${formatRUTDisplay(r.rut_responsable)}` : '')}
                      </td>
                      <td className="px-3 py-2">{r.estado_servicio ?? '—'}</td>
                      <td className="px-3 py-2">{formatISODateToCL(r.fecha_reporte)}</td>
                      <td className="px-3 py-2 text-center">{r.evidencias_count ?? 0}</td>
                      <td className="px-3 py-2 text-center">{r.gastos_count ?? 0}</td>
                      <td className="px-3 py-2">
                        {(r.nombre_cliente ? r.nombre_cliente : '—') +
                          (r.rut_cliente ? ` — ${formatRUTDisplay(r.rut_cliente)}` : '')}
                      </td>
                      <td className="px-3 py-2">
                        {(r.nombre_centro_costo ? r.nombre_centro_costo : '—') +
                          (r.id_rut_empresa_cobro ? ` — ${formatRUTDisplay(r.id_rut_empresa_cobro)}` : '')}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                        No hay datos para mostrar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Acciones */}
        {showExportButton && (
          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={doExport}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Generar PDF del Informe Global"
            >
              Descargar PDF
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default InformeGlobal;
