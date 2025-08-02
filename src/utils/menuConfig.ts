/**
 * Archivo: menuConfig.ts
 * Descripción: Configuración central de opciones de menú para Supervisor y Técnico.
 * Define rutas, iconos y etiquetas de forma dinámica.
 */

import {
  HomeIcon,
  DocumentChartBarIcon,
  ChartBarSquareIcon,
  UsersIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';

interface MenuItem {
  label: string;          // Texto visible
  path: string;           // Ruta de navegación
  icon: React.ElementType;// Icono asociado
}

/* 📌 Menú para SUPERVISOR (tipo 2) */
export const menuSupervisor: MenuItem[] = [
  { label: 'Home', path: '/dashboard-supervisor', icon: HomeIcon },
  { label: 'Reportes', path: '/supervisor/reportes', icon: DocumentChartBarIcon },
  { label: 'Informes', path: '/supervisor/informes', icon: ChartBarSquareIcon },
  { label: 'Usuarios', path: '/supervisor/usuarios', icon: UsersIcon },
  { label: 'Historial', path: '/supervisor/historial', icon: ClockIcon },
  { label: 'Configuración', path: '/supervisor/configuracion', icon: Cog6ToothIcon },
  { label: 'Salir', path: '/logout', icon: ArrowRightOnRectangleIcon },
  { label: 'Ayuda', path: '/ayuda', icon: QuestionMarkCircleIcon },
];

/* 📌 Menú para TÉCNICO (tipo 1) */
export const menuTecnico: MenuItem[] = [
  { label: 'Home', path: '/dashboard-tecnico', icon: HomeIcon },
  { label: 'Reportes', path: '/tecnico/reportes', icon: DocumentChartBarIcon },
  { label: 'Historial', path: '/tecnico/historial', icon: ClockIcon },
  { label: 'Salir', path: '/logout', icon: ArrowRightOnRectangleIcon },
  { label: 'Ayuda', path: '/ayuda', icon: QuestionMarkCircleIcon },
];
