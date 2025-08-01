/**
 * Función: formatRUTDisplay
 * Descripción: Formatea el RUT para visualización, soporta RUT cortos (1-9)
 * y largos (XX.XXX.XXX-X) sin forzar DV mientras el usuario escribe.
 */
export function formatRUTDisplay(value: string): string {
  const clean = value.replace(/[^\dkK]/g, '').toUpperCase();

  // Si hay solo 1 carácter, devolver tal cual (cuerpo sin DV)
  if (clean.length === 1) {
    return clean;
  }

  // Si hay exactamente 2 caracteres, asumir formato corto "1-9"
  if (clean.length === 2) {
    return `${clean[0]}-${clean[1]}`;
  }

  // Para RUT largos: último carácter es DV
  const cuerpo = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let formatted = '';

  const reversed = cuerpo.split('').reverse();
  for (let i = 0; i < reversed.length; i++) {
    if (i !== 0 && i % 3 === 0) {
      formatted = '.' + formatted;
    }
    formatted = reversed[i] + formatted;
  }

  return `${formatted}-${dv}`;
}

/**
 * Función: cleanRUTForAPI
 * Descripción: Limpia el RUT para enviarlo a la API, sin puntos ni guion.
 * Convierte K/k a 0 para cumplir con el backend.
 */
export function cleanRUTForAPI(rut: string): string {
  const clean = rut.replace(/\./g, '').replace(/-/g, '').toUpperCase();
  const cuerpo = clean.slice(0, -1);
  let dv = clean.slice(-1);

  if (dv === 'K') dv = '0';

  return `${cuerpo}${dv}`;
}
