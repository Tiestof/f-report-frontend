/**
 * ============================================================
 * Archivo: src/pages/supervisor/SupervisorDashboard.tsx
 * Página: Dashboard Supervisor
 * Descripción:
 *  - Página que delega la composición del Dashboard a `DashboardHome`,
 *    el contenedor que agrupa los Widgets 1–4.
 *  - Se añade un botón "Actualizar" que re-monta DashboardHome para
 *    forzar la recarga de datos de todos los widgets sin tocar su lógica.
 * Patrón aplicado:
 *  - Component Composition (la página no conoce los detalles de los widgets)
 * Accesibilidad:
 *  - Botón con aria-label y texto visible.
 * TODO:
 *  - (Opcional) Mostrar la última hora de actualización con Intl.DateTimeFormat.
 * ============================================================
 */

import { useState } from 'react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import DashboardHome from '../dashboard/DashboardHome';

/**
 * Componente principal del Dashboard del Supervisor.
 * Mantiene el layout y delega la presentación a DashboardHome.
 */
export default function SupervisorDashboard() {
  // Clave para forzar el re-montaje de DashboardHome al presionar "Actualizar"
  const [reloadKey, setReloadKey] = useState(0);

  const handleRefresh = () => setReloadKey((k) => k + 1);

  return (
    <DashboardLayout>
      {/* Encabezado */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 dark:text-gray-100">
            Dashboard — Supervisor
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Resumen operativo del día, distribución y estado de reportes.
          </p>
        </div>

        {/* Botón Actualizar: re-monta DashboardHome y fuerza nuevas llamadas */}
        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Actualizar dashboard"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2
                     text-sm font-medium text-gray-700 dark:text-gray-200
                     hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 4v6h6M20 20v-6h-6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Actualizar
        </button>
      </div>

      {/* Contenedor del Dashboard (Widgets 1–4) */}
      {/* key={reloadKey} fuerza el re-montaje cuando se presiona "Actualizar" */}
      <DashboardHome key={reloadKey} />
    </DashboardLayout>
  );
}
