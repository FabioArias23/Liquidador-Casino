/**
 * Use case: registrarCargaManual.
 *
 * El operador registra una carga del jugador con comprobante.
 * Estado inicial: pending.
 * Origen: manual.
 *
 * Permisos: operador, supervisor o tenant_admin (todos pueden registrar).
 */

import { z } from "zod";

import { errorNegocio, err, ok, type ErrorNegocio, type Result } from "@/domain/result";
import type { Carga } from "@/domain/entities";
import type { TenantId, UserId } from "@/domain/ids";
import { cargaId, nuevoId } from "@/domain/ids";
import { esEntero } from "@/domain/money";
import { codigos } from "@/application/errors";
import { tienePermiso } from "@/domain/roles";
import type {
  AuditRepository,
  CargaRepository,
  MemberRepository,
  ProfileRepository,
} from "@/application/ports/repositories";

export const registrarCargaManualInputSchema = z.object({
  tenantId: z.string().uuid(),
  playerRef: z.string().trim().min(1, "Falta player_ref del jugador."),
  montoCents: z.number().int().positive(),
  moneda: z.string().trim().length(3).default("ARS"),
  metodo: z.string().trim().min(1),
  comprobanteUrl: z.string().trim().min(1, "Falta URL del comprobante."),
});

export type RegistrarCargaManualInput = z.input<
  typeof registrarCargaManualInputSchema
>;

export interface RegistrarCargaManualDeps {
  cargas: CargaRepository;
  audit: AuditRepository;
  profiles: ProfileRepository;
  members: MemberRepository;
}

export async function registrarCargaManual(
  deps: RegistrarCargaManualDeps,
  actorId: UserId,
  rawInput: RegistrarCargaManualInput,
): Promise<Result<Carga, ErrorNegocio>> {
  // 1. Validar input con Zod.
  const parsed = registrarCargaManualInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return err(
      errorNegocio(
        codigos.INPUT_INVALIDO,
        parsed.error.issues[0]?.message ?? "Input inválido.",
      ),
    );
  }
  const input = parsed.data;

  if (!esEntero(input.montoCents) || input.montoCents <= 0) {
    return err(
      errorNegocio(
        codigos.INPUT_INVALIDO,
        "El monto debe ser un entero positivo.",
      ),
    );
  }

  const tenantId = input.tenantId as TenantId;

  // 2. Actor debe existir.
  const actor = await deps.profiles.obtenerPorId(actorId);
  if (!actor) {
    return err(errorNegocio(codigos.PROFILE_NO_ENCONTRADO, "Actor no encontrado."));
  }

  // 3. Permisos: ser miembro activo del tenant con rol que pueda registrar.
  const member = await deps.members.obtenerPorUsuarioYTenant(tenantId, actorId);
  if (!member || member.estado !== "activo") {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        "El actor no es miembro activo del tenant.",
      ),
    );
  }
  if (!tienePermiso(member.rol, "cargas.registrar")) {
    return err(
      errorNegocio(
        codigos.PERMISO_DENEGADO,
        `El rol "${member.rol}" no puede registrar cargas.`,
      ),
    );
  }

  // 4. Construir carga en estado pending.
  const now = new Date();
  const carga: Carga = {
    id: cargaId(nuevoId()),
    tenantId,
    playerRef: input.playerRef,
    montoCents: input.montoCents,
    moneda: input.moneda,
    metodo: input.metodo,
    origen: "manual",
    estado: "pending",
    externalRef: null,
    comprobanteUrl: input.comprobanteUrl,
    motivoRechazo: null,
    registradaPor: actorId,
    validadaPor: null,
    rechazadaPor: null,
    asentadaPor: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  // 5. Persistir carga.
  await deps.cargas.crear(carga);

  // 6. Audit log (no bloqueante — si falla, el log se pierde pero la carga queda).
  // En producción se enqueue y se reintenta. Acá lo dejamos sincrónico.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "carga.crear",
    entidadTipo: "carga",
    entidadId: carga.id,
    before: null,
    after: serializarCarga(carga),
    motivo: null,
    metadata: { origen: "manual" },
  });

  return ok(carga);
}

/** Serializa la carga a JSON-safe para audit_log.before/after. */
function serializarCarga(c: Carga): Record<string, unknown> {
  return {
    id: c.id,
    tenantId: c.tenantId,
    playerRef: c.playerRef,
    montoCents: c.montoCents,
    moneda: c.moneda,
    metodo: c.metodo,
    origen: c.origen,
    estado: c.estado,
    externalRef: c.externalRef,
    comprobanteUrl: c.comprobanteUrl,
    motivoRechazo: c.motivoRechazo,
    registradaPor: c.registradaPor,
    validadaPor: c.validadaPor,
    rechazadaPor: c.rechazadaPor,
    asentadaPor: c.asentadaPor,
    version: c.version,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export { serializarCarga };