/**
 * ============================================================
 * Archivo: src/components/modals/GastosModal.tsx
 * Componente: GastosModal
 * Propósito:
 *  - Con archivo: UN paso → POST /gastos/upload con metadatos + file.
 *  - Sin archivo: POST /gastos con JSON simple (como ya funcionaba).
 *  - Formato visual de monto con separadores de miles (sin decimales);
 *    a la API va número limpio.
 *  - Previsualización segura de imagen (sin src vacío).
 *  - Evita tocar api.ts global.
 * ============================================================
 */

import type { FC, MouseEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
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

// ===== Helpers monto (es-CL, sin decimales) =====
const nfCL = new Intl.NumberFormat('es-CL', { style: 'decimal', maximumFractionDigits: 0 });
function formatMiles(n: number | null | undefined): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '';
  return nfCL.format(Math.trunc(n));
}
function parseMoneyToNumber(s: string): number {
  const onlyDigits = (s ?? '').replace(/[^\d]/g, '');
  return onlyDigits ? Number(onlyDigits) : 0;
}

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
  monto: string; // visual con miles
  fecha_gasto: string;
  comentario?: string;
  archivo: FileList;
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
    control,
    reset,
    formState: { errors },
    setValue,
    watch,
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

  const acceptFile = 'image/*,application/pdf';
  const acceptCamera = 'image/*';

  // Previsualización
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && isImageFile(selectedFile)) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  // Progreso
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
    setSelectedFile(files[0]);
    setValue('archivo', files as unknown as FileList, { shouldValidate: true });
    toast.info('Foto seleccionada (color).');
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setSourceType('file');
    setSelectedFile(files[0]);
    setValue('archivo', files as unknown as FileList, { shouldValidate: true });
    toast.info('Archivo seleccionado.');
  };

  // SUBMIT (un paso si hay archivo)
  const onSubmit = handleSubmit(async (v) => {
    try {
      if (!v.id_tipo_gasto) return toast.error('Selecciona un tipo de gasto');
      const montoNumber = parseMoneyToNumber(v.monto);
      if (!montoNumber || montoNumber < 0) return toast.error('Ingresa un monto válido');
      if (!v.fecha_gasto) return toast.error('Selecciona la fecha del gasto');

      const maybeFile = v.archivo?.item(0) ?? null;

      // Sin archivo → JSON directo
      if (!maybeFile) {
        await createGasto({
          id_reporte: idReporte,
          id_tipo_gasto: Number(v.id_tipo_gasto),
          monto: montoNumber,
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

      // Con archivo → compresión (si es imagen) y upload con metadatos
      const rawSizeMB = maybeFile.size / (1024 * 1024);
      if (rawSizeMB > 12) return toast.error('Archivo demasiado grande (máx. 12 MB).');

      let fileToSend: File = maybeFile;
      if (isImageFile(maybeFile)) {
        if (sourceType === 'camera') {
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

      setUploading(true);
      setProgress(5);

      const res = await uploadGasto(
        {
          id_reporte: idReporte,
          id_tipo_gasto: Number(v.id_tipo_gasto),
          monto: montoNumber,
          fecha_gasto: v.fecha_gasto,
          comentario: v.comentario?.trim() || '',
          file: fileToSend,
        },
        (p) => setProgress(p)
      );

      if (!res.ok) {
        // Fallback: si no existe /upload, permitimos imagen base64 via createGasto
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
            monto: montoNumber,
            fecha_gasto: v.fecha_gasto,
            comentario: v.comentario?.trim() || '',
            imagen_url: dataURL,
          });
          toast.success('Gasto guardado (sin /upload)');
        } else {
          toast.error('El backend no soporta /gastos/upload para PDF. Sube una imagen o ajusta la API.');
          setUploading(false);
          return;
        }
      } else {
        toast.success('Gasto guardado');
      }

      await qc.invalidateQueries({ queryKey: ['gastos', idReporte] });
      reset({
        id_tipo_gasto: '',
        monto: '',
        fecha_gasto: new Date().toISOString().slice(0, 10),
        comentario: '',
        archivo: new DataTransfer().files,
      });
      setSelectedFile(null);
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

  function stopClose(e: MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  const tiposOptions = useMemo(
    () => (tiposQ.data ?? []).map((t) => ({ value: t.id_tipo_gasto, label: t.descripcion })),
    [tiposQ.data]
  );

  const watchedFiles = watch('archivo');
  const currentFile = watchedFiles?.item(0) ?? selectedFile;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={() => (uploading ? null : onClose())}
    >
      <div
        onClick={stopClose}
        className="w-full md:max-w-4xl bg-white dark:bg-slate-900 shadow-xl rounded-t-2xl md:rounded-2xl h-[96vh] md:h-auto md:max-h-[92vh] overflow-y-auto p-4 md:p-5"
      >
        {/* Header */}
        <div className="mb-3 md:mb-4 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur z-10 py-1">
          <h2 className="text-lg md:text-xl font-semibold">
            Gastos del Reporte #{idReporte}
          </h2>
          <div className="flex items-center gap-2">
            <a href="#gastos-existentes" className="text-xs text-blue-600 hover:underline">
              Ver gastos existentes
            </a>
            <button
              onClick={onClose}
              className="rounded-lg px-3 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Cerrar modal"
              disabled={uploading}
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tipo de gasto *</label>
            <select
              {...register('id_tipo_gasto', { required: true, valueAsNumber: true })}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="">— Seleccionar —</option>
              {tiposOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {errors.id_tipo_gasto && (
              <p className="mt-1 text-xs text-red-600">Selecciona un tipo de gasto.</p>
            )}
          </div>

          {/* Monto visual con separadores */}
          <div>
            <label className="mb-1 block text-sm font-medium">Monto *</label>
            <Controller
              control={control}
              name="monto"
              rules={{
                required: 'Monto requerido',
                validate: (v) => parseMoneyToNumber(v) > 0 || 'Monto inválido',
              }}
              render={({ field, fieldState }) => (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
                    value={field.value}
                    onChange={(e) => {
                      const num = parseMoneyToNumber(e.target.value);
                      field.onChange(num ? formatMiles(num) : '');
                    }}
                    onBlur={(e) => {
                      const num = parseMoneyToNumber(e.target.value);
                      field.onChange(num ? formatMiles(num) : '');
                    }}
                    placeholder="0"
                    aria-invalid={!!fieldState.error}
                  />
                  {fieldState.error ? (
                    <p className="mt-1 text-xs text-red-600">{fieldState.error.message}</p>
                  ) : null}
                </>
              )}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fecha *</label>
            <input
              type="date"
              {...register('fecha_gasto', { required: true })}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
            />
            {errors.fecha_gasto && (
              <p className="mt-1 text-xs text-red-600">Selecciona la fecha.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Comentario (opcional)</label>
            <input
              type="text"
              {...register('comentario')}
              className="w-full rounded-lg border px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
              placeholder="Detalle breve del gasto…"
            />
          </div>

          {/* Carga de archivo */}
          <div className="space-y-2">
            <label className="mb-1 block text-sm font-medium">Comprobante / Foto</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Tomar foto
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Elegir archivo
              </button>
            </div>

            {/* Inputs ocultos */}
            <input
              ref={cameraInputRef}
              type="file"
              accept={acceptCamera}
              onChange={handleCameraSelect}
              // @ts-ignore
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

            {/* Previsualización segura */}
            {currentFile ? (
              <div className="rounded-lg border p-3 text-sm dark:border-slate-700">
                <div className="mb-2 font-medium">Archivo a subir</div>
                {isImageFile(currentFile) && previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Previsualización"
                    className="max-h-40 w-full rounded-md object-contain"
                  />
                ) : !isImageFile(currentFile) ? (
                  <div className="flex items-center justify-between">
                    <span className="truncate">{currentFile.name}</span>
                    <span className="text-xs text-slate-500">PDF</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Progreso */}
          {uploading && (
            <div className="md:col-span-3">
              <div className="h-2 w-full rounded bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-2 bg-blue-600 transition-all"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                Subiendo… {Math.floor(progress)}%
              </p>
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
                setSelectedFile(null);
                setSourceType(null);
              }}
              disabled={uploading}
              className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
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

        {/* Listado */}
        <section id="gastos-existentes">
          <h3 className="mb-2 text-base font-semibold">Gastos existentes</h3>

          {gastosQ.isLoading && <p className="text-sm text-slate-500">Cargando gastos…</p>}
          {gastosQ.isError && (
            <div className="text-sm text-red-600">
              Error al obtener gastos.{' '}
              <button className="underline" onClick={() => gastosQ.refetch()}>
                Reintentar
              </button>
            </div>
          )}
          {!gastosQ.isLoading && !gastosQ.isError && !(gastosQ.data?.length) && (
            <p className="text-sm text-slate-500">No hay gastos registrados para este reporte.</p>
          )}

          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {gastosQ.data?.map((g) => {
              const url = resolveMediaUrl(g.imagen_url ?? '');
              const showImg = !!url && isImageUrl(url);
              return (
                <li key={g.id_gasto} className="rounded-xl border p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        #{g.id_gasto} • {g.tipo_gasto ?? 'Tipo'} •{' '}
                        {typeof g.monto === 'number' ? `$${formatMiles(g.monto)}` : '-'}
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
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="currentColor"
                          d="M9 3h6l1 2h4v2H4V5h4l1-2m1 6v8h2V9h-2m-4 0v8h2V9H7m8 0v8h2V9h-2Z"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {showImg ? (
                      <img
                        src={url}
                        alt={`Gasto ${g.id_gasto}`}
                        className="max-h-36 w-full rounded-lg border object-contain dark:border-slate-800"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget.style.display = 'none');
                          const link =
                            e.currentTarget.nextElementSibling as HTMLAnchorElement | null;
                          if (link) link.style.display = 'inline-flex';
                        }}
                      />
                    ) : null}

                    <a
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      style={{ display: showImg ? 'none' : 'inline-flex' }}
                    >
                      Ver archivo
                      <svg width="16" height="16" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M14 3l7 7l-1.41 1.41L15 7.83V20h-2V7.83l-4.59 4.58L7 10z"
                        />
                      </svg>
                    </a>

                    {g.comentario ? (
                      <div className="text-xs">
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
