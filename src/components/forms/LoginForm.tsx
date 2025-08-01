/**
 * Componente: LoginForm
 * Descripción: Formulario de login que integra RUTInput y PasswordInput.
 * Gestiona la validación, estados de carga y la llamada a la API de autenticación.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RUTInput from '../ui/RUTInput';
import PasswordInput from '../ui/PasswordInput';
import { cleanRUTForAPI } from '../../utils/rutFormatter';
import { login } from '../../services/authService';
import useAuthStore from '../../store/authStore';

const MIN_PASSWORD_LENGTH = 4;

export default function LoginForm() {
  const [rut, setRut] = useState('');
  const [rutValid, setRutValid] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const setUser = useAuthStore((state) => state.setUser);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!rutValid || password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(`Debes ingresar un RUT válido y una contraseña de al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    try {
      setLoading(true);
      const rutLimpio = cleanRUTForAPI(rut);

      console.log('DEBUG LOGIN ENVIADO:', { rutOriginal: rut, rutLimpio, password });
      const data = await login(rutLimpio, password);
      console.log('DEBUG RESPUESTA API:', data);

      if (data?.token) {
        setUser(data.token, data.usuario);
        console.log('DEBUG TOKEN GUARDADO:', data.token);
        console.log('DEBUG USUARIO:', data.usuario);

        if (data.usuario.tipo === 1) {
          navigate('/dashboard-tecnico');
        } else if (data.usuario.tipo === 2) {
          navigate('/dashboard-supervisor');
        }
      }
    } catch (error: any) {
      console.error('DEBUG ERROR LOGIN:', error);
      setErrorMsg(error.message || 'Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4">
      <RUTInput value={rut} onChange={(v, valid) => { setRut(v); setRutValid(valid); }} />
      <PasswordInput value={password} onChange={setPassword} minLength={MIN_PASSWORD_LENGTH} />

      {errorMsg && <p className="text-xs sm:text-sm text-red-600">{errorMsg}</p>}

      <button
        type="submit"
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 text-white py-2 rounded-md transition-colors disabled:bg-gray-400 text-sm sm:text-base"
      >
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>

      <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 text-[11px] sm:text-xs text-gray-600 mt-2">
        <span className="cursor-not-allowed opacity-50">Recuperar contraseña</span>
        <label className="flex items-center gap-1">
          <input type="checkbox" className="accent-green-700" /> Recordarme
        </label>
      </div>
    </form>
  );
}
