/**
 * Componente: AuthLayout
 * Descripción: Layout base para páginas de autenticación (Login, etc.).
 * Proporciona fondo, centrado de contenido y footer.
 */

import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--primary-green)]">
      <div className="flex flex-1 justify-center items-center p-4">
        <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 sm:p-8">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">F-REPORT</h1>
          {children}
        </div>
      </div>
      <footer className="bg-white text-gray-600 text-xs text-center py-2">
        © 2024 F-REPORT. Todos los derechos reservados. | Soporte: soporte@freport.cl | v1.0.0
      </footer>
    </div>
  );
}
