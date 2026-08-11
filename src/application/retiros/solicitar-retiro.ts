/**
 * Use case: solicitarRetiro.
 *
 * Un operador (o supervisor/tenant_admin) registra un retiro en estado
 * `pending`. Es el primer paso del flujo de pago a jugador.
 *
 * Validaciones:
 * - Input: tenantId, playerRef, montoCents > 0, CBU destino (checksum BCRA),
 *   titularDestino.
 * - Permiso: miembro activo del tenant con `retiros.validar`.
 * - El actor queda registrado como `registradaPor` (esto es la base del
 *   cuatro-ojos: si después quiere validar el mismo retiro, el state
 *   machine lo permite, pero el cuatro-ojos recién actúa entre
 *   validar → aprobar y aprobar → pagar).
 *
 * Genera 1 entrada en audit_log con accion `retiro.solicitar`.
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
import { tienePermiso } from "@/domain/roles";
import { err, errorNegocio, ok, type ErrorNegocio, type Result } from "@/domain/result";

export const solicitarRetiroInputSchema = z.object({
  tenantId: z.string().uuid(),
  playerRef: z.string().trim().min(1, "Falta referencia del jugador."),
  montoCents: z.number().int().positive("El monto debe ser mayor a 0."),
  moneda: z.string().trim().min(1, "Falta moneda."),
  cbuDestino: z.string().trim().min(22, "CBU incompleto."),
  aliasDestino: z.string().trim().optional().nullable(),
  titularDestino: z.string().trim().min(1, "Falta titular destino."),
});

export type SolicitarRetiroInput = z.input<typeof solicitarRetiroInputSchema>;

export interface SolicitarRetiroDeps {
  retiros: RetiroRepository;
  audit: AuditRepository;
  members: MemberRepository;
}

export async function solicitarRetiro(
  deps: SolicitarRetiroDeps,
  actorId: UserId,
  rawInput: SolicitarRetiroInput,
): Promise<Result<Retiro, ErrorNegocio>> {
  const parsed = solicitarRetiroInputSchema.safeParse(rawInput);
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

  // 1. Permisos: miembro activo del tenant con `retiros.validar`.
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
        `El rol "${member.rol}" no puede solicitar retiros.`,
      ),
    );
  }

  // 2. CBU destino debe pasar el checksum oficial (BCRA).
  const cbuNormalizado = normalizarCBU(input.cbuDestino);
  if (!cbuNormalizado) {
    return err(
      errorNegocio(
        codigos.CBU_INVALIDO,
        "El CBU destino no pasa el checksum oficial (BCRA). Verificá los 22 dígitos.",
      ),
    );
  }

  // 3. Construir el Retiro en estado pending.
  const now = new Date();
  const id = `ret-${crypto.randomUUID()}`;
  const retiro: Retiro = {
    id,
    tenantId,
    playerRef: input.playerRef,
    montoCents: input.montoCents,
    moneda: input.moneda,
    cbuDestino: cbuNormalizado,
    aliasDestino: input.aliasDestino ?? null,
    titularDestino: input.titularDestino,
    estado: "pending",
    origen: "manual",
    externalRef: null,
    comprobanteUrl: null,
    motivoRechazo: null,
    registradaPor: actorId,
    validadaPor: null,
    rechazadaPor: null,
    aprobadaPor: null,
    rechazadaAprobacionPor: null,
    pagadaPor: null,
    idempotencyKey: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await deps.retiros.crear(retiro);

  // 4. Audit log.
  await deps.audit.append({
    tenantId,
    actorId,
    accion: "retiro.solicitar",
    entidadTipo: "retiro",
    entidadId: id,
    before: null,
    after: serializarRetiro(retiro),
    motivo: null,
    metadata: { montoCents: input.montoCents, playerRef: input.playerRef },
  });

  return ok(retiro);
}

function serializarRetiro(r: Retiro): Record<string, unknown> {
  return {
    id: r.id,
    estado: r.estado,
    montoCents: r.montoCents,
    playerRef: r.playerRef,
    cbuDestino: r.cbuDestino,
    titularDestino: r.titularDestino,
    version: r.version,
  };
}
