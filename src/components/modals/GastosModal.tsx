/**
 * ============================================================
 * Archivo: src/components/modals/GastosModal.tsx
 * Componente: GastosModal
 * Descripción:
 *  - Permite ingresar N gastos en un modal (tipo, monto, fecha, comentario, imagen opcional).
 *  - Las imágenes se comprimen en el cliente y se convierten a blanco y negro (canvas).
 *  - Al guardar, envía cada gasto por separado.
 * ============================================================
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTiposGasto } from '../../services/catalogosService';
import { createGasto, listarGastosPorReporte, eliminarGasto } from '../../services/gastosService';
import { compressToJpegDataURL } from '../../utils/imageTools';
import FileUploader from '../ui/FileUploader';
import { toast } from 'sonner';

type Props = {
  idReporte: number;
  onClose: () => void;
  onSaved: () => void;
};

type TipoGasto = { id_tipo_gasto: number; descripcion: string };

type Row = {
  id?: number;
  id_tipo_gasto?: number;
  monto?: number;
  fecha_gasto?: string;
  comentario?: string;
  file?: File | null;
  preview?: string | null; // DataURL
};

type GastoExistente = {
  id_gasto?: number;
  id?: number;
  id_tipo_gasto?: number;
  monto?: number;
  fecha_gasto?: string | null;
  fecha?: string | null;
  comentario?: string | null;
  descripcion?: string | null;
  imagen_url?: string | null;
};

export default function GastosModal({ idReporte, onClose, onSaved }: Props) {
  const { data: tipos = [] } = useQuery<TipoGasto[]>({
    queryKey: ['tipos-gasto'],
    queryFn: getTiposGasto,
    staleTime: 10 * 60 * 1000,
  });
  const [rows, setRows] = useState<Row[]>([{}]);

  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id_tipo_gasto, t.descripcion])), [tipos]);

  const { data: gastosExistentes = [], isFetching: loadingGastos, refetch: refetchGastos } = useQuery<GastoExistente[]>({
    queryKey: ['gastos-reporte', idReporte],
    queryFn: () => listarGastosPorReporte(idReporte),
    staleTime: 5 * 60 * 1000,
  });

  const addRow = () => setRows((rs) => [...rs, {}]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const onFile = async (idx: number, f: File | null) => {
    if (!f) {
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, file: null, preview: null } : r)));
      return;
    }
    const dataUrl = await compressToJpegDataURL(f, { maxW: 1600, maxH: 1200, grayscale: true, quality: 0.7 });
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, file: f, preview: dataUrl } : r)));
  };

  const handleDelete = async (gasto: GastoExistente) => {
    const id = gasto.id_gasto ?? gasto.id;
    if (!id) return;
    const ok = confirm('¿Eliminar el gasto seleccionado?');
    if (!ok) return;
    try {
      await eliminarGasto(id);
      toast.success('Gasto eliminado');
      await refetchGastos();
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar el gasto');
    }
  };

  const saveAll = async () => {
    try {
      for (const r of rows) {
        if (!r.id_tipo_gasto || !r.monto || !r.fecha_gasto) continue;

        let imageUrl: string | undefined = undefined;
        if (r.preview) {
          // Si implementas /uploads, aquí subes y reemplazas por URL devuelta.
          imageUrl = r.preview;
        }

        await createGasto({
          id_reporte: idReporte,
          id_tipo_gasto: r.id_tipo_gasto,
          monto: r.monto,
          fecha_gasto: r.fecha_gasto,
          comentario: r.comentario ?? '',
          imagen_url: imageUrl ?? '',
        });
      }
      toast.success('Gastos guardados');
      await refetchGastos();
      setRows([{}]);
      onSaved();
      onClose();

    } catch (e) {
      console.error(e);
      toast.error('Error al guardar gastos');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 shadow-xl p-4">
        <h3 className="text-lg font-semibold">Gastos del reporte #{idReporte}</h3>
        <div className="mt-3 flex flex-col gap-4 max-h-[60vh] overflow-auto pr-1">
          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Gastos registrados</h4>
            {loadingGastos ? (
              <div className="text-xs text-slate-500">Cargando gastos...</div>
            ) : gastosExistentes.length === 0 ? (
              <div className="text-xs text-slate-500">Sin gastos registrados.</div>
            ) : (
              gastosExistentes.map((g) => {
                const id = g.id_gasto ?? g.id;
                const fechaRaw = g.fecha_gasto ?? g.fecha ?? '';
                const fecha = fechaRaw ? new Date(fechaRaw).toISOString().slice(0, 10) : '';
                const comentario = g.comentario ?? g.descripcion ?? '';
                return (
                  <div
                    key={id ?? `${fecha}-${comentario}`}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-1 text-xs"
                  >
                    <div className="flex flex-wrap gap-3">
                      <span><b>Tipo:</b> {tipoMap.get(g.id_tipo_gasto ?? 0) ?? g.id_tipo_gasto ?? '-'}</span>
                      <span><b>Monto:</b> {g.monto != null ? Math.round(Number(g.monto)) : '-'}</span>
                      <span><b>Fecha:</b> {fecha || '-'}</span>
                    </div>
                    {comentario ? <div><b>Comentario:</b> {comentario}</div> : null}
                    {g.imagen_url ? (
                      <div className="mt-1">
                        <img src={g.imagen_url} alt="Evidencia gasto" className="h-20 rounded border object-cover" />
                      </div>
                    ) : null}
                    <div className="flex justify-end">
                      <button className="px-2 py-1 rounded border text-xs" onClick={() => handleDelete(g)}>
                        Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">Agregar nuevos gastos</h4>
            {rows.map((row, idx) => (
            <div key={idx} className="rounded-xl border p-3 grid grid-cols-1 md:grid-cols-6 gap-2">
              <div>
                <label className="text-xs">Tipo</label>
                <select
                  className="input w-full"
                  value={row.id_tipo_gasto ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, id_tipo_gasto: val } : r)));
                  }}
                >
                  <option value="">—</option>
                  {tipos.map((t) => (
                    <option key={t.id_tipo_gasto} value={t.id_tipo_gasto}>
                      {t.descripcion}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs">Monto</label>
                <input
                  className="input w-full"
                  type="number"
                  min={0}
                  value={row.monto ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, monto: val } : r)));
                  }}
                />
              </div>
              <div>
                <label className="text-xs">Fecha</label>
                <input
                  className="input w-full"
                  type="date"
                  value={row.fecha_gasto ?? ''}
                  onChange={(e) => {
                    const val = e.target.value || undefined;
                    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, fecha_gasto: val } : r)));
                  }}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs">Comentario</label>
                <input
                  className="input w-full"
                  value={row.comentario ?? ''}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, comentario: e.target.value } : r)))}
                />
              </div>
              <div>
                <label className="text-xs">Boleta/Foto (opcional)</label>
                <FileUploader onFile={(f) => onFile(idx, f)} preview={row.preview ?? undefined} accept="image/*" capture />
              </div>

              <div className="md:col-span-6 flex justify-end">
                <button className="px-2 py-1 rounded-lg border text-xs" onClick={() => removeRow(idx)}>
                  Quitar
                </button>
              </div>
            </div>
          ))}
            <button className="self-start px-3 py-2 rounded-xl border text-sm" onClick={addRow}>
              + Agregar gasto
            </button>
          </section>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-2 rounded-xl border" onClick={onClose}>
            Cerrar
          </button>
          <button className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={saveAll}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
