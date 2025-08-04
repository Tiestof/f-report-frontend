/**
 * Página: SupervisorUsuarios
 * Gestión de usuarios con validaciones de RUT, email y control de estado.
 * 100% responsive con soporte para mobile y tablet.
 * Incluye modales de ayuda para formulario y listado.
 */

import { useEffect, useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { PencilIcon, PowerIcon, CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import api from '../../services/api';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { formatRUTDisplay, cleanRUTForAPI } from '../../utils/rutFormatter';
import { validateRUT } from '../../utils/rutValidator';
import { helpUsuariosConfig } from '../../utils/helpUsuariosConfig';

interface Usuario {
  rut: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  email: string;
  tipo: number;
  activado: number;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SupervisorUsuarios = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [formData, setFormData] = useState({
    rut: '',
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    email: '',
    tipo: 1,
    clave: '',
    activado: 1
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [search, setSearch] = useState('');
  const [perfilFilter, setPerfilFilter] = useState<number | 'all'>('all');

  const [showFormHelp, setShowFormHelp] = useState(false);
  const [showListHelp, setShowListHelp] = useState(false);

  // ✅ Cargar usuarios desde API
  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const res = await api.get('/usuarios');
      const data = res.data.map((u: any) => ({
        ...u,
        tipo: u.id_tipo_usuario
      }));
      setUsuarios(data);
    } catch (err) {
      console.error('Error al obtener usuarios', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // ✅ Validación
  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    const rutClean = cleanRUTForAPI(formData.rut);

    if (!validateRUT(rutClean)) newErrors.rut = 'RUT inválido';
    if (formData.nombre.trim().length < 4) newErrors.nombre = 'Debe tener al menos 4 caracteres';
    if (formData.apellido_paterno.trim().length < 4)
      newErrors.apellido_paterno = 'Debe tener al menos 4 caracteres';
    if (formData.apellido_materno.trim().length < 4)
      newErrors.apellido_materno = 'Debe tener al menos 4 caracteres';
    if (!emailRegex.test(formData.email)) newErrors.email = 'Correo electrónico inválido';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let value = e.target.value;
    const name = e.target.name;
    if (name === 'rut') value = formatRUTDisplay(value);
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const payload = {
        rut: cleanRUTForAPI(formData.rut),
        nombre: formData.nombre,
        apellido_paterno: formData.apellido_paterno,
        apellido_materno: formData.apellido_materno,
        email: formData.email,
        id_tipo_usuario: formData.tipo,
        clave: formData.clave,
        activado: 1
      };

      if (editingUser) {
        await api.put(`/usuarios/${cleanRUTForAPI(editingUser.rut)}`, payload);
      } else {
        await api.post('/usuarios', payload);
      }
      handleCancel();
      fetchUsuarios();
    } catch (err) {
      console.error('Error al guardar usuario', err);
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingUser(usuario);
    setFormData({
      rut: formatRUTDisplay(usuario.rut),
      nombre: usuario.nombre,
      apellido_paterno: usuario.apellido_paterno,
      apellido_materno: usuario.apellido_materno,
      email: usuario.email,
      tipo: usuario.tipo,
      clave: '',
      activado: usuario.activado
    });
    setErrors({});
  };

  const handleCancel = () => {
    setEditingUser(null);
    setFormData({
      rut: '',
      nombre: '',
      apellido_paterno: '',
      apellido_materno: '',
      email: '',
      tipo: 1,
      clave: '',
      activado: 1
    });
    setErrors({});
  };

  const handleToggleStatus = async (rut: string, activado: number) => {
    try {
      const usuario = usuarios.find(u => u.rut === rut);
      if (!usuario) return;

      const payload = {
        nombre: usuario.nombre,
        apellido_paterno: usuario.apellido_paterno,
        apellido_materno: usuario.apellido_materno,
        email: usuario.email,
        id_tipo_usuario: usuario.tipo,
        activado: activado ? 0 : 1
      };

      await api.put(`/usuarios/${cleanRUTForAPI(rut)}`, payload);
      fetchUsuarios();
    } catch (err) {
      console.error('Error al actualizar estado', err);
    }
  };

  const filteredUsuarios = usuarios
    .filter((u) => {
      const matchSearch =
        search.length < 3 ||
        u.nombre.toLowerCase().includes(search.toLowerCase()) ||
        u.rut.includes(search);
      const matchPerfil = perfilFilter === 'all' || u.tipo === perfilFilter;
      return matchSearch && matchPerfil;
    })
    .sort((a, b) => b.tipo - a.tipo);

  return (
    <DashboardLayout>
      <div className="w-full max-w-screen overflow-x-hidden px-2 sm:px-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-800 mb-2">
            Gestión de Usuarios
          </h1>
          <button onClick={() => setShowFormHelp(true)} title="Ayuda formulario">
            <QuestionMarkCircleIcon className="h-7 w-7 text-blue-600" />
          </button>
        </div>
        <p className="text-gray-600 mb-4 sm:mb-6">Alta, baja y modificación de cuentas de usuario.</p>

        {/* 📌 Formulario */}
        <div className="bg-white shadow rounded-lg p-3 sm:p-6 mb-6 w-full max-w-full">
          <h2 className="text-lg font-bold text-gray-700 mb-4 flex justify-between items-center">
            {editingUser ? 'Editar Usuario' : 'Crear Usuario'}
            <button onClick={() => setShowFormHelp(true)} title="Ayuda formulario">
              <QuestionMarkCircleIcon className="h-5 w-5 text-blue-600" />
            </button>
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Campos */}
            {[ 
              { label: 'RUT', name: 'rut', type: 'text' },
              { label: 'Nombre', name: 'nombre', type: 'text' },
              { label: 'Apellido Paterno', name: 'apellido_paterno', type: 'text' },
              { label: 'Apellido Materno', name: 'apellido_materno', type: 'text' },
              { label: 'Correo electrónico', name: 'email', type: 'email' }
            ].map((field) => (
              <div key={field.name}>
                <label className="text-sm font-medium text-gray-700">{field.label}</label>
                <input
                  type={field.type}
                  name={field.name}
                  value={(formData as any)[field.name]}
                  onChange={handleChange}
                  className={`border p-2 rounded w-full max-w-full ${errors[field.name] ? 'border-red-500' : ''}`}
                  disabled={field.name === 'rut' && !!editingUser}
                />
                {errors[field.name] && <p className="text-red-500 text-xs">{errors[field.name]}</p>}
              </div>
            ))}

            <div>
              <label className="text-sm font-medium text-gray-700">Perfil</label>
              <select
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              >
                <option value={1}>Técnico</option>
                <option value={2}>Supervisor</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Contraseña</label>
              <input
                type="password"
                name="clave"
                value={formData.clave}
                onChange={handleChange}
                className="border p-2 rounded w-full"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-2 rounded transition w-full sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition w-full sm:w-auto"
              >
                {editingUser ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </form>
        </div>

        {/* 📌 Búsqueda y filtro */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-2">
          <input
            type="text"
            placeholder="Buscar por nombre o RUT (3+ letras)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border p-2 rounded w-full md:w-1/2"
          />
          <select
            value={perfilFilter}
            onChange={(e) =>
              setPerfilFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))
            }
            className="border p-2 rounded w-full md:w-1/4"
          >
            <option value="all">Todos los perfiles</option>
            <option value={1}>Técnico</option>
            <option value={2}>Supervisor</option>
          </select>
        </div>

        <div className="flex justify-end mb-2">
          <button onClick={() => setShowListHelp(true)} title="Ayuda listado">
            <QuestionMarkCircleIcon className="h-7 w-7 text-blue-600" />
          </button>
        </div>

        {/* 📌 Lista de usuarios */}
        <div className="bg-white shadow rounded-lg overflow-x-auto w-full max-w-full">
          {loading ? (
            <Skeleton count={6} height={40} />
          ) : (
            <>
              {/* ✅ Vista tabla desktop */}
              <div className="hidden sm:block">
                <table className="min-w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-2 py-2 text-left">Estado</th>
                      <th className="px-2 py-2 text-left">RUT</th>
                      <th className="px-2 py-2 text-left">Nombre</th>
                      <th className="px-2 py-2 text-left">Email</th>
                      <th className="px-2 py-2 text-left">Perfil</th>
                      <th className="px-2 py-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsuarios.map((u) => (
                      <tr key={u.rut} className="border-t hover:bg-gray-50">
                        <td className="px-2 py-2">
                          {u.activado ? (
                            <CheckCircleIcon className="h-6 w-6" style={{ color: '#22ff55' }} />
                          ) : (
                            <XCircleIcon className="h-6 w-6" style={{ color: '#ff2222' }} />
                          )}
                        </td>
                        <td className="px-2 py-2">{formatRUTDisplay(u.rut)}</td>
                        <td className="px-2 py-2">{`${u.nombre} ${u.apellido_paterno}`}</td>
                        <td className="px-2 py-2">{u.email}</td>
                        <td className="px-2 py-2">{u.tipo === 2 ? 'Supervisor' : 'Técnico'}</td>
                        <td className="px-2 py-2 flex gap-2">
                          <button
                            onClick={() => handleEdit(u)}
                            className="p-1 rounded hover:bg-gray-200"
                            title="Editar"
                          >
                            <PencilIcon className="h-5 w-5 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(u.rut, u.activado)}
                            className="p-1 rounded"
                            style={{ backgroundColor: u.activado ? '#22ff55' : '#ff2222' }}
                            title={u.activado ? 'Desactivar' : 'Activar'}
                          >
                            <PowerIcon className="h-5 w-5 text-white" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ✅ Vista tipo cards para móvil */}
              <div className="block sm:hidden space-y-3">
                {filteredUsuarios.map((u) => (
                  <div key={u.rut} className="border rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold">{`${u.nombre} ${u.apellido_paterno}`}</span>
                      {u.activado ? (
                        <CheckCircleIcon className="h-6 w-6" style={{ color: '#22ff55' }} />
                      ) : (
                        <XCircleIcon className="h-6 w-6" style={{ color: '#ff2222' }} />
                      )}
                    </div>
                    <p className="text-sm text-gray-700"><strong>RUT:</strong> {formatRUTDisplay(u.rut)}</p>
                    <p className="text-sm text-gray-700"><strong>Email:</strong> {u.email}</p>
                    <p className="text-sm text-gray-700"><strong>Perfil:</strong> {u.tipo === 2 ? 'Supervisor' : 'Técnico'}</p>
                    <div className="flex justify-end gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(u)}
                        className="p-1 rounded bg-gray-200"
                        title="Editar"
                      >
                        <PencilIcon className="h-5 w-5 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(u.rut, u.activado)}
                        className="p-1 rounded"
                        style={{ backgroundColor: u.activado ? '#22ff55' : '#ff2222' }}
                        title={u.activado ? 'Desactivar' : 'Activar'}
                      >
                        <PowerIcon className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ✅ Modal Ayuda Formulario */}
      {showFormHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">{helpUsuariosConfig.form.title}</h3>
            <p className="text-gray-700 mb-4">{helpUsuariosConfig.form.description}</p>
            <ul className="list-disc pl-5 space-y-2">
              {helpUsuariosConfig.form.fields.map((f) => (
                <li key={f.field}>
                  <strong>{f.field}:</strong> {f.desc}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowFormHelp(false)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ✅ Modal Ayuda Listado */}
      {showListHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-2">{helpUsuariosConfig.listado.title}</h3>
            <p className="text-gray-700 mb-4">{helpUsuariosConfig.listado.description}</p>
            <ul className="space-y-2">
              {helpUsuariosConfig.listado.icons.map((icon, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="text-lg">{icon.icon}</span>
                  <span>{icon.desc}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowListHelp(false)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SupervisorUsuarios;
