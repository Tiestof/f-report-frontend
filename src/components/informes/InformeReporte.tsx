/**
 * ============================================================
 * Componente: src/components/informes/InformeReporte.tsx
 * Propósito:
 *  - Renderizar “Informe de Reporte” (individual) con plantillas A/B.
 *  - Cargar reporte + evidencias + gastos desde la API (endpoints existentes).
 *  - Exportar a PDF (html2canvas + jsPDF), evidencias 1 por página.
 *
 * Correcciones clave:
 *  - Reutiliza resolveMediaUrl / isImageUrl (como en los modales) para mostrar imágenes.
 *  - Firma digital (id_tipo_evidencia === 3):
 *      • Mostrar sólo "Tipo de evidencia" y "Nombre quien recibe el trabajo" (desde modelo).
 *      • Mostrar imagen grande (preferentemente firma dibujada).
 *  - Otros tipos de evidencia:
 *      • Mostrar campos conocidos con N/A si vienen nulos.
 *      • Imagen grande debajo; si falla, sin links (sólo aviso).
 *  - Técnico: nombre completo + RUT.
 *  - Título “F-REPORT” en mayúsculas.
 *  - Cabecera: se muestra Dirección (sin mini-mapa).
 *
 * TODO/FIXME:
 *  - Ajustar nombres exactos de campos de dirección si el backend cambia.
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
import { resolveMediaUrl, isImageUrl, swapUploadsApi } from '../../components/ui/urlResolver';

// ------------------ Tipos tolerantes ------------------
type Evidencia = {
  id_evidencia: number;

  // URLs posibles según backend
  url?: string | null;
  url_imagen?: string | null;
  comprobante_url?: string | null;
  url_comprobante?: string | null;
  imagen_url?: string | null;

  // Catálogo de tipo
  id_tipo_evidencia?: number | null; // 3 -> Firma Digital
  descripcion_tipo_evidencia?: string | null;

  // Metadatos
  modelo?: string | null;            // En firma digital: nombre firmante
  serie?: string | null;
  numero_serie?: string | null;
  ip?: string | null;
  ipv4?: string | null;
  ipv6?: string | null;
  mac?: string | null;
  macadd?: string | null;
  nombre_maquina?: string | null;
  fecha?: string | null;
  fecha_subida?: string | null;
  descripcion?: string | null;

  [k: string]: any;
};

type Gasto = {
  id_gasto: number;
  descripcion?: string | null;
  monto?: number | null;
  fecha?: string | null;

  url?: string | null;
  url_imagen?: string | null;
  url_comprobante?: string | null;
  comprobante_url?: string | null;
  imagen_url?: string | null;

  [k: string]: any;
};

type Reporte = {
  id_reporte: number;
  fecha_reporte: string;
  rut_responsable: string;
  nombre_responsable?: string | null;

  id_estado_servicio?: number;
  estado_servicio?: string | null;

  rut_cliente?: string | null;
  nombre_cliente?: string | null;

  id_rut_empresa_cobro?: string | null;
  nombre_centro_costo?: string | null;

  direccion_calle?: string | null;
  direccion_comuna?: string | null;
  direccion_ciudad?: string | null;

  observaciones?: string | null;
  [k: string]: any;
};

export interface InformeReporteProps {
  /** ID del reporte a visualizar */
  reporteId: number;
  /** Plantilla visual */
  plantilla: 'A' | 'B';
  /** Si true, descarga PDF automáticamente al montar y cargar todo */
  autoExport?: boolean;
  /** Oculta el botón “Exportar PDF” si se deja en false */
  showExportButton?: boolean;
  /** Por defecto NO mostrar gastos; si true, inicia visible y se incluyen en PDF */
  defaultShowGastos?: boolean;
  /** Callback opcional cuando termina de exportar */
  onExported?: () => void;
}

export type InformeReporteHandle = {
  /** Dispara la exportación a PDF programáticamente */
  exportPDF: () => Promise<void>;
};

// ------------------ Helpers locales ------------------
function kvListAll(
  obj: Record<string, any>,
  map: Record<string, string>
): Array<[string, string]> {
  const items: Array<[string, string]> = [];
  Object.entries(map).forEach(([key, label]) => {
    let v = obj[key];
    if (v === undefined || v === null || v === '') v = 'N/A';
    // Fechas a formato CL
    if (String(key).toLowerCase().includes('fecha') && v !== 'N/A') {
      v = formatISODateToCL(String(v));
    }
    items.push([label, String(v)]);
  });
  return items;
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// ------------------ Hook de datos ------------------
function useReporteCompleto(id: number) {
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // Reporte
        const repRes = await api.get(`/reportes/${id}`);
        const rep: Reporte = repRes?.data?.data || repRes?.data || repRes;
        if (!active) return;

        // Evidencias
        let evids: Evidencia[] = [];
        try {
          const evRes = await api.get(`/evidencias/reporte/${id}`);
          evids = Array.isArray(evRes?.data?.data)
            ? evRes.data.data
            : (evRes?.data || []);
        } catch {
          evids = [];
        }
        if (!active) return;

        // Gastos
        let gsts: Gasto[] = [];
        try {
          const gsRes = await api.get(`/gastos/reporte/${id}`);
          gsts = Array.isArray(gsRes?.data?.data)
            ? gsRes.data.data
            : (gsRes?.data || []);
        } catch {
          gsts = [];
        }
        if (!active) return;

        setReporte(rep);
        setEvidencias(evids);
        setGastos(gsts);
        setLoading(false);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Error cargando datos del reporte.');
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [id]);

  return { reporte, evidencias, gastos, loading, error };
}

// ------------------ Exportación PDF ------------------
async function exportInformeToPDF(
  portada: HTMLElement,
  evidBlocks: HTMLElement[],
  gastosBlocks: HTMLElement[],
  incluirGastos: boolean,
  fileName: string
) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const A4_W = 210;
  const A4_H = 297;

  // Portada
  const c1 = await html2canvas(portada, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
  });
  const img1 = c1.toDataURL('image/png');
  const w1 = A4_W - 20;
  const h1 = (c1.height * w1) / c1.width;
  pdf.addImage(img1, 'PNG', 10, 10, w1, Math.min(h1, A4_H - 20));

  // Evidencias: una por página
  for (const node of evidBlocks) {
    const c = await html2canvas(node, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: node.scrollWidth,
    });
    const img = c.toDataURL('image/png');

    pdf.addPage('a4', 'p');

    const maxW = A4_W - 20;
    const maxH = A4_H - 20;
    let w = maxW;
    let h = (c.height * w) / c.width;
    if (h > maxH) {
      h = maxH;
      w = (c.width * h) / c.height;
    }
    const x = (A4_W - w) / 2;
    const y = (A4_H - h) / 2;
    pdf.addImage(img, 'PNG', x, y, w, h);
  }

  // Gastos (opcional): cada gasto como tarjeta en su propia página
  if (incluirGastos) {
    for (const node of gastosBlocks) {
      const c = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        windowWidth: node.scrollWidth,
      });
      const img = c.toDataURL('image/png');

      pdf.addPage('a4', 'p');

      const maxW = A4_W - 20;
      const maxH = A4_H - 20;
      let w = maxW;
      let h = (c.height * w) / c.width;
      if (h > maxH) {
        h = maxH;
        w = (c.width * h) / c.height;
      }
      const x = (A4_W - w) / 2;
      const y = (A4_H - h) / 2;
      pdf.addImage(img, 'PNG', x, y, w, h);
    }
  }

  pdf.save(fileName);
}

// ------------------ UI bloques ------------------
const Field: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <div className="flex gap-2 text-sm">
    <span className="min-w-[160px] text-zinc-500">{label}</span>
    <span className="font-medium text-zinc-800 dark:text-zinc-100">{children}</span>
  </div>
);

const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-[13px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
    {children}
  </h4>
);

/** Bloque de evidencia con manejo especial para firma digital (id_tipo_evidencia = 3) */
const EvidenciaBlock: React.FC<{ ev: Evidencia }> = ({ ev }) => {
  const isFirma = Number(ev.id_tipo_evidencia) === 3;

  // normalizamos URL igual que en los modales
  const rawUrl =
    ev.url ||
    ev.url_imagen ||
    ev.comprobante_url ||
    ev.url_comprobante ||
    ev.imagen_url ||
    null;

  const initialUrl = resolveMediaUrl(rawUrl || '');
  const [imgSrc, setImgSrc] = useState<string | null>(initialUrl);
  const [triedSwap, setTriedSwap] = useState(false);

  const showImg = isImageUrl(imgSrc || undefined);

  // Mapeos: firma digital muestra sólo 2 campos
  const baseMap: Record<string, string> = isFirma
    ? {
        descripcion_tipo_evidencia: 'Tipo de evidencia',
        modelo: 'Nombre quien recibe el trabajo',
      }
    : {
        descripcion_tipo_evidencia: 'Tipo de evidencia',
        fecha: 'Fecha',
        fecha_subida: 'Fecha de subida',
        numero_serie: 'N° Serie',
        serie: 'Serie',
        ip: 'IP',
        ipv4: 'IPv4',
        ipv6: 'IPv6',
        mac: 'MAC',
        macadd: 'MAC',
        nombre_maquina: 'Nombre máquina',
        descripcion: 'Descripción',
        modelo: 'Modelo',
      };

  const kv = kvListAll({ ...ev }, baseMap);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      {/* Datos */}
      {kv.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] md:grid-cols-2">
          {kv.map(([label, value], idx) => (
            <div key={`${label}-${idx}`} className="flex gap-2">
              <span className="w-56 shrink-0 text-zinc-500">{label}</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-100">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Imagen (sin links). Si falla, intentamos swap /uploads ↔ /api/uploads una sola vez */}
      <div className="flex items-center justify-center">
        {imgSrc && showImg ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <img
            src={imgSrc}
            className="max-h-[900px] max-w-full rounded-lg object-contain"
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => {
              if (!triedSwap) {
                setTriedSwap(true);
                setImgSrc((s) => (s ? swapUploadsApi(s) : s));
              } else {
                setImgSrc(null); // ocultar si también falla el alternativo
              }
            }}
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
            {initialUrl ? 'Archivo no disponible' : 'Sin imagen'}
          </div>
        )}
      </div>
    </div>
  );
};

const GastoBlock: React.FC<{ g: Gasto }> = ({ g }) => {
  const raw =
    g.url ||
    g.url_imagen ||
    g.url_comprobante ||
    g.comprobante_url ||
    g.imagen_url ||
    null;

  const initialUrl = resolveMediaUrl(raw || '');
  const [imgSrc, setImgSrc] = useState<string | null>(initialUrl);
  const [triedSwap, setTriedSwap] = useState(false);

  const asImg = isImageUrl(imgSrc || undefined);

  const kv = kvListAll(
    {
      descripcion: g.descripcion,
      monto:
        g.monto === null || g.monto === undefined
          ? null
          : (g.monto as number).toLocaleString('es-CL', {
              style: 'currency',
              currency: 'CLP',
            }),
      fecha: g.fecha,
    },
    {
      descripcion: 'Descripción',
      monto: 'Monto',
      fecha: 'Fecha',
    }
  );

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] md:grid-cols-2">
        {kv.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="flex gap-2">
            <span className="w-56 shrink-0 text-zinc-500">{k}</span>
            <span className="font-medium text-zinc-800 dark:text-zinc-100">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center">
        {imgSrc ? (
          asImg ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={imgSrc}
              className="max-h-[700px] max-w-full rounded-lg object-contain"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              onError={() => {
                if (!triedSwap) {
                  setTriedSwap(true);
                  setImgSrc((s) => (s ? swapUploadsApi(s) : s));
                } else {
                  setImgSrc(null);
                }
              }}
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800">
              Archivo adjunto disponible (no es imagen)
            </div>
          )
        ) : (
          <div className="flex h-40 w-full items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
            Sin archivo de comprobante
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------ Plantillas ------------------
const HeaderA: React.FC = () => (
  <div className="mb-4 flex items-center justify-between">
    <h1 className="text-2xl font-extrabold tracking-tight text-blue-600">F-REPORT</h1>
    <div className="text-right text-xs text-zinc-500">
      <div>Documento: Informe de Reporte</div>
      <div>Formato A — Corporate Clean</div>
    </div>
  </div>
);

const HeaderB: React.FC = () => (
  <div className="mb-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="h-10 w-1 rounded bg-blue-600" />
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">F-REPORT</h1>
    </div>
    <div className="text-right text-xs text-zinc-500">
      <div>Documento: Informe de Reporte</div>
      <div>Formato B — Band Lateral</div>
    </div>
  </div>
);

// ------------------ Componente Principal (con forwardRef) ------------------
const InformeReporte = forwardRef<InformeReporteHandle, InformeReporteProps>(
  (
    {
      reporteId,
      plantilla,
      autoExport = false,
      showExportButton = true,
      defaultShowGastos = false,
      onExported,
    },
    ref
  ) => {
    const { reporte, evidencias, gastos, loading, error } = useReporteCompleto(reporteId);

    const [incluirGastos, setIncluirGastos] = useState<boolean>(defaultShowGastos);

    // Refs para exportación
    const portadaRef = useRef<HTMLDivElement | null>(null);
    const evidContainerRef = useRef<HTMLDivElement | null>(null);
    const gastosContainerRef = useRef<HTMLDivElement | null>(null);

    const direccion = useMemo(() => {
      if (!reporte) return '';
      const parts = [reporte.direccion_calle, reporte.direccion_comuna, reporte.direccion_ciudad]
        .filter(Boolean)
        .join(', ');
      return parts || '';
    }, [reporte]);

    const Header = plantilla === 'A' ? HeaderA : HeaderB;

    const datosReporte = useMemo(
      () =>
        kvListAll(
          {
            id_reporte: reporte?.id_reporte,
            fecha_reporte: reporte?.fecha_reporte,
            estado_servicio: reporte?.estado_servicio,
            observaciones: reporte?.observaciones,
          },
          {
            id_reporte: 'ID de Reporte',
            fecha_reporte: 'Fecha',
            estado_servicio: 'Estado',
            observaciones: 'Observaciones',
          }
        ),
      [reporte]
    );

    const datosTecnico = useMemo(
      () =>
        kvListAll(
          {
            nombre_responsable: reporte?.nombre_responsable,
            rut_responsable: reporte?.rut_responsable ? formatRUTDisplay(reporte.rut_responsable) : null,
          },
          {
            nombre_responsable: 'Técnico Responsable',
            rut_responsable: 'RUT Técnico',
          }
        ),
      [reporte]
    );

    const datosCliente = useMemo(
      () =>
        kvListAll(
          {
            nombre_cliente: reporte?.nombre_cliente,
            rut_cliente: reporte?.rut_cliente ? formatRUTDisplay(reporte.rut_cliente) : null,
            nombre_centro_costo: reporte?.nombre_centro_costo,
            id_rut_empresa_cobro: reporte?.id_rut_empresa_cobro
              ? formatRUTDisplay(reporte.id_rut_empresa_cobro)
              : null,
          },
          {
            nombre_cliente: 'Cliente',
            rut_cliente: 'RUT Cliente',
            nombre_centro_costo: 'Centro de Costo',
            id_rut_empresa_cobro: 'RUT Empresa de Cobro',
          }
        ),
      [reporte]
    );

    const totalGastos = useMemo(
      () =>
        (gastos || []).reduce(
          (acc, g) => acc + (Number.isFinite(g.monto || 0) ? (g.monto as number) : 0),
          0
        ),
      [gastos]
    );

    // Exportación
    const doExport = async () => {
      if (!portadaRef.current) return;

      // Espera breve para asegurar carga de imágenes
      await new Promise((r) => setTimeout(r, 300));

      const evidBlocks = Array.from(
        evidContainerRef.current?.querySelectorAll<HTMLElement>('[data-evidencia="1"]') || []
      );
      const gastoBlocks = incluirGastos
        ? Array.from(
            gastosContainerRef.current?.querySelectorAll<HTMLElement>('[data-gasto="1"]') || []
          )
        : [];

      const fileName = `Informe_Reporte_${reporte?.id_reporte ?? 'X'}_${nowStamp()}.pdf`;
      await exportInformeToPDF(portadaRef.current, evidBlocks, gastoBlocks, incluirGastos, fileName);
      onExported?.();
    };

    useImperativeHandle(ref, () => ({ exportPDF: doExport }), [incluirGastos, onExported]);

    // Auto export tras cargar todo
    useEffect(() => {
      if (autoExport && !loading && !error) {
        const t = setTimeout(() => {
          doExport();
        }, 350);
        return () => clearTimeout(t);
      }
      return;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoExport, loading, error]);

    if (loading) return <p className="text-sm text-zinc-500">Cargando datos del reporte…</p>;
    if (error) {
      return (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      );
    }
    if (!reporte) return <p className="text-sm text-zinc-500">No se encontró el reporte.</p>;

    return (
      <div className="space-y-6">
        {/* Portada */}
        <div
          ref={portadaRef}
          className="mx-auto w-full max-w-4xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Header />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <SubTitle>Identificación</SubTitle>
              <div className="mt-2 space-y-1">
                {datosReporte.map(([k, v]) => (
                  <Field key={k} label={k}>
                    {v}
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <SubTitle>Técnico</SubTitle>
              <div className="mt-2 space-y-1">
                {datosTecnico.map(([k, v]) => (
                  <Field key={k} label={k}>
                    {v}
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <SubTitle>Cliente / Centro de Costo</SubTitle>
              <div className="mt-2 space-y-1">
                {datosCliente.map(([k, v]) => (
                  <Field key={k} label={k}>
                    {v}
                  </Field>
                ))}
                <Field label="Dirección">{direccion || 'N/A'}</Field>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Evidencias</div>
              <div className="text-xl font-semibold">{(evidencias || []).length}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Gastos</div>
              <div className="text-xl font-semibold">{(gastos || []).length}</div>
            </div>
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Total Gastos</div>
              <div className="text-xl font-semibold">
                {totalGastos.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
              </div>
            </div>
          </div>

          {/* Toggle gastos en PDF */}
          <div className="mt-4 flex items-center justify-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={incluirGastos}
                onChange={(e) => setIncluirGastos(e.target.checked)}
              />
              Incluir sección de gastos (PDF)
            </label>
          </div>
        </div>

        {/* Evidencias */}
        <div ref={evidContainerRef} className="space-y-6">
          {(evidencias || []).map((ev) => (
            <div key={ev.id_evidencia} data-evidencia="1">
              <EvidenciaBlock ev={ev} />
            </div>
          ))}
          {(!evidencias || evidencias.length === 0) && (
            <div className="mx-auto w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
              No hay evidencias para este reporte.
            </div>
          )}
        </div>

        {/* Gastos detallados (sólo si incluirGastos) */}
        {incluirGastos && (
          <div ref={gastosContainerRef} className="space-y-6">
            {(gastos || []).map((g) => (
              <div key={g.id_gasto} data-gasto="1">
                <GastoBlock g={g} />
              </div>
            ))}
            {(!gastos || gastos.length === 0) && (
              <div className="mx-auto w-full max-w-3xl rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
                No hay gastos para este reporte.
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        {showExportButton && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={doExport}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Generar PDF del informe"
            >
              Exportar PDF
            </button>
          </div>
        )}
      </div>
    );
  }
);

export default InformeReporte;
