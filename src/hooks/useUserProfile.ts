/**
 * Hook: useUserProfile
 * Descripción: Carga datos completos del usuario logueado usando la API.
 * Utiliza el RUT desde authStore para hacer la consulta.
 */

import { useEffect, useState } from 'react';
import useAuthStore from '../store/authStore';
import api from '../services/api';

const useUserProfile = () => {
  const { usuario, token, setUser } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usuario?.rut || !token) return;

    const fetchProfile = async () => {
      try {
        const res = await api.get(`/usuarios/${usuario.rut}`);
        const data = res.data;

        setUser(token, {
          rut: data.rut,
          nombre: data.nombre,
          tipo: data.id_tipo_usuario,
          apellido_paterno: data.apellido_paterno,
          apellido_materno: data.apellido_materno,
          email: data.email,
        });
      } catch (error) {
        console.error('Error al obtener datos del usuario:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [usuario?.rut, token, setUser]);

  return loading;
};

export default useUserProfile;
