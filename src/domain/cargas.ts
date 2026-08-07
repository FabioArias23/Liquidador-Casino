/**
 * State machine de Carga (pura, sin frameworks).
 *
 * Reglas (ver PLAN-TECNICO.md §4):
 * - Toda transición valida: estado actual permitido + actor correcto + tenant correcto.
 * - El dominio NO toca BD: la persistencia + ledger + audit lo hace el caso de uso.
 * - Append-only por diseño: settled y rejected son terminales (no se sale).
 *
 * Esta tabla es exhaustiva y testeada. Cualquier transición nueva se agrega
 * acá Y al test (no se permite código de transición sin cobertura).
 */

import type { Carga } from "./entities";
import type { UserId } from "./ids";
import { type ErrorNegocio, errorNegocio, type Result, ok, err } from "./result";

export const ESTADOS_CARGA = [
  "pending",
  "validating",
  "validated",
  "settled",
  "rejected",
] as const;
export type EstadoCarga = (typeof ESTADOS_CARGA)[number];

export const ORIGENES_CARGA = ["manual", "api_casino"] as const;
export type OrigenCarga = (typeof ORIGENES_CARGA)[number];

export const ACCIONES_CARGA = [
  "iniciar_validacion",
  "validar",
  "rechazar",
  "asentar",
] as const;
export type AccionCarga = (typeof ACCIONES_CARGA)[number];

/**
 * Tabla de transiciones válidas.
 * Cada estado tiene la lista de estados a los que puede ir.
 * Terminales (settled, rejected) tienen lista vacía.
 */
export const TRANSICIONES_CARGA: Record<EstadoCarga, readonly EstadoCarga[]> = {
  pending: ["validating", "rejected"],
  validating: ["validated", "rejected"],
  validated: ["settled"],
  settled: [],
  rejected: [],
};

/**
 * Códigos de error del dominio de Carga.
 * Re-exportados desde application/errors.ts para type-safety en la UI.
 */
export const CODIGOS_ERROR_CARGA = {
  TRANSICION_INVALIDA: "TRANSICION_INVALIDA",
  COMPROBANTE_REQUERIDO: "COMPROBANTE_REQUERIDO",
  MOTIVO_REQUERIDO: "MOTIVO_REQUERIDO",
} as const;
export type CodigoErrorCarga =
  (typeof CODIGOS_ERROR_CARGA)[keyof typeof CODIGOS_ERROR_CARGA];

/** ¿La transición from → to es válida según la tabla? */
export function puedeTransicionar(from: EstadoCarga, to: EstadoCarga): boolean {
  return TRANSICIONES_CARGA[from].includes(to);
}

/** Data opcional que algunas acciones requieren (ej: validar pide comprobante). */
export interface AplicarAccionData {
  /** URL del comprobante. Requerido para `validar`. */
  comprobanteUrl?: string;
  /** Motivo del rechazo. Requerido para `rechazar`. */
  motivo?: string;
}

/**
 * Aplica una acción sobre una carga, devolviendo una carga nueva con:
 * - estado actualizado
 * - campos del actor actualizados (validadaPor / rechazadaPor / asentadaPor)
 * - campos de la acción aplicados (comprobanteUrl / motivoRechazo)
 * - version + 1
 * - updatedAt = now
 *
 * Falla con ErrorNegocio si:
 * - La transición no es válida para el estado actual (TRANSICION_INVALIDA)
 * - Faltan datos requeridos (COMPROBANTE_REQUERIDO / MOTIVO_REQUERIDO)
 *
 * NO muta la carga original.
 */
export function aplicarAccion(
  carga: Carga,
  accion: AccionCarga,
  actor: UserId,
  data: AplicarAccionData = {},
  now: Date = new Date(),
): Result<Carga, ErrorNegocio> {
  const destino = resolverDestino(carga.estado, accion);

  if (destino === null) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_CARGA.TRANSICION_INVALIDA,
        `Acción "${accion}" no permitida desde estado "${carga.estado}".`,
      ),
    );
  }

  // Validaciones de input por acción.
  if (accion === "validar" && (!data.comprobanteUrl || data.comprobanteUrl.trim() === "")) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_CARGA.COMPROBANTE_REQUERIDO,
        "Para validar una carga hace falta subir el comprobante.",
      ),
    );
  }

  if (accion === "rechazar" && (!data.motivo || data.motivo.trim() === "")) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_CARGA.MOTIVO_REQUERIDO,
        "Para rechazar una carga hace falta indicar el motivo.",
      ),
    );
  }

  // Construye la carga nueva.
  const actualizada: Carga = {
    ...carga,
    estado: destino,
    version: carga.version + 1,
    updatedAt: now,
    ...aplicarEfectosAccion(accion, actor, data),
  };

  return ok(actualizada);
}

/**
 * Resuelve a qué estado debe ir una carga según la acción.
 * Devuelve null si la acción no es válida para el estado actual.
 *
 * Reglas:
 * - iniciar_validacion: pending → validating
 * - validar: validating → validated
 * - rechazar: pending|validating → rejected
 * - asentar: validated → settled
 */
function resolverDestino(
  estadoActual: EstadoCarga,
  accion: AccionCarga,
): EstadoCarga | null {
  if (!puedeTransicionar(estadoActual, "validating") && accion === "iniciar_validacion") {
    return estadoActual === "pending" ? "validating" : null;
  }

  switch (accion) {
    case "iniciar_validacion":
      return estadoActual === "pending" ? "validating" : null;
    case "validar":
      return estadoActual === "validating" ? "validated" : null;
    case "rechazar":
      return estadoActual === "pending" || estadoActual === "validating"
        ? "rejected"
        : null;
    case "asentar":
      return estadoActual === "validated" ? "settled" : null;
  }
}

/**
 * Devuelve los efectos colaterales de una acción: actualizar campos del actor
 * y los datos provistos.
 */
function aplicarEfectosAccion(
  accion: AccionCarga,
  actor: UserId,
  data: AplicarAccionData,
): Partial<Carga> {
  switch (accion) {
    case "iniciar_validacion":
      return {};
    case "validar":
      return {
        validadaPor: actor,
        comprobanteUrl: data.comprobanteUrl ?? null,
      };
    case "rechazar":
      return {
        rechazadaPor: actor,
        motivoRechazo: data.motivo ?? null,
      };
    case "asentar":
      return {
        asentadaPor: actor,
      };
  }
}