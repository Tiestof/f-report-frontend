/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },

  /**
   * Configuración de modo oscuro en Tailwind:
   * 
   * - 'class': El modo oscuro depende de la clase "dark" en <html>.
   *            ✅ Usar esta opción si tienes un botón que alterna el tema manualmente.
   * 
   * - 'media': El modo oscuro se activa automáticamente si el navegador/SO 
   *            está en modo oscuro (usa la media query prefers-color-scheme).
   *            🔄 Esta opción ignora tu botón, útil si quieres seguir el tema del sistema.
   * 
   * Ejemplo para usar modo automático por navegador:
   *    darkMode: 'media'
   */
  darkMode: 'class', // ✅ Actualmente depende de la clase "dark" controlada por el botón.

  plugins: [],
}