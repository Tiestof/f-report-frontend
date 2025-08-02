/**
 * Archivo: App.tsx
 * Descripción: Define las rutas principales de la aplicación.
 * Protege rutas de Supervisor y Técnico usando ProtectedRoute.
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';

/* ✅ Importar páginas de Supervisor */
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import SupervisorReportes from './pages/supervisor/SupervisorReportes';
import SupervisorInformes from './pages/supervisor/SupervisorInformes';
import SupervisorUsuarios from './pages/supervisor/SupervisorUsuarios';
import SupervisorHistorial from './pages/supervisor/SupervisorHistorial';
import SupervisorConfiguracion from './pages/supervisor/SupervisorConfiguracion';

/* ✅ Importar páginas de Técnico */
import TecnicoDashboard from './pages/tecnico/TecnicoDashboard';
import TecnicoReportes from './pages/tecnico/TecnicoReportes';
import TecnicoHistorial from './pages/tecnico/TecnicoHistorial';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* 📌 Login */}
        <Route path="/login" element={<Login />} />

        {/* 📌 Rutas Supervisor (Protegidas y rol = 2) */}
        <Route
          path="/dashboard-supervisor"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/reportes"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorReportes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/informes"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorInformes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/usuarios"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorUsuarios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/historial"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorHistorial />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/configuracion"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <SupervisorConfiguracion />
            </ProtectedRoute>
          }
        />

        {/* 📌 Rutas Técnico (Protegidas y rol = 1) */}
        <Route
          path="/dashboard-tecnico"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <TecnicoDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/reportes"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <TecnicoReportes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/historial"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <TecnicoHistorial />
            </ProtectedRoute>
          }
        />

        {/* 📌 Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}
