/**
 * ============================================================
 * Archivo: src/components/modals/EvidenciasModal.tsx
 * Propósito:
 *   - Cargar Tipos (activados) desde catalogosService.
 *   - Listar evidencias existentes (GET /evidencias/reporte/:id).
 *   - Subir evidencias (POST /evidencias/upload):
 *       • Firma Digital: pad → JPG B/N fondo blanco + firmante.
 *       • Otros: archivo + metadatos (modelo, serie, ip, mac, equipo).
 *   - Agregar múltiples evidencias sin cerrar el modal.
 *   - Miniaturas para imágenes (resolviendo /uploads/... en dev/prod).
 *   - Botón eliminar (papelera roja) con confirmación.
 * ============================================================
 */

import type { FC, MouseEvent } from 'react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getEvidenciasByReporte, uploadEvidencia, deleteEvidencia } from '../../services/evidenciasService';
import { getTiposEvidencia as getTiposEvidenciaCatalogo } from '../../services/catalogosService';
import type { EvidenciaListadoItem, EvidenciaCreateUploadInput } from '../../types/evidencias';
import { resolveMediaUrl, isImageUrl } from '../../utils/urlResolver';

type Props = { onClose: () => void; onSaved?: () => void; idReporte: number };

type FormValues = {
  id_tipo_evidencia: number | '';
  // Firma digital:
  firmante?: string;
  // Metadatos (otros tipos):
  modelo?: string;
  numero_serie?: string;
  ipv4?: string;
  ipv6?: string;
  macadd?: string;
  nombre_maquina?: string;
  // Archivos:
  archivo: FileList;
};

const EvidenciasModal: FC<Props> = ({ onClose, onSaved, idReporte }) => {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);

  // 1) Catálogo (solo activados)
  const tiposQ = useQuery({
    queryKey: ['tipoevidencias'],
    queryFn: getTiposEvidenciaCatalogo,
    staleTime: 5 * 60_000,
  });

  // 2) Evidencias del reporte
  const evidQ = useQuery<EvidenciaListadoItem[]>({
    queryKey: ['evidencias', idReporte],
    queryFn: () => getEvidenciasByReporte(idReporte),
    enabled: !!idReporte,
  });

  useEffect(() => {
    if (!tiposQ.isLoading && !evidQ.isLoading) setReady(true);
  }, [tiposQ.isLoading, evidQ.isLoading]);

  // 3) Form
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

  // Tipo seleccionado
  const tipoSel = useMemo(
    () => (tiposQ.data ?? []).find((t) => t.id_tipo_evidencia === Number(idTipo)),
    [tiposQ.data, idTipo]
  );
  const descTipo = (tipoSel?.descripcion_tipo_evidencia || '').toLowerCase();
  const esFirma = tipoSel?.id_tipo_evidencia === 3 || descTipo.includes('firma');
  const esImagen = descTipo.includes('imagen') || descTipo.includes('foto');
  const accept = esFirma ? undefined : esImagen ? 'image/*' : '.pdf,image/*';

  // 4) Firma: canvas con fondo blanco + B/N → JPG
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    function resizeCanvas() {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const cssW = c.clientWidth || 600;
      const cssH = 220;
      c.width = Math.floor(cssW * dpr);
      c.height = Math.floor(cssH * dpr);
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cssW, cssH);
      }
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
    drawingRef.current = true;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) {
      const r = c.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
    }
  }
  function endDraw() { drawingRef.current = false; canvasRef.current?.getContext('2d')?.beginPath(); }
  function draw(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const c = canvasRef.current, ctx = c?.getContext('2d'); if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
    ctx.lineTo(x, y); ctx.stroke();
  }
  // táctil
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ts = (ev: TouchEvent) => {
      drawingRef.current = true;
      const t = ev.touches[0], r = c.getBoundingClientRect();
      c.getContext('2d')?.moveTo(t.clientX - r.left, t.clientY - r.top);
    };
    const tm = (ev: TouchEvent) => {
      if (!drawingRef.current) return;
      const t = ev.touches[0], r = c.getBoundingClientRect();
      const ctx = c.getContext('2d');
      if (ctx) { ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000';
        ctx.lineTo(t.clientX - r.left, t.clientY - r.top); ctx.stroke(); }
    };
    const te = () => { drawingRef.current = false; c.getContext('2d')?.beginPath(); };
    c.addEventListener('touchstart', ts, { passive: true });
    c.addEventListener('touchmove', tm, { passive: true });
    c.addEventListener('touchend', te);
    return () => { c.removeEventListener('touchstart', ts); c.removeEventListener('touchmove', tm); c.removeEventListener('touchend', te); };
  }, []);

  function clearCanvas() {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const cssW = c.clientWidth || 600, cssH = 220;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cssW, cssH);
  }

  function canvasToGrayscaleJpegFile(source: HTMLCanvasElement, filename = 'firma.jpg', quality = 0.92): Promise<File> {
    const w = source.width, h = source.height;
    const off = document.createElement('canvas'); off.width = w; off.height = h;
    const octx = off.getContext('2d'); if (!octx) return Promise.reject(new Error('ctx'));
    octx.fillStyle = '#ffffff'; octx.fillRect(0, 0, w, h);
    octx.drawImage(source, 0, 0);
    const img = octx.getImageData(0, 0, w, h); const d = img.data;
    for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; }
    octx.putImageData(img, 0, 0);
    return new Promise<File>((resolve, reject) => {
      off.toBlob((blob) => {
        if (blob) resolve(new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() }));
        else {
          try {
            const dataURL = off.toDataURL('image/jpeg', quality);
            const arr = dataURL.split(','); const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(arr[1]); const u8 = new Uint8Array(bstr.length);
            for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
            resolve(new File([u8], filename, { type: mime }));
          } catch (e) { reject(new Error('No Blob JPG')); }
        }
      }, 'image/jpeg', quality);
    });
  }

  // 5) Mutations
  const mCreate = useMutation({
    mutationFn: async (payload: EvidenciaCreateUploadInput) => uploadEvidencia(payload),
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
      clearCanvas();
      onSaved?.(); // (opcional) refrescar contador en la tabla padre
    },
    onError: (e: any) => {
      console.debug('[EvidenciasModal] upload error', e);
      alert(e?.message ?? 'No fue posible crear la evidencia.');
    },
  });

  const mDelete = useMutation({
    mutationFn: async (id: number) => deleteEvidencia(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['evidencias', idReporte] });
    },
  });

  // 6) Submit
  const onSubmit = handleSubmit(async (v) => {
    if (!v.id_tipo_evidencia) { alert('Selecciona un tipo de evidencia.'); return; }

    if (esFirma) {
      const c = canvasRef.current; if (!c) { alert('Canvas no disponible'); return; }
      const file = await canvasToGrayscaleJpegFile(c, 'firma.jpg', 0.92);
      await mCreate.mutateAsync({
        id_reporte: idReporte,
        id_tipo_evidencia: Number(v.id_tipo_evidencia),
        firmante: (v.firmante || '').trim() || undefined,
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

  // 7) Loading inicial
  if (!ready) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 md:p-4" role="dialog" aria-modal="true" onClick={onClose}>
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

  // 8) Render
  function stopClose(e: MouseEvent<HTMLDivElement>) { e.stopPropagation(); }

  const tiposOptions = (tiposQ.data ?? []).map((t) => ({ value: t.id_tipo_evidencia, label: t.descripcion_tipo_evidencia }));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-2 md:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl bg-white p-3 md:p-4 shadow-xl dark:bg-slate-900" onClick={stopClose}>
        {/* Header */}
        <div className="mb-3 md:mb-4 flex items-center justify-between">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 dark:text-slate-100">Evidencias del Reporte #{idReporte}</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Cerrar modal">Cerrar</button>
        </div>

        {/* Formulario */}
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Formulario de evidencia">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Tipo de Evidencia <span className="text-red-500">*</span>
            </label>
            <select {...register('id_tipo_evidencia', { required: true, valueAsNumber: true })} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800">
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
                <input type="text" {...register('firmante')} placeholder="Ej: Juan Pérez" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" />
              </div>

              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Firma (dibuje en el recuadro)</label>
                <div className="rounded-xl border border-slate-300 p-2 dark:border-slate-700">
                  <canvas ref={canvasRef} className="h-[220px] w-full touch-none rounded-md bg-white dark:bg-slate-800"
                          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={clearCanvas} className="rounded-lg bg-slate-100 px-3 py-1 text-sm hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700">Limpiar</button>
                    <span className="text-xs text-slate-500">Se guardará como JPG (blanco y negro, fondo blanco).</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Otros tipos */}
          {!esFirma && (
            <>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{esImagen ? 'Imagen' : 'Archivo (PDF o imagen)'}</label>
                <input type="file" accept={accept} {...register('archivo')} className="block w-full cursor-pointer rounded-lg border border-dashed border-slate-300 p-2 text-sm dark:border-slate-700" />
                <p className="mt-1 text-xs text-slate-500">Se guardará como EVI_&lt;reporte&gt;_&lt;tipo&gt;_&lt;fecha&gt;.*</p>
              </div>

              <div className="md:col-span-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Modelo</label><input type="text" {...register('modelo')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">N° Serie</label><input type="text" {...register('numero_serie')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">IPv4</label><input type="text" {...register('ipv4')} placeholder="192.168.1.10" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">IPv6</label><input type="text" {...register('ipv6')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">MAC</label><input type="text" {...register('macadd')} placeholder="AA-BB-CC-DD-EE-FF" className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
                <div><label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre máquina</label><input type="text" {...register('nombre_maquina')} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm outline-none focus:ring-2 dark:border-slate-700 dark:bg-slate-800" /></div>
              </div>
            </>
          )}

          <div className="md:col-span-3 mt-1 md:mt-2 flex items-center justify-end gap-2">
            <button type="button" onClick={() => {
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
              }); clearCanvas();
            }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800">
              Limpiar
            </button>
            <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700">Guardar evidencia</button>
          </div>
        </form>

        <hr className="my-3 md:my-4 border-slate-200 dark:border-slate-800" />

        {/* Listado */}
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
              const isImg = isImageUrl(url);
              return (
                <li key={ev.id_evidencia} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">#{ev.id_evidencia} • {ev.descripcion_tipo_evidencia ?? 'Tipo'}</p>
                      <p className="text-xs text-slate-500">{ev.fecha_subida ? new Date(ev.fecha_subida).toLocaleString() : ''}</p>
                    </div>
                    {/* Botón eliminar */}
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
                      {/* icono papelera */}
                      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2m1 6v8h2V9h-2m-4 0v8h2V9H7m8 0v8h2V9h-2Z"/></svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {isImg ? (
                      <img
                        src={url}
                        alt={`Evidencia ${ev.id_evidencia}`}
                        className="max-h-36 w-full rounded-lg border border-slate-200 object-contain dark:border-slate-800"
                        loading="lazy"
                        onError={(e) => {
                          // fallback a enlace si la miniatura falla
                          (e.currentTarget.style.display = 'none');
                          const link = e.currentTarget.nextElementSibling as HTMLAnchorElement | null;
                          if (link) link.style.display = 'inline-flex';
                        }}
                      />
                    ) : null}
                    <a
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      style={{ display: isImg ? 'none' : 'inline-flex' }}
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
