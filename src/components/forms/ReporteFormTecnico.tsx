/**

 * ============================================================================

 * Archivo: src/components/forms/ReporteFormTecnico.tsx

 * Proposito: Formulario de creacion/edicion de reporte para tecnico.

 * Notas:

 *  - Usa react-hook-form + zod para validar.

 *  - Replica catologos y autocomplete de direccion similares al formulario de supervisor.

 *  - En modo edicion, cliente y direccion se mantienen solo lectura.

 * ============================================================================

 */



import React, { useMemo, useState } from 'react';

import { useForm } from 'react-hook-form';

import type { SubmitHandler } from 'react-hook-form';

import { z } from 'zod';

import { zodResolver } from '@hookform/resolvers/zod';

import { useQuery } from '@tanstack/react-query';

import { useJsApiLoader } from '@react-google-maps/api';

import type { Libraries } from '@react-google-maps/api';



import {

  getClientes,

  getEstadosServicio,

  getTiposHardware,

  getTiposServicio,

  getSO,

  type Cliente,

  type EstadoServicio,

  type TipoHardware,

  type TipoServicio,

  type SistemaOperativo,

} from '../../services/catalogosService';

import { crearReporte, actualizarReporte } from '../../services/reportesService';

import ConfirmSaveModal from '../modals/ConfirmSaveModal';

import useAuthStore from '../../store/authStore';

import AddressAutocomplete from '../maps/AddressAutocomplete';

import MapPreview from '../maps/MapPreview';

import type { ReporteCreate } from '../../types';



type Props = {

  mode: 'create' | 'edit';

  /** Si es edicion, id del reporte a persistir */

  id_reporte?: number;

  /** Valores iniciales si es edicion */

  initialValues?: Partial<FormValues>;

  /** Callback tras guardado exitoso */

  onSaved?: () => void;

};



const MAP_LIBRARIES: Libraries = ['places'];

const LIMITS = {

  numero: 10,

  sector: 100,

  edificio: 100,

  piso: 20,

};



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



const schemaEdit = schemaBase.extend({

  hora_fin: z.string().min(1, 'Hora de término requerida en edición'),

});



export type FormValues = z.infer<typeof schemaBase>;



const numberOrUndefined = (value?: number | null) => {

  if (typeof value === 'number' && !Number.isNaN(value)) return value;

  return undefined;

};



const numberOrNull = (value?: number | null) => {

  if (typeof value === 'number' && !Number.isNaN(value)) return value;

  return null;

};



const ReporteFormTecnico: React.FC<Props> = ({ mode, id_reporte, initialValues, onSaved }) => {

  const rutActual = useAuthStore((state) => state.usuario?.rut ?? '');



  const schema = useMemo(() => (mode === 'edit' ? schemaEdit : schemaBase), [mode]);



  const defaultValues = useMemo<FormValues>(() => ({

    fecha_reporte:
      initialValues?.fecha_reporte
        ? initialValues.fecha_reporte.slice(0, 10)
        : new Date().toISOString().slice(0, 10),

    comentario: initialValues?.comentario ?? '',

    hora_inicio: initialValues?.hora_inicio ?? '',

    hora_fin: initialValues?.hora_fin ?? '',

    direccion: initialValues?.direccion ?? '',

    numero: initialValues?.numero ?? '',

    rut_cliente: initialValues?.rut_cliente ?? '',

    id_estado_servicio:

      typeof initialValues?.id_estado_servicio === 'number' ? initialValues.id_estado_servicio : undefined,

    id_tipo_servicio:

      typeof initialValues?.id_tipo_servicio === 'number' ? initialValues.id_tipo_servicio : undefined,

    id_tipo_hardware:

      typeof initialValues?.id_tipo_hardware === 'number' ? initialValues.id_tipo_hardware : undefined,

    id_sistema_operativo:

      typeof initialValues?.id_sistema_operativo === 'number' ? initialValues.id_sistema_operativo : undefined,

    sector: initialValues?.sector ?? '',

    edificio: initialValues?.edificio ?? '',

    piso: initialValues?.piso ?? '',

    latitud: typeof initialValues?.latitud === 'number' ? initialValues.latitud : undefined,

    longitud: typeof initialValues?.longitud === 'number' ? initialValues.longitud : undefined,

  }), [initialValues]);



  const form = useForm<FormValues>({

    resolver: zodResolver(schema),

    defaultValues,

    mode: 'onSubmit',

  });



  const { data: estadosRaw = [] } = useQuery<EstadoServicio[]>({

    queryKey: ['estados-servicio'],

    queryFn: getEstadosServicio,

    staleTime: 5 * 60 * 1000,

  });

  const estados = useMemo(() => estadosRaw.sort((a, b) => a.descripcion.localeCompare(b.descripcion)), [estadosRaw]);

  const estadoMap = useMemo(() => new Map(estados.map((e) => [e.id_estado_servicio, e.descripcion])), [estados]);



  const { data: tiposServRaw = [] } = useQuery<TipoServicio[]>({

    queryKey: ['tipos-servicio'],

    queryFn: getTiposServicio,

    staleTime: 5 * 60 * 1000,

  });

  const tiposServ = useMemo(() => tiposServRaw.sort((a, b) => a.descripcion.localeCompare(b.descripcion)), [tiposServRaw]);



  const { data: tiposHwRaw = [] } = useQuery<TipoHardware[]>({

    queryKey: ['tipos-hardware'],

    queryFn: getTiposHardware,

    staleTime: 5 * 60 * 1000,

  });

  const tiposHw = useMemo(() => tiposHwRaw.sort((a, b) => a.descripcion.localeCompare(b.descripcion)), [tiposHwRaw]);



  const { data: soRaw = [] } = useQuery<SistemaOperativo[]>({

    queryKey: ['sistema-operativo'],

    queryFn: getSO,

    staleTime: 5 * 60 * 1000,

  });

  const soList = useMemo(() => soRaw.sort((a, b) => a.descripcion.localeCompare(b.descripcion)), [soRaw]);



  const { data: clientesRaw = [] } = useQuery<Cliente[]>({

    queryKey: ['clientes'],

    queryFn: getClientes,

    staleTime: 5 * 60 * 1000,

  });

  const clientes = useMemo(() => clientesRaw.sort((a, b) => a.nombre_cliente.localeCompare(b.nombre_cliente)), [clientesRaw]);

  const clientesMap = useMemo(() => new Map(clientes.map((c) => [c.rut_cliente, c.nombre_cliente])), [clientes]);



  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({

    id: 'reporte-tecnico-map',

    googleMapsApiKey: mapsKey ?? '',

    libraries: MAP_LIBRARIES,

  });

  const mapsAvailable = Boolean(mapsKey) && isMapsLoaded && !mapsLoadError;



  const latValue = form.watch('latitud');

  const lngValue = form.watch('longitud');

  const direccionValue = form.watch('direccion');

  const rutClienteValue = form.watch('rut_cliente');

  const estadoSeleccionado = form.watch('id_estado_servicio');



  const [confirmOpen, setConfirmOpen] = useState(false);



  const onSubmit: SubmitHandler<FormValues> = async (values) => {

    const payload: ReporteCreate = {

      fecha_reporte: values.fecha_reporte,

      comentario: values.comentario ?? '',

      hora_inicio: values.hora_inicio || undefined,

      hora_fin: values.hora_fin || undefined,

      direccion: values.direccion ?? '',

      numero: values.numero ?? '',

      rut_cliente: values.rut_cliente ?? null,

      id_estado_servicio: numberOrUndefined(values.id_estado_servicio) ?? null,

      id_tipo_servicio: numberOrUndefined(values.id_tipo_servicio) ?? null,

      id_tipo_hardware: numberOrUndefined(values.id_tipo_hardware) ?? null,

      id_sistema_operativo: numberOrUndefined(values.id_sistema_operativo) ?? null,

      sector: values.sector ?? null,

      edificio: values.edificio ?? null,

      piso: values.piso ?? null,

      latitud: numberOrNull(values.latitud),

      longitud: numberOrNull(values.longitud),

      rut_usuario: rutActual,

      rut_responsable: rutActual,

      id_rut_empresa_cobro: null,

    };



    if (mode === 'create') {

      await crearReporte(payload);

    } else if (mode === 'edit' && id_reporte) {

      await actualizarReporte(id_reporte, payload);

    }

    onSaved?.();

  };



  const latPreview = typeof latValue === 'number' && !Number.isNaN(latValue) ? latValue : undefined;

  const lngPreview = typeof lngValue === 'number' && !Number.isNaN(lngValue) ? lngValue : undefined;

  const clienteNombre = rutClienteValue ? clientesMap.get(rutClienteValue) : undefined;



  return (

    <div className="space-y-6">

      <div>

        <h2 className="text-xl font-semibold">

          {mode === 'create' ? 'Nuevo Reporte (Tecnico)' : 'Editar Reporte (Tecnico)'}

        </h2>

        <p className="text-sm text-gray-500">

          Completa los campos necesarios. En edición, dirección y cliente se muestran solo lectura.

        </p>

      </div>



      <form

        className="grid grid-cols-1 md:grid-cols-2 gap-4"

        onSubmit={async (e) => {

          e.preventDefault();

          const isValid = await form.trigger();

          if (isValid) setConfirmOpen(true);

        }}

      >

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



        <div>

          <label className="block text-sm font-medium mb-1">Estado del servicio</label>

          <select

            className="w-full rounded border px-3 py-2"

            {...form.register('id_estado_servicio', {

              setValueAs: (value) => (value === '' ? undefined : Number(value)),

            })}

          >

            <option value="">-- Selecciona --</option>

            {estados.map((e) => (

              <option key={e.id_estado_servicio} value={e.id_estado_servicio}>

                {e.descripcion}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label className="block text-sm font-medium mb-1">Tipo de servicio</label>

          <select

            className="w-full rounded border px-3 py-2"

            {...form.register('id_tipo_servicio', {

              setValueAs: (value) => (value === '' ? undefined : Number(value)),

            })}

          >

            <option value="">-- Selecciona --</option>

            {tiposServ.map((t) => (

              <option key={t.id_tipo_servicio} value={t.id_tipo_servicio}>

                {t.descripcion}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label className="block text-sm font-medium mb-1">Tipo de hardware</label>

          <select

            className="w-full rounded border px-3 py-2"

            {...form.register('id_tipo_hardware', {

              setValueAs: (value) => (value === '' ? undefined : Number(value)),

            })}

          >

            <option value="">-- Selecciona --</option>

            {tiposHw.map((t) => (

              <option key={t.id_tipo_hardware} value={t.id_tipo_hardware}>

                {t.descripcion}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label className="block text-sm font-medium mb-1">Sistema operativo</label>

          <select

            className="w-full rounded border px-3 py-2"

            {...form.register('id_sistema_operativo', {

              setValueAs: (value) => (value === '' ? undefined : Number(value)),

            })}

          >

            <option value="">-- Selecciona --</option>

            {soList.map((s) => (

              <option key={s.id_sistema_operativo} value={s.id_sistema_operativo}>

                {s.descripcion}

              </option>

            ))}

          </select>

        </div>



        <div>

          <label className="block text-sm font-medium mb-1">Cliente</label>

          <select

            className="w-full rounded border px-3 py-2"

            disabled={mode === 'edit'}

            {...form.register('rut_cliente')}

          >

            <option value="">-- Selecciona --</option>

            {clientes.map((cliente) => (

              <option key={cliente.rut_cliente} value={cliente.rut_cliente}>

                {cliente.nombre_cliente} ({cliente.rut_cliente})

              </option>

            ))}

          </select>

          {clienteNombre && (

            <p className="text-xs text-gray-500 mt-1">{clienteNombre}</p>

          )}

        </div>



        <div className="md:col-span-2">

          <label className="block text-sm font-medium mb-2">Direccion</label>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">

            <div className="space-y-3">

              {mapsAvailable ? (

                <AddressAutocomplete

                  label="Buscar direccion"

                  defaultValue={direccionValue}

                  disabled={mode === 'edit'}

                  componentRestrictions={{ country: 'cl' }}

                  onSelect={(data) => {

                    form.setValue('direccion', data.address ?? '', { shouldDirty: true, shouldValidate: true });

                    if (data.numero) {

                      form.setValue('numero', data.numero.slice(0, LIMITS.numero), { shouldDirty: true, shouldValidate: true });

                    }

                    form.setValue(

                      'latitud',

                      typeof data.lat === 'number' ? data.lat : undefined,

                      { shouldDirty: true, shouldValidate: true },

                    );

                    form.setValue(

                      'longitud',

                      typeof data.lng === 'number' ? data.lng : undefined,

                      { shouldDirty: true, shouldValidate: true },

                    );

                  }}

                />

              ) : (

                <input

                  type="text"

                  className="w-full rounded border px-3 py-2"

                  {...form.register('direccion')}

                  readOnly={mode === 'edit'}

                  placeholder="Calle y numero"

                />

              )}



              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

                <div>

                  <label className="block text-sm font-medium mb-1">Numero</label>

                  <input

                    type="text"

                    maxLength={LIMITS.numero}

                    className="w-full rounded border px-3 py-2"

                    {...form.register('numero')}

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium mb-1">Sector</label>

                  <input

                    type="text"

                    maxLength={LIMITS.sector}

                    className="w-full rounded border px-3 py-2"

                    {...form.register('sector')}

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium mb-1">Edificio</label>

                  <input

                    type="text"

                    maxLength={LIMITS.edificio}

                    className="w-full rounded border px-3 py-2"

                    {...form.register('edificio')}

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium mb-1">Piso</label>

                  <input

                    type="text"

                    maxLength={LIMITS.piso}

                    className="w-full rounded border px-3 py-2"

                    {...form.register('piso')}

                  />

                </div>

              </div>



              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                <div>

                  <label className="block text-sm font-medium mb-1">Latitud</label>

                  <input

                    type="number"

                    step="any"

                    className="w-full rounded border px-3 py-2"

                    {...form.register('latitud', {

                      setValueAs: (value) => (value === '' ? undefined : Number(value)),

                    })}

                    placeholder="-33.45"

                  />

                </div>

                <div>

                  <label className="block text-sm font-medium mb-1">Longitud</label>

                  <input

                    type="number"

                    step="any"

                    className="w-full rounded border px-3 py-2"

                    {...form.register('longitud', {

                      setValueAs: (value) => (value === '' ? undefined : Number(value)),

                    })}

                    placeholder="-70.67"

                  />

                </div>

              </div>

            </div>



            <div className="w-full">

              {mapsAvailable ? (

                <MapPreview lat={latPreview ?? null} lng={lngPreview ?? null} height="240px" width="100%" />

              ) : (

                <div className="rounded-lg border border-gray-200 bg-gray-100 text-gray-600 flex items-center justify-center text-sm h-full min-h-[200px] px-3 text-center">

                  {mapsLoadError

                    ? 'Error cargando mapa.'

                    : mapsKey

                    ? 'Cargando mapa...'

                    : 'Configura VITE_GOOGLE_MAPS_API_KEY para habilitar el mapa.'}

                </div>

              )}

            </div>

          </div>

        </div>



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



        <div className="md:col-span-2">

          <label className="block text-sm font-medium mb-1">Comentarios</label>

          <textarea

            rows={4}

            className="w-full rounded border px-3 py-2"

            {...form.register('comentario')}

            placeholder="Notas, hallazgos, etc."

          />

        </div>



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

            onClick={() => form.reset(defaultValues)}

          >

            Limpiar

          </button>

        </div>

      </form>



      <ConfirmSaveModal

        open={confirmOpen}

        onCancel={() => setConfirmOpen(false)}

        onConfirm={async () => {

          await form.handleSubmit(onSubmit)();

          setConfirmOpen(false);

        }}

        title="Confirmar guardado"

      >

        <div className="text-sm space-y-1">

          <p><strong>Fecha:</strong> {form.getValues('fecha_reporte') || 'N/A'}</p>

          <p><strong>Cliente:</strong> {clienteNombre || rutClienteValue || 'N/A'}</p>

          <p><strong>Estado:</strong> {(typeof estadoSeleccionado === 'number' ? estadoMap.get(estadoSeleccionado) : undefined) || 'N/A'}</p>

          <p><strong>Direccion:</strong> {`${form.getValues('direccion') || 'N/A'} ${form.getValues('numero') || ''}`.trim()}</p>

          <p><strong>Hora fin:</strong> {form.getValues('hora_fin') || 'N/A'}</p>

          <p><strong>Comentario:</strong> {form.getValues('comentario') || 'N/A'}</p>

        </div>

      </ConfirmSaveModal>

    </div>

  );

};



export default ReporteFormTecnico;

