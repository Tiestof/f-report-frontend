/**
 * Componente: DashboardLayout
 * Descripción: Layout principal para páginas de Supervisor y Técnico.
 * Integra useUserProfile para cargar datos desde la API.
 * Ahora incluye soporte para modo oscuro en todo el contenedor y header.
 */

import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import useSidebar from '../../hooks/useSidebar';
import useAuthStore from '../../store/authStore';
import useUserProfile from '../../hooks/useUserProfile';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { isOpen, isMobile, toggleSidebar, closeSidebar } = useSidebar();
  const usuario = useAuthStore((state) => state.usuario);
  const loading = useUserProfile();

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* 📌 Sidebar */}
      <Sidebar
        isOpen={isOpen}
        isMobile={isMobile}
        toggleSidebar={toggleSidebar}
        closeSidebar={closeSidebar}
      />

      {/* 📌 Contenido principal */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          !isMobile ? (isOpen ? 'md:ml-64' : 'md:ml-16') : ''
        }`}
      >
        {/* Header superior solo en mobile */}
        {isMobile && (
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 shadow px-4 py-3">
            <h1 className="text-xl font-bold text-gray-700 dark:text-gray-100">
              {usuario?.tipo === 2 ? 'Supervisor' : 'Técnico'} - F-REPORT
            </h1>
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-gray-800 dark:text-gray-200"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
          {loading ? (
            <p className="text-gray-500 dark:text-gray-300">Cargando datos de usuario...</p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
