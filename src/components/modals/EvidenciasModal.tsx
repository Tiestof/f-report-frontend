/**
 * ============================================================
 * Archivo: src/components/modals/EvidenciasModal.tsx
 * Componente: EvidenciasModal (refactor multipart + UI)
 * Descripción:
 *  - Permite ingresar múltiples evidencias.
 *  - Usa flujo NUEVO multipart para subir archivos a /evidencias/upload.
 *  - Caso especial: TipoEvidencia = 3 (Firma Digital)
 *      • Muestra pad de firma más grande + nombre y apellido.
 *      • Sube la firma como PNG vía multipart usando uploadFirmaDesdeDataURL.
 *  - Para otros tipos: adjuntar imagen (usa FileUploader). Se sube con uploadEvidencia.
 *  - Lista y permite eliminar evidencias existentes.
 * Accesibilidad/UX:
 *  - Diseño modernizado con Tailwind, cabecera sticky, overlay semitransparente.
 *  - Estados de carga/notificación con sonner.
 *  - Botón Cerrar siempre visible, foco visual claro.
 * Dependencias:
 *  - @tanstack/react-query
 *  - services/catalogosService.getTiposEvidencia
 *  - services/evidenciasService: listarEvidenciasPorReporte, eliminarEvidencia,
 *      uploadEvidencia, uploadFirmaDesdeDataURL
 *  - components/ui/SignaturePad, components/ui/FileUploader
 *  - utils/imageTools.compressToJpegDataURL (opcional, se usa si quieres comprimir)
 * ============================================================
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTiposEvidencia } from '../../services/catalogosService';
import {
  listarEvidenciasPorReporte,
  eliminarEvidencia,
  uploadEvidencia,
  uploadFirmaDesdeDataURL,
} from '../../services/evidenciasService';
import SignaturePad from '../ui/SignaturePad';
import FileUploader from '../ui/FileUploader';
import { compressToJpegDataURL } from '../../utils/imageTools';
import { toast } from 'sonner';

type Props = {
  idReporte: number;
  onClose: () => void;
  onSaved: () => void;
};

type TipoEvidencia = { id_tipo_evidencia: number; descripcion_tipo_evidencia: string };

type Row = {
  id_tipo_evidencia?: number;
  // Archivo/preview para tipos NO firma
  file?: File | null;
  previewUrl?: string | null;
  // Metadatos (se mantienen para futuro; hoy el upload sólo asegura URL)
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;
  // Firma
  nombre?: string;
  apellido?: string;
  firmaDataUrl?: string | null;
};

// Unificamos el tipo que llega del backend (V12/V13 o legacy)
export type EvidenciaView = {
  id_evidencia?: number;
  id?: number;
  id_reporte?: number;
  id_tipo_evidencia?: number | null; // puede venir null
  url?: string | null;
  modelo?: string | null;
  serie?: string | null;          // V12/V13
  numero_serie?: string | null;   // legacy
  ipv4?: string | null;
  ipv6?: string | null;
  macadd?: string | null;
  nombre_maquina?: string | null;
  comentario?: string | null;
  created_at?: string | null;
};

export default function EvidenciasModal({ idReporte, onClose, onSaved }: Props) {
  const { data: tipos = [] } = useQuery<TipoEvidencia[]>({
    queryKey: ['tipos-evidencia'],
    queryFn: getTiposEvidencia,
    staleTime: 10 * 60 * 1000,
    initialData: [],
  });

  const [rows, setRows] = useState<Row[]>([{}]);
  const [busy, setBusy] = useState(false);

  const isFirma = (t?: number) => t === 3;
  const tipoMap = useMemo(() => new Map(tipos.map((t) => [t.id_tipo_evidencia, t.descripcion_tipo_evidencia])), [tipos]);

  const {
    data: evidenciasExistentes = [],
    isFetching: loadingEvidencias,
    refetch: refetchEvidencias,
  } = useQuery<EvidenciaView[]>({
  queryKey: ['evidencias-reporte', idReporte],
  queryFn: async () => {
    const data = await listarEvidenciasPorReporte(idReporte);
    return (data ?? []) as EvidenciaView[];
  },
  staleTime: 5 * 60 * 1000,
  initialData: [],
});

  const addRow = () => setRows((rs) => [...rs, {}]);
  const removeRow = (idx: number) => setRows((rs) => rs.filter((_, i) => i !== idx));

  const onFile = async (idx: number, f: File | null) => {
    if (!f) {
      setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, file: null, previewUrl: null } : r)));
      return;
    }
    // Preview inmediato con la imagen original (rápido). Si quieres comprimir,
    // lo hacemos al momento de guardar para subir el archivo comprimido.
    const objUrl = URL.createObjectURL(f);
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, file: f, previewUrl: objUrl } : r)));
  };

  const handleDeleteEvidencia = async (ev: EvidenciaView) => {
    const id = ev.id_evidencia ?? ev.id;
    if (!id) return;
    const ok = confirm('¿Eliminar la evidencia seleccionada?');
    if (!ok) return;
    try {
      await eliminarEvidencia(id);
      toast.success('Evidencia eliminada');
      await refetchEvidencias();
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error('No se pudo eliminar la evidencia');
    }
  };

  const saveAll = async () => {
    try {
      setBusy(true);

      for (const r of rows) {
        if (!r.id_tipo_evidencia) continue;

        if (isFirma(r.id_tipo_evidencia)) {
          const full = `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim();
          if (!r.firmaDataUrl) continue;

          // Subir firma como PNG (multipart). Si luego quieres guardar "full" en DB,
          // podemos extender el endpoint para recibir campo "modelo" opcional.
          await uploadFirmaDesdeDataURL({
            dataURL: r.firmaDataUrl,
            id_reporte: idReporte,
            id_tipo_evidencia: 3,
            fileName: full ? `firma_${full.replace(/\s+/g, '_')}.png` : 'firma.png',
          });
        } else {
          // Si hay archivo, opcionalmente comprimimos y luego subimos multipart
          if (!r.file) continue;

          // OPCIONAL: comprimir a JPEG B/N como en tu flujo original
          // Si prefieres subir original, comenta las 3 líneas siguientes y usa r.file directamente.
          const dataUrl = await compressToJpegDataURL(r.file, {
            maxW: 1600,
            maxH: 1200,
            grayscale: true,
            quality: 0.7,
          });
          const blob = dataURLtoBlob(dataUrl);
          const fname = r.file.name?.replace(/\.[^.]+$/, '') || 'evidencia';

          await uploadEvidencia({
            file: blob, // o r.file si no comprimes
            id_reporte: idReporte,
            id_tipo_evidencia: r.id_tipo_evidencia,
            fileName: `${fname}.jpg`,
          });
        }
      }

      toast.success('Evidencias subidas');
      await refetchEvidencias();
      setRows([{}]);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Error al subir evidencias');
    } finally {
      setBusy(false);
    }
  };

  // Utilidad local: convertir dataURL→Blob sin Buffer (navegador)
  function dataURLtoBlob(dataURL: string): Blob {
    const parts = dataURL.split(',', 2);
    if (parts.length < 2) throw new Error('DataURL inválida');

    const header = parts[0]; // ej: data:image/jpeg;base64
    const data = parts[1];

    const isBase64 = /;base64/i.test(header);
    const mimeMatch = header.match(/^data:([^;]+)(;.*)?$/i);
    const mime = mimeMatch?.[1] ?? 'application/octet-stream';

    const byteString = isBase64 ? atob(data) : decodeURIComponent(data);
    const len = byteString.length;
    const u8 = new Uint8Array(len);
    for (let i = 0; i < len; i++) u8[i] = byteString.charCodeAt(i) & 0xff;

    return new Blob([u8], { type: mime });
  }

  const isPdf = (url?: string | null) => (url ? /\.pdf($|\?)/i.test(url) : false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-5xl rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-black/5 overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur">
          <div>
            <h3 className="text-lg font-semibold">Evidencias del reporte #{idReporte}</h3>
            <p className="text-xs text-zinc-500">Sube fotos/archivos y captura firma digital. Máx 5MB por archivo.</p>
          </div>
          <button
            className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-6 max-h-[75vh] overflow-auto">
          {/* Lista existentes */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Evidencias registradas</h4>
              {loadingEvidencias && <span className="text-xs text-zinc-500">Cargando…</span>}
            </div>
            {(!loadingEvidencias && evidenciasExistentes.length === 0) ? (
              <div className="text-xs text-zinc-500">Sin evidencias registradas.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {evidenciasExistentes.map((ev) => {
                  const id = ev.id_evidencia ?? ev.id;
                  const tipoDescripcion = tipoMap.get(ev.id_tipo_evidencia ?? 0) ?? ev.id_tipo_evidencia ?? '-';
                  const serie = ev.serie ?? ev.numero_serie;
                  return (
                    <div key={id ?? `${ev.url}-${tipoDescripcion}`}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col gap-2">
                      <div className="text-xs flex flex-wrap gap-x-3 gap-y-1 text-zinc-700 dark:text-zinc-200">
                        <span><b>Tipo:</b> {String(tipoDescripcion)}</span>
                        {ev.modelo ? <span><b>Modelo:</b> {ev.modelo}</span> : null}
                        {serie ? <span><b>Serie:</b> {serie}</span> : null}
                      </div>
                      {ev.ipv4 || ev.ipv6 ? (
                        <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                          {ev.ipv4 ? <span><b>IPv4:</b> {ev.ipv4}</span> : null}
                          {ev.ipv6 ? <span><b>IPv6:</b> {ev.ipv6}</span> : null}
                        </div>
                      ) : null}
                      {ev.macadd ? <div className="text-xs"><b>MAC:</b> {ev.macadd}</div> : null}
                      {ev.nombre_maquina ? <div className="text-xs"><b>Equipo:</b> {ev.nombre_maquina}</div> : null}
                      {ev.url ? (
                        isPdf(ev.url) ? (
                          <a href={ev.url} target="_blank" rel="noreferrer"
                             className="mt-1 grid place-items-center h-32 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs">
                            Ver PDF
                          </a>
                        ) : (
                          <a href={ev.url} target="_blank" rel="noreferrer" className="mt-1 block">
                            <img src={ev.url} alt="Evidencia" className="h-32 w-full object-contain rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white" />
                          </a>
                        )
                      ) : null}
                      <div className="flex justify-end">
                        <button className="px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                onClick={() => handleDeleteEvidencia(ev)}>
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Agregar nuevas */}
          <section className="space-y-3">
            <h4 className="text-sm font-semibold">Agregar nuevas evidencias</h4>
            {rows.map((row, idx) => {
              const tipo = row.id_tipo_evidencia;
              return (
                <div key={idx} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 grid grid-cols-1 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="text-xs">Tipo evidencia</label>
                    <select
                      className="input w-full"
                      value={tipo ?? ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : undefined;
                        setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, id_tipo_evidencia: val } : r)));
                      }}
                    >
                      <option value="">—</option>
                      {tipos.map((t) => (
                        <option key={t.id_tipo_evidencia} value={t.id_tipo_evidencia}>
                          {t.descripcion_tipo_evidencia}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Firma digital */}
                  {isFirma(tipo) ? (
                    <>
                      <div className="lg:col-span-4">
                        <label className="text-xs">Pad de firma</label>
                        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-800">
                          <SignaturePad
                            height={220} // ↑ Más alto que antes (mejora UX)
                            onChange={(dataUrl: string) =>
                              setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, firmaDataUrl: dataUrl } : r)))
                            }
                          />
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1">Sugerencia: firme con el teléfono en horizontal para mayor área.</p>
                      </div>
                      <div>
                        <label className="text-xs">Nombre</label>
                        <input
                          className="input w-full"
                          value={row.nombre ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, nombre: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">Apellido</label>
                        <input
                          className="input w-full"
                          value={row.apellido ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, apellido: e.target.value } : r)))}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="lg:col-span-2">
                        <label className="text-xs">Modelo</label>
                        <input
                          className="input w-full"
                          value={row.modelo ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, modelo: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">N° Serie</label>
                        <input
                          className="input w-full"
                          value={row.numero_serie ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, numero_serie: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">IPv4</label>
                        <input
                          className="input w-full"
                          value={row.ipv4 ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ipv4: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">IPv6</label>
                        <input
                          className="input w-full"
                          value={row.ipv6 ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ipv6: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">MAC</label>
                        <input
                          className="input w-full"
                          value={row.macadd ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, macadd: e.target.value } : r)))}
                        />
                      </div>
                      <div>
                        <label className="text-xs">Nombre equipo</label>
                        <input
                          className="input w-full"
                          value={row.nombre_maquina ?? ''}
                          onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, nombre_maquina: e.target.value } : r)))}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <label className="text-xs">Foto/Archivo</label>
                        <FileUploader onFile={(f) => onFile(idx, f)} preview={row.previewUrl || undefined} accept="image/*" capture />
                        {row.previewUrl ? (
                          <div className="text-[10px] text-zinc-500 mt-1">* Se comprime a JPG B/N al subir (1600×1200 @ 0.7).</div>
                        ) : null}
                      </div>
                    </>
                  )}

                  <div className="lg:col-span-6 flex justify-between">
                    <button className="px-2 py-1 rounded-lg border text-xs" onClick={() => removeRow(idx)}>
                      Quitar
                    </button>
                    {isFirma(tipo) && (
                      <button
                        className="px-2 py-1 rounded-lg border text-xs"
                        onClick={() => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, firmaDataUrl: null } : r)))}
                      >
                        Limpiar firma
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button className="self-start px-3 py-2 rounded-xl border text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800" onClick={addRow}>
              + Agregar evidencia
            </button>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2 bg-white dark:bg-zinc-900">
          <button className="px-3 py-2 rounded-xl border" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
          <button
            className="px-3 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300"
            onClick={saveAll}
            disabled={busy}
          >
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
