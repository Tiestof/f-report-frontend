/**
 * ============================================================
 * Archivo: src/components/modals/GastosModal.tsx
 * Componente: GastosModal (v3)
 * Propósito:
 *  - UX alineada a Evidencias con mejoras móvil:
 *    • Sheet full-screen, header pegado y scroll interno.
 *    • Botones grandes: "Tomar foto" (cámara, color) / "Elegir archivo" (galería/archivos).
 *    • Si la imagen proviene de archivo → convertir a JPG en blanco y negro.
 *    • Si proviene de cámara → convertir a JPG manteniendo COLOR (para compatibilidad HEIC).
 *  - Límite tamaño: 12 MB original; target ~2 MB.
 *  - Subida preferente: POST /api/gastos/upload (campo "file") con barra de progreso.
 *  - Listado de gastos siempre ABAJO del formulario.
 *  - Al terminar: toast, refetch, onSaved(), y cierre del modal.
 * ============================================================
 */

import type { FC, MouseEvent } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getTiposGasto } from '../../services/catalogosService';
import {
  listarGastosPorReporte,
  eliminarGasto,
  createGasto,
  uploadGasto,
} from '../../services/gastosService';

import {
  isImageFile,
  grayscaleCompressToJpegBlob,
  colorCompressToJpegBlob,
} from '../../utils/imageTools';
import { resolveMediaUrl, isImageUrl } from '../../utils/urlResolver';

type Props = { idReporte: number; onClose: () => void; onSaved?: () => void };

type TipoGasto = { id_tipo_gasto: number; descripcion: string };

type GastoListado = {
  id_gasto: number;
  id_reporte: number;
  id_tipo_gasto: number | null;
  monto: number | null;
  comentario?: string | null;
  fecha_gasto?: string | null;
  imagen_url?: string | null;
  tipo_gasto?: string | null;
};

type FormValues = {
  id_tipo_gasto: number | '';
  monto: number | '';
  fecha_gasto: string;
  comentario?: string;
  archivo: FileList; // manejado por setValue desde inputs ocultos
};

const GastosModal: FC<Props> = ({ idReporte, onClose, onSaved }) => {
  const qc = useQueryClient();

  // Catálogo
  const tiposQ = useQuery<TipoGasto[]>({
    queryKey: ['tipos-gasto'],
    queryFn: getTiposGasto,
    staleTime: 10 * 60_000,
  });

  // Gastos por reporte
  const gastosQ = useQuery<GastoListado[]>({
    queryKey: ['gastos', idReporte],
    queryFn: () => listarGastosPorReporte(idReporte),
    enabled: !!idReporte,
    staleTime: 5 * 60_000,
  });

  // Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      id_tipo_gasto: '',
      monto: '',
      fecha_gasto: new Date().toISOString().slice(0, 10),
      comentario: '',
      archivo: new DataTransfer().files,
    },
  });

  // Inputs ocultos + origen del archivo
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sourceType, setSourceType] = useState<'camera' | 'file' | null>(null);

  const acceptFile = 'image/*,.pdf';
  const acceptCamera = 'image/*';

  // Barra de progreso
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Eliminar gasto
  const mDelete = useMutation({
    mutationFn: (id: number) => eliminarGasto(id),
    onSuccess: async () => {
      toast.success('Gasto eliminado');
      await qc.invalidateQueries({ queryKey: ['gastos', idReporte] });
    },
    onError: () => toast.error('No se pudo eliminar el gasto'),
  });

  // Handlers inputs ocultos
  const handleCameraSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSourceType('camera');
    // setValue en RHF (nota: FileList puede asignarse como any)
    setValue('archivo', files as unknown as FileList, { shouldValidate: true });
    toast.info('Foto seleccionada (color).');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSourceType('file');
    setValue('archivo', files as unknown as FileList, { shouldValidate: true });
    toast.info('Archivo seleccionado.');
  };

  // Submit
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (!v.id_tipo_gasto) return toast.error('Selecciona un tipo de gasto');
      if (!v.monto) return toast.error('Ingresa el monto del gasto');
      if (!v.fecha_gasto) return toast.error('Selecciona la fecha del gasto');

      const files = v.archivo;
      const maybeFile = files?.item(0) ?? null;

      // Sin archivo → crear directo
      if (!maybeFile) {
        await createGasto({
          id_reporte: idReporte,
          id_tipo_gasto: Number(v.id_tipo_gasto),
          monto: Number(v.monto),
          fecha_gasto: v.fecha_gasto,
          comentario: v.comentario?.trim() || '',
          imagen_url: '',
        });
        toast.success('Gasto guardado');
        await qc.invalidateQueries({ queryKey: ['gastos', idReporte] });
        onSaved?.();
        onClose();
        return;
      }

      // Validación tamaño original
      const rawSizeMB = maybeFile.size / (1024 * 1024);
      if (rawSizeMB > 12) {
        toast.error('Archivo demasiado grande (máx. 12 MB).');
        return;
      }

      // Preparar archivo final según fuente y tipo
      let fileToSend: File = maybeFile;

      if (isImageFile(maybeFile)) {
        if (sourceType === 'camera') {
          // Cámara: convertir a JPG color (evitamos HEIC y mantenemos color)
          const colorBlob = await colorCompressToJpegBlob(maybeFile, {
            maxW: 1600,
            maxH: 1200,
            qualityStart: 0.85,
            qualityMin: 0.6,
            targetMaxBytes: 2 * 1024 * 1024,
          });
          fileToSend = new File([colorBlob], 'gasto_camera.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
        } else {
          // Archivo: JPG en blanco y negro
          const grayBlob = await grayscaleCompressToJpegBlob(maybeFile, {
            maxW: 1600,
            maxH: 1200,
            qualityStart: 0.8,
            qualityMin: 0.5,
            targetMaxBytes: 2 * 1024 * 1024,
          });
          fileToSend = new File([grayBlob], 'gasto_gris.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
        }
      }
      // Si es PDF → se sube tal cual

      // Subida con progreso
      setUploading(true);
      setProgress(5);

      const res = await uploadGasto(
        {
          id_reporte: idReporte,
          id_tipo_gasto: Number(v.id_tipo_gasto),
          monto: Number(v.monto),
          fecha_gasto: v.fecha_gasto,
          comentario: v.comentario?.trim() || '',
          file: fileToSend,
        },
        (p) => setProgress(p)
      );

      if (res?.ok) {
        toast.success('Gasto guardado');
      } else {
        // Fallback si no existe /upload (ex.: 404/405)
        if (isImageFile(fileToSend)) {
          const reader = new FileReader();
          const dataURL: string = await new Promise((resolve, reject) => {
            reader.onerror = reject;
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(fileToSend);
          });
          await createGasto({
            id_reporte: idReporte,
            id_tipo_gasto: Number(v.id_tipo_gasto),
            monto: Number(v.monto),
            fecha_gasto: v.fecha_gasto,
            comentario: v.comentario?.trim() || '',
            imagen_url: dataURL,
          });
          toast.success('Gasto guardado (sin /upload)');
        } else {
          toast.error('El backend no soporta /api/gastos/upload para PDF. Ajusta la API o sube una imagen.');
          setUploading(false);
          return;
        }
      }

      // Reset + refetch + cerrar
      await qc.invalidateQueries({ queryKey: ['gastos', idReporte] });
      reset({
        id_tipo_gasto: '',
        monto: '',
        fecha_gasto: new Date().toISOString().slice(0, 10),
        comentario: '',
        archivo: new DataTransfer().files,
      });
      setSourceType(null);
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('[GastosModal] submit error', err);
      toast.error(err?.message ?? 'No fue posible guardar el gasto.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  });

  // UX modal-fullscreen móvil
  function stopClose(e: MouseEvent<HTMLDivElement>) { e.stopPropagation(); }

  // Opciones tipos
  const tiposOptions = useMemo(
    () => (tiposQ.data ?? []).map((t) => ({ value: t.id_tipo_gasto, label: t.descripcion })),
    [tiposQ.data]
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        onClick={stopClose}
        className="
          w-full md:max-w-4xl bg-white dark:bg-slate-900 shadow-xl
          rounded-t-2xl md:rounded-2xl
          h-[96vh] md:h-auto md:max-h-[92vh]
          overflow-y-auto
          p-4 md:p-5
        "
      >
        {/* Header */}
        <div className="mb-3 md:mb-4 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10 py-1">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">
            Gastos del Reporte #{idReporte}
          </h2>
          <div className="flex items-center gap-2">
            <a href="#gastos-existentes" className="text-xs text-blue-600 hover:underline">Ver gastos existentes</a>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Cerrar modal"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Tipo de gasto <span className="text-red-500">*</span>
            </label>
            <select
              {...register('id_tipo_gasto', { required: true, valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">— Seleccionar —</option>
              {tiposOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.id_tipo_gasto && <p className="mt-1 text-xs text-red-600">Selecciona un tipo de gasto.</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Monto <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={0}
              step="1"
              {...register('monto', { required: true, valueAsNumber: true })}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.monto && <p className="mt-1 text-xs text-red-600">Ingresa el monto.</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Fecha <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('fecha_gasto', { required: true })}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.fecha_gasto && <p className="mt-1 text-xs text-red-600">Selecciona la fecha.</p>}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Comentario (opcional)
            </label>
            <input
              type="text"
              {...register('comentario')}
              className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800"
              placeholder="Detalle breve del gasto…"
            />
          </div>

          {/* Acciones de carga (móvil-friendly) */}
          <div className="space-y-2">
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Comprobante / Foto (opcional)
            </label>

            {/* Botones visibles */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                📷 Tomar foto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                🗂️ Elegir archivo
              </button>
            </div>

            {/* Inputs ocultos */}
            <input
              ref={cameraInputRef}
              type="file"
              accept={acceptCamera}
              onChange={handleCameraSelect}
              // @ts-ignore: atributo válido en HTML, no tipado en React
              capture="environment"
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptFile}
              onChange={handleFileSelect}
              className="hidden"
            />

            <p className="mt-1 text-xs text-slate-500">
              Si tomas foto: se guarda en <b>color</b>. Si eliges imagen de archivos: se convertirá a <b>blanco y negro</b>. PDF se sube tal cual.
            </p>
          </div>

          {/* Barra de progreso */}
          {uploading && (
            <div className="md:col-span-3">
              <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-2 bg-emerald-600 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Subiendo… {Math.floor(progress)}%</p>
            </div>
          )}

          <div className="md:col-span-3 mt-1 md:mt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                reset({
                  id_tipo_gasto: '',
                  monto: '',
                  fecha_gasto: new Date().toISOString().slice(0, 10),
                  comentario: '',
                  archivo: new DataTransfer().files,
                });
                setSourceType(null);
              }}
              disabled={uploading}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Guardar gasto
            </button>
          </div>
        </form>

        <hr className="my-3 md:my-4 border-slate-200 dark:border-slate-800" />

        {/* Listado SIEMPRE abajo */}
        <section id="gastos-existentes">
          <h3 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">Gastos existentes</h3>

          {gastosQ.isLoading && <p className="text-sm text-slate-500">Cargando gastos…</p>}
          {gastosQ.isError && (
            <div className="text-sm text-red-600">
              Error al obtener gastos. <button className="underline" onClick={() => gastosQ.refetch()}>Reintentar</button>
            </div>
          )}
          {!gastosQ.isLoading && !gastosQ.isError && !(gastosQ.data?.length) && (
            <p className="text-sm text-slate-500">No hay gastos registrados para este reporte.</p>
          )}

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {gastosQ.data?.map((g) => {
              const url = resolveMediaUrl(g.imagen_url || '');
              const showImg = isImageUrl(url);
              return (
                <li key={g.id_gasto} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        #{g.id_gasto} • {g.tipo_gasto ?? 'Tipo'} • ${g.monto ?? '-'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {g.fecha_gasto ? new Date(g.fecha_gasto).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <button
                      title="Eliminar gasto"
                      onClick={async () => {
                        const ok = confirm(`¿Eliminar gasto #${g.id_gasto}?`);
                        if (!ok) return;
                        await mDelete.mutateAsync(g.id_gasto);
                      }}
                      className="rounded-full bg-red-600 p-2 text-white hover:bg-red-700"
                      aria-label="Eliminar gasto"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2m1 6v8h2V9h-2m-4 0v8h2V9H7m8 0v8h2V9h-2Z"/></svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {showImg && (
                      <img
                        src={url}
                        alt={`Gasto ${g.id_gasto}`}
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

                    {g.comentario ? (
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        <b>Comentario:</b> {g.comentario}
                      </div>
                    ) : null}
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

export default GastosModal;
