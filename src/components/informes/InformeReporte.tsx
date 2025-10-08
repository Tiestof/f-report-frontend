/**
 * ============================================================
 * Componente: src/components/informes/InformeReporte.tsx
 * Propósito:
 *  - Renderizar “Informe de Reporte”.
 *  - Cargar reporte + evidencias + gastos desde la API.
 *  - Exportar a PDF (html2canvas + jsPDF).
 *
 * Cambios:
 *  - Fix de errores de compilación (línea residual y estado triedSwap).
 *  - Firma Digital: solo Tipo de evidencia, ID evidencia, Nombre quien recibe, Imagen.
 *  - Otras evidencias: NO “Comentario”, NO “Fecha” (creación). MAC unificado solo si hay dato.
 *  - Centro de Costo: si hay RUT Empresa de Cobro, buscar su descripción y mostrar en “Centro de Costo”.
 *  - Técnico Responsable: completar con nombre + apellidos desde /usuarios/:rut si falta.
 *  - Datos logísticos: recuadro aparte, con Dirección (calle) primero, luego Número, Sector, Piso, Edificio,
 *    Comuna, Ciudad, Región, País (con fallbacks).
 *  - Gastos: monto formateado CLP sin decimales incluso si llega como string.
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
import { resolveMediaUrl, isImageUrl } from '../../utils/urlResolver';

// Alterna /uploads ↔ /api/uploads si una imagen falla
function swapUploadsApiLocal(url: string): string {
  if (!url) return url;
  if (url.includes('/api/uploads')) return url.replace('/api/uploads', '/uploads');
  return url.replace('/uploads', '/api/uploads');
}

// ------------------ Tipos tolerantes ------------------
type Evidencia = {
  id_evidencia: number;

  // URLs
  url?: string | null;
  url_imagen?: string | null;
  comprobante_url?: string | null;
  url_comprobante?: string | null;
  imagen_url?: string | null;

  // Catálogo
  id_tipo_evidencia?: number | null; // 3 -> Firma Digital
  descripcion_tipo_evidencia?: string | null;

  // Metadatos
  modelo?: string | null;            // Firma: nombre firmante
  numero_serie?: string | null;      // N° Serie
  ipv4?: string | null;
  ipv6?: string | null;
  mac?: string | null;
  macadd?: string | null;
  nombre_maquina?: string | null;

  // Fechas
  fecha?: string | null;             // no se muestra
  fecha_subida?: string | null;

  // Texto (no mostrar "comentario" en informe para otras evidencias)
  descripcion?: string | null;

  [k: string]: any;
};

type Gasto = {
  id_gasto: number;
  comentario?: string | null;
  descripcion?: string | null;
  monto?: number | string | null;
  fecha?: string | null;
  fecha_gasto?: string | null;

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

  // Técnico
  rut_responsable: string;
  nombre_responsable?: string | null;

  // Estado
  id_estado_servicio?: number;
  estado_servicio?: string | null;

  // Cliente / Cobro
  rut_cliente?: string | null;
  nombre_cliente?: string | null;
  id_rut_empresa_cobro?: string | null;
  nombre_centro_costo?: string | null;

  // Dirección desglosada o variantes antiguas
  calle?: string | null;
  numero?: string | null;
  sector?: string | null;
  barrio?: string | null;
  piso?: string | null;
  edificio?: string | null;
  comuna?: string | null;
  ciudad?: string | null;
  region?: string | null;
  pais?: string | null;
  direccion?: string | null;

  direccion_calle?: string | null;
  direccion_numero?: string | null;
  direccion_comuna?: string | null;
  direccion_ciudad?: string | null;

  observaciones?: string | null;
  comentario?: string | null;

  [k: string]: any;
};

export interface InformeReporteProps {
  reporteId: number;
  plantilla: 'A' | 'B';
  autoExport?: boolean;
  showExportButton?: boolean;
  defaultShowGastos?: boolean;
  onExported?: () => void;
}

export type InformeReporteHandle = { exportPDF: () => Promise<void> };

// ------------------ Helpers ------------------
function kvListAll(
  obj: Record<string, any>,
  map: Record<string, string>
): Array<[string, string]> {
  const items: Array<[string, string]> = [];
  Object.entries(map).forEach(([key, label]) => {
    let v = obj[key];
    if (v === undefined || v === null || v === '') v = 'N/A';
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

function formatCLP(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'N/A';
  return `$ ${n.toLocaleString('es-CL', { maximumFractionDigits: 0, minimumFractionDigits: 0 })} CLP`;
}

// Normaliza RUT para API: elimina puntos y espacios, mantiene guión
function normalizeRutForApi(rut?: string | null): string | null {
  if (!rut) return null;
  return rut.replace(/\./g, '').replace(/\s+/g, '').trim();
}

// Intenta construir nombre completo desde varios alias de campos
function buildFullName(u: any): string | null {
  if (!u) return null;
  const nombre = u.nombre || u.nombres || u.first_name || '';
  const segundo = u.segundo_nombre || u.segundoNombre || u.middle_name || '';
  const apPat = u.apellido_paterno || u.apellidoPaterno || u.apellido || u.last_name || '';
  const apMat = u.apellido_materno || u.apellidoMaterno || u.second_last_name || u.apellidos || '';
  const candidato =
    (u.nombre_completo && String(u.nombre_completo).trim()) ||
    [nombre, segundo, apPat, apMat].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return candidato || null;
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
        // 1) Reporte base
        const repRes = await api.get(`/reportes/${id}`);
        let rep: Reporte = repRes?.data?.data || repRes?.data || (repRes as any);

        // 2) Enriquecer: Centro de Costo desde RUT Empresa de Cobro
        if (rep?.id_rut_empresa_cobro && !rep?.nombre_centro_costo) {
          const rutCC = normalizeRutForApi(rep.id_rut_empresa_cobro);
          if (rutCC) {
            const tryEndpoints = [
              `/centro-costo/${rutCC}`,
              `/centros-costo/${rutCC}`,
              `/empresas-cobro/${rutCC}`,
              `/empresa-cobro/${rutCC}`,
            ];
            for (const ep of tryEndpoints) {
              try {
                const r = await api.get(ep);
                const d = r?.data?.data || r?.data || null;
                const nombre = d?.descripcion || d?.nombre || d?.nombre_centro_costo || null;
                if (nombre) {
                  rep.nombre_centro_costo = String(nombre);
                  break;
                }
              } catch {
                /* intenta siguiente endpoint */
              }
            }
          }
        }

        // 3) Enriquecer: Técnico Responsable desde RUT
        if (rep?.rut_responsable && (!rep?.nombre_responsable || String(rep.nombre_responsable).trim().split(' ').length < 2)) {
          const rutTec = normalizeRutForApi(rep.rut_responsable) ?? rep.rut_responsable;
          try {
            const uRes = await api.get(`/usuarios/${rutTec}`);
            const u = uRes?.data?.data || uRes?.data || null;
            const full = buildFullName(u);
            if (full) rep.nombre_responsable = full;
          } catch {
            /* silencioso */
          }
        }

        if (!active) return;

        // 4) Evidencias
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

        // 5) Gastos
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

  // Gastos (opcional)
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

/** Bloque de evidencia */
const EvidenciaBlock: React.FC<{ ev: Evidencia }> = ({ ev }) => {
  const isFirma = Number(ev.id_tipo_evidencia) === 3;

  // URL normalizada
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

  // Mapeo (sin "Comentario" en otras evidencias)
  const baseMapFirma: Record<string, string> = {
    descripcion_tipo_evidencia: 'Tipo de evidencia',
    id_evidencia: 'ID evidencia',
    modelo: 'Nombre quien recibe el trabajo',
  };

  const baseMapOtros: Record<string, string> = {
    descripcion_tipo_evidencia: 'Tipo de evidencia',
    // fecha: 'Fecha',   // eliminado
    fecha_subida: 'Fecha de subida',
    numero_serie: 'N° Serie',
    ipv4: 'IPv4',
    ipv6: 'IPv6',
    nombre_maquina: 'Nombre máquina',
    modelo: 'Modelo',
    // MAC se agrega abajo si hay dato
  };

  const kv = kvListAll(ev, isFirma ? baseMapFirma : baseMapOtros);

  // MAC unificado solo si NO es firma y hay dato
  if (!isFirma) {
    const macUnified = ev.mac || ev.macadd || '';
    if (macUnified && String(macUnified).trim() !== '') {
      kv.push(['MAC', String(macUnified)]);
    }
  }

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

      {/* Imagen */}
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
                setImgSrc((s) => (s ? swapUploadsApiLocal(s) : s));
              } else {
                setImgSrc(null);
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

  const kv = [
    ['Comentario gasto', g.comentario ?? g.descripcion ?? 'N/A'],
    ['Monto', formatCLP(g.monto ?? 0)],
    ['Fecha', g.fecha_gasto ? formatISODateToCL(g.fecha_gasto) : g.fecha ? formatISODateToCL(g.fecha) : 'N/A'],
  ] as Array<[string, string]>;

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
                  setImgSrc((s) => (s ? swapUploadsApiLocal(s) : s));
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

// ------------------ Componente Principal ------------------
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

    // Dirección: recuadro “Datos logísticos”
    const datosLogisticos = useMemo(() => {
      if (!reporte) return [] as Array<[string, string]>;

      // Dirección (nombre de la calle) como PRIMER campo
      const direccionNombre =
        reporte.direccion ??
        reporte.direccion_calle ??
        reporte.calle ??
        null;

      // El resto de campos
      const objResto: Record<string, any> = {
        numero: reporte.numero ?? reporte.direccion_numero ?? null,
        sector: reporte.sector ?? reporte.barrio ?? null,
        piso: reporte.piso ?? null,
        edificio: reporte.edificio ?? null,
        comuna: reporte.comuna ?? reporte.direccion_comuna ?? null,
        ciudad: reporte.ciudad ?? reporte.direccion_ciudad ?? null,
        region: reporte.region ?? null,
        pais: reporte.pais ?? null,
      };

      const items: Array<[string, string]> = [];
      if (direccionNombre && String(direccionNombre).trim() !== '') {
        items.push(['Dirección', String(direccionNombre)]);
      }

      const labelMap: Record<string, string> = {
        numero: 'Número',
        sector: 'Sector',
        piso: 'Piso',
        edificio: 'Edificio',
        comuna: 'Comuna',
        ciudad: 'Ciudad',
        region: 'Región',
        pais: 'País',
      };

      Object.entries(labelMap).forEach(([k, label]) => {
        const val = objResto[k];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          items.push([label, String(val)]);
        }
      });

      // Si no cargó nada, intentar fallback a cadena completa
      if (items.length === 0) {
        const joined =
          [
            reporte.direccion_calle,
            reporte.direccion_comuna,
            reporte.direccion_ciudad,
          ]
            .filter(Boolean)
            .join(', ') || reporte.direccion || '';
        if (joined) items.push(['Dirección', joined]);
      }

      return items;
    }, [reporte]);

    // Elegir cabecera sin warning TS2774
    const HeaderComp = useMemo(() => (plantilla === 'A' ? HeaderA : HeaderB), [plantilla]);

    const datosReporte = useMemo(
      () =>
        kvListAll(
          {
            id_reporte: reporte?.id_reporte,
            fecha_reporte: reporte?.fecha_reporte,
            estado_servicio: reporte?.estado_servicio,
            observaciones: reporte?.observaciones ?? reporte?.comentario ?? null,
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

    const datosClienteCobro = useMemo(
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

    const totalGastos = useMemo(() => {
      return (gastos || []).reduce((acc, g) => {
        const val = Number(g?.monto);
        return acc + (Number.isFinite(val) ? val : 0);
      }, 0);
    }, [gastos]);

    // Exportación
    const doExport = async () => {
      if (!portadaRef.current) return;

      await new Promise((r) => setTimeout(r, 300)); // asegurar carga de imágenes

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
          <HeaderComp />

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
              <SubTitle>Cliente y Cobro</SubTitle>
              <div className="mt-2 space-y-1">
                {datosClienteCobro.map(([k, v]) => (
                  <Field key={k} label={k}>
                    {v}
                  </Field>
                ))}
              </div>
            </div>
          </div>

          {/* Datos logísticos */}
          <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
            <SubTitle>Datos logísticos</SubTitle>
            <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 md:grid-cols-2">
              {datosLogisticos.length > 0 ? (
                datosLogisticos.map(([label, value]) => (
                  <Field key={label} label={label}>
                    {value}
                  </Field>
                ))
              ) : (
                <Field label="Dirección">N/A</Field>
              )}
            </div>
          </div>

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
              <div className="text-xs text-zinc-500">Evidencias</div>
              <div className="text-xl font-semibold">{(evidencias || []).length}</div>
            </div>

            {incluirGastos && (
              <>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="text-xs text-zinc-500">Gastos</div>
                  <div className="text-xl font-semibold">{(gastos || []).length}</div>
                </div>
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="text-xs text-zinc-500">Total Gastos</div>
                  <div className="text-xl font-semibold">
                    {formatCLP(totalGastos)}
                  </div>
                </div>
              </>
            )}
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
