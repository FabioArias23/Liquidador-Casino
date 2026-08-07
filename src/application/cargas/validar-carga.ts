/**
 * Use case: validarCarga.
 *
 * Operador valida una carga con comprobante.
 * - pending → validating → validated (en una transición lógica: aplicamos
 *   `iniciar_validacion` y después `validar`).
 * - validating → validated (continuar validación).
 *
 * En ambos casos la carga termina en `validated` con `validadaPor` y `comprobanteUrl`.
 * Genera 1 entrada en audit_log (validación).
 */

import { z } from "zod";

import { errorNegocio, err, ok, type ErrorNegocio, type Result } from "@/domain/result";
import type { Carga } from "@/domain/entities";
import type { CargaId, TenantId, UserId } from "@/domain/ids";
import { aplicarAccion, type EstadoCarga } from "@/domain/cargas";
import { codigos } from "@/application/errors";
import { tienePermiso } from "@/domain/roles";
import type {
  AuditRepository,
  CargaRepository,
  MemberRepository,
  ProfileRepository,
} from "@/application/ports/repositories";

import { serializarCarga } from "./registrar-carga-manual";

export const validarCargaInputSchema = z.object({
  tenantId: z.string().uuid(),
  cargaId: z.string().uuid(),
  comprobanteUrl: z.string().trim().min(1, "Falta URL del comprobante."),
});

export type ValidarCargaInput = z.input<typeof validarCargaInputSchema>;

export interface ValidarCargaDeps {
  cargas: CargaRepository;
  audit: AuditRepository;
  profiles: ProfileRepository;
  members: MemberRepository;
}

/**
 * Valida una carga. Si está en `pending`, primero la pasa a `validating`
 * y después a `validated` (transición lógica en 2 pasos).
 * Si está en `validating`, va directo a `validated`.
 */
export async function validarCarga(
  deps: ValidarCargaDeps,
  actorId: UserId,
  rawInput: ValidarCargaInput,
): Promise<Result<Carga, ErrorNegocio>> {
  const parsed = validarCargaInputSchema.safeParse(rawInput);
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

  // 1. Carga debe existir en el tenant.
  const cargaActual = await deps.cargas.obtenerPorId(tenantId, cargaId);
  if (!cargaActual) {
    return err(errorNegocio(codigos.CARGA_NO_ENCONTRADA, "Carga no encontrada."));
  }

  // 2. Permisos.
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
        `El rol "${member.rol}" no puede validar cargas.`,
      ),
    );
  }

  // 3. Transición al estado validated (puede requerir 1 o 2 pasos según estado actual).
  const transicionada = await llevarAValidating(deps, cargaActual, actorId);
  if (!transicionada.ok) return transicionada;
  let cargaTrabajo = transicionada.data;

  const resultado = aplicarAccion(
    cargaTrabajo,
    "validar",
    actorId,
    { comprobanteUrl: input.comprobanteUrl },
  );
  if (!resultado.ok) return resultado;
  cargaTrabajo = resultado.data;

  // 4. Persistir con optimistic lock.
  const actualizada = await deps.cargas.actualizar(
    cargaTrabajo,
    cargaTrabajo.version - 1,
  );
  if (!actualizada.ok) return actualizada;

  // 5. Audit log.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "carga.validar",
    entidadTipo: "carga",
    entidadId: cargaId,
    before: serializarCarga(cargaActual),
    after: serializarCarga(actualizada.data),
    motivo: null,
    metadata: {},
  });

  return actualizada;
}

/**
 * Si la carga está en `pending`, primero aplicamos `iniciar_validacion`
 * (la pasa a `validating`). Si ya está en `validating`, no hacemos nada.
 * Si está en otro estado, dejamos que `validar` falle.
 */
async function llevarAValidating(
  deps: ValidarCargaDeps,
  carga: Carga,
  actorId: UserId,
): Promise<Result<Carga, ErrorNegocio>> {
  if (carga.estado !== ("pending" as EstadoCarga)) {
    return ok(carga);
  }

  const r1 = aplicarAccion(carga, "iniciar_validacion", actorId);
  if (!r1.ok) return r1;

  const persistida = await deps.cargas.actualizar(r1.data, carga.version);
  if (!persistida.ok) return persistida;

  // Audit del paso intermedio.
  await deps.audit.append({
    tenantId: carga.tenantId,
    actorId,
    accion: "carga.iniciar_validacion",
    entidadTipo: "carga",
    entidadId: carga.id,
    before: serializarCarga(carga),
    after: serializarCarga(persistida.data),
    motivo: null,
    metadata: {},
  });

  return persistida;
}