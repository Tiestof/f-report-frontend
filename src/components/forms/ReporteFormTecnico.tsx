/**
 * ============================================================================
 * Archivo: src/components/forms/ReporteFormTecnico.tsx
 * Propósito: Formulario de creación/edición de Reporte para TÉCNICO.
 * Notas:
 *  - Usa zod + zodResolver (sin genéricos explícitos) para evitar errores TS.
 *  - En edición, la única validación obligatoria adicional es 'hora_fin'.
 *  - Dirección/cliente se muestran solo lectura en edición (regla negocio).
 *  - Integra catálogos via React Query y confirma en modal antes de guardar.
 * ============================================================================
 */

import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form'; // <- type-only (soluciona TS1484)
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  getClientesMap,
  getEstadosServicio,
  getTiposHardware,
  getTiposServicio,
  getSO,
} from '../../services/catalogosService';
import { crearReporte, actualizarReporte } from '../../services/reportesService';
import ConfirmSaveModal from '../modals/ConfirmSaveModal';
import useAuthStore from '../../store/authStore';

type Props = {
  mode: 'create' | 'edit';
  /** Si es edición, id del reporte a persistir */
  id_reporte?: number;
  /** Valores iniciales si es edición */
  initialValues?: Partial<FormValues>;
  /** Callback tras guardado exitoso */
  onSaved?: () => void;
};

/** Esquema base (coincide con el shape que manejamos en el form) */
const schemaBase = z.object({
  fecha_reporte: z.string().min(1, 'Fecha requerida'),
  comentario: z.string().optional(),
  hora_inicio: z.string().optional(),
  hora_fin: z.string().optional(),
  direccion: z.string().optional(),
  numero: z.string().optional(),
  rut_cliente: z.string().optional(),
  id_estado_servicio: z.number().optional(),
  id_tipo_servicio: z.number().optional(),
  id_tipo_hardware: z.number().optional(),
  id_sistema_operativo: z.number().optional(),
  sector: z.string().optional().nullable(),
  edificio: z.string().optional().nullable(),
  piso: z.string().optional().nullable(),
  latitud: z.number().optional().nullable(),
  longitud: z.number().optional().nullable(),
});

/** En edición se exige hora_fin */
const schemaEdit = schemaBase.extend({
  hora_fin: z.string().min(1, 'Hora de término requerida en edición'),
});

export type FormValues = z.infer<typeof schemaBase>;

const ReporteFormTecnico: React.FC<Props> = ({ mode, id_reporte, initialValues, onSaved }) => {
  // RUT actual desde el store (selector permisivo para evitar TS2339)
  const rutActual: string = useAuthStore((s: any) => s?.user?.rut ?? s?.rut ?? s?.profile?.rut ?? '');

  // Catálogos con React Query (tipados para evitar "unknown")
  const { data: estados = [] } = useQuery<{ id_estado_servicio: number; descripcion: string }[]>({
    queryKey: ['estados-servicio'],
    queryFn: getEstadosServicio,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tiposServ = [] } = useQuery<{ id_tipo_servicio: number; descripcion: string }[]>({
    queryKey: ['tipos-servicio'],
    queryFn: getTiposServicio,
    staleTime: 5 * 60 * 1000,
  });

  const { data: tiposHw = [] } = useQuery<{ id_tipo_hardware: number; descripcion: string }[]>({
    queryKey: ['tipos-hardware'],
    queryFn: getTiposHardware,
    staleTime: 5 * 60 * 1000,
  });

  const { data: soList = [] } = useQuery<{ id_sistema_operativo: number; descripcion: string }[]>({
    queryKey: ['sistema-operativo'],
    queryFn: getSO,
    staleTime: 5 * 60 * 1000,
  });

  const { data: clientesMap = {} } = useQuery<Record<string, string>>({
    queryKey: ['clientes-map'],
    queryFn: getClientesMap,
    staleTime: 5 * 60 * 1000,
  });

  // Elegimos el esquema según modo
  const schema = useMemo(() => (mode === 'edit' ? schemaEdit : schemaBase), [mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fecha_reporte: new Date().toISOString().slice(0, 10),
      comentario: '',
      hora_inicio: '',
      hora_fin: '',
      direccion: '',
      numero: '',
      rut_cliente: '',
      id_estado_servicio: undefined,
      id_tipo_servicio: undefined,
      id_tipo_hardware: undefined,
      id_sistema_operativo: undefined,
      sector: '',
      edificio: '',
      piso: '',
      latitud: undefined,
      longitud: undefined,
      ...initialValues,
    },
    mode: 'onSubmit',
  });

  const [confirmOpen, setConfirmOpen] = useState(false);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    // Reglas negocio: si crea, rut_usuario == rut_responsable == rut actual
    const payload = {
      ...values,
      rut_usuario: rutActual,
      rut_responsable: rutActual,
    };

    if (mode === 'create') {
      await crearReporte(payload as any);
    } else if (mode === 'edit' && id_reporte) {
      await actualizarReporte(id_reporte, payload as any);
    }
    onSaved?.();
  };

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-xl font-semibold">
          {mode === 'create' ? 'Nuevo Reporte (Técnico)' : 'Editar Reporte (Técnico)'}
        </h2>
        <p className="text-sm text-gray-500">
          Completa los campos necesarios. En edición, dirección/cliente se muestran solo lectura.
        </p>
      </div>

      {/* FORM */}
      <form
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Abrimos modal de confirmación antes de persistir
          setConfirmOpen(true);
        }}
      >
        {/* Fecha */}
        <div>
          <label className="block text-sm font-medium mb-1">Fecha del reporte</label>
          <input
            type="date"
            className="w-full rounded border px-3 py-2"
            {...form.register('fecha_reporte')}
          />
          {form.formState.errors.fecha_reporte && (
            <p className="text-red-600 text-xs mt-1">
              {form.formState.errors.fecha_reporte.message as string}
            </p>
          )}
        </div>

        {/* Estado servicio */}
        <div>
          <label className="block text-sm font-medium mb-1">Estado del servicio</label>
          <select className="w-full rounded border px-3 py-2" {...form.register('id_estado_servicio')}>
            <option value="">-- Selecciona --</option>
            {estados.map((e) => (
              <option key={e.id_estado_servicio} value={e.id_estado_servicio}>
                {e.descripcion}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo servicio */}
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de servicio</label>
          <select className="w-full rounded border px-3 py-2" {...form.register('id_tipo_servicio')}>
            <option value="">-- Selecciona --</option>
            {tiposServ.map((t) => (
              <option key={t.id_tipo_servicio} value={t.id_tipo_servicio}>
                {t.descripcion}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo hardware */}
        <div>
          <label className="block text-sm font-medium mb-1">Tipo de hardware</label>
          <select className="w-full rounded border px-3 py-2" {...form.register('id_tipo_hardware')}>
            <option value="">-- Selecciona --</option>
            {tiposHw.map((t) => (
              <option key={t.id_tipo_hardware} value={t.id_tipo_hardware}>
                {t.descripcion}
              </option>
            ))}
          </select>
        </div>

        {/* Sistema operativo */}
        <div>
          <label className="block text-sm font-medium mb-1">Sistema operativo</label>
          <select className="w-full rounded border px-3 py-2" {...form.register('id_sistema_operativo')}>
            <option value="">-- Selecciona --</option>
            {soList.map((s) => (
              <option key={s.id_sistema_operativo} value={s.id_sistema_operativo}>
                {s.descripcion}
              </option>
            ))}
          </select>
        </div>

        {/* Cliente (solo lectura en edición) */}
        <div>
          <label className="block text-sm font-medium mb-1">Cliente (RUT)</label>
          <input
            type="text"
            className="w-full rounded border px-3 py-2"
            {...form.register('rut_cliente')}
            readOnly={mode === 'edit'}
            placeholder="11.111.111-1"
          />
          {(() => {
            const rc = form.watch('rut_cliente') ?? ''; // <- asegura índice string (evita TS2538)
            return rc ? (
              <p className="text-xs text-gray-500 mt-1">
                {clientesMap[rc] ?? '—'}
              </p>
            ) : null;
          })()}
        </div>

        {/* Dirección (solo lectura en edición) */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Dirección</label>
          <input
            type="text"
            className="w-full rounded border px-3 py-2"
            {...form.register('direccion')}
            readOnly={mode === 'edit'}
            placeholder="Calle y número"
          />
        </div>

        {/* Hora inicio / fin */}
        <div>
          <label className="block text-sm font-medium mb-1">Hora inicio</label>
          <input type="time" className="w-full rounded border px-3 py-2" {...form.register('hora_inicio')} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hora fin</label>
          <input type="time" className="w-full rounded border px-3 py-2" {...form.register('hora_fin')} />
          {form.formState.errors.hora_fin && (
            <p className="text-red-600 text-xs mt-1">
              {form.formState.errors.hora_fin.message as string}
            </p>
          )}
        </div>

        {/* Comentarios */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Comentarios</label>
          <textarea
            rows={4}
            className="w-full rounded border px-3 py-2"
            {...form.register('comentario')}
            placeholder="Notas, hallazgos, etc."
          />
        </div>

        {/* Acciones */}
        <div className="md:col-span-2 flex gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Guardar
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => form.reset()}
          >
            Limpiar
          </button>
        </div>
      </form>

      {/* Modal Confirmación */}
      <ConfirmSaveModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await form.handleSubmit(onSubmit)();
          setConfirmOpen(false);
        }}
        title="Confirmar guardado"
      >
        {/* Resumen muy simple del formulario */}
        <div className="text-sm space-y-1">
          <p><strong>Fecha:</strong> {form.getValues('fecha_reporte')}</p>
          <p><strong>Estado:</strong> {form.getValues('id_estado_servicio') ?? '—'}</p>
          <p><strong>Hora fin:</strong> {form.getValues('hora_fin') || '—'}</p>
          <p><strong>Comentario:</strong> {form.getValues('comentario') || '—'}</p>
        </div>
      </ConfirmSaveModal>
    </div>
  );
};

export default ReporteFormTecnico;
