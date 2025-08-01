
# 🚀 Configuración del Ambiente de Desarrollo F-Report Frontend

Este documento describe los pasos para crear y configurar el frontend de F-Report en **React 19 + TypeScript** con **Vite** y **TailwindCSS v3**.

---

## ✅ 1. Requisitos previos
- Node.js 18+ (usamos v22.17.0 en el proyecto)
- npm 9+ (o yarn)

Verificar versiones:
```bash
node -v
npm -v
```

---

## ✅ 2. Crear el proyecto con Vite + React + TypeScript
```bash
npm create vite@latest f-report-frontend
```
- Seleccionar: **React**
- Seleccionar: **TypeScript + SWC**

Entrar al proyecto:
```bash
cd f-report-frontend
```

---

## ✅ 3. Instalar dependencias principales

### 🔹 UI y estilos
```bash
npm install -D tailwindcss@3.4.13 postcss autoprefixer
npm install @headlessui/react @heroicons/react
```

### 🔹 Estado y formularios
```bash
npm install zustand @tanstack/react-query react-hook-form zod
```

### 🔹 HTTP y seguridad
```bash
npm install axios react-jwt crypto-js
```

### 🔹 Gráficos
```bash
npm install react-chartjs-2 chart.js recharts d3
```

### 🔹 Animaciones y loaders
```bash
npm install framer-motion react-loading-skeleton
```

---

## ✅ 4. Configurar TailwindCSS
Inicializar Tailwind:
```bash
npx tailwindcss init -p
```

Editar `tailwind.config.js`:
```js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}
```

En `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## ✅ 5. Variables de entorno
Crear `.env.local` en la raíz:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_BASE_URL_HTTPS=https://tu-dominio.com/api
VITE_ENVIRONMENT=development

VITE_JWT_SECRET_KEY=tu-clave-jwt
VITE_ENCRYPTION_KEY=tu-clave-encriptacion
VITE_ENABLE_ANALYTICS=false
VITE_ENABLE_DARK_MODE=true
VITE_ENABLE_OFFLINE_MODE=false
```

---

## ✅ 6. Estructura inicial de carpetas
```
src/
 ├── components/
 │   ├── ui/
 │   ├── layout/
 │   ├── charts/
 │   └── common/
 ├── pages/
 │   ├── auth/
 │   ├── dashboard/
 │   ├── reports/
 │   └── settings/
 ├── services/
 ├── store/
 ├── hooks/
 ├── utils/
 ├── types/
 ├── constants/
 └── styles/
```

---

## ✅ 7. Probar Tailwind
En `App.tsx`:
```tsx
export default function App() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="bg-blue-500 text-white p-6 rounded-lg shadow-lg">
        🚀 Tailwind v3 funcionando correctamente
      </div>
    </div>
  );
}
```

Levantar proyecto:
```bash
npm run dev
```
Abrir en `http://localhost:5173`

---

## 📌 Notas finales
- **React:** v19.1.1
- **TailwindCSS:** v3.4.13 (estable)
- **Bundler:** Vite
- **Lenguaje:** TypeScript
- **Base de datos backend:** MySQL
- **API backend:** Node.js + Express
