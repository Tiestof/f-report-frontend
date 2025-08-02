/**
 * Página: TecnicoDashboard
 * Descripción: Página principal (HOME) para el perfil Técnico.
 */

import DashboardLayout from '../../components/layout/DashboardLayout';

const TecnicoDashboard = () => {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-extrabold text-gray-800">Dashboard Técnico</h1>
      <p className="mt-2 text-gray-600">Resumen de tareas y reportes asignados.</p>
    </DashboardLayout>
  );
};

export default TecnicoDashboard;
