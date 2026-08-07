/**
 * Use case: registrarCargaDesdeCasino.
 *
 * El sistema (vía polling del CasinoAdapter) trae una carga del casino
 * y la persiste como carga del sistema.
 *
 * - Origen: api_casino.
 * - Estado inicial: validated (el casino ya validó; el operador solo
 *   asienta o rechaza si no coincide).
 * - Idempotente: si ya existe una carga con (tenantId, externalRef),
 *   no se crea duplicado y se devuelve la existente.
 *
 * Esta función la invoca el script de polling, NO un operador.
 */

import type { Carga } from "@/domain/entities";
import type { TenantId } from "@/domain/ids";
import { cargaId, nuevoId } from "@/domain/ids";
import { esEntero } from "@/domain/money";
import { errorNegocio, err, ok, type ErrorNegocio, type Result } from "@/domain/result";
import type { CargaExterna } from "@/application/ports/casino";
import type {
  AuditRepository,
  CargaRepository,
} from "@/application/ports/repositories";

import { serializarCarga } from "./registrar-carga-manual";

export interface RegistrarCargaDesdeCasinoDeps {
  cargas: CargaRepository;
  audit: AuditRepository;
}

/** UserId "sistema" usado como registradaPor cuando la carga viene del casino. */
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000099" as never;

export async function registrarCargaDesdeCasino(
  deps: RegistrarCargaDesdeCasinoDeps,
  tenantId: TenantId,
  externa: CargaExterna,
): Promise<Result<Carga, ErrorNegocio>> {
  // 0. Validar input mínimo.
  if (!externa.externalRef || !externa.playerRef) {
    return err(
      errorNegocio(
        "INPUT_INVALIDO",
        "externalRef y playerRef son obligatorios.",
      ),
    );
  }
  if (!esEntero(externa.montoCents) || externa.montoCents <= 0) {
    return err(
      errorNegocio(
        "INPUT_INVALIDO",
        "montoCents debe ser entero positivo.",
      ),
    );
  }

  // 1. Idempotencia: si ya existe, devolverla tal cual.
  const existente = await deps.cargas.obtenerPorTenantYExternalRef(
    tenantId,
    externa.externalRef,
  );
  if (existente) {
    return ok(existente);
  }

  // 2. Construir carga en estado validated (casino ya validó).
  const now = new Date();
  const carga: Carga = {
    id: cargaId(nuevoId()),
    tenantId,
    playerRef: externa.playerRef,
    montoCents: externa.montoCents,
    moneda: externa.moneda || "ARS",
    metodo: externa.metodo,
    origen: "api_casino",
    estado: "validated",
    externalRef: externa.externalRef,
    comprobanteUrl: externa.comprobanteUrl ?? null,
    motivoRechazo: null,
    registradaPor: SYSTEM_USER_ID,
    validadaPor: SYSTEM_USER_ID,
    rechazadaPor: null,
    asentadaPor: null,
    version: 1,
    createdAt: externa.timestamp ?? now,
    updatedAt: now,
  };

  await deps.cargas.crear(carga);

  await deps.audit.append({
    tenantId,
    actorId: SYSTEM_USER_ID,
    accion: "carga.crear_desde_casino",
    entidadTipo: "carga",
    entidadId: carga.id,
    before: null,
    after: serializarCarga(carga),
    motivo: null,
    metadata: { externalRef: externa.externalRef },
  });

  return ok(carga);
}