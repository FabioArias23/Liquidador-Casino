/**
 * Use case: rechazarCarga.
 *
 * Operador rechaza una carga con motivo (append-only: el motivo queda en la carga
 * y en audit_log).
 * Transiciones válidas: pending | validating | validated → rejected.
 *
 * Solo se puede rechazar antes de settled (terminal).
 */

import { z } from "zod";

import { errorNegocio, err, type ErrorNegocio, type Result } from "@/domain/result";
import type { Carga } from "@/domain/entities";
import type { CargaId, TenantId, UserId } from "@/domain/ids";
import { aplicarAccion } from "@/domain/cargas";
import { codigos } from "@/application/errors";
import { tienePermiso } from "@/domain/roles";
import type {
  AuditRepository,
  CargaRepository,
  MemberRepository,
} from "@/application/ports/repositories";

import { serializarCarga } from "./registrar-carga-manual";

export const rechazarCargaInputSchema = z.object({
  tenantId: z.string().uuid(),
  cargaId: z.string().uuid(),
  motivo: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres."),
});

export type RechazarCargaInput = z.input<typeof rechazarCargaInputSchema>;

export interface RechazarCargaDeps {
  cargas: CargaRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function rechazarCarga(
  deps: RechazarCargaDeps,
  actorId: UserId,
  rawInput: RechazarCargaInput,
): Promise<Result<Carga, ErrorNegocio>> {
  const parsed = rechazarCargaInputSchema.safeParse(rawInput);
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
    // Validar incluye la facultad de rechazar (la validación es el filtro).
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        `El rol "${member.rol}" no puede rechazar cargas.`,
      ),
    );
  }

  const resultado = aplicarAccion(cargaActual, "rechazar", actorId, {
    motivo: input.motivo,
  });
  if (!resultado.ok) return resultado;

  const actualizada = await deps.cargas.actualizar(
    resultado.data,
    cargaActual.version,
  );
  if (!actualizada.ok) return actualizada;

  await deps.audit.append({
    tenantId,
    actorId,
    accion: "carga.rechazar",
    entidadTipo: "carga",
    entidadId: cargaId,
    before: serializarCarga(cargaActual),
    after: serializarCarga(actualizada.data),
    motivo: input.motivo,
    metadata: {},
  });

  return actualizada;
}