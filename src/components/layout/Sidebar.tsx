/**
 * Componente: Sidebar
 * Descripción: Menú lateral responsive para Supervisor y Técnico.
 * Modal de ayuda ahora muestra todas las opciones de helpConfig.
 */

import type { FC } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import UserHeader from './UserHeader';
import { menuSupervisor, menuTecnico } from '../../utils/menuConfig';
import { helpConfig } from '../../utils/helpConfig';
import useAuthStore from '../../store/authStore';
import HelpTooltip from './HelpTooltip';

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

  const handleMenuClick = (path: string, isHelp = false) => {
    if (isHelp) {
      setShowHelp(true);
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

  return (
    <>
      {isMobile && isOpen && (
        <div
          onClick={closeSidebar}
          className="fixed inset-0 bg-black bg-opacity-40 z-30"
        />
      )}

      <aside
        className={`bg-gray-900 text-white h-full transition-transform duration-300 z-40
          ${
            isMobile
              ? isOpen
                ? 'fixed translate-x-0 w-64'
                : 'fixed -translate-x-full w-64'
              : isOpen
                ? 'relative md:w-64'
                : 'relative md:w-16'
          }`}
      >
        <UserHeader user={usuario} isOpen={isOpen} />

        <nav className="mt-4">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isHelp = item.label === 'Ayuda';

            return (
              <div key={item.path} className="relative">
                <button
                  onClick={() => handleMenuClick(item.path, isHelp)}
                  className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg transition-colors w-full text-left
                    ${isActive ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
                >
                  <item.icon className="h-6 w-6" />
                  {isOpen && <span className="text-sm font-medium">{item.label}</span>}
                  {isHelp && (
                    <HelpTooltip
                      option={item.label}
                      config={helpConfig}
                      isMobile={isMobile}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </nav>

        {!isMobile && (
          <button
            onClick={toggleSidebar}
            className="absolute bottom-3 right-3 bg-gray-700 hover:bg-gray-600 p-2 rounded-full transition"
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

      {/* ✅ Modal de ayuda con todas las opciones */}
      {showHelp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 shadow-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{helpConfig.Ayuda.title}</h3>
            <p className="text-gray-700 mb-4">{helpConfig.Ayuda.description}</p>

            <div className="space-y-3">
              {Object.entries(helpConfig).map(([key, value]) => (
                <div key={key} className="border-b pb-2">
                  <h4 className="font-semibold text-gray-900">{value.title}</h4>
                  <p className="text-sm text-gray-600">{value.description}</p>
                </div>
              ))}
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
