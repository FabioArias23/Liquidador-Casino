/**
 * Ledger de partida doble (puro, sin frameworks).
 *
 * Regla de oro: cada movimiento de plata genera exactamente 2 entradas
 * (1 débito + 1 crédito) con Σ = 0. Este invariante se valida EN EL DOMINIO
 * (no en la BD), para que cualquier caso de uso que ensamble asientos inválidos
 * falle en tests, antes de llegar a producción.
 *
 * El dominio solo VALIDA y ENSAMBLA. La persistencia la hace el caso de uso
 * a través del LedgerRepository (que es append-only en la BD).
 */

import type { Carga } from "./entities";
import { type ErrorNegocio, errorNegocio, type Result, ok, err } from "./result";

export const TIPOS_MOVIMIENTO = ["debito", "credito"] as const;
export type TipoMovimientoLedger = (typeof TIPOS_MOVIMIENTO)[number];

/** Movimiento contable unitario. */
export interface MovimientoContable {
  /** Cuenta contable (libre: "banco:cbu", "casino:ingresos", "jugador:ref", etc.). */
  cuenta: string;
  tipo: TipoMovimientoLedger;
  /** SIEMPRE en centavos (regla de oro del proyecto). */
  montoCents: number;
}

/** Input del helper de validación. */
export interface AsientoInput {
  operacionTipo: string;
  operacionId: string;
  descripcion: string;
  /** Exactamente 2 movimientos: [débito, crédito]. */
  movimientos: [MovimientoContable, MovimientoContable];
}

/** Asiento validado (lo que se persiste). */
export interface Asiento {
  operacionTipo: string;
  operacionId: string;
  descripcion: string;
  movimientos: [MovimientoContable, MovimientoContable];
  /** ID que agrupa las 2 entries del asiento (para consultar el par). */
  asientoId: string;
  totalDebitos: number;
  totalCreditos: number;
}

/**
 * Códigos de error del ledger.
 * Re-exportados desde application/errors.ts.
 */
export const CODIGOS_ERROR_LEDGER = {
  ASIENTO_DESBALANCEADO: "ASIENTO_DESBALANCEADO",
  MOVIMIENTOS_INVALIDOS: "MOVIMIENTOS_INVALIDOS",
  MONTO_INVALIDO: "MONTO_INVALIDO",
  CUENTA_REQUERIDA: "CUENTA_REQUERIDA",
  OPERACION_NO_ASENTABLE: "OPERACION_NO_ASENTABLE",
} as const;
export type CodigoErrorLedger =
  (typeof CODIGOS_ERROR_LEDGER)[keyof typeof CODIGOS_ERROR_LEDGER];

/**
 * Valida un asiento contable de partida doble y lo devuelve armado.
 * Falla si:
 * - Los movimientos no son exactamente [1 débito, 1 crédito]
 * - Algún monto es negativo o no entero
 * - Alguna cuenta está vacía
 * - Σ débitos ≠ Σ créditos
 */
export function aplicarPartidaDoble(
  input: AsientoInput,
  idGenerator: () => string = generarAsientoId,
): Result<Asiento, ErrorNegocio> {
  // 1. Estructura: exactamente un débito y un crédito.
  const debitos = input.movimientos.filter((m) => m.tipo === "debito");
  const creditos = input.movimientos.filter((m) => m.tipo === "credito");
  if (debitos.length !== 1 || creditos.length !== 1) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_LEDGER.MOVIMIENTOS_INVALIDOS,
        "Un asiento debe tener exactamente un débito y un crédito.",
      ),
    );
  }

  // 2. Cuentas requeridas.
  for (const m of input.movimientos) {
    if (!m.cuenta || m.cuenta.trim() === "") {
      return err(
        errorNegocio(
          CODIGOS_ERROR_LEDGER.CUENTA_REQUERIDA,
          "Cada movimiento contable debe tener una cuenta.",
        ),
      );
    }
  }

  // 3. Montos: enteros no negativos.
  for (const m of input.movimientos) {
    if (!Number.isFinite(m.montoCents) || !Number.isInteger(m.montoCents) || m.montoCents < 0) {
      return err(
        errorNegocio(
          CODIGOS_ERROR_LEDGER.MONTO_INVALIDO,
          `Monto inválido en cuenta "${m.cuenta}": ${m.montoCents}. Debe ser entero ≥ 0.`,
        ),
      );
    }
  }

  // 4. Invariante de partida doble.
  const totalDebitos = debitos[0]!.montoCents;
  const totalCreditos = creditos[0]!.montoCents;
  if (totalDebitos !== totalCreditos) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_LEDGER.ASIENTO_DESBALANCEADO,
        `Asiento desbalanceado: débitos=${totalDebitos}, créditos=${totalCreditos}.`,
      ),
    );
  }

  return ok({
    operacionTipo: input.operacionTipo,
    operacionId: input.operacionId,
    descripcion: input.descripcion,
    movimientos: input.movimientos,
    asientoId: idGenerator(),
    totalDebitos,
    totalCreditos,
  });
}

/** Genera un ID de asiento (formato: asiento-<uuid>). */
function generarAsientoId(): string {
  return `asiento-${crypto.randomUUID()}`;
}

// ─── Generadores por tipo de operación ───────────────────────────────────────

/**
 * Genera el asiento contable para una carga validada.
 *
 * Regla contable (Phase 2):
 * - DÉBITO: `banco:<cbu_origen>` (entra plata a la cuenta del casino)
 * - CRÉDITO: `casino:ingresos` (el casino registra el ingreso del jugador)
 *
 * Solo se permite si la carga está en estado `validated` (validada por operador,
 * pendiente de asentar). El asentamiento es un paso posterior (`validated → settled`).
 */
export function generarAsientoCargaValidada(
  carga: Carga,
): Result<Asiento, ErrorNegocio> {
  if (carga.estado !== "validated") {
    return err(
      errorNegocio(
        CODIGOS_ERROR_LEDGER.OPERACION_NO_ASENTABLE,
        `Solo cargas en estado "validated" generan asiento. Actual: "${carga.estado}".`,
      ),
    );
  }

  return aplicarPartidaDoble({
    operacionTipo: "carga",
    operacionId: carga.id,
    descripcion: `Carga validada del jugador ${carga.playerRef}`,
    movimientos: [
      {
        cuenta: `banco:carga:${carga.id}`,
        tipo: "debito",
        montoCents: carga.montoCents,
      },
      {
        cuenta: "casino:ingresos",
        tipo: "credito",
        montoCents: carga.montoCents,
      },
    ],
  });
}