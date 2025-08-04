/**
 * Archivo: helpUsuariosConfig.ts
 * Descripción: Configuración de ayuda contextual para la página de usuarios.
 */

export const helpUsuariosConfig = {
  form: {
    title: 'Ayuda - Formulario de Usuario',
    description: 'Completa todos los campos obligatorios para crear o editar usuarios.',
    fields: [
      { field: 'RUT', desc: 'Debe estar en formato chileno válido. Ej: 12.345.678-9' },
      { field: 'Nombre', desc: 'Mínimo 4 caracteres. Solo letras.' },
      { field: 'Apellido Paterno', desc: 'Mínimo 4 caracteres.' },
      { field: 'Apellido Materno', desc: 'Mínimo 4 caracteres.' },
      { field: 'Correo electrónico', desc: 'Debe tener un formato válido. Ej: usuario@dominio.com' },
      { field: 'Perfil', desc: 'Selecciona si es Técnico (1) o Supervisor (2).' },
      { field: 'Contraseña', desc: 'Se requiere al crear usuario. Al editar es opcional.' }
    ]
  },
  listado: {
    title: 'Ayuda - Listado de Usuarios',
    description: 'En esta sección puedes visualizar, editar y activar/desactivar usuarios.',
    icons: [
      { icon: '🖊️', desc: 'Botón para editar usuario. Carga la información en el formulario.' },
       { icon: '⏻', desc: 'Botón para activar/desactivar usuario. Verde = activo, Rojo = inactivo.' },
      { icon: '✅', desc: 'Estado activo.' },
      { icon: '❌', desc: 'Estado inactivo.' }
    ]
  }
};
