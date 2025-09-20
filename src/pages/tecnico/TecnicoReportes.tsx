/**
 * ============================================================
 * Archivo: src/pages/tecnico/TecnicoReportes.tsx
 * Propósito:
 *   - Página de Reportes del TÉCNICO.
 *   - Lista superior (solo rut_responsable = técnico, excluye estado 5).
 *   - Filtros: Cliente (nombre), Fecha, ID de reporte, Estado (descripción).
 *   - Crear / Editar / Eliminar lógico (5) según reglas.
 *   - Abre modales de Gastos y Evidencias asociados al reporte.
 *   - Responsive: tabla en desktop, cards en móvil.
 *   - Botón "Nuevo reporte" abajo del listado con scroll al formulario.
 * Notas:
 *   - Normalizamos catálogos para evitar desajustes de TS (rut/nombre vs rut_cliente/nombre_cliente).
 * ============================================================
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import ReporteFormTecnico from '../../components/forms/ReporteFormTecnico';
import GastosModal from '../../components/modals/GastosModal';
import EvidenciasModal from '../../components/modals/EvidenciasModal';

import {
  listarReportesTecnico,
  eliminarReporteLogicoTecnico,
  puedeEditarTecnico,
  puedeEliminarTecnico,
  obtenerReporte,
} from '../../services/reportesService';
import type { Reporte } from '../../types';
import useAuthStore from '../../store/authStore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getClientes, getEstadosServicio } from '../../services/catalogosService';

/** Tipos locales usados en esta vista (normalizados) */
type EstadoServicio = { id_estado_servicio: number; descripcion: string };
type Cliente = { rut_cliente: string; nombre_cliente: string };

/** Formatter fecha segura */
function fmtFecha(v?: string) {
  if (!v) return '';
  try {
    return format(new Date(v), 'dd-MM-yyyy', { locale: es });
  } catch {
    return v;
  }
}

const TecnicoReportes: React.FC = () => {
  // Del store: en tu authStore la forma estable es "usuario.rut"
  const rutTecnico: string | undefined = useAuthStore((s: any) => s?.usuario?.rut);

  const [loading, setLoading] = useState(false);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [selected, setSelected] = useState<Reporte | null>(null);

  const [showGastos, setShowGastos] = useState(false);
  const [showEvidencias, setShowEvidencias] = useState(false);

  // Catálogos para filtros/mapeos (normalizados)
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [estados, setEstados] = useState<EstadoServicio[]>([]);

  // Filtros UI
  const [fCliente, setFCliente] = useState('');        // por nombre de cliente (texto)
  const [fFecha, setFFecha] = useState('');            // yyyy-mm-dd
  const [fId, setFId] = useState('');                  // id_reporte (texto/número)
  const [fEstado, setFEstado] = useState<'all' | number>('all'); // estado por id

  const formRef = useRef<HTMLDivElement | null>(null);

  /** Carga catálogos (clientes/estados) con NORMALIZACIÓN */
  useEffect(() => {
    (async () => {
      try {
        const [cliRaw, estRaw] = await Promise.all([getClientes(), getEstadosServicio()]);

        // Normaliza clientes a { rut_cliente, nombre_cliente }
        const cliNorm: Cliente[] = (Array.isArray(cliRaw) ? cliRaw : []).map((c: any) => ({
          rut_cliente:
            c?.rut_cliente ??
            c?.rut ??
            c?.rutCliente ??
            c?.rutcliente ??
            c?.id_rut_cliente ??
            '',
          nombre_cliente:
            c?.nombre_cliente ??
            c?.nombre ??
            c?.razon_social ??
            c?.descripcion ??
            c?.nombreCliente ??
            '',
        }));

        // Normaliza estados a { id_estado_servicio, descripcion }
        const estNorm: EstadoServicio[] = (Array.isArray(estRaw) ? estRaw : []).map((e: any) => ({
          id_estado_servicio:
            e?.id_estado_servicio ??
            e?.id ??
            e?.value ??
            e?.id_estado ??
            Number(e?.codigo) ??
            0,
          descripcion:
            e?.descripcion ??
            e?.nombre ??
            e?.label ??
            e?.desc ??
            String(e?.id ?? ''),
        }));

        setClientes(cliNorm);
        setEstados(estNorm.filter((e) => e.id_estado_servicio > 0 && e.descripcion));
      } catch (e) {
        console.error('Error cargando catálogos', e);
      }
    })();
  }, []);

  /** Carga/recarga lista del técnico */
  const reload = async () => {
    if (!rutTecnico) return;
    setLoading(true);
    try {
      const data = await listarReportesTecnico(rutTecnico);
      setReportes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutTecnico]);

  /** Mapas auxiliares para mostrar descripciones */
  const estadoMap = useMemo(() => {
    const m = new Map<number, string>();
    estados.forEach((e) => m.set(e.id_estado_servicio, e.descripcion));
    return m;
  }, [estados]);

  const clienteMap = useMemo(() => {
    const m = new Map<string, string>();
    clientes.forEach((c) => m.set(c.rut_cliente, c.nombre_cliente));
    return m;
  }, [clientes]);

  /** Filtrado en memoria */
  const listFiltered = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const fCli = norm(fCliente || '');

    return reportes.filter((r) => {
      // Cliente por NOMBRE
      const nombreCliente = r.rut_cliente ? (clienteMap.get(r.rut_cliente) || '') : '';
      if (fCli && !norm(nombreCliente).includes(fCli)) return false;

      // Fecha exacta (YYYY-MM-DD)
      if (fFecha) {
        const iso = r.fecha_reporte ? String(r.fecha_reporte).slice(0, 10) : '';
        if (iso !== fFecha) return false;
      }

      // ID de reporte (contiene)
      if (fId) {
        const idStr = r.id_reporte ? String(r.id_reporte) : '';
        if (!idStr.includes(fId)) return false;
      }

      // Estado por id (dropdown)
      if (fEstado !== 'all') {
        if (r.id_estado_servicio !== fEstado) return false;
      }

      return true;
    });
  }, [reportes, clienteMap, fCliente, fFecha, fId, fEstado]);

  /** Acciones de la tabla */
  const onEdit = async (r: Reporte) => {
    if (!rutTecnico) return;
    if (!puedeEditarTecnico(r, rutTecnico)) {
      alert('No autorizado para editar este reporte.');
      return;
    }
    const full = await obtenerReporte(Number(r.id_reporte));
    setSelected(full || r);
    // Llevar scroll al formulario
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const onDelete = async (r: Reporte) => {
    if (!rutTecnico || !r.id_reporte) return;
    if (!puedeEliminarTecnico(r, rutTecnico)) {
      alert('Solo puedes eliminar reportes donde eres AUTOR y RESPONSABLE.');
      return;
    }
    const ok = confirm(`¿Eliminar (lógico) el reporte #${r.id_reporte}?`);
    if (!ok) return;
    try {
      await eliminarReporteLogicoTecnico(r.id_reporte, rutTecnico);
      await reload();
      if (selected?.id_reporte === r.id_reporte) setSelected(null);
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo eliminar.');
    }
  };

  const onOpenGastos = (r: Reporte) => {
    setSelected(r);
    setShowGastos(true);
  };

  const onOpenEvidencias = (r: Reporte) => {
    setSelected(r);
    setShowEvidencias(true);
  };

  /** UI: Filtros */
  const FiltersBar = (
    <div className="bg-white/90 dark:bg-slate-800 rounded-xl shadow p-3 md:p-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-base md:text-lg font-semibold">Filtros</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Cliente (nombre)</label>
          <input
            type="text"
            placeholder="Ej: ACME Ltda"
            value={fCliente}
            onChange={(e) => setFCliente(e.target.value)}
            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Fecha</label>
          <input
            type="date"
            value={fFecha}
            onChange={(e) => setFFecha(e.target.value)}
            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">ID Reporte</label>
          <input
            type="text"
            placeholder="Ej: 1024"
            value={fId}
            onChange={(e) => setFId(e.target.value.replace(/\D/g, ''))}
            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          />
        </div>
        <div>
          <label className="text-sm text-slate-600 dark:text-slate-300">Estado</label>
          <select
            value={fEstado}
            onChange={(e) => setFEstado(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="w-full p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
          >
            <option value="all">Todos</option>
            {estados.map((e) => (
              <option key={e.id_estado_servicio} value={e.id_estado_servicio}>
                {e.descripcion}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={() => {
              setFCliente('');
              setFFecha('');
              setFId('');
              setFEstado('all');
            }}
            className="w-full p-2 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );

  /** UI: Tabla / Cards */
  const Listado = (
    <div className="bg-white/90 dark:bg-slate-800 rounded-xl shadow p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Mis reportes</h2>
        <span className="text-sm text-slate-500">{listFiltered.length} resultado(s)</span>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        {/* Contenedor con alto máximo ~5 filas y scroll vertical */}
        <div
          className="overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md"
          style={{ maxHeight: 56 * 5 + 40 }}
        >
          <table className="min-w-[820px] w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10">
              <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 px-2">#</th>
                <th className="py-2 px-2">Fecha</th>
                <th className="py-2 px-2">Cliente</th>
                <th className="py-2 px-2">Dirección</th>
                <th className="py-2 px-2">Estado</th>
                <th className="py-2 px-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Cargando...</td></tr>
              )}
              {!loading && listFiltered.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-slate-500">Sin resultados.</td></tr>
              )}
              {!loading && listFiltered.map((r) => (
                <tr key={r.id_reporte} className="border-b border-slate-100 dark:border-slate-700/50">
                  <td className="py-2 px-2">{r.id_reporte}</td>
                  <td className="py-2 px-2">{fmtFecha(r.fecha_reporte)}</td>
                  <td className="py-2 px-2">
                    {r.rut_cliente ? (clienteMap.get(r.rut_cliente) || r.rut_cliente) : '-'}
                  </td>
                  <td className="py-2 px-2">
                    {r.direccion ?? '-'} {r.numero ?? ''}
                  </td>
                  <td className="py-2 px-2">
                    {typeof r.id_estado_servicio === 'number'
                      ? (estadoMap.get(r.id_estado_servicio) || r.id_estado_servicio)
                      : '-'}
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                        onClick={() => onEdit(r)}
                      >
                        Editar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => onDelete(r)}
                      >
                        Eliminar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
                        onClick={() => onOpenGastos(r)}
                      >
                        Gastos
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700"
                        onClick={() => onOpenEvidencias(r)}
                      >
                        Evidencias
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Botón Nuevo reporte al final del listado */}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => {
              setSelected(null);
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
            }}
            className="px-3 py-1 rounded bg-emerald-700 text-white hover:bg-emerald-800 text-sm"
          >
            + Nuevo reporte
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {loading && <div className="text-center text-slate-500 py-3">Cargando...</div>}
        {!loading && listFiltered.length === 0 && (
          <div className="text-center text-slate-500 py-3">Sin resultados.</div>
        )}
        {!loading && listFiltered.map((r) => (
          <div key={r.id_reporte} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">#{r.id_reporte} • {fmtFecha(r.fecha_reporte)}</div>
              <div className="text-xs">
                {typeof r.id_estado_servicio === 'number'
                  ? (estadoMap.get(r.id_estado_servicio) || r.id_estado_servicio)
                  : '-'}
              </div>
            </div>
            <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              <div><b>Cliente:</b> {r.rut_cliente ? (clienteMap.get(r.rut_cliente) || r.rut_cliente) : '-'}</div>
              <div><b>Dirección:</b> {(r.direccion ?? '-') + ' ' + (r.numero ?? '')}</div>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => onEdit(r)}>
                Editar
              </button>
              <button className="px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700" onClick={() => onDelete(r)}>
                Eliminar
              </button>
              <button className="px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700" onClick={() => onOpenGastos(r)}>
                Gastos
              </button>
              <button className="px-2 py-1 rounded bg-slate-600 text-white hover:bg-slate-700" onClick={() => onOpenEvidencias(r)}>
                Evidencias
              </button>
            </div>
          </div>
        ))}

        {/* Botón Nuevo reporte en móvil */}
        <div className="mt-3">
          <button
            onClick={() => {
              setSelected(null);
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
            }}
            className="w-full px-3 py-2 rounded bg-emerald-700 text-white hover:bg-emerald-800"
          >
            + Nuevo reporte
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* FILTROS */}
        {FiltersBar}

        {/* LISTADO */}
        {Listado}

        {/* FORMULARIO */}
        <div ref={formRef} className="bg-white/90 dark:bg-slate-800 rounded-xl shadow p-3 md:p-4">
          <h3 className="text-base md:text-lg font-semibold mb-3">
            {selected?.id_reporte ? `Editar reporte #${selected.id_reporte}` : 'Crear nuevo reporte'}
          </h3>

          <ReporteFormTecnico
            key={`form-${selected?.id_reporte ?? 'new'}`}  // fuerza remount al cambiar selección
            mode={selected?.id_reporte ? 'edit' : 'create'}
            id_reporte={selected?.id_reporte}
            initialValues={
              selected?.id_reporte
                ? {
                    fecha_reporte: selected.fecha_reporte ?? '',
                    comentario: selected.comentario ?? '',
                    hora_inicio: selected.hora_inicio ?? '',
                    hora_fin: selected.hora_fin ?? '',
                    direccion: selected.direccion ?? '',
                    numero: selected.numero ?? '',
                    rut_cliente: selected.rut_cliente ?? '',
                    id_tipo_servicio: selected.id_tipo_servicio ?? undefined,
                    id_tipo_hardware: selected.id_tipo_hardware ?? undefined,
                    id_sistema_operativo: selected.id_sistema_operativo ?? undefined,
                    id_estado_servicio: selected.id_estado_servicio ?? undefined,
                    sector: selected.sector ?? undefined,
                    edificio: selected.edificio ?? undefined,
                    piso: selected.piso ?? undefined,
                    latitud: selected.latitud ?? undefined,
                    longitud: selected.longitud ?? undefined,
                  }
                : undefined
            }
            onSaved={async () => {
              await reload();
              if (selected?.id_reporte) setSelected(null);
            }}
          />
        </div>
      </div>

      {/* MODALES */}
      {selected?.id_reporte && showGastos && (
        <GastosModal
          onClose={() => setShowGastos(false)}
          onSaved={async () => {
            setShowGastos(false);
            await reload();
          }}
          idReporte={selected.id_reporte}
        />
      )}
      {selected?.id_reporte && showEvidencias && (
        <EvidenciasModal
          onClose={() => setShowEvidencias(false)}
          onSaved={async () => {
            setShowEvidencias(false);
            await reload();
          }}
          idReporte={selected.id_reporte}
        />
      )}
    </DashboardLayout>
  );
};

export default TecnicoReportes;