/**
 * ============================================================
 * Archivo: src/pages/dashboard/DashboardHome.tsx
 * Descripción:
 *  - Contenedor para el Dashboard: agrupa los Widgets 1–4.
 *  - Pasa las props requeridas a los Widgets 3 y 4:
 *      - endpoint: string
 *      - fechaInicio: string (YYYY-MM-DD)
 *      - fechaFin: string (YYYY-MM-DD)
 * Patrón aplicado:
 *  - Component Composition: cada widget es independiente.
 * Notas:
 *  - Los endpoints apuntan al namespace de supervisor del dashboard.
 *  - Si quieres un rango distinto, ajusta las fechas debajo.
 * TODO:
 *  - (Opcional) mover todayISO a un util compartido si se reutiliza.
 * ============================================================
 */

import Widget1ResumenDelDia from './Widget1ResumenDelDia';
import Widget2TecnicosHoy from './Widget2TecnicosHoy';
import Widget3ReportesPorDia from './Widget3ReportesPorDia';
import Widget4DistribucionEstados from './Widget4DistribucionEstados';

/** Retorna la fecha en formato YYYY-MM-DD con un offset en días */
function dateWithOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DashboardHome() {
  // 🗓️ Calculamos el rango dinámico: hoy -10 y hoy +10
  const fechaInicio = dateWithOffset(-25);
  const fechaFin = dateWithOffset(5);

  return (
    <div className="space-y-4">
      {/* Fila 1: Widgets 1 y 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Widget1ResumenDelDia />
        <Widget2TecnicosHoy />
      </div>

      {/* Fila 2: Widgets 3 y 4 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Widget3ReportesPorDia
        endpoint="/dashboard/supervisor/carga-reportes"
        fechaInicio={fechaInicio}
        fechaFin={fechaFin}
        />
        <Widget4DistribucionEstados
          endpoint="/dashboard/supervisor/estado-reportes"
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
        />
      </div>
    </div>
  );
}
