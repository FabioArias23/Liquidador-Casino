/**
 * Use case: aprobarRetiro.
 *
 * Un supervisor (o tenant_admin) aprueba un retiro que está en
 * `awaiting_approval`. Esto es la **doble aprobación / cuatro-ojos**:
 * el actor que aprueba NO puede ser el mismo que validó.
 *
 * - awaiting_approval → approved.
 * - Cuatro-ojos: si `retiro.validadaPor === actorId`, falla con
 *   `CUATRO_OJOS_APROBACION`. La defensa real está en BD (CHECK
 *   `aprobado_por <> validada_por` cuando migremos a Drizzle).
 * - Permiso: requiere `retiros.aprobar` (supervisor o tenant_admin).
 *
 * La acción "rechazar la aprobación" está en `rechazarAprobacionRetiro`.
 */

import { z } from "zod";

import { codigos } from "@/application/errors";
import type {
  AuditRepository,
  MemberRepository,
  RetiroRepository,
} from "@/application/ports/repositories";
import type { Retiro } from "@/domain/entities";
import { CODIGOS_ERROR_RETIRO, aplicarAccion } from "@/domain/retiros";
import type { TenantId, UserId } from "@/domain/ids";
import { tienePermiso } from "@/domain/roles";
import { err, errorNegocio, ok, type ErrorNegocio, type Result } from "@/domain/result";

export const aprobarRetiroInputSchema = z.object({
  tenantId: z.string().uuid(),
  retiroId: z.string().trim().min(1, "Falta id del retiro."),
});

export type AprobarRetiroInput = z.input<typeof aprobarRetiroInputSchema>;

export interface AprobarRetiroDeps {
  retiros: RetiroRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function aprobarRetiro(
  deps: AprobarRetiroDeps,
  actorId: UserId,
  rawInput: AprobarRetiroInput,
): Promise<Result<Retiro, ErrorNegocio>> {
  const parsed = aprobarRetiroInputSchema.safeParse(rawInput);
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
  const retiroId = input.retiroId;

  // 1. El retiro debe existir en el tenant.
  const retiroActual = await deps.retiros.obtenerPorId(tenantId, retiroId);
  if (!retiroActual) {
    return err(
      errorNegocio(codigos.RETIRO_NO_ENCONTRADO, "Retiro no encontrado."),
    );
  }

  // 2. Permisos: miembro activo del tenant con `retiros.aprobar`.
  const member = await deps.members.obtenerPorUsuarioYTenant(tenantId, actorId);
  if (!member || member.estado !== "activo") {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        "El actor no es miembro activo del tenant.",
      ),
    );
  }
  if (!tienePermiso(member.rol, "retiros.aprobar")) {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        `El rol "${member.rol}" no puede aprobar retiros.`,
      ),
    );
  }

  // 3. Cuatro-ojos: el aprobador NO puede ser quien validó.
  if (retiroActual.validadaPor && retiroActual.validadaPor === actorId) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_RETIRO.CUATRO_OJOS_APROBACION,
        "Cuatro-ojos: el aprobador no puede ser la misma persona que validó el retiro.",
      ),
    );
  }

  // 4. Aplicar la transición `aprobar` (awaiting_approval → approved).
  const resultado = aplicarAccion(retiroActual, "aprobar", actorId);
  if (!resultado.ok) return resultado;

  // 5. Persistir con optimistic lock.
  const persistido = await deps.retiros.actualizar(
    resultado.data,
    retiroActual.version,
  );
  if (!persistido.ok) return persistido;

  // 6. Audit log.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.aprobar",
    entidadTipo: "retiro",
    entidadId: retiroId,
    before: serializarRetiro(retiroActual),
    after: serializarRetiro(persistido.data),
    motivo: null,
    metadata: { validadaPor: retiroActual.validadaPor, aprobadaPor: actorId },
  });

  return ok(persistido.data);
}

function serializarRetiro(r: Retiro): Record<string, unknown> {
  return {
    id: r.id,
    estado: r.estado,
    montoCents: r.montoCents,
    validadaPor: r.validadaPor,
    aprobadaPor: r.aprobadaPor,
    version: r.version,
  };
}
