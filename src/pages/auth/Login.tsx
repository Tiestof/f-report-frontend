/**
 * Página: Login
 * Descripción: Página principal de autenticación para F-REPORT.
 * Integra AuthLayout y LoginForm con diseño responsive.
 */

import AuthLayout from '../../components/layout/AuthLayout';
import LoginForm from '../../components/forms/LoginForm';

export default function Login() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
