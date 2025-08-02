/**
 * Página: SupervisorUsuarios
 * Descripción: Sección para gestión de usuarios desde el perfil Supervisor.
 */

import DashboardLayout from '../../components/layout/DashboardLayout';

const SupervisorUsuarios = () => {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-extrabold text-gray-800">Gestión de Usuarios</h1>
      <p className="mt-2 text-gray-600">Alta, baja y modificación de cuentas de usuario.</p>
    </DashboardLayout>
  );
};

export default SupervisorUsuarios;
