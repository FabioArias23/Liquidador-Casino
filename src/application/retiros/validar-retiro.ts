/**
 * Use case: validarRetiro.
 *
 * El operador valida un retiro pendiente. Confirma que el CBU destino
 * pase el checksum oficial (BCRA) y que el titular esté presente.
 *
 * - pending → validated
 * - Si el monto supera `umbralDobleAprobacionCents`, además se aplica
 *   `solicitar_aprobacion` y el retiro termina en `awaiting_approval`.
 *
 * El cuatro-ojos (validadaPor !== aprobadaPor, aprobadaPor !== pagadaPor)
 * NO se valida acá — el caso de uso `aprobarRetiro` y `pagarPremio` se
 * ocupan. Este caso de uso solo valida + (opcionalmente) solicita aprobación.
 *
 * Genera 1 o 2 entradas en audit_log según corresponda.
 */

import { z } from "zod";

import { codigos } from "@/application/errors";
import type {
  AuditRepository,
  MemberRepository,
  RetiroRepository,
} from "@/application/ports/repositories";
import type { Retiro } from "@/domain/entities";
import { normalizarCBU } from "@/domain/cbu";
import type { TenantId, UserId } from "@/domain/ids";
import { aplicarAccion } from "@/domain/retiros";
import { tienePermiso } from "@/domain/roles";
import { err, errorNegocio, ok, type ErrorNegocio, type Result } from "@/domain/result";

export const validarRetiroInputSchema = z.object({
  tenantId: z.string().uuid(),
  retiroId: z.string().trim().min(1, "Falta id del retiro."),
  umbralDobleAprobacionCents: z.number().int().nonnegative(),
});

export type ValidarRetiroInput = z.input<typeof validarRetiroInputSchema>;

export interface ValidarRetiroDeps {
  retiros: RetiroRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function validarRetiro(
  deps: ValidarRetiroDeps,
  actorId: UserId,
  rawInput: ValidarRetiroInput,
): Promise<Result<Retiro, ErrorNegocio>> {
  const parsed = validarRetiroInputSchema.safeParse(rawInput);
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
        `El rol "${member.rol}" no puede validar retiros.`,
      ),
    );
  }

  // 3. CBU destino debe pasar el checksum oficial (BCRA).
  if (!normalizarCBU(retiroActual.cbuDestino)) {
    return err(
      errorNegocio(
        codigos.CBU_INVALIDO,
        "El CBU destino no pasa el checksum oficial (BCRA). Verificá los 22 dígitos.",
      ),
    );
  }

  // 4. Aplicar la transición `validar` (pending → validated).
  const resultado = aplicarAccion(retiroActual, "validar", actorId);
  if (!resultado.ok) return resultado;
  let retiroTrabajo = resultado.data;

  // 5. Persistir la validación con optimistic lock.
  const persistido1 = await deps.retiros.actualizar(
    retiroTrabajo,
    retiroActual.version,
  );
  if (!persistido1.ok) return persistido1;
  retiroTrabajo = persistido1.data;

  // 6. Audit del paso de validación.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.validar",
    entidadTipo: "retiro",
    entidadId: retiroId,
    before: serializarRetiro(retiroActual),
    after: serializarRetiro(retiroTrabajo),
    motivo: null,
    metadata: {},
  });

  // 7. Si supera el umbral, además pedir aprobación (validated → awaiting_approval).
  if (retiroTrabajo.montoCents > input.umbralDobleAprobacionCents) {
    const r2 = aplicarAccion(retiroTrabajo, "solicitar_aprobacion", actorId);
    if (!r2.ok) return r2;
    const persistido2 = await deps.retiros.actualizar(
      r2.data,
      retiroTrabajo.version,
    );
    if (!persistido2.ok) return persistido2;

    await deps.audit.append({
      tenantId,
      actorId,
      accion: "retiro.solicitar_aprobacion",
      entidadTipo: "retiro",
      entidadId: retiroId,
      before: serializarRetiro(retiroTrabajo),
      after: serializarRetiro(persistido2.data),
      motivo: null,
      metadata: { montoCents: retiroTrabajo.montoCents, umbral: input.umbralDobleAprobacionCents },
    });

    return ok(persistido2.data);
  }

  return ok(retiroTrabajo);
}

function serializarRetiro(r: Retiro): Record<string, unknown> {
  return {
    id: r.id,
    estado: r.estado,
    montoCents: r.montoCents,
    playerRef: r.playerRef,
    cbuDestino: r.cbuDestino,
    titularDestino: r.titularDestino,
    validadaPor: r.validadaPor,
    version: r.version,
  };
}
