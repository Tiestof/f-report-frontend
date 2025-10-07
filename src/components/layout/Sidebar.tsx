/**
 * Componente: Sidebar
 * Descripción:
 *  - Menú lateral responsive para Supervisor y Técnico.
 *  - Corrige: (1) Quitar tooltip hover en "Ayuda" y forzar ícono correcto.
 *             (2) Evitar doble margen en desktop haciendo el aside 'fixed'.
 *  - Incluye botón de Modo Oscuro (Sol/Luna) y modal de ayuda.
 */

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserHeader from './UserHeader';
import { menuSupervisor, menuTecnico } from '../../utils/menuConfig';
import { helpConfig } from '../../utils/helpConfig';
import useAuthStore from '../../store/authStore';
//  Se elimina HelpTooltip en el botón para no mostrar tooltip hover
import { useThemeStore } from '../../store/themeStore';
import { SunIcon, MoonIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const Sidebar: FC<SidebarProps> = ({ isOpen, isMobile, toggleSidebar, closeSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const usuario = useAuthStore((state) => state.usuario);

  const [showHelp, setShowHelp] = useState(false);

  const menuItems = usuario?.tipo === 2 ? menuSupervisor : menuTecnico;

  const { darkMode, toggleTheme } = useThemeStore();

  // Debug de tema
  useEffect(() => {
    console.log(' Estado actual darkMode:', darkMode);
    console.log(' Clase dark aplicada en <html>?', document.documentElement.classList.contains('dark'));
  }, [darkMode]);

  const handleMenuClick = (path: string, isHelp = false) => {
    if (isHelp) {
      setShowHelp(true); // Abrir modal de ayuda (sin tooltip hover)
      return;
    }

    if (path === '/logout') {
      logout();
      navigate('/login');
    } else {
      navigate(path);
    }
    if (isMobile) closeSidebar();
  };

  const handleToggleTheme = () => {
    console.log('🟢 Click en botón de modo oscuro/claro');
    toggleTheme();
  };

  return (
    <>
      {isMobile && isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/40 z-30"
        />
      )}

      {/* 🔧 Aside fijo también en desktop para evitar doble margen */}
      <aside
        className={`bg-gray-900 dark:bg-gray-800 text-white h-full transition-transform duration-300 z-40
          ${
            isMobile
              ? (isOpen ? 'fixed translate-x-0 w-64' : 'fixed -translate-x-full w-64')
              : (isOpen ? 'fixed md:translate-x-0 md:w-64' : 'fixed md:translate-x-0 md:w-16')
          }`}
        style={{ top: 0, bottom: 0, left: 0 }}
      >
        <UserHeader user={usuario} isOpen={isOpen} />

        <nav className="mt-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isHelp = item.label === 'Ayuda';

            //  Forzar ícono correcto para Ayuda cuando está colapsado/expandido
            const IconComp = isHelp ? QuestionMarkCircleIcon : item.icon;

            return (
              <div key={item.path} className="relative">
                <button
                  onClick={() => handleMenuClick(item.path, isHelp)}
                  className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-colors w-full text-left
                    ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-blue-500 dark:hover:bg-blue-500 text-white dark:text-white'
                    }`}
                >
                  <IconComp className="h-6 w-6 text-white" />
                  {isOpen && (
                    <span className="text-sm font-medium text-white">
                      {item.label}
                    </span>
                  )}

                  {/*  Se elimina HelpTooltip dentro del botón para no mostrar tooltip hover */}
                </button>
              </div>
            );
          })}
        </nav>

        {/* Botón Modo Oscuro */}
        <div className="mt-6 px-3">
          <button
            onClick={handleToggleTheme}
            className="flex items-center gap-2 w-full bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 text-white px-3 py-2 rounded-md transition"
          >
            {darkMode ? (
              <SunIcon className="h-5 w-5 text-yellow-400" />
            ) : (
              <MoonIcon className="h-5 w-5 text-blue-300" />
            )}
            {isOpen && <span className="text-sm">{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>
        </div>

        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="absolute bottom-3 right-3 bg-gray-700 dark:bg-gray-600 hover:bg-gray-600 dark:hover:bg-gray-500 p-2 rounded-full transition"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-5 w-5 transform transition-transform ${!isOpen && 'rotate-180'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
      </aside>

      {/* Modal de ayuda (única forma de ver ayuda ahora) */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-96 shadow-lg max-h-[80vh] overflow-y-auto text-gray-800 dark:text-gray-100">
            <h3 className="text-xl font-bold mb-4">{helpConfig.Ayuda.title}</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">{helpConfig.Ayuda.description}</p>

            <div className="space-y-4">
              {menuItems.map((item) => {
                const help = helpConfig[item.label as keyof typeof helpConfig];
                if (!help) return null;
                const Icon = item.label === 'Ayuda' ? QuestionMarkCircleIcon : item.icon;

                return (
                  <div key={item.label} className="flex items-start gap-3 border-b pb-2 border-gray-200 dark:border-gray-700">
                    <Icon className="h-6 w-6 text-blue-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold">{help.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{help.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setShowHelp(false)}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
