/**
 * Archivo: App.tsx
 * Descripción: Rutas principales de la aplicación.
 * Incluye login y rutas dummy para dashboards.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* ✅ Rutas dummy para probar navegación */}
        <Route path="/dashboard-tecnico" element={<h1 className="p-6 text-2xl">Dashboard Técnico (Dummy)</h1>} />
        <Route path="/dashboard-supervisor" element={<h1 className="p-6 text-2xl">Dashboard Supervisor (Dummy)</h1>} />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
