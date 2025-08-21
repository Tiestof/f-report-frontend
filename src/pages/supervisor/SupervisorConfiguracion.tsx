/**
 * Página: SupervisorConfiguracion
 * Descripción: Configuración general de tablas auxiliares del proyecto.
 * Cambios:
 *  - Se elimina la opción de eliminar registros.
 *  - Se agrega botón de encendido/apagado por fila para gestionar el campo 'activado'.
 *  - Se mantiene edición (PUT) y creación (POST).
 *  - El campo 'activado' no se edita por input, solo por toggle.
 *  - No se permite editar la clave primaria (primer campo del objeto).
 *  - Ordena los registros por la clave primaria ascendente (numérico o alfabético).
 *  - Mantiene soporte RUT (formateo/validación) según tabla con rutField.
 *  - Incluye toasts, diseño responsive y modo oscuro.
 */

import { useState, useEffect } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import api from '../../services/api';
import { FaSave } from 'react-icons/fa';
import {
  QuestionMarkCircleIcon,
  PencilIcon,
  PlusIcon,
  PowerIcon, // 🔌 Toggle activar/desactivar
} from '@heroicons/react/24/outline';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { formatRUTDisplay, cleanRUTForAPI } from '../../utils/rutFormatter';
import { validateRUT } from '../../utils/rutValidator';

type TablaDef = {
  key: string;
  label: string;
  endpoint: string;
  rutField?: string;
};

const tablasDisponibles: TablaDef[] = [
  { key: 'centrocostos', label: 'Centro de Costo', endpoint: '/centrocostos', rutField: 'id_rut_empresa_cobro' },
  { key: 'clientes', label: 'Cliente', endpoint: '/clientes', rutField: 'rut_cliente' },
  // Nota: EstadoServicio NO tiene 'activado' en el DDL
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

  const tablaActual = tablasDisponibles.find((t) => t.key === tablaSeleccionada);

  useEffect(() => {
    if (!tablaSeleccionada) return;
    cargarDatos();
    // Reset de estados al cambiar de tabla
    setEditingId(null);
    setEditValues({});
    setOriginalValues({});
    setNuevoRegistro({});
  }, [tablaSeleccionada]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  // Detecta el nombre de la clave primaria como el primer campo del objeto
  const getIdField = (reg: Registro) => Object.keys(reg)[0];
  const getIdValue = (reg: Registro) => reg[getIdField(reg)];

  // Comparador por PK ascendente (numérico si ambos son números, si no, alfabético con numeric)
  const compareByPrimary = (a: Registro, b: Registro) => {
    const keyA = getIdField(a);
    const keyB = getIdField(b);
    // Si las tablas no son uniformes (no debería), caemos al nombre del primer key de 'a'
    const k = keyA || keyB;
    const av = a[k];
    const bv = b[k];
    const na = Number(av);
    const nb = Number(bv);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return String(av).localeCompare(String(bv), 'es', { numeric: true, sensitivity: 'base' });
  };

  const cargarDatos = async () => {
    if (!tablaActual) return;
    try {
      setLoading(true);
      const res = await api.get(tablaActual.endpoint);
      const lista = Array.isArray(res.data) ? res.data : [];
      const ordenada = [...lista].sort(compareByPrimary);
      setRegistros(ordenada);
    } catch (err) {
      console.error('Error al cargar datos:', err);
      showToast('Error al cargar datos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (reg: Registro) => {
    setEditingId(getIdValue(reg));
    setEditValues(reg);
    setOriginalValues(reg);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    setEditValues({ ...editValues, [field]: e.target.value });
  };

  const isModified = (field: string) => editValues[field] !== originalValues[field];

  const handleSaveEdit = async () => {
    if (!tablaActual) return;
    try {
      const idField = getIdField(editValues);
      const idValue = editValues[idField];

      // Construir payload evitando enviar clave primaria y 'activado' (se maneja por toggle)
      const payload: Registro = { ...editValues };
      delete payload[idField];
      if ('activado' in payload) delete payload['activado'];

      // Normalizar RUT si corresponde
      if (tablaActual.rutField && payload[tablaActual.rutField]) {
        payload[tablaActual.rutField] = cleanRUTForAPI(payload[tablaActual.rutField]);
      }

      await api.put(`${tablaActual.endpoint}/${idValue}`, payload);
      setEditingId(null);
      setEditValues({});
      await cargarDatos(); // vuelve a ordenar
      showToast('Registro actualizado correctamente', 'success');
    } catch (err) {
      console.error('Error al actualizar registro:', err);
      showToast('Error al actualizar registro', 'error');
    }
  };

  // 🔌 Activar/Desactivar (toggle) usando PUT con { activado: 0|1 }
  const handleToggleActivado = async (reg: Registro) => {
    if (!tablaActual) return;
    if (!('activado' in reg)) return; // Si la tabla no tiene activado (ej: EstadoServicio), no hace nada
    try {
      const idField = getIdField(reg);
      const idValue = reg[idField];
      const nuevoEstado = reg.activado ? 0 : 1;
      await api.put(`${tablaActual.endpoint}/${idValue}`, { activado: nuevoEstado });
      await cargarDatos(); // vuelve a ordenar
      showToast(`Registro ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`, 'success');
    } catch (err) {
      console.error('Error al cambiar estado activado:', err);
      showToast('Error al cambiar estado del registro', 'error');
    }
  };

  const handleNewChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let val = value;
    if (tablaActual?.rutField === name) {
      val = formatRUTDisplay(value);
    }
    setNuevoRegistro((prev) => ({ ...prev, [name]: val }));
  };

  const handleCreate = async () => {
    if (!tablaActual) return;
    try {
      const payload: Registro = { ...nuevoRegistro };

      // Validación/normalización RUT
      if (tablaActual.rutField && payload[tablaActual.rutField]) {
        const limpio = cleanRUTForAPI(payload[tablaActual.rutField]);
        if (!validateRUT(limpio)) {
          alert('El RUT ingresado no es válido.');
          return;
        }
        payload[tablaActual.rutField] = limpio;
      }

      // Si la tabla soporta 'activado' y no vino en el form, lo dejamos en 1 por defecto.
      if (!('activado' in payload)) {
        const primera = registros[0];
        if (primera && 'activado' in primera) {
          payload['activado'] = 1;
        }
      }

      await api.post(tablaActual.endpoint, payload);
      setNuevoRegistro({});
      await cargarDatos(); // vuelve a ordenar
      showToast('Registro creado correctamente', 'success');
    } catch (err) {
      console.error('Error al crear registro:', err);
      showToast('Error al crear registro', 'error');
    }
  };

  // Helpers UI: lista de campos editables (evita clave primaria y 'activado')
  const camposEditables = (reg: Registro) =>
    Object.keys(reg).filter((f) => f !== getIdField(reg) && f !== 'activado');

  // Campos para el formulario "Nuevo"
  // Importante: incluimos la PK (RUT/ID) para tablas donde no es autoincrement (ej: Cliente/CentroCosto)
  // y ocultamos 'activado' (se define a 1 por defecto si aplica).
  const camposNuevo = () => {
    const base = registros[0] || { descripcion: '' };
    return Object.keys(base).filter((f) => f !== 'activado');
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
        <h1 className="text-lg sm:text-2xl font-extrabold text-gray-800 dark:text-gray-100 text-center sm:text-left">
          Configuración de Tablas Auxiliares
        </h1>
      </div>

      <p className="text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 text-center sm:text-left">
        Crear y editar tablas auxiliares. Para deshabilitar un registro, usa el botón de encendido/apagado.
      </p>

      {!tablaSeleccionada ? (
        <div className="bg-white dark:bg-gray-700 shadow rounded-lg p-3 sm:p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            Selecciona una tabla a configurar:
          </label>
          <select
            value={tablaSeleccionada}
            onChange={(e) => setTablaSeleccionada(e.target.value)}
            className="border p-2 rounded w-full dark:bg-gray-700 dark:text-gray-100 dark:border-gray-500"
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
        <div className="bg-white dark:bg-gray-700 shadow rounded-lg p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
              {tablaActual?.label}
            </h2>
            <button onClick={() => setShowHelp(true)} title="Ayuda">
              <QuestionMarkCircleIcon className="h-6 w-6 text-blue-600" />
            </button>
          </div>

          {loading ? (
            <Skeleton count={5} height={30} baseColor="#374151" highlightColor="#4B5563" />
          ) : (
            <div className="space-y-2">
              {registros.map((reg) => {
                const idField = getIdField(reg);
                const id = reg[idField];
                const tieneActivado = 'activado' in reg;
                const activo = !!reg.activado;

                return (
                  <div
                    key={id}
                    className="flex flex-col sm:flex-row sm:gap-2 sm:items-center border p-2 rounded bg-gray-50 dark:bg-gray-800 dark:border-gray-600"
                  >
                    {/* Badge ID (solo lectura) */}
                    <div className="text-xs sm:text-sm font-mono text-gray-600 dark:text-gray-300 mb-2 sm:mb-0 sm:w-48">
                      <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">
                        {idField}: {String(id)}
                      </span>
                    </div>

                    {/* Inputs editables (evita id y activado) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                      {camposEditables(reg).map((field) => (
                        <input
                          key={field}
                          name={field}
                          placeholder={field}
                          value={
                            editingId === id ? String(editValues[field] ?? '') : String(reg[field] ?? '')
                          }
                          disabled={editingId !== id}
                          onChange={(e) => handleEditChange(e, field)}
                          className={`border p-1 rounded dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 ${
                            editingId !== id ? 'bg-gray-100 dark:bg-gray-700/60' : ''
                          }`}
                        />
                      ))}
                    </div>

                    {/* Controles a la derecha */}
                    <div className="flex gap-2 justify-end items-center mt-2 sm:mt-0">
                      {/* Toggle Activado (si existe el campo) */}
                      {tieneActivado && (
                        <button
                          onClick={() => handleToggleActivado(reg)}
                          title={activo ? 'Desactivar' : 'Activar'}
                          className={`p-2 rounded flex items-center gap-1 ${
                            activo
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-red-500 hover:bg-red-600 text-white'
                          }`}
                        >
                          <PowerIcon className="h-4 w-4" />
                          <span className="text-xs">{activo ? 'Activo' : 'Inactivo'}</span>
                        </button>
                      )}

                      {/* Botón Guardar / Editar */}
                      {editingId === id ? (
                        <button
                          onClick={handleSaveEdit}
                          disabled={!Object.keys(editValues).some((f) => isModified(f) && f !== 'activado')}
                          className={`p-2 rounded ${
                            Object.keys(editValues).some((f) => isModified(f) && f !== 'activado')
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-300 dark:bg-gray-600 text-gray-500'
                          }`}
                          title="Guardar cambios"
                        >
                          <FaSave className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleEdit(reg)}
                          className="p-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                          title="Editar"
                        >
                          <PencilIcon className="h-4 w-4 text-blue-600" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ➕ Nuevo registro */}
              <div className="flex flex-col sm:flex-row sm:gap-2 sm:items-center border-t dark:border-gray-600 pt-3 mt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                  {camposNuevo().map((field) => (
                    <input
                      key={field}
                      name={field}
                      placeholder={field}
                      value={nuevoRegistro[field] || ''}
                      onChange={handleNewChange}
                      className="border p-1 rounded flex-1 dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
                    />
                  ))}
                </div>
                <div className="flex justify-end mt-2 sm:mt-0">
                  <button
                    onClick={handleCreate}
                    className="p-2 rounded bg-green-500 hover:bg-green-600 text-white"
                    title="Crear registro"
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
              className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-100 px-3 py-2 rounded"
            >
              Cerrar
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

      {/* (Opcional) Modal de ayuda */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 max-w-lg w-full">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Ayuda</h3>
            <ul className="list-disc pl-6 text-sm text-gray-700 dark:text-gray-200 space-y-1">
              <li>Use el botón <b>Editar</b> para modificar campos del registro.</li>
              <li>Use el botón <b>Encendido/Apagado</b> para activar o desactivar un registro (si la tabla soporta el campo <code>activado</code>).</li>
              <li>La clave primaria y el campo <code>activado</code> no se editan por input.</li>
              <li>Al crear registros, el sistema establece <code>activado=1</code> por defecto cuando aplica.</li>
              <li>Los registros se muestran ordenados por su clave primaria de forma ascendente.</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setShowHelp(false)}
                className="px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SupervisorConfiguracion;
