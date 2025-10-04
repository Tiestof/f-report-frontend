/**
 * ============================================================
 * Archivo: src/components/modals/InformePreviewModal.tsx
 * Propósito:
 *  - Modal de previsualización para Informe de Reporte o Global.
 *  - Botón “Descargar PDF” dispara exportPDF() del hijo.
 * Uso:
 *  <InformePreviewModal
 *    open={open}
 *    mode="reporte"
 *    reporteId={id}
 *    template="A"
 *    onClose={()=>setOpen(false)}
 *  />
 *  // ó
 *  <InformePreviewModal
 *    open={open}
 *    mode="global"
 *    filters={filters}
 *    onClose={()=>setOpen(false)}
 *  />
 * ============================================================
 */

import { useRef } from 'react';
import InformeReporte, {
  type InformeReporteHandle,
} from '../informes/InformeReporte';
import InformeGlobal, {
  type InformeGlobalHandle,
} from '../informes/InformeGlobal';
import type { ReportesConsultaParams } from '../../services/reportesConsulta.service';

type Props =
  | {
      open: boolean;
      mode: 'reporte';
      reporteId: number;
      template?: 'A' | 'B';
      onClose: () => void;
    }
  | {
      open: boolean;
      mode: 'global';
      filters: Omit<ReportesConsultaParams, 'page' | 'pageSize'>;
      onClose: () => void;
    };

export default function InformePreviewModal(props: Props) {
  if (!props.open) return null;

  const repRef = useRef<InformeReporteHandle | null>(null);
  const globRef = useRef<InformeGlobalHandle | null>(null);

  const doDownload = async () => {
    if (props.mode === 'reporte') {
      await repRef.current?.exportPDF();
    } else {
      await globRef.current?.exportPDF();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-3">
      <div className="bg-white dark:bg-zinc-900 w-full max-w-[1100px] rounded-2xl shadow-xl overflow-hidden flex flex-col h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-lg font-semibold">
            {props.mode === 'reporte' ? 'Vista previa - Informe del Reporte' : 'Vista previa - Informe Global'}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={doDownload}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Descargar PDF
            </button>
            <button
              onClick={props.onClose}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {props.mode === 'reporte' ? (
            <InformeReporte
              ref={repRef}
              reporteId={props.reporteId}
              plantilla={props.template ?? 'A'}
              showExportButton={false}
            />
          ) : (
            <InformeGlobal
              ref={globRef}
              filters={props.filters}
              showExportButton={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
