/**
 * Use case: pagarPremio.
 *
 * Un operador (o supervisor/tenant_admin) ejecuta el pago de un retiro
 * que está en `approved`. El pago es **manual** en v1: el operador
 * transfiere por home banking y carga el comprobante.
 *
 * - approved → paying → paid.
 * - Cuatro-ojos: el pagador NO puede ser quien aprobó.
 * - Idempotencia: si llaman con la misma `idempotencyKey` y el retiro ya
 *   está en `paid` con esa key, devuelve el resultado anterior sin error.
 * - Permiso: cualquier miembro activo del tenant (operador, supervisor,
 *   tenant_admin) puede ejecutar el pago.
 *
 * El Pago queda embebido en el Retiro (campos `pagadaPor`, `comprobanteUrl`,
 * `idempotencyKey`, `estado=paid`). En el refactor a Drizzle se separará en
 * tabla `pagos` con CHECK `aprobado_por <> pagado_por` (ver PLAN-TECNICO §3).
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

export const pagarPremioInputSchema = z.object({
  tenantId: z.string().uuid(),
  retiroId: z.string().trim().min(1, "Falta id del retiro."),
  comprobanteUrl: z.string().trim().min(1, "Falta URL del comprobante."),
  idempotencyKey: z.string().trim().min(1, "Falta clave de idempotencia."),
});

export type PagarPremioInput = z.input<typeof pagarPremioInputSchema>;

export interface PagarPremioDeps {
  retiros: RetiroRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function pagarPremio(
  deps: PagarPremioDeps,
  actorId: UserId,
  rawInput: PagarPremioInput,
): Promise<Result<Retiro, ErrorNegocio>> {
  const parsed = pagarPremioInputSchema.safeParse(rawInput);
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

  // 2. Idempotencia: si ya está paid con esta misma key, devolvemos el mismo
  // resultado sin error. Esto cubre reintentos del operador (doble click, red).
  if (
    retiroActual.estado === "paid" &&
    retiroActual.idempotencyKey === input.idempotencyKey
  ) {
    return ok(retiroActual);
  }

  // 3. Permisos: miembro activo del tenant con `retiros.validar` (los 3 roles
  // operativos tienen este permiso, ver domain/roles.ts).
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
        `El rol "${member.rol}" no puede ejecutar pagos.`,
      ),
    );
  }

  // 4. Cuatro-ojos: el pagador NO puede ser quien aprobó.
  if (retiroActual.aprobadaPor && retiroActual.aprobadaPor === actorId) {
    return err(
      errorNegocio(
        CODIGOS_ERROR_RETIRO.CUATRO_OJOS_PAGO,
        "Cuatro-ojos: el pagador no puede ser la misma persona que aprobó el retiro.",
      ),
    );
  }

  // 5. Transición: approved → paying.
  const r1 = aplicarAccion(retiroActual, "iniciar_pago", actorId);
  if (!r1.ok) return r1;
  const p1 = await deps.retiros.actualizar(r1.data, retiroActual.version);
  if (!p1.ok) return p1;

  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.iniciar_pago",
    entidadTipo: "retiro",
    entidadId: retiroId,
    before: serializarRetiro(retiroActual),
    after: serializarRetiro(p1.data),
    motivo: null,
    metadata: { comprobanteUrl: input.comprobanteUrl, idempotencyKey: input.idempotencyKey },
  });

  // 6. Transición: paying → paid, seteando comprobanteUrl + idempotencyKey.
  const retiroConPago: Retiro = {
    ...p1.data,
    comprobanteUrl: input.comprobanteUrl,
    idempotencyKey: input.idempotencyKey,
  };
  const r2 = aplicarAccion(retiroConPago, "completar_pago", actorId);
  if (!r2.ok) return r2;
  const p2 = await deps.retiros.actualizar(r2.data, p1.data.version);
  if (!p2.ok) return p2;

  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.completar_pago",
    entidadTipo: "retiro",
    entidadId: retiroId,
    before: serializarRetiro(p1.data),
    after: serializarRetiro(p2.data),
    motivo: null,
    metadata: { comprobanteUrl: input.comprobanteUrl, idempotencyKey: input.idempotencyKey },
  });

  return ok(p2.data);
}

function serializarRetiro(r: Retiro): Record<string, unknown> {
  return {
    id: r.id,
    estado: r.estado,
    montoCents: r.montoCents,
    pagadaPor: r.pagadaPor,
    comprobanteUrl: r.comprobanteUrl,
    idempotencyKey: r.idempotencyKey,
    version: r.version,
  };
}
