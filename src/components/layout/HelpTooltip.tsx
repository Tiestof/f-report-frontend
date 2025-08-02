/**
 * Componente: HelpTooltip
 * Descripción: Sistema de ayuda contextual para opciones del menú.
 * - En Desktop: muestra un tooltip flotante.
 * - En Mobile: abre un modal con descripción completa.
 */

import type { FC } from 'react';
import { useState } from 'react';

interface HelpConfig {
  title: string;
  description: string;
}

interface HelpTooltipProps {
  option: string;          // Opción actual del menú
  config: Record<string, HelpConfig>; // Configuración de textos de ayuda
  isMobile?: boolean;
}

const HelpTooltip: FC<HelpTooltipProps> = ({ option, config, isMobile }) => {
  const [open, setOpen] = useState(false);
  const helpData = config[option];

  if (!helpData) return null;

  return (
    <>
      {/* Desktop: Tooltip flotante */}
      {!isMobile && (
        <div className="relative group">
          <span className="ml-2 text-xs text-gray-400 cursor-help">❓</span>
          <div className="absolute left-full ml-2 w-56 bg-gray-800 text-white text-sm p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50">
            <h3 className="font-semibold">{helpData.title}</h3>
            <p className="text-gray-300">{helpData.description}</p>
          </div>
        </div>
      )}

      {/* Mobile: Modal */}
      {isMobile && (
        <>
          <button
            onClick={() => setOpen(true)}
            className="ml-2 text-xs text-gray-300 underline"
          >
            Ayuda
          </button>

          {open && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-4 w-80 shadow-lg">
                <h3 className="text-lg font-bold mb-2">{helpData.title}</h3>
                <p className="text-gray-700 mb-4">{helpData.description}</p>
                <button
                  onClick={() => setOpen(false)}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default HelpTooltip;
