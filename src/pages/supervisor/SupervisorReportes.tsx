/**
 * Página: SupervisorReportes
 * - Carga Google Maps **una sola vez** con libraries=['places'].
 * - AddressAutocomplete NO llama useJsApiLoader.
 * - MapPreview NO llama useJsApiLoader y recibe lat/lng numéricos.
 * - Filtro de fecha corrige comparación normalizando ISO -> YYYY-MM-DD.
 * - Listado muestra fecha sin hora (YYYY-MM-DD).
 * - Tras crear/editar: limpia formulario. Eliminar: pide confirmación. Editar: auto-scroll.
 * - Listado: más nuevo→antiguo + filtros.
 * - Mapeo RUT creador → rut_responsable (DB) y técnico asignado → rut_usuario (DB).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import {
  PencilIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon,
  FunnelIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import api from '../../services/api';
import useAuthStore from '../../store/authStore';

// Google Maps loader ÚNICO
import { useJsApiLoader } from '@react-google-maps/api';
import type { Libraries } from '@react-google-maps/api';

// Componentes de mapas (no cargan script)
import AddressAutocomplete from '../../components/maps/AddressAutocomplete';
import MapPreview from '../../components/maps/MapPreview';

// ===== Tipos =====
type CatalogSO = { id_sistema_operativo: number; nombre_sistema: string; activado?: number };
type CatalogTS = { id_tipo_servicio: number; descripcion: string; activado?: number };
type CatalogTH = { id_tipo_hardware: number; descripcion: string; activado?: number };
type EstadoServicio = { id_estado_servicio: number; descripcion: string };
type Cliente = { rut_cliente: string; nombre_cliente: string; activado?: number };
type CentroCosto = { id_rut_empresa_cobro: string; nombre_centro_costo: string; activado?: number };
type Usuario = {
  rut: string;
  nombre: string;
  apellido_paterno?: string;
  id_tipo_usuario: number;
  activado?: number;
};

type ReporteRow = {
  id_reporte: number;
  fecha_reporte: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  comentario: string | null;
  direccion: string | null;
  numero: string | null;
  rut_usuario: string;
  rut_responsable: string;
  rut_cliente: string | null;
  id_tipo_servicio: number | null;
  id_tipo_hardware: number | null;
  id_sistema_operativo: number | null;
  id_estado_servicio: number | null;
  sector: string | null;
  edificio: string | null;
  piso: string | null;
  latitud: number | null;
  longitud: number | null;
  id_rut_empresa_cobro: string | null;
  // labels si vienen
  nombre_usuario?: string | null;
  nombre_cliente?: string | null;
  tipo_servicio?: string | null;
  tipo_hardware?: string | null;
  nombre_sistema?: string | null;
  estado_servicio?: string | null;
};

type FormValues = {
  fecha_reporte: string;
  hora_inicio: string;
  hora_fin: string;
  comentario: string;
  rut_asignado: string; // técnico asignado → DB: rut_usuario
  rut_cliente: string;
  id_rut_empresa_cobro: string;
  id_tipo_servicio: number | '';
  id_tipo_hardware: number | '';
  id_estado_servicio: number | '';
  id_sistema_operativo: number | '';
  direccion: string;
  numero: string;
  sector: string;
  edificio: string;
  piso: string;
  latitud?: number | '';   // puede ser number o '' (vacío)
  longitud?: number | '';
};

// ===== Utilidades =====
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const timeHM = () => {
  const d = new Date();
  const h = `${d.getHours()}`.padStart(2, '0');
  const m = `${d.getMinutes()}`.padStart(2, '0');
  return `${h}:${m}`;
};

/** Normaliza a 'YYYY-MM-DD' en zona local (sirve para ISO con 'T' o fechas simples) */
const dateOnly = (value?: string | null): string => {
  if (!value) return '';
  // Si ya viene en formato 'YYYY-MM-DD...' cortamos a 10
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const defaultForm = (): FormValues => ({
  fecha_reporte: todayISO(),
  hora_inicio:'', //timeHM(),
  hora_fin: '',
  comentario: '',
  rut_asignado: '',
  rut_cliente: '',
  id_rut_empresa_cobro: '',
  id_tipo_servicio: '',
  id_tipo_hardware: '',
  id_estado_servicio: '',
  id_sistema_operativo: '',
  direccion: '',
  numero: '',
  sector: '',
  edificio: '',
  piso: '',
  latitud: '',
  longitud: '',
});

const MAP_LIBS: Libraries = ['places'];

const SupervisorReportes = () => {
  const formRef = useRef<HTMLDivElement | null>(null);

  const { usuario } = useAuthStore();
  const rutCreador = usuario?.rut || '';

  const [form, setForm] = useState<FormValues>(defaultForm());
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Loader único
  const { isLoaded: isMapsLoaded, loadError: mapsLoadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string,
    libraries: MAP_LIBS,
  });

  // Catálogos
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [tiposServicio, setTiposServicio] = useState<CatalogTS[]>([]);
  const [tiposHardware, setTiposHardware] = useState<CatalogTH[]>([]);
  const [sistemas, setSistemas] = useState<CatalogSO[]>([]);
  const [estados, setEstados] = useState<EstadoServicio[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);

  // Listado + filtros
  const [reportes, setReportes] = useState<ReporteRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [fRutUsuario, setFRutUsuario] = useState('');
  const [fFecha, setFFecha] = useState('');
  const [fTipoServicio, setFTipoServicio] = useState<number | 'all'>('all');
  const [fTipoHardware, setFTipoHardware] = useState<number | 'all'>('all');
  const [fSO, setFSO] = useState<number | 'all'>('all');
  const [fEstado, setFEstado] = useState<number | 'all'>('all');
  const [fCliente, setFCliente] = useState<string | 'all'>('all');

  // ===== Cargar catálogos =====
  useEffect(() => {
    (async () => {
      try {
        const [
          resClientes,
          resCentros,
          resTS,
          resTH,
          resSO,
          resES,
          resUsuarios,
        ] = await Promise.all([
          api.get('/clientes'),
          api.get('/centrocostos'),
          api.get('/tiposervicios'),
          api.get('/tipohardware'),
          api.get('/sistemasoperativos'),
          api.get('/estadoservicios'),
          api.get('/usuarios'),
        ]);

        const onlyActive = <T extends { activado?: number }>(arr: T[]) =>
          Array.isArray(arr) ? arr.filter((x) => x.activado === 1 || x.activado === undefined) : [];

        setClientes(onlyActive(resClientes.data as Cliente[]));
        setCentros(onlyActive(resCentros.data as CentroCosto[]));
        setTiposServicio(onlyActive(resTS.data as CatalogTS[]));
        setTiposHardware(onlyActive(resTH.data as CatalogTH[]));
        setSistemas(onlyActive(resSO.data as CatalogSO[]));
        setEstados(Array.isArray(resES.data) ? (resES.data as EstadoServicio[]) : []);

        // Técnicos activos (id_tipo_usuario=1)
        const users = Array.isArray(resUsuarios.data) ? (resUsuarios.data as any[]) : [];
        const techs = users.filter(
          (u) => u.id_tipo_usuario === 1 && (u.activado === 1 || u.activado === undefined)
        ) as Usuario[];
        setTecnicos(techs);
      } catch (e) {
        console.error('Error cargando catálogos', e);
      }
    })();
  }, []);

  // ===== Cargar listado =====
  const fetchReportes = async () => {
    try {
      setLoadingList(true);
      const { data } = await api.get('/reportes');
      const lista: ReporteRow[] = Array.isArray(data) ? data : [];
      // Más nuevo → más antiguo por id
      const ordenada = [...lista].sort((a, b) => (b.id_reporte || 0) - (a.id_reporte || 0));
      setReportes(ordenada);
    } catch (e) {
      console.error('Error obteniendo reportes', e);
    } finally {
      setLoadingList(false);
    }
  };
  useEffect(() => { fetchReportes(); }, []);

  // ===== Filtrado =====
  const filtered = useMemo(() => {
    return reportes.filter((r) => {
      if (fRutUsuario && !r.rut_usuario?.includes(fRutUsuario)) return false;
      if (fFecha && dateOnly(r.fecha_reporte) !== fFecha) return false; // <-- normalizado
      if (fTipoServicio !== 'all' && r.id_tipo_servicio !== fTipoServicio) return false;
      if (fTipoHardware !== 'all' && r.id_tipo_hardware !== fTipoHardware) return false;
      if (fSO !== 'all' && r.id_sistema_operativo !== fSO) return false;
      if (fEstado !== 'all' && r.id_estado_servicio !== fEstado) return false;
      if (fCliente !== 'all' && r.rut_cliente !== fCliente) return false;
      return true;
    });
  }, [reportes, fRutUsuario, fFecha, fTipoServicio, fTipoHardware, fSO, fEstado, fCliente]);

  // ===== Handlers formulario =====
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name.startsWith('id_') || name === 'latitud' || name === 'longitud'
          ? (value === '' ? '' : isNaN(Number(value)) ? value : Number(value))
          : value,
    }));
  };

  const resetForm = () => {
    setForm(defaultForm());
    setEditingId(null);
  };

  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rutCreador) return alert('No se detecta el RUT del usuario autenticado.');
    if (!form.rut_asignado) return alert('Debes seleccionar el RUT responsable (técnico asignado).');
    if (!form.rut_cliente) return alert('Debes seleccionar un cliente.');
    if (!form.id_tipo_servicio || !form.id_estado_servicio) {
      return alert('Debes seleccionar Tipo de Servicio y Estado del Servicio.');
    }

    const payload = {
      fecha_reporte: form.fecha_reporte,
      comentario: form.comentario || '',
      hora_inicio: form.hora_inicio || null,
      hora_fin: form.hora_fin || null,
      direccion: form.direccion || '',
      numero: form.numero || '',
      rut_usuario: form.rut_asignado,   // técnico asignado
      rut_responsable: rutCreador,      // creador
      rut_cliente: form.rut_cliente,
      id_tipo_servicio: form.id_tipo_servicio || null,
      id_tipo_hardware: form.id_tipo_hardware || null,
      id_sistema_operativo: form.id_sistema_operativo || null,
      id_estado_servicio: form.id_estado_servicio,
      sector: form.sector || '',
      edificio: form.edificio || '',
      piso: form.piso || '',
      latitud: form.latitud === '' ? null : form.latitud,
      longitud: form.longitud === '' ? null : form.longitud,
      id_rut_empresa_cobro: form.id_rut_empresa_cobro || null,
    };

    try {
      setSaving(true);
      if (editingId) {
        await api.put(`/reportes/${editingId}`, payload);
      } else {
        await api.post('/reportes', payload);
      }
      await fetchReportes();
      resetForm(); // ✅ limpiar tras crear/editar
    } catch (error) {
      console.error('Error guardando reporte', error);
      alert('No se pudo guardar el reporte.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (row: ReporteRow) => {
    setEditingId(row.id_reporte);
    setForm({
      // normalizamos para input type="date"
      fecha_reporte: dateOnly(row.fecha_reporte) || todayISO(),
      hora_inicio: (row.hora_inicio || '').slice(0, 5),
      hora_fin: (row.hora_fin || '').slice(0, 5),
      comentario: row.comentario || '',
      rut_asignado: row.rut_usuario || '',
      rut_cliente: row.rut_cliente || '',
      id_rut_empresa_cobro: row.id_rut_empresa_cobro || '',
      id_tipo_servicio: row.id_tipo_servicio || '',
      id_tipo_hardware: row.id_tipo_hardware || '',
      id_estado_servicio: row.id_estado_servicio || '',
      id_sistema_operativo: row.id_sistema_operativo || '',
      direccion: row.direccion || '',
      numero: row.numero || '',
      sector: row.sector || '',
      edificio: row.edificio || '',
      piso: row.piso || '',
      latitud: row.latitud ?? '',
      longitud: row.longitud ?? '',
    });
    scrollToForm();
  };

  const handleDelete = async (row: ReporteRow) => {
    const ok = window.confirm(
      `¿Eliminar el reporte #${row.id_reporte}? Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await api.delete(`/reportes/${row.id_reporte}`);
      await fetchReportes();
      if (editingId === row.id_reporte) resetForm();
    } catch (e) {
      console.error('Error eliminando reporte', e);
      alert('No se pudo eliminar el reporte.');
    }
  };

  // ====== Coerción segura a number para el mini-mapa ======
  const latNum = useMemo<number | undefined>(() => {
    const v = form.latitud;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }, [form.latitud]);

  const lngNum = useMemo<number | undefined>(() => {
    const v = form.longitud;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
  }, [form.longitud]);

  // === UI helpers ===
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 mb-2 flex items-center gap-2">
      {children}
    </h3>
  );

  const FieldLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{children}</label>
  );

  const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className={`border rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition ${props.className || ''}`}
    />
  );

  const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <select
      {...props}
      className={`border rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition ${props.className || ''}`}
    />
  );

  const TextArea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea
      {...props}
      className={`border rounded-md p-2 w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none transition ${props.className || ''}`}
    />
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            Reportes (Supervisor)
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Crea, edita y gestiona los reportes. Los más recientes aparecen primero.
          </p>
        </div>

        {/* =================== Formulario =================== */}
        <div
          ref={formRef}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-4"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tiempo */}
            <div>
              <SectionTitle>🕒 Datos de tiempo</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Fecha de reporte*</FieldLabel>
                  <Input type="date" name="fecha_reporte" value={form.fecha_reporte} onChange={handleChange} required />
                </div>
                <div>
                  <FieldLabel>Hora de inicio</FieldLabel>
                  <Input type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} />
                </div>
                <div>
                  <FieldLabel>Hora de término</FieldLabel>
                  <Input type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* Cliente y asignación */}
            <div>
              <SectionTitle>👤 Datos cliente y asignación</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <FieldLabel>Cliente*</FieldLabel>
                  <Select name="rut_cliente" value={form.rut_cliente} onChange={handleChange} required>
                    <option value="">-- Selecciona cliente --</option>
                    {clientes.map((c) => (
                      <option key={c.rut_cliente} value={c.rut_cliente}>
                        {c.nombre_cliente} ({c.rut_cliente})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Centro de costo</FieldLabel>
                  <Select name="id_rut_empresa_cobro" value={form.id_rut_empresa_cobro} onChange={handleChange}>
                    <option value="">-- Selecciona centro --</option>
                    {centros.map((cc) => (
                      <option key={cc.id_rut_empresa_cobro} value={cc.id_rut_empresa_cobro}>
                        {cc.nombre_centro_costo} ({cc.id_rut_empresa_cobro})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>RUT responsable (Técnico asignado)*</FieldLabel>
                  <Select name="rut_asignado" value={form.rut_asignado} onChange={handleChange} required>
                    <option value="">-- Selecciona técnico --</option>
                    {tecnicos.map((t) => (
                      <option key={t.rut} value={t.rut}>
                        {t.nombre} {t.apellido_paterno ? t.apellido_paterno : ''} ({t.rut})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Servicio */}
            <div>
              <SectionTitle>🧩 Datos de servicio</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <FieldLabel>Tipo de servicio*</FieldLabel>
                  <Select name="id_tipo_servicio" value={form.id_tipo_servicio} onChange={handleChange} required>
                    <option value="">-- Selecciona --</option>
                    {tiposServicio.map((x) => (
                      <option key={x.id_tipo_servicio} value={x.id_tipo_servicio}>{x.descripcion}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Tipo de hardware</FieldLabel>
                  <Select name="id_tipo_hardware" value={form.id_tipo_hardware} onChange={handleChange}>
                    <option value="">-- Selecciona --</option>
                    {tiposHardware.map((x) => (
                      <option key={x.id_tipo_hardware} value={x.id_tipo_hardware}>{x.descripcion}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Sistema operativo</FieldLabel>
                  <Select name="id_sistema_operativo" value={form.id_sistema_operativo} onChange={handleChange}>
                    <option value="">-- Selecciona --</option>
                    {sistemas.map((s) => (
                      <option key={s.id_sistema_operativo} value={s.id_sistema_operativo}>{s.nombre_sistema}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel>Estado del servicio*</FieldLabel>
                  <Select name="id_estado_servicio" value={form.id_estado_servicio} onChange={handleChange} required>
                    <option value="">-- Selecciona --</option>
                    {estados.map((e) => (
                      <option key={e.id_estado_servicio} value={e.id_estado_servicio}>{e.descripcion}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Comentario */}
            <div>
              <SectionTitle>📝 Comentarios</SectionTitle>
              <TextArea name="comentario" value={form.comentario} onChange={handleChange} rows={3} placeholder="Observaciones..." />
            </div>

            {/* Ubicación (al final) */}
            <div>
              <SectionTitle>📍 Datos de ubicación</SectionTitle>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                <div className="space-y-3">
                  <div key={`addr-${editingId ?? 'new'}`}>
                    <AddressAutocomplete
                      label="Dirección"
                      defaultValue={form.direccion}
                      disabled={!isMapsLoaded}
                      onSelect={(d) => {
                        setForm((prev) => ({
                          ...prev,
                          direccion: d.address || prev.direccion,
                          numero: d.numero || prev.numero,
                          latitud: d.lat ?? '',
                          longitud: d.lng ?? '',
                        }));
                      }}
                      componentRestrictions={{ country: 'cl' }}
                    />
                    {!isMapsLoaded && (
                      <p className="mt-1 text-xs text-gray-500">Cargando Google Maps…</p>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Número</FieldLabel>
                    <Input name="numero" value={form.numero} onChange={handleChange} placeholder="N°" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <FieldLabel>Sector</FieldLabel>
                      <Input name="sector" value={form.sector} onChange={handleChange} />
                    </div>
                    <div>
                      <FieldLabel>Edificio</FieldLabel>
                      <Input name="edificio" value={form.edificio} onChange={handleChange} />
                    </div>
                    <div>
                      <FieldLabel>Piso</FieldLabel>
                      <Input name="piso" value={form.piso} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Latitud</FieldLabel>
                      <Input name="latitud" type="number" step="any" value={form.latitud as any} onChange={handleChange} placeholder="-33.45" />
                    </div>
                    <div>
                      <FieldLabel>Longitud</FieldLabel>
                      <Input name="longitud" type="number" step="any" value={form.longitud as any} onChange={handleChange} placeholder="-70.67" />
                    </div>
                  </div>
                </div>

                <div className="md:pl-2">
                  {!isMapsLoaded ? (
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 animate-pulse flex items-center justify-center text-sm text-gray-500" style={{ height: '240px', width: '100%' }}>
                      {mapsLoadError ? 'Error cargando mapa' : 'Cargando mapa…'}
                    </div>
                  ) : (
                    <MapPreview
                      lat={latNum}
                      lng={lngNum}
                      height="240px"
                      width="100%"
                      zoom={16}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row gap-2 justify-end pt-2">
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition"
                  title="Cancelar edición"
                >
                  <XMarkIcon className="h-5 w-5" />
                  Cancelar
                </button>
              )}
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition"
                title="Limpiar formulario"
              >
                <ArrowPathIcon className="h-5 w-5" />
                Limpiar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-60"
              >
                <PlusIcon className="h-5 w-5" />
                {editingId ? (saving ? 'Guardando...' : 'Guardar cambios') : (saving ? 'Creando...' : 'Crear reporte')}
              </button>
            </div>
          </form>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-4">
          <div className="flex items-center gap-2 mb-3">
            <FunnelIcon className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Filtros</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <FieldLabel>Responsable (técnico)</FieldLabel>
              <Input placeholder="Ej: 11111111K" value={fRutUsuario} onChange={(e) => setFRutUsuario(e.target.value.trim())} />
            </div>
            <div>
              <FieldLabel>Fecha</FieldLabel>
              <Input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Tipo Servicio</FieldLabel>
              <Select value={fTipoServicio} onChange={(e) => setFTipoServicio(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Todos</option>
                {tiposServicio.map((x) => <option key={x.id_tipo_servicio} value={x.id_tipo_servicio}>{x.descripcion}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Hardware</FieldLabel>
              <Select value={fTipoHardware} onChange={(e) => setFTipoHardware(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Todos</option>
                {tiposHardware.map((x) => <option key={x.id_tipo_hardware} value={x.id_tipo_hardware}>{x.descripcion}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Sistema Operativo</FieldLabel>
              <Select value={fSO} onChange={(e) => setFSO(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Todos</option>
                {sistemas.map((s) => <option key={s.id_sistema_operativo} value={s.id_sistema_operativo}>{s.nombre_sistema}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel>Estado</FieldLabel>
              <Select value={fEstado} onChange={(e) => setFEstado(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">Todos</option>
                {estados.map((e) => <option key={e.id_estado_servicio} value={e.id_estado_servicio}>{e.descripcion}</option>)}
              </Select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel>Cliente</FieldLabel>
              <Select value={fCliente} onChange={(e) => setFCliente(e.target.value as any)}>
                <option value="all">Todos</option>
                {clientes.map((c) => <option key={c.rut_cliente} value={c.rut_cliente}>{c.nombre_cliente}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* Listado */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Reportes</h2>
            <span className="text-sm text-gray-600 dark:text-gray-300">{filtered.length} resultado(s)</span>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-100 dark:bg-gray-900">
                <tr className="text-left text-sm text-gray-700 dark:text-gray-300">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Inicio</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Servicio</th>
                  <th className="px-3 py-2">Hardware</th>
                  <th className="px-3 py-2">SO</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Responsable </th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">Cargando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">Sin resultados.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id_reporte} className="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 font-mono">{r.id_reporte}</td>
                      {/* Mostrar solo fecha normalizada */}
                      <td className="px-3 py-2">{dateOnly(r.fecha_reporte)}</td>
                      <td className="px-3 py-2">{(r.hora_inicio || '').slice(0, 5)}</td>
                      <td className="px-3 py-2">{r.nombre_cliente || r.rut_cliente}</td>
                      <td className="px-3 py-2">{r.tipo_servicio}</td>
                      <td className="px-3 py-2">{r.tipo_hardware}</td>
                      <td className="px-3 py-2">{r.nombre_sistema}</td>
                      <td className="px-3 py-2">{r.estado_servicio}</td>
                      <td className="px-3 py-2">{r.rut_usuario}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => handleEdit(r)} className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition" title="Editar">
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button onClick={() => handleDelete(r)} className="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition" title="Eliminar">
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Cards móvil */}
          <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
            {loadingList ? (
              <div className="p-4 text-center text-gray-500">Cargando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-500">Sin resultados.</div>
            ) : (
              filtered.map((r) => (
                <div key={r.id_reporte} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-gray-800 dark:text-gray-100">
                      #{r.id_reporte} — {dateOnly(r.fecha_reporte)}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleEdit(r)} className="p-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition" title="Editar">
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button onClick={() => handleDelete(r)} className="p-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition" title="Eliminar">
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    <div><b>Inicio:</b> {(r.hora_inicio || '').slice(0, 5)}</div>
                    <div><b>Cliente:</b> {r.nombre_cliente || r.rut_cliente}</div>
                    <div><b>Servicio:</b> {r.tipo_servicio || '-'}</div>
                    <div><b>Hardware:</b> {r.tipo_hardware || '-'}</div>
                    <div><b>SO:</b> {r.nombre_sistema || '-'}</div>
                    <div><b>Estado:</b> {r.estado_servicio || '-'}</div>
                    <div><b>RUT usuario:</b> {r.rut_usuario}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SupervisorReportes;
