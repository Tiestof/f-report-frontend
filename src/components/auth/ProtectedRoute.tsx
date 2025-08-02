/**
 * Componente: ProtectedRoute
 * Descripción: Protege rutas verificando sesión activa y tipo de usuario.
 */

import { Navigate } from 'react-router-dom';
import type { ReactElement } from 'react';
import useAuthStore from '../../store/authStore';

interface ProtectedRouteProps {
  children: ReactElement;
  allowedRoles?: number[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { token, usuario } = useAuthStore();

  if (!token || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(usuario.tipo)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
