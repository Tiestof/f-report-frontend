import type { ReactNode } from 'react';
import BackgroundMatrix from '../ui/BackgroundMatrix';

interface AuthLayoutProps {
  children: ReactNode;
}

// Componente para puntos del código Morse
const MorseDot = () => (
  <div className="w-1.5 h-1.5 bg-gray-800 rounded-full mx-0.5"></div>
);

// Componente para rayas del código Morse
const MorseDash = () => (
  <div className="w-4 h-1.5 bg-gray-800 mx-0.5"></div>
);

// Componente para espacios entre letras
const LetterSpace = () => (
  <div className="w-2"></div>
);

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen flex flex-col bg-[var(--primary-green)]">
      {/* Fondo tipo "matrix" */}
      <BackgroundMatrix />

      {/* Contenido encima del fondo */}
      <div className="relative z-10 flex flex-1 justify-center items-center px-3 sm:px-4 lg:px-0">
        <div className="bg-white w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-md rounded-xl shadow-lg p-4 sm:p-6 lg:p-8">
          
          {/* Título F-REPORT con subrayado en Morse */}
          <div className="text-center mb-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-800 mb-5 tracking-wider drop-shadow-lg">
              F-REPORT
            </h1>
            
            <div className="space-y-2 px-2">
              {/* Primera línea: MISION (-- .. ... .. --- -.) */}
              <div className="flex justify-center items-center h-4 flex-wrap">
                {/* M */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDash />
                </div>
                <LetterSpace />
                
                {/* I */}
                <div className="flex items-center">
                  <MorseDot />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* S */}
                <div className="flex items-center">
                  <MorseDot />
                  <MorseDot />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* I */}
                <div className="flex items-center">
                  <MorseDot />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* O */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDash />
                  <MorseDash />
                </div>
                <LetterSpace />
                
                {/* N */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDot />
                </div>
              </div>
              
              {/* Segunda línea: COMPLETE (-.-. --- -- .--. .-.. . - .) */}
              <div className="flex justify-center items-center h-4">
                {/* C */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDot />
                  <MorseDash />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* O */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDash />
                  <MorseDash />
                </div>
                <LetterSpace />
                
                {/* M */}
                <div className="flex items-center">
                  <MorseDash />
                  <MorseDash />
                </div>
                <LetterSpace />
                
                {/* P */}
                <div className="flex items-center">
                  <MorseDot />
                  <MorseDash />
                  <MorseDash />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* L */}
                <div className="flex items-center">
                  <MorseDot />
                  <MorseDash />
                  <MorseDot />
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* E */}
                <div className="flex items-center">
                  <MorseDot />
                </div>
                <LetterSpace />
                
                {/* T */}
                <div className="flex items-center">
                  <MorseDash />
                </div>
                <LetterSpace />
                
                {/* E */}
                <div className="flex items-center">
                  <MorseDot />
                </div>
              </div>
            </div>
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