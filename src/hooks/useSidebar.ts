/**
 * Hook: useSidebar
 * Descripción: Maneja el estado global del menú lateral (sidebar),
 * detecta breakpoints responsive y persiste la preferencia de colapsado
 * en localStorage para mantener UX consistente entre sesiones.
 */

import { useState, useEffect, useCallback } from 'react';

interface SidebarState {
  isOpen: boolean;
  isMobile: boolean;
  toggleSidebar: () => void;
  closeSidebar: () => void;
}

const STORAGE_KEY = 'f-report-sidebar-open';

const useSidebar = (): SidebarState => {
  // 📌 Estado inicial desde localStorage
  const getInitialState = (): boolean => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? JSON.parse(saved) : true; // Por defecto abierto
  };

  const [isOpen, setIsOpen] = useState<boolean>(getInitialState);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  //  Guardar estado en localStorage cuando cambia
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen));
    }
  }, [isOpen, isMobile]);

  //  Detectar tamaño de pantalla para modo mobile
  const handleResize = useCallback(() => {
    const mobileView = window.innerWidth <= 768;
    setIsMobile(mobileView);
    if (mobileView) {
      setIsOpen(false); // En mobile siempre inicia cerrado
    } else {
      // Recuperar preferencia cuando vuelve a desktop
      setIsOpen(getInitialState());
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  //  Funciones de control
  const toggleSidebar = () => setIsOpen((prev) => !prev);
  const closeSidebar = () => setIsOpen(false);

  return { isOpen, isMobile, toggleSidebar, closeSidebar };
};

export default useSidebar;
