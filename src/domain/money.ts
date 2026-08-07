/**
 * Regla de oro del proyecto: la plata SIEMPRE viaja como enteros en centavos.
 * Nunca floats. Ver PLAN-TECNICO.md §1 y AGENTS.md §3.
 */
export type Centavos = number;

export function esEntero(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

/** Crea Centavos validando que sea entero no negativo (para montos). */
export function centavos(value: number): Centavos {
  if (!esEntero(value)) {
    throw new Error(`Money: se esperaba un entero de centavos, llegó ${value}`);
  }
  return value;
}

/**
 * Parsea un string decimal a centavos.
 * Acepta "1234.56", "1234,56" y "1.234,56" (formato es-AR).
 */
export function desdeDecimalString(input: string): Centavos {
  const limpio = input.trim();
  let cuerpo: string;
  if (limpio.includes(",")) {
    // Formato es-AR: puntos como miles, coma como decimal ("1.234,56")
    cuerpo = limpio.replace(/\./g, "").replace(",", ".");
  } else {
    cuerpo = limpio;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(cuerpo)) {
    throw new Error(`Money: formato decimal inválido: "${input}"`);
  }
  const [enteros, decimales = ""] = cuerpo.split(".");
  const dec = (decimales + "00").slice(0, 2);
  return centavos(Number(enteros) * 100 + Number(dec));
}

/** "123456" centavos -> "1234.56" */
export function aDecimalString(monto: Centavos): string {
  const signo = monto < 0 ? "-" : "";
  const abs = Math.abs(monto);
  const enteros = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  return `${signo}${enteros}.${dec}`;
}

/** Formatea para mostrar: $ 1.234,56 (es-AR por defecto). */
export function formatear(monto: Centavos, moneda = "ARS"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto / 100);
}

export function sumar(a: Centavos, b: Centavos): Centavos {
  return centavos(a + b);
}

export function restar(a: Centavos, b: Centavos): Centavos {
  return centavos(a - b);
}
