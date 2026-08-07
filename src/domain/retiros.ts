/**
 * State machine de Retiro (pura, sin frameworks).
 *
 * Reglas (ver PLAN-TECNICO.md §4):
 *   pending → validated → awaiting_approval → approved → paying → paid
 *              ↘ rejected        ↘ rejected        ↘ failed
 *
 * - Toda transición valida: estado actual permitido + datos requeridos.
 * - Cuatro-ojos NO se valida acá: el state machine es sobre la entidad
 *   y no conoce al actor anterior. El caso de uso chequea
 *   `validadaPor !== aprobadaPor` y `aprobadaPor !== pagadaPor`.
 * - El dominio NO toca BD: la persistencia + ledger + audit lo hace el caso de uso.
 * - Append-only por diseño: paid, rejected y failed son terminales.
 *
 * Esta tabla es exhaustiva y testeada. Cualquier transición nueva se agrega
 * acá Y al test (no se permite código de transición sin cobertura).
 */

import type { Retiro } from "./entities";
import type { UserId } from "./ids";
import { type ErrorNegocio, errorNegocio, type Result, ok, err } from "./result";

export const ESTADOS_RETIRO = [
  "pending",
  "validated",
  "awaiting_approval",
  "approved",
  "paying",
  "paid",
  "rejected",
  "failed",
] as const;
export type EstadoRetiro = (typeof ESTADOS_RETIRO)[number];

export const ACCIONES_RETIRO = [
  "validar",
  "rechazar",
  "solicitar_aprobacion",
  "aprobar",
  "rechazar_aprobacion",
  "iniciar_pago",
  "completar_pago",
  "fallar_pago",
] as const;
export type AccionRetiro = (typeof ACCIONES_RETIRO)[number];

export const TRANSICIONES_RETIRO: Record<EstadoRetiro, readonly EstadoRetiro[]> = {
  pending: ["validated", "rejected"],
  validated: ["awaiting_approval", "rejected"],
  awaiting_approval: ["approved", "rejected"],
  approved: ["paying"],
  paying: ["paid", "failed"],
  paid: [],
  rejected: [],
  failed: [],
};

export const CODIGOS_ERROR_RETIRO = {
  TRANSICION_INVALIDA: "TRANSICION_INVALIDA",
  CBU_DESTINO_REQUERIDO: "CBU_DESTINO_REQUERIDO",
  TITULAR_DESTINO_REQUERIDO: "TITULAR_DESTINO_REQUERIDO",
  MOTIVO_REQUERIDO: "MOTIVO_REQUERIDO",
  CUATRO_OJOS_APROBACION: "CUATRO_OJOS_APROBACION",
  CUATRO_OJOS_PAGO: "CUATRO_OJOS_PAGO",
} as const;
export type CodigoErrorRetiro =
  (typeof CODIGOS_ERROR_RETIRO)[keyof typeof CODIGOS_ERROR_RETIRO];

export function puedeTransicionar(from: EstadoRetiro, to: EstadoRetiro): boolean {
  return TRANSICIONES_RETIRO[from].includes(to);
}

export interface AplicarAccionData {
  motivo?: string;
}

/**
 * Aplica una acción sobre un retiro. Devuelve un retiro NUEVO con:
 * - estado actualizado
 * - campos del actor actualizados
 * - motivo de rechazo si aplica
 * - version + 1
 * - updatedAt = now
 *
 * Falla con ErrorNegocio si:
 * - La transición no es válida para el estado actual (TRANSICION_INVALIDA)
 * - Faltan datos requeridos por la acción
 *
 * NO muta el retiro original.
 *
 * IMPORTANTE: cuatro-ojos NO se valida acá. El caso de uso debe chequear
 * `retiro.validadaPor !== actor` antes de aprobar, y
 * `retiro.aprobadaPor !== actor` antes de iniciar_pago.
 */
export function aplicarAccion(
  retiro: Retiro,
  accion: AccionRetiro,
  actor: UserId,
  data: AplicarAccionData = {},
  now: Date = new Date(),
): Result<Retiro, ErrorNegocio> {
  const destino = resolverDestino(retiro.estado, accion);

  if (destino === null) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_RETIRO.TRANSICION_INVALIDA,
        `Acción "${accion}" no permitida desde estado "${retiro.estado}".`,
      ),
    );
  }

  if (accion === "validar") {
    if (!retiro.cbuDestino || retiro.cbuDestino.trim() === "") {
      return err(
        errorNegocio(
          CODIGOS_ERROR_RETIRO.CBU_DESTINO_REQUERIDO,
          "El CBU destino es obligatorio para validar un retiro.",
        ),
      );
    }
    if (!retiro.titularDestino || retiro.titularDestino.trim() === "") {
      return err(
        errorNegocio(
          CODIGOS_ERROR_RETIRO.TITULAR_DESTINO_REQUERIDO,
          "El titular destino es obligatorio para validar un retiro.",
        ),
      );
    }
  }

  if (
    (accion === "rechazar" || accion === "rechazar_aprobacion") &&
    (!data.motivo || data.motivo.trim() === "")
  ) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_RETIRO.MOTIVO_REQUERIDO,
        "Para rechazar un retiro hace falta indicar el motivo.",
      ),
    );
  }

  const actualizado: Retiro = {
    ...retiro,
    estado: destino,
    version: retiro.version + 1,
    updatedAt: now,
    ...aplicarEfectosAccion(accion, actor, data),
  };

  return ok(actualizado);
}

function resolverDestino(
  estadoActual: EstadoRetiro,
  accion: AccionRetiro,
): EstadoRetiro | null {
  switch (accion) {
    case "validar":
      return estadoActual === "pending" ? "validated" : null;
    case "rechazar":
      return estadoActual === "pending" ||
        estadoActual === "validated" ||
        estadoActual === "awaiting_approval"
        ? "rejected"
        : null;
    case "solicitar_aprobacion":
      return estadoActual === "validated" ? "awaiting_approval" : null;
    case "aprobar":
      return estadoActual === "awaiting_approval" ? "approved" : null;
    case "rechazar_aprobacion":
      return estadoActual === "awaiting_approval" ? "rejected" : null;
    case "iniciar_pago":
      return estadoActual === "approved" ? "paying" : null;
    case "completar_pago":
      return estadoActual === "paying" ? "paid" : null;
    case "fallar_pago":
      return estadoActual === "paying" ? "failed" : null;
  }
}

function aplicarEfectosAccion(
  accion: AccionRetiro,
  actor: UserId,
  data: AplicarAccionData,
): Partial<Retiro> {
  switch (accion) {
    case "validar":
      return { validadaPor: actor };
    case "rechazar":
      return { rechazadaPor: actor, motivoRechazo: data.motivo ?? null };
    case "solicitar_aprobacion":
      return {};
    case "aprobar":
      return { aprobadaPor: actor };
    case "rechazar_aprobacion":
      return { rechazadaAprobacionPor: actor, motivoRechazo: data.motivo ?? null };
    case "iniciar_pago":
      return { pagadaPor: actor };
    case "completar_pago":
      return {};
    case "fallar_pago":
      return { motivoRechazo: data.motivo ?? null };
  }
}
