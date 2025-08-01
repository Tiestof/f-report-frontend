/**
 * Componente: AuthLayout
 * Descripción: Layout base para páginas de autenticación (Login, etc.).
 * Proporciona fondo, centrado de contenido y footer.
 */

import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--primary-green)]">
      {/* Contenedor principal centrado */}
      <div className="flex flex-1 justify-center items-center px-3 sm:px-4 lg:px-0">
        <div className="bg-white w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-md rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-6 text-gray-800 tracking-wide">
            F-REPORT
          </h1>
          {children}
        </div>
      </div>

      {/* Footer fijo al fondo */}
      <footer className="bg-white text-gray-600 text-[10px] sm:text-xs text-center py-2 px-2">
        © 2024 F-REPORT. Todos los derechos reservados. | Soporte: soporte@freport.cl | v1.0.0
      </footer>
    </div>
  );
}
