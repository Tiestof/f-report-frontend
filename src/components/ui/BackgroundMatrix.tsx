/**
 * BackgroundMatrix (versión robusta)
 * - No usa clases de Tailwind dentro del SVG (evita purge).
 * - Opacidad controlada en el <svg>.
 * - Contraste muy tenue pero visible sobre var(--primary-green).
 */
export default function BackgroundMatrix() {
  // F-REPORT en binario y hexadecimal
  const bin =
    "01000110 00101101 01010010 01000101 01010000 01001111 01010010 01010100";
  const hex = "46 2D 52 45 50 4F 52 54";

  return (
    <svg
      className="absolute inset-0 w-full h-full z-0"
      aria-hidden="true"
      role="img"
      pointerEvents="none"
      style={{ opacity: 0.15 }} // sube/baja a gusto (0.05 - 0.2)
    >
      <defs>
        <pattern
          id="matrixPattern"
          width="520"
          height="120"
          patternUnits="userSpaceOnUse"
        >
          {/* Línea 1: Binario */}
          <text
            x="0"
            y="40"
            fill="#D1D5DB" // gris claro (Tailwind gray-300 #D1D5DB)
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
            fontSize="14"
            xmlSpace="preserve"
          >
            {" " + bin + "  •  "}
            {" " + bin + "  •  "}
            {" " + bin + "  •  "}
          </text>

          {/* Línea 2: Hexadecimal */}
          <text
            x="0"
            y="90"
            fill="#9CA3AF" // gris más oscuro (Tailwind gray-400)
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
            fontSize="14"
            xmlSpace="preserve"
          >
            {" " + hex + "  •  "}
            {" " + hex + "  •  "}
            {" " + hex + "  •  "}
          </text>
        </pattern>
      </defs>

      {/* Rect que rellena todo con el patrón */}
      <rect width="100%" height="100%" fill="url(#matrixPattern)" />
    </svg>
  );
}
