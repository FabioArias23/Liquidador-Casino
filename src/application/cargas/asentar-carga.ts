/**
 * Use case: asentarCarga.
 *
 * Pasa una carga de `validated` a `settled` y genera el asiento contable
 * (2 entries en ledger con partida doble, Σ débitos = Σ créditos).
 *
 * Si la generación del asiento falla (no debería, el dominio ya lo validó),
 * la carga NO se modifica.
 */

import { z } from "zod";

import { errorNegocio, err, type ErrorNegocio, type Result } from "@/domain/result";
import type { Carga, LedgerEntry } from "@/domain/entities";
import type { CargaId, TenantId, UserId } from "@/domain/ids";
import { aplicarAccion } from "@/domain/cargas";
import { generarAsientoCargaValidada } from "@/domain/ledger";
import { ledgerEntryId } from "@/domain/ids";
import { codigos } from "@/application/errors";
import { tienePermiso } from "@/domain/roles";
import type {
  AuditRepository,
  CargaRepository,
  LedgerRepository,
  MemberRepository,
} from "@/application/ports/repositories";

import { serializarCarga } from "./registrar-carga-manual";

export const asentarCargaInputSchema = z.object({
  tenantId: z.string().uuid(),
  cargaId: z.string().uuid(),
});

export type AsentarCargaInput = z.input<typeof asentarCargaInputSchema>;

export interface AsentarCargaDeps {
  cargas: CargaRepository;
  ledger: LedgerRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function asentarCarga(
  deps: AsentarCargaDeps,
  actorId: UserId,
  rawInput: AsentarCargaInput,
): Promise<Result<Carga, ErrorNegocio>> {
  const parsed = asentarCargaInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      errorNegocio(
        codigos.INPUT_INVALIDO,
        parsed.error.issues[0]?.message ?? "Input inválido.",
      ),
    );
  }
  const input = parsed.data;
  const tenantId = input.tenantId as TenantId;
  const cargaId = input.cargaId as CargaId;

  const cargaActual = await deps.cargas.obtenerPorId(tenantId, cargaId);
  if (!cargaActual) {
    return err(errorNegocio(codigos.CARGA_NO_ENCONTRADA, "Carga no encontrada."));
  }

  const member = await deps.members.obtenerPorUsuarioYTenant(tenantId, actorId);
  if (!member || member.estado !== "activo") {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        "El actor no es miembro activo del tenant.",
      ),
    );
  }
  if (!tienePermiso(member.rol, "cargas.validar")) {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        `El rol "${member.rol}" no puede asentar cargas.`,
      ),
    );
  }

  // 1. Generar asiento contable desde la carga VALIDATED (antes de transicionar).
  // El asiento representa el movimiento económico "la carga fue validada y entra al casino";
  // una vez asentada (settled), el asiento ya está persistido y no se regenera.
  const rAsiento = generarAsientoCargaValidada(cargaActual);
  if (!rAsiento.ok) return rAsiento;
  const asiento = rAsiento.data;

  // 2. State machine: validated → settled.
  const r1 = aplicarAccion(cargaActual, "asentar", actorId);
  if (!r1.ok) return r1;

  // 3. Persistir la carga con optimistic lock.
  const actualizada = await deps.cargas.actualizar(r1.data, cargaActual.version);
  if (!actualizada.ok) {
    if (process.env.DEBUG_CARGAS) process.stderr.write(`\n[DEBUG asentar] actualizar FAIL: ${actualizada.error.codigo} ${actualizada.error.mensaje} cargaActual.version=${cargaActual.version}\n`);
    return actualizada;
  }

  // 4. Persistir las 2 entries del asiento (atómicas en repo).
  const entries: [LedgerEntry, LedgerEntry] = [
    materializarEntry(asiento.asientoId, tenantId, "carga", cargaId, asiento.movimientos[0]),
    materializarEntry(asiento.asientoId, tenantId, "carga", cargaId, asiento.movimientos[1]),
  ];
  await deps.ledger.append(entries);

  // 5. Audit log.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "carga.asentar",
    entidadTipo: "carga",
    entidadId: cargaId,
    before: serializarCarga(cargaActual),
    after: serializarCarga(actualizada.data),
    motivo: null,
    metadata: { asientoId: asiento.asientoId },
  });

  return actualizada;
}

/**
 * Convierte un MovimientoContable (del dominio) en una LedgerEntry
 * (entidad persistible). El dominio genera el asiento; el caso de uso
 * materializa cada entry con id + timestamp + tenantId + operacion.
 */
function materializarEntry(
  asientoId: string,
  tenantId: TenantId,
  operacionTipo: string,
  operacionId: string,
  mov: { cuenta: string; tipo: "debito" | "credito"; montoCents: number },
  now: Date = new Date(),
): LedgerEntry {
  return {
    id: ledgerEntryId(crypto.randomUUID()),
    tenantId,
    operacionTipo,
    operacionId,
    cuenta: mov.cuenta,
    tipo: mov.tipo,
    montoCents: mov.montoCents,
    moneda: "ARS", // v1: asumimos la moneda del tenant; leer del tenant cuando haya config real
    descripcion: "",
    asientoId,
    createdAt: now,
  };
}