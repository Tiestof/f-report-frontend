/**
 * ============================================================
 * Archivo: src/components/modals/EvidenciasModal.tsx
 * (…encabezado idéntico…)
 * ============================================================
 */

import type { FC, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getEvidenciasByReporte, uploadEvidencia, deleteEvidencia } from '../../services/evidenciasService';
import { getTiposEvidencia as getTiposEvidenciaCatalogo } from '../../services/catalogosService';
import type { EvidenciaListadoItem } from '../../types/evidencias';
import { resolveMediaUrl, isImageUrl } from '../../utils/urlResolver';

import SignaturePad, { type SignaturePadHandle } from '../ui/SignaturePad';

type Props = { onClose: () => void; onSaved?: () => void; idReporte: number };

type FormValues = {
  id_tipo_evidencia: number | '';
  firmante?: string;
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;
  archivo: FileList;
};

const CANVAS_CSS_HEIGHT = 220;

const EvidenciasModal: FC<Props> = ({ onClose, onSaved, idReporte }) => {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  const tiposQ = useQuery({
    queryKey: ['tipoevidencias'],
    queryFn: getTiposEvidenciaCatalogo,
    staleTime: 5 * 60_000,
  });

  const evidQ = useQuery<EvidenciaListadoItem[]>({
    queryKey: ['evidencias', idReporte],
    queryFn: () => getEvidenciasByReporte(idReporte),
    enabled: !!idReporte,
  });

  useEffect(() => {
    if (!tiposQ.isLoading && !evidQ.isLoading) setReady(true);
  }, [tiposQ.isLoading, evidQ.isLoading]);

  const { register, watch, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      id_tipo_evidencia: '',
      firmante: '',
      modelo: '',
      numero_serie: '',
      ipv4: '',
      ipv6: '',
      macadd: '',
      nombre_maquina: '',
      archivo: new DataTransfer().files,
    },
  });

  const idTipo = watch('id_tipo_evidencia');
  const tipoSel = useMemo(
    () => (tiposQ.data ?? []).find((t) => t.id_tipo_evidencia === Number(idTipo)),
    [tiposQ.data, idTipo]
  );
  const descTipo = (tipoSel?.descripcion_tipo_evidencia || '').toLowerCase();
  const esFirma = tipoSel?.id_tipo_evidencia === 3 || descTipo.includes('firma');
  const esImagen = descTipo.includes('imagen') || descTipo.includes('foto');
  const accept = esFirma ? undefined : esImagen ? 'image/*' : '.pdf,image/*';

  const sigRef = useRef<SignaturePadHandle | null>(null);

  async function dataURLToGrayscaleJpegFile(pngDataURL: string, name = 'firma.jpg', quality = 0.92): Promise<File> {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.crossOrigin = 'anonymous';
      im.src = pngDataURL;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const octx = off.getContext('2d')!;
    octx.fillStyle = '#ffffff';
    octx.fillRect(0, 0, w, h);
    octx.drawImage(img, 0, 0);

    const imageData = octx.getImageData(0, 0, w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = y;
    }
    octx.putImageData(imageData, 0, 0);

    const blob: Blob = await new Promise((resolve, reject) => {
      off.toBlob((b) => (b ? resolve(b) : reject(new Error('No Blob JPG'))), 'image/jpeg', quality);
    });
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  }

  const mCreate = useMutation({
    mutationFn: uploadEvidencia,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['evidencias', idReporte] });
      reset({
        id_tipo_evidencia: '',
        firmante: '',
        modelo: '',
        numero_serie: '',
        ipv4: '',
        ipv6: '',
        macadd: '',
        nombre_maquina: '',
        archivo: new DataTransfer().files,
      });
      sigRef.current?.clear();
      onSaved?.();
    },
    onError: (e: any) => {
      console.debug('[EvidenciasModal] upload error', e);
      alert(e?.message ?? 'No fue posible crear la evidencia.');
    },
  });

  const mDelete = useMutation({
    mutationFn: (id: number) => deleteEvidencia(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['evidencias', idReporte] });
    },
  });

  const onSubmit = handleSubmit(async (v) => {
    if (!v.id_tipo_evidencia) { alert('Selecciona un tipo de evidencia.'); return; }

    if (esFirma) {
      const dataUrl = sigRef.current?.toDataURL('image/png');
      if (!dataUrl) { alert('Pad no disponible.'); return; }
      const file = await dataURLToGrayscaleJpegFile(dataUrl, 'firma.jpg', 0.92);
      await mCreate.mutateAsync({
        id_reporte: idReporte,
        id_tipo_evidencia: Number(v.id_tipo_evidencia),
        firmante: v.firmante?.trim() || undefined,
        file,
      });
      return;
    }

    const f = v.archivo?.item(0) ?? null;
    if (!f) { alert('Adjunta un archivo (imagen o PDF).'); return; }

    await mCreate.mutateAsync({
      id_reporte: idReporte,
      id_tipo_evidencia: Number(v.id_tipo_evidencia),
      modelo: v.modelo?.trim() || undefined,
      numero_serie: v.numero_serie?.trim() || undefined,
      ipv4: v.ipv4?.trim() || undefined,
      ipv6: v.ipv6?.trim() || undefined,
      macadd: v.macadd?.trim() || undefined,
      nombre_maquina: v.nombre_maquina?.trim() || undefined,
      file: f,
    });
  });

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2" role="dialog" aria-modal="true" onClick={onClose}>
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-40 w-full rounded bg-slate-200 dark:bg-slate-700" />
          </div>
          <p className="mt-3 text-center text-sm text-slate-500">Cargando evidencias…</p>
        </div>
      </div>
    );
  }

  function stopClose(e: MouseEvent<HTMLDivElement>) { e.stopPropagation(); }

  const tiposOptions = (tiposQ.data ?? []).map((t) => ({ value: t.id_tipo_evidencia, label: t.descripcion_tipo_evidencia }));

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        onClick={stopClose}
        className="
          w-full md:max-w-4xl bg-white dark:bg-slate-900 shadow-xl
          rounded-t-2xl md:rounded-2xl
          h-[90svh] md:h-auto md:max-h-[90dvh]
          max-h-[100dvh]
          overflow-y-auto overscroll-contain
          p-4 md:p-5
        "
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Header */}
        <div className="mb-3 md:mb-4 flex items-center justify-between sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10 py-1">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">
            Evidencias del Reporte #{idReporte}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Cerrar modal"
          >
            Cerrar
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Tipo de Evidencia <span className="text-red-500">*</span>
            </label>
            <select
              {...register('id_tipo_evidencia', { required: true, valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">— Seleccionar —</option>
              {tiposOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
            {errors.id_tipo_evidencia && <p className="mt-1 text-xs text-red-600">Selecciona un tipo de evidencia.</p>}
          </div>

          {/* Firma */}
          {esFirma && (
            <>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre del firmante</label>
                <input
                  type="text"
                  {...register('firmante')}
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Firma digital (dibuje en el recuadro)</label>
                <SignaturePad
                  key={`sig-${idReporte}-${idTipo}`} // fuerza montaje limpio cuando cambia el tipo
                  ref={sigRef}
                  height={CANVAS_CSS_HEIGHT}
                />
                <p className="mt-2 text-xs text-slate-500">Se guardará como JPG (blanco y negro, fondo blanco).</p>
              </div>
            </>
          )}

          {/* Otros tipos */}
          {!esFirma && (
            <>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{esImagen ? 'Imagen' : 'Archivo (PDF o imagen)'}</label>
                <input
                  type="file"
                  accept={accept}
                  {...register('archivo')}
                  className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 p-2 text-sm dark:border-slate-700"
                />
                <p className="mt-1 text-xs text-slate-500">Se guardará como EVI_&lt;reporte&gt;_&lt;tipo&gt;_&lt;fecha&gt;.*</p>
              </div>

              <div className="md:col-span-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div><label className="mb-1 block text-sm font-medium">Modelo</label><input type="text" {...register('modelo')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium">N° Serie</label><input type="text" {...register('numero_serie')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium">IPv4</label><input type="text" {...register('ipv4')} placeholder="192.168.1.10" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium">IPv6</label><input type="text" {...register('ipv6')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium">MAC</label><input type="text" {...register('macadd')} placeholder="AA-BB-CC-DD-EE-FF" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium">Nombre máquina</label><input type="text" {...register('nombre_maquina')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
              </div>
            </>
          )}

          <div className="md:col-span-3 mt-1 md:mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset({
                  id_tipo_evidencia: '',
                  firmante: '',
                  modelo: '',
                  numero_serie: '',
                  ipv4: '',
                  ipv6: '',
                  macadd: '',
                  nombre_maquina: '',
                  archivo: new DataTransfer().files,
                });
                sigRef.current?.clear();
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">
              Guardar evidencia
            </button>
          </div>
        </form>

        {/* Divider */}
        <hr className="my-3 md:my-4 border-slate-200 dark:border-slate-800" />

        {/* Listado de evidencias */}
        <section>
          <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">Evidencias existentes</h3>

          {evidQ.isLoading && <p className="text-sm text-slate-500">Cargando evidencias…</p>}

          {evidQ.isError && (
            <div className="text-sm text-red-600">
              Error al obtener evidencias. <button className="underline" onClick={() => evidQ.refetch()}>Reintentar</button>
            </div>
          )}

          {!evidQ.isLoading && !evidQ.isError && !(evidQ.data?.length) && (
            <p className="text-sm text-slate-500">No hay evidencias registradas para este reporte.</p>
          )}

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {evidQ.data?.map((ev) => {
              const url = resolveMediaUrl(ev.url);
              const showImg = isImageUrl(url);
              return (
                <li key={ev.id_evidencia} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">#{ev.id_evidencia} • {ev.descripcion_tipo_evidencia ?? 'Tipo'}</p>
                      <p className="text-xs text-slate-500">{ev.fecha_subida ? new Date(ev.fecha_subida).toLocaleString() : ''}</p>
                    </div>
                    <button
                      title="Eliminar evidencia"
                      onClick={async () => {
                        const ok = confirm(`¿Eliminar evidencia #${ev.id_evidencia}?`);
                        if (!ok) return;
                        await mDelete.mutateAsync(ev.id_evidencia);
                      }}
                      className="rounded-full bg-red-600 p-2 text-white hover:bg-red-700"
                      aria-label="Eliminar evidencia"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2m1 6v8h2V9h-2m-4 0v8h2V9H7m8 0v8h2V9h-2Z"/></svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {showImg && (
                      <img
                        src={url}
                        alt={`Evidencia ${ev.id_evidencia}`}
                        className="max-h-36 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-800"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget.style.display = 'none');
                          const link = e.currentTarget.nextElementSibling as HTMLAnchorElement | null;
                          if (link) link.style.display = 'inline-flex';
                        }}
                      />
                    )}

                    <a
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      style={{ display: showImg ? 'none' : 'inline-flex' }}
                    >
                      Ver archivo
                      <svg width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M14 3l7 7l-1.41 1.41L15 7.83V20h-2V7.83l-4.59 4.58L7 10z"/></svg>
                    </a>

                    <div className="text-xs text-slate-500">
                      {ev.modelo ? <>Modelo: <b>{ev.modelo}</b> · </> : null}
                      {ev.numero_serie ? <>Serie: <b>{ev.numero_serie}</b> · </> : null}
                      {ev.nombre_maquina ? <>Equipo: <b>{ev.nombre_maquina}</b> · </> : null}
                      {ev.ipv4 ? <>IPv4: <b>{ev.ipv4}</b></> : null}
                      {ev.ipv6 ? <> · IPv6: <b>{ev.ipv6}</b></> : null}
                      {ev.macadd ? <> · MAC: <b>{ev.macadd}</b></> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default EvidenciasModal;
