import type { ReactNode } from 'react';
import BackgroundMatrix from '../ui/BackgroundMatrix';

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--primary-green)]">
      {/* Fondo tipo "matrix" */}
      <BackgroundMatrix />

      {/* Contenido encima del fondo */}
      <div className="relative z-10 flex flex-1 justify-center items-center px-3 sm:px-4 lg:px-0">
        <div className="bg-white w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-md rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
          
          {/* Logo centrado e imponente */}
          <div className="flex justify-center items-center mb-6">
            <img
              src="/LOGO F-REPORT v2.png"
              alt="Logo F-REPORT"
              className="w-80 sm:w-96 lg:w-[28rem] max-h-[260px] object-contain drop-shadow-2xl"
            />
          </div>

          {children}
        </div>
      </div>

      <footer className="relative z-10 bg-white text-gray-600 text-[10px] sm:text-xs text-center py-2 px-2">
        © 2024 F-REPORT. Todos los derechos reservados. | Soporte: soporte@freport.cl | v1.0.0
      </footer>
    </div>
  );
}
