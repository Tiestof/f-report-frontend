/**
 * Página: SupervisorDashboard
 * Descripción: Página principal (HOME) para el perfil Supervisor.
 */

import DashboardLayout from '../../components/layout/DashboardLayout';

const SupervisorDashboard = () => {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-extrabold text-gray-800">Dashboard Supervisor</h1>
      <p className="mt-2 text-gray-600">Resumen general de reportes y estadísticas.</p>
    </DashboardLayout>
  );
};

export default SupervisorDashboard;
