/**
 * Use case: rechazarRetiro.
 *
 * Un operador, supervisor o tenant_admin rechaza un retiro que está en
 * `pending`, `validated` o `awaiting_approval`. El rechazo es terminal:
 * el retiro queda en `rejected` y no se puede reversar.
 *
 * - pending → rejected
 * - validated → rejected
 * - awaiting_approval → rejected (equivalente a "rechazar la aprobación")
 *
 * El motivo es OBLIGATORIO (lo exige el state machine: `MOTIVO_REQUERIDO`).
 *
 * Permisos: cualquier miembro activo del tenant con `retiros.validar`
 * (operador, supervisor, tenant_admin). Ver roles.ts.
 *
 * Genera 1 entrada en audit_log con accion `retiro.rechazar` y el motivo.
 */

import { z } from "zod";

import { codigos } from "@/application/errors";
import type {
  AuditRepository,
  MemberRepository,
  RetiroRepository,
} from "@/application/ports/repositories";
import type { Retiro } from "@/domain/entities";
import type { TenantId, UserId } from "@/domain/ids";
import { aplicarAccion } from "@/domain/retiros";
import { tienePermiso } from "@/domain/roles";
import { err, errorNegocio, ok, type ErrorNegocio, type Result } from "@/domain/result";

export const rechazarRetiroInputSchema = z.object({
  tenantId: z.string().uuid(),
  retiroId: z.string().trim().min(1, "Falta id del retiro."),
  motivo: z.string(), // vacío lo rechaza el state machine con MOTIVO_REQUERIDO
});

export type RechazarRetiroInput = z.input<typeof rechazarRetiroInputSchema>;

export interface RechazarRetiroDeps {
  retiros: RetiroRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function rechazarRetiro(
  deps: RechazarRetiroDeps,
  actorId: UserId,
  rawInput: RechazarRetiroInput,
): Promise<Result<Retiro, ErrorNegocio>> {
  const parsed = rechazarRetiroInputSchema.safeParse(rawInput);
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

  // 2. Permisos: miembro activo del tenant con `retiros.validar`.
  const member = await deps.members.obtenerPorUsuarioYTenant(tenantId, actorId);
  if (!member || member.estado !== "activo") {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        "El actor no es miembro activo del tenant.",
      ),
    );
  }
  if (!tienePermiso(member.rol, "retiros.validar")) {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        `El rol "${member.rol}" no puede rechazar retiros.`,
      ),
    );
  }

  // 3. Aplicar la transición `rechazar` (pending|validated|awaiting_approval → rejected).
  // El state machine ya valida que el motivo no esté vacío (MOTIVO_REQUERIDO).
  const resultado = aplicarAccion(retiroActual, "rechazar", actorId, {
    motivo: input.motivo,
  });
  if (!resultado.ok) return resultado;

  // 4. Persistir con optimistic lock.
  const persistido = await deps.retiros.actualizar(
    resultado.data,
    retiroActual.version,
  );
  if (!persistido.ok) return persistido;

  // 5. Audit log.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.rechazar",
    entidadTipo: "retiro",
    entidadId: retiroId,
    before: serializarRetiro(retiroActual),
    after: serializarRetiro(persistido.data),
    motivo: input.motivo,
    metadata: {},
  });

  return ok(persistido.data);
}

function serializarRetiro(r: Retiro): Record<string, unknown> {
  return {
    id: r.id,
    estado: r.estado,
    montoCents: r.montoCents,
    rechazadaPor: r.rechazadaPor,
    motivoRechazo: r.motivoRechazo,
    version: r.version,
  };
}
