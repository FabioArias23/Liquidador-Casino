/**
 * Validación de CBU (Clave Bancaria Uniforme, BCRA Argentina).
 * 22 dígitos: bloque 1 de 8 (entidad + sucursal + dígito verificador),
 * bloque 2 de 14 (dígito verificador + número de cuenta).
 */

const PESOS = [3, 1, 7];

function digitoVerificador(cuerpo: string): number {
  let suma = 0;
  for (let i = cuerpo.length - 1, p = 0; i >= 0; i--, p++) {
    suma += Number(cuerpo[i]) * PESOS[p % PESOS.length];
  }
  return (10 - (suma % 10)) % 10;
}

function bloqueValido(bloque: string): boolean {
  const cuerpo = bloque.slice(0, -1);
  const digito = Number(bloque.slice(-1));
  return digitoVerificador(cuerpo) === digito;
}

export function validarCBU(cbu: string): boolean {
  if (!/^\d{22}$/.test(cbu)) return false;
  return bloqueValido(cbu.slice(0, 8)) && bloqueValido(cbu.slice(8));
}

/** Normaliza: quita espacios/guiones y valida. Devuelve el CBU limpio o null. */
export function normalizarCBU(input: string): string | null {
  const limpio = input.replace(/[\s-]/g, "");
  return validarCBU(limpio) ? limpio : null;
}

/** Calcula el dígito verificador de un bloque a partir de su cuerpo (para tests/altas). */
export function calcularDigito(cuerpo: string): number {
  return digitoVerificador(cuerpo);
}
