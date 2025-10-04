/**
 * ========================================================================
 * Página: src/pages/supervisor/SupervisorInformes.tsx
 * Propósito:
 *  - Page de Informes (Supervisor) con filtros server-side, paginación
 *    y grilla con totales de evidencias/gastos.
 *  - Formato de RUT (formatRUTDisplay) y fecha (formatISODateToCL).
 *  - Acciones por fila: Ver informe (modal) / Generar informe (PDF in-place).
 *  - Acciones de Informe Global al final: Vista previa (modal) / Generar PDF.
 *
 * Notas:
 *  - Selects con ListBox (Headless UI). Muestra “Nombre — RUT” y guarda
 *    el RUT limpio para la API (cleanRUTForAPI).
 *  - La generación de PDF NO navega; monta el componente oculto con
 *    autoExport y se desmonta al terminar.
 * ========================================================================
 */

import { useMemo, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useReportesConsulta } from '../../hooks/useReportesConsulta';
import type {
  ReporteConsultaRow,
  ReportesConsultaParams,
} from '../../services/reportesConsulta.service';
import {
  useTecnicos,
  useClientes,
  useCentrosCosto,
  useEstadosServicio,
} from '../../hooks/useCatalogos';

// Utils existentes
import { formatRUTDisplay, cleanRUTForAPI } from '../../utils/rutFormatter';
import { formatISODateToCL } from '../../utils/dateFormat';

// ListBox reutilizable
import ListBox from '../../components/ui/ListBox';
import type { LBOption } from '../../components/ui/ListBox';

// Componentes de informes (ya existentes) y modal
import InformeReporte from '../../components/informes/InformeReporte';
import InformeGlobal from '../../components/informes/InformeGlobal';
import InformePreviewModal from '../../components/modals/InformePreviewModal';

type BaseFilters = Partial<Omit<ReportesConsultaParams, 'page' | 'pageSize'>>;

export default function SupervisorInformes() {
  // --- Catálogos ---
  const { data: tecnicos = [] } = useTecnicos();
  const { data: clientes = [] } = useClientes();
  const { data: centros = [] } = useCentrosCosto();
  const { data: estados = [] } = useEstadosServicio();

  // --- Filtros (ListBox con objeto seleccionado) ---
  const [selTecnico, setSelTecnico] = useState<LBOption<string> | null>(null);
  const [selEstado, setSelEstado] = useState<LBOption<number> | null>(null);
  const [selCliente, setSelCliente] = useState<LBOption<string> | null>(null);
  const [selCentro, setSelCentro] = useState<LBOption<string> | null>(null);

  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [conEvidencias, setConEvidencias] = useState<boolean | undefined>(undefined);
  const [conGastos, setConGastos] = useState<boolean | undefined>(undefined);

  // paginación
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const [doSearch, setDoSearch] = useState<boolean>(false);

  // --- Opciones de ListBox ---
  const tecnicoOptions: LBOption<string>[] = useMemo(
    () =>
      tecnicos.map((t) => {
        const nombre = `${t.nombre ?? ''} ${t.apellido_paterno ?? ''} ${t.apellido_materno ?? ''}`.trim();
        const displayRut = formatRUTDisplay(t.rut);
        return { value: cleanRUTForAPI(t.rut), label: `${nombre} — ${displayRut}` };
      }),
    [tecnicos]
  );

  const clienteOptions: LBOption<string>[] = useMemo(
    () =>
      clientes.map((c) => ({
        value: cleanRUTForAPI(c.rut_cliente),
        label: `${c.nombre_cliente} — ${formatRUTDisplay(c.rut_cliente)}`,
      })),
    [clientes]
  );

  const centroOptions: LBOption<string>[] = useMemo(
    () =>
      centros.map((cc) => ({
        value: cleanRUTForAPI(cc.id_rut_empresa_cobro),
        label: `${cc.nombre_centro_costo} — ${formatRUTDisplay(cc.id_rut_empresa_cobro)}`,
      })),
    [centros]
  );

  const estadoOptions: LBOption<number>[] = useMemo(
    () =>
      estados.map((es) => ({
        value: es.id_estado_servicio,
        label: es.descripcion,
      })),
    [estados]
  );

  // --- Filtros para API ---
  const baseFilters = useMemo<BaseFilters>(() => {
    return {
      rut_responsable: selTecnico?.value || undefined,
      id_estado_servicio: selEstado?.value ?? undefined,
      fecha_desde: fechaDesde || undefined,
      fecha_hasta: fechaHasta || undefined,
      con_evidencias: typeof conEvidencias === 'boolean' ? conEvidencias : undefined,
      con_gastos: typeof conGastos === 'boolean' ? conGastos : undefined,
      rut_cliente: selCliente?.value || undefined,
      id_rut_empresa_cobro: selCentro?.value || undefined,
    };
  }, [selTecnico, selEstado, fechaDesde, fechaHasta, conEvidencias, conGastos, selCliente, selCentro]);

  const params = useMemo<ReportesConsultaParams>(() => {
    return {
      ...baseFilters,
      page,
      pageSize,
    } as ReportesConsultaParams;
  }, [baseFilters, page, pageSize]);

  const { data, isFetching, refetch } = useReportesConsulta({
    params,
    enabled: false,
  });

  const rows: ReporteConsultaRow[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // --- Estado para MODAL de previsualización ---
  const [previewReporteId, setPreviewReporteId] = useState<number | null>(null);
  const [previewGlobalOpen, setPreviewGlobalOpen] = useState<boolean>(false);

  // --- Estado para EXPORTACIÓN oculta (monta componente con autoExport) ---
  const [exportReporteId, setExportReporteId] = useState<number | null>(null);
  const [exportGlobalKey, setExportGlobalKey] = useState<number>(0); // para remount

  // --- Handlers ---
  const handleBuscar = async () => {
    if (!fechaDesde || !fechaHasta) {
      alert('Debes seleccionar "Fecha desde" y "Fecha hasta".');
      return;
    }
    setPage(1);
    if (!doSearch) setDoSearch(true);
    await refetch();
  };

  const handlePageChange = async (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    if (clamped !== page) {
      setPage(clamped);
      await refetch();
    }
  };

  const handleAccionReporte = (reporte: ReporteConsultaRow, accion: string) => {
    if (!accion) return;
    if (accion === 'ver') {
      // Abre modal de previsualización del reporte
      setPreviewReporteId(reporte.id_reporte);
    } else if (accion === 'pdf') {
      // Dispara exportación directa (monta oculto y descarga)
      setExportReporteId(reporte.id_reporte);
    }
  };

  const handleInformeGlobalPreview = () => {
    setPreviewGlobalOpen(true);
  };

  const handleInformeGlobalPdf = () => {
    // remount para forzar nueva exportación
    setExportGlobalKey((k) => k + 1);
  };

  // --- Render ---
  return (
    <DashboardLayout>
      <div className="px-4 md:px-6">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Informes</h1>
        </header>

        {/* Filtros */}
        <section className="mb-4 rounded-lg border p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {/* Técnico */}
            <ListBox
              label="Técnico (Nombre — RUT)"
              options={tecnicoOptions}
              value={selTecnico}
              onChange={setSelTecnico}
              placeholder="Selecciona técnico…"
            />

            {/* Estado */}
            <ListBox
              label="Estado de servicio"
              options={[{ value: undefined as unknown as number, label: 'Todos' }, ...estadoOptions]}
              value={selEstado}
              onChange={setSelEstado}
              placeholder="Todos"
            />

            {/* Cliente */}
            <ListBox
              label="Cliente (Nombre — RUT)"
              options={clienteOptions}
              value={selCliente}
              onChange={setSelCliente}
              placeholder="Selecciona cliente…"
            />

            {/* Fechas */}
            <div>
              <label className="block text-sm font-medium mb-1">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="w-full rounded border px-3 py-2"
                max={fechaHasta || undefined}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="w-full rounded border px-3 py-2"
                min={fechaDesde || undefined}
              />
            </div>

            {/* Flags evidencias/gastos */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!conEvidencias}
                  onChange={(e) => setConEvidencias(e.target.checked)}
                />
                Con evidencias
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!conGastos}
                  onChange={(e) => setConGastos(e.target.checked)}
                />
                Con gastos
              </label>
            </div>

            {/* Centro de costo */}
            <ListBox
              label="Centro de costo (Nombre — RUT)"
              options={centroOptions}
              value={selCentro}
              onChange={setSelCentro}
              placeholder="Selecciona centro de costo…"
              className="md:col-span-1"
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              className="rounded border px-3 py-2 text-sm"
              onClick={() => {
                setSelTecnico(null);
                setSelEstado(null);
                setSelCliente(null);
                setSelCentro(null);
                setFechaDesde('');
                setFechaHasta('');
                setConEvidencias(undefined);
                setConGastos(undefined);
                setPage(1);
              }}
            >
              Limpiar
            </button>
            <button
              className="rounded bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800"
              onClick={handleBuscar}
            >
              Buscar
            </button>
          </div>

          {isFetching && <p className="mt-2 text-xs text-blue-700">Consultando datos…</p>}
        </section>

        {/* Resultados */}
        <section className="rounded-lg border">
          <div className="max-h-[60vh] overflow-auto">
            <table className="min-w-full table-fixed text-sm">
              <thead className="bg-zinc-50 text-left uppercase tracking-wide text-zinc-600">
                <tr>
                  <th className="w-16 px-4 py-2">ID</th>
                  <th className="px-4 py-2">Técnico</th>
                  <th className="w-40 px-4 py-2">Estado</th>
                  <th className="w-28 px-4 py-2">Fecha</th>
                  <th className="w-24 px-4 py-2 text-center"># Evid.</th>
                  <th className="w-24 px-4 py-2 text-center"># Gastos</th>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2">Centro Costo</th>
                  <th className="w-40 px-4 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id_reporte} className="odd:bg-white even:bg-zinc-50">
                    <td className="px-4 py-2 font-medium">{r.id_reporte}</td>
                    <td className="px-4 py-2">
                      {r.nombre_responsable
                        ? `${r.nombre_responsable} — ${r.rut_responsable ? formatRUTDisplay(r.rut_responsable) : ''}`
                        : r.rut_responsable
                        ? formatRUTDisplay(r.rut_responsable)
                        : '—'}
                    </td>
                    <td className="px-4 py-2">{r.estado_servicio ?? '—'}</td>
                    <td className="px-4 py-2">{formatISODateToCL(r.fecha_reporte)}</td>
                    <td className="px-4 py-2 text-center">{r.evidencias_count ?? 0}</td>
                    <td className="px-4 py-2 text-center">{r.gastos_count ?? 0}</td>
                    <td className="px-4 py-2">
                      {r.nombre_cliente
                        ? `${r.nombre_cliente} — ${r.rut_cliente ? formatRUTDisplay(r.rut_cliente) : ''}`
                        : r.rut_cliente
                        ? formatRUTDisplay(r.rut_cliente)
                        : '—'}
                    </td>
                    <td className="px-4 py-2">
                      {r.nombre_centro_costo
                        ? `${r.nombre_centro_costo} — ${
                            r.id_rut_empresa_cobro ? formatRUTDisplay(r.id_rut_empresa_cobro) : ''
                          }`
                        : r.id_rut_empresa_cobro
                        ? formatRUTDisplay(r.id_rut_empresa_cobro)
                        : '—'}
                    </td>
                    {/* Acciones por reporte */}
                    <td className="px-4 py-2 text-center">
                      <select
                        defaultValue=""
                        className="w-full rounded border px-2 py-1 text-sm"
                        onChange={(e) => handleAccionReporte(r, e.target.value)}
                        title="Acciones de informe"
                      >
                        <option value="" disabled>
                          Selecciona…
                        </option>
                        <option value="ver">Ver informe</option>
                        <option value="pdf">Generar informe (PDF)</option>
                      </select>
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && doSearch && !isFetching && (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                      No hay datos para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-xs text-zinc-500">
              {total > 0 ? `Total: ${total} registros` : '—'}
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || isFetching}
                onClick={() => handlePageChange(page - 1)}
                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
              >
                « Anterior
              </button>
              <span className="text-sm">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages || isFetching}
                onClick={() => handlePageChange(page + 1)}
                className="rounded border px-2 py-1 text-sm disabled:opacity-50"
              >
                Siguiente »
              </button>

              <select
                value={pageSize}
                onChange={async (e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                  await refetch();
                }}
                className="ml-2 rounded border px-2 py-1 text-sm"
                title="Filas por página"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Acciones de Informe Global (debajo de la grilla) */}
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <button
              onClick={handleInformeGlobalPreview}
              disabled={!rows.length}
              className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-700"
              title="Ver vista previa del Informe Global"
            >
              Vista previa — Informe Global
            </button>
            <button
              onClick={handleInformeGlobalPdf}
              disabled={!rows.length}
              className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-indigo-700"
              title="Generar PDF del Informe Global"
            >
              Generar PDF — Informe Global
            </button>
          </div>
        </section>
      </div>

      {/* ===== Modales de PREVIEW ===== */}
      <InformePreviewModal
        open={previewReporteId !== null}
        mode="reporte"
        reporteId={previewReporteId ?? 0}
        template="A"
        onClose={() => setPreviewReporteId(null)}
      />

      <InformePreviewModal
        open={previewGlobalOpen}
        mode="global"
        filters={{
          rut_responsable: baseFilters.rut_responsable,
          id_estado_servicio: baseFilters.id_estado_servicio,
          fecha_desde: baseFilters.fecha_desde,
          fecha_hasta: baseFilters.fecha_hasta,
          con_evidencias: baseFilters.con_evidencias,
          con_gastos: baseFilters.con_gastos,
          rut_cliente: baseFilters.rut_cliente,
          id_rut_empresa_cobro: baseFilters.id_rut_empresa_cobro,
        }}
        onClose={() => setPreviewGlobalOpen(false)}
      />

      {/* ===== Montaje oculto para EXPORTACIÓN DIRECTA ===== */}
      {/* Reporte individual */}
      {exportReporteId !== null && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
          <InformeReporte
            reporteId={exportReporteId}
            plantilla="A"
            autoExport
            showExportButton={false}
            onExported={() => setExportReporteId(null)}
          />
        </div>
      )}

      {/* Informe Global */}
      {exportGlobalKey > 0 && (
        <div key={exportGlobalKey} style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
          <InformeGlobal
            filters={{
              rut_responsable: baseFilters.rut_responsable,
              id_estado_servicio: baseFilters.id_estado_servicio,
              fecha_desde: baseFilters.fecha_desde,
              fecha_hasta: baseFilters.fecha_hasta,
              con_evidencias: baseFilters.con_evidencias,
              con_gastos: baseFilters.con_gastos,
              rut_cliente: baseFilters.rut_cliente,
              id_rut_empresa_cobro: baseFilters.id_rut_empresa_cobro,
            }}
            autoExport
            showExportButton={false}
            onExported={() => setExportGlobalKey(0)}
          />
        </div>
      )}
    </DashboardLayout>
  );
}
