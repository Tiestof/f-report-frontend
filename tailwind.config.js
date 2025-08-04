/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {},
  },
  darkMode: 'class', // ✅ Forzar que Tailwind solo use "dark" con la clase en <html>
  plugins: [],
}
