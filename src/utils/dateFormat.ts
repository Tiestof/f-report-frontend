/**
 * ============================================================
 * Archivo: src/utils/dateFormat.ts
 * Descripción: Utilidades de fecha para mostrar en CL.
 * ============================================================
 */
export function formatISODateToCL(s?: string) {
  if (!s) return '—';
  // s puede venir "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ssZ"
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s.slice(0,10);
  return d.toLocaleDateString('es-CL'); // dd-mm-aaaa
}
