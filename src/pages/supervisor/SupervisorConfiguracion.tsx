/**
 * Página: SupervisorConfiguracion
 * Descripción: Configuración general de tablas auxiliares del proyecto.
 * Permite seleccionar una tabla, listar, editar, crear y eliminar registros.
 * Incluye toasts y diseño responsive para móvil.
 */

import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../services/api';
import { FaSave } from 'react-icons/fa';
import {
  QuestionMarkCircleIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { formatRUTDisplay, cleanRUTForAPI } from '../../utils/rutFormatter';
import { validateRUT } from '../../utils/rutValidator';

const tablasDisponibles = [
  { key: 'centrocostos', label: 'Centro de Costo', endpoint: '/centrocostos', rutField: 'id_rut_empresa_cobro' },
  { key: 'clientes', label: 'Cliente', endpoint: '/clientes', rutField: 'rut_cliente' },
  { key: 'estadoservicios', label: 'Estado Servicio', endpoint: '/estadoservicios' },
  { key: 'sistemasoperativos', label: 'Sistema Operativo', endpoint: '/sistemasoperativos' },
  { key: 'tipoevidencias', label: 'Tipo Evidencia', endpoint: '/tipoevidencias' },
  { key: 'tipogastos', label: 'Tipo Gasto', endpoint: '/tipogastos' },
  { key: 'tipohardware', label: 'Tipo Hardware', endpoint: '/tipohardware' },
  { key: 'tiposervicios', label: 'Tipo Servicio', endpoint: '/tiposervicios' },
  { key: 'tipotareas', label: 'Tipo Tarea', endpoint: '/tipotareas' },
];

interface Registro {
  [key: string]: any;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const SupervisorConfiguracion = () => {
  const [tablaSeleccionada, setTablaSeleccionada] = useState<string>('');
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [editValues, setEditValues] = useState<Registro>({});
  const [originalValues, setOriginalValues] = useState<Registro>({});
  const [nuevoRegistro, setNuevoRegistro] = useState<Registro>({});
  const [showHelp, setShowHelp] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!tablaSeleccionada) return;
    cargarDatos();
  }, [tablaSeleccionada]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 10000);
  };

  const cargarDatos = async () => {
    const tabla = tablasDisponibles.find((t) => t.key === tablaSeleccionada);
    if (!tabla) return;
    try {
      setLoading(true);
      const res = await api.get(tabla.endpoint);
      setRegistros(res.data);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reg: Registro) => {
    setEditingId(Object.values(reg)[0]);
    setEditValues(reg);
    setOriginalValues(reg);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    setEditValues({ ...editValues, [field]: e.target.value });
  };

  const isModified = (field: string) => editValues[field] !== originalValues[field];

  const handleSaveEdit = async () => {
    const tabla = tablasDisponibles.find((t) => t.key === tablaSeleccionada);
    if (!tabla) return;
    try {
      let payload = { ...editValues };
      if (tabla.rutField && payload[tabla.rutField]) {
        payload[tabla.rutField] = cleanRUTForAPI(payload[tabla.rutField]);
      }
      await api.put(`${tabla.endpoint}/${Object.values(editValues)[0]}`, payload);
      setEditingId(null);
      setEditValues({});
      cargarDatos();
      showToast('Registro actualizado correctamente', 'success');
    } catch (err) {
      console.error('Error al actualizar registro:', err);
      showToast('Error al actualizar registro', 'error');
    }
  };

  const handleDelete = async (id: any) => {
    const tabla = tablasDisponibles.find((t) => t.key === tablaSeleccionada);
    if (!tabla) return;
    if (!confirm('¿Seguro que deseas eliminar este registro?')) return;
    try {
      await api.delete(`${tabla.endpoint}/${id}`);
      cargarDatos();
      showToast('Registro eliminado correctamente', 'success');
    } catch (err) {
      console.error('Error al eliminar:', err);
      showToast('Error al eliminar registro', 'error');
    }
  };

  const handleNewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const tabla = tablasDisponibles.find((t) => t.key === tablaSeleccionada);
    let val = value;
    if (tabla?.rutField === name) {
      val = formatRUTDisplay(value);
    }
    setNuevoRegistro({ ...nuevoRegistro, [name]: val });
  };

  const handleCreate = async () => {
    const tabla = tablasDisponibles.find((t) => t.key === tablaSeleccionada);
    if (!tabla) return;
    try {
      let payload = { ...nuevoRegistro };
      if (tabla.rutField && payload[tabla.rutField]) {
        const rutValido = validateRUT(cleanRUTForAPI(payload[tabla.rutField]));
        if (!rutValido) {
          alert('El RUT ingresado no es válido.');
          return;
        }
        payload[tabla.rutField] = cleanRUTForAPI(payload[tabla.rutField]);
      }
      await api.post(tabla.endpoint, payload);
      setNuevoRegistro({});
      cargarDatos();
      showToast('Registro creado correctamente', 'success');
    } catch (err) {
      console.error('Error al crear registro:', err);
      showToast('Error al crear registro', 'error');
    }
  };

  const tablaActual = tablasDisponibles.find((t) => t.key === tablaSeleccionada);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h1 className="text-lg sm:text-2xl font-extrabold text-gray-800 text-center sm:text-left">
          Configuración de Tablas Auxiliares
        </h1>
      </div>
      <p className="text-gray-600 mb-4 sm:mb-6 text-center sm:text-left">
        Alta, baja y modificación de tablas auxiliares.
      </p>

      {!tablaSeleccionada ? (
        <div className="bg-white shadow rounded-lg p-3 sm:p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Selecciona una tabla a configurar:
          </label>
          <select
            value={tablaSeleccionada}
            onChange={(e) => setTablaSeleccionada(e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">-- Selecciona --</option>
            {tablasDisponibles.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base sm:text-lg font-bold">{tablaActual?.label}</h2>
            <button onClick={() => setShowHelp(true)} title="Ayuda">
              <QuestionMarkCircleIcon className="h-6 w-6 text-blue-600" />
            </button>
          </div>

          {loading ? (
            <Skeleton count={5} height={30} />
          ) : (
            <div className="space-y-2">
              {registros.map((reg) => {
                const id = Object.values(reg)[0];
                return (
                  <div
                    key={id}
                    className="flex flex-col sm:flex-row sm:gap-2 sm:items-center border p-2 rounded"
                  >
                    {Object.keys(reg).map((field) => (
                      <input
                        key={field}
                        name={field}
                        value={
                          editingId === id ? editValues[field] || '' : reg[field] || ''
                        }
                        disabled={false}
                        onChange={(e) => handleEditChange(e, field)}
                        className="border p-1 rounded flex-1 mb-2 sm:mb-0"
                      />
                    ))}
                    <div className="flex gap-2 justify-end">
                      {editingId === id ? (
                        <button
                          onClick={handleSaveEdit}
                          disabled={
                            !Object.keys(editValues).some((f) => isModified(f))
                          }
                          className={`p-2 rounded ${
                            Object.keys(editValues).some((f) => isModified(f))
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-300 text-gray-500'
                          }`}
                        >
                          <FaSave className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEdit(reg)}
                          className="p-2 rounded bg-gray-200 hover:bg-gray-300"
                        >
                          <PencilIcon className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(id)}
                        className="p-2 rounded bg-red-500 hover:bg-red-600 text-white"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* ➕ Nuevo registro */}
              <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-center border-t pt-3 mt-3">
                {Object.keys(registros[0] || { descripcion: '' }).map((field) => (
                  <input
                    key={field}
                    name={field}
                    placeholder={field}
                    value={nuevoRegistro[field] || ''}
                    onChange={handleNewChange}
                    className="border p-1 rounded flex-1 mb-2 sm:mb-0"
                  />
                ))}
                <div className="flex justify-end">
                  <button
                    onClick={handleCreate}
                    className="p-2 rounded bg-green-500 hover:bg-green-600 text-white"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                setTablaSeleccionada('');
                setEditingId(null);
                setEditValues({});
                setNuevoRegistro({});
              }}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ✅ TOASTS */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded shadow text-white text-sm sm:text-base ${
              t.type === 'success' ? 'bg-green-600' : 'bg-red-600'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default SupervisorConfiguracion;
