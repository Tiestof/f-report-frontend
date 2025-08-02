/**
 * Página: TecnicoHistorial
 * Descripción: Historial de reportes completados por el Técnico.
 */

import DashboardLayout from '../../components/layout/DashboardLayout';

const TecnicoHistorial = () => {
  return (
    <DashboardLayout>
      <h1 className="text-2xl font-extrabold text-gray-800">Historial Técnico</h1>
      <p className="mt-2 text-gray-600">Consulta de reportes realizados en el tiempo.</p>
    </DashboardLayout>
  );
};

export default TecnicoHistorial;
