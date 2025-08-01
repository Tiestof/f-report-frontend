/**
 * Función: validateRUT
 * Descripción: Valida el RUT chileno usando el algoritmo módulo 11.
 * Soporta RUT cortos como 1-9 y 2-7.
 */
export function validateRUT(rut: string): boolean {
  if (!rut || rut.length < 2) return false;

  const cuerpo = rut.slice(0, -1);
  let dv = rut.slice(-1).toUpperCase();

  if (!/^\d+$/.test(cuerpo)) return false;
  if (!/^[0-9K]$/i.test(dv)) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperado = resto === 0 ? '0' : resto === 1 ? 'K' : String(11 - resto);

  return dv === dvEsperado;
}
