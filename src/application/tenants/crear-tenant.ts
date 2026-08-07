/**
 * Caso de uso: crearTenant.
 *
 * Reglas (ver PLAN-TECNICO.md §7 + §9 Fase 1):
 *   1. Input validado con Zod (mismo schema puede usarse en el form).
 *   2. Solo superadmin puede crear tenants (autorización en el caso de uso,
 *      NO en la UI — la UI solo llama y muestra el error).
 *   3. Slug único (chequeo + crear).
 *
 * Result pattern (no throw para errores esperables).
 */

import { z } from "zod";

import { codigos } from "@/application/errors";
import type {
  ProfileRepository,
  TenantRepository,
} from "@/application/ports/repositories";
import type { Tenant } from "@/domain/entities";
import type { UserId } from "@/domain/ids";
import { err, ErrorNegocio, ok } from "@/domain/result";
import type { Result } from "@/domain/result";

const schema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre debe tener al menos 2 caracteres")
    .max(80, "El nombre debe tener como máximo 80 caracteres"),
  slug: z
    .string()
    .trim()
    .min(2, "El slug debe tener al menos 2 caracteres")
    .max(40, "El slug debe tener como máximo 40 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "El slug solo puede tener minúsculas, números y guiones",
    ),
});

export type CrearTenantInput = z.infer<typeof schema>;

export async function crearTenant(
  deps: {
    tenants: TenantRepository;
    profiles: ProfileRepository;
  },
  actorId: UserId,
  input: unknown,
): Promise<Result<Tenant, ErrorNegocio>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err(
      new ErrorNegocio(
        codigos.INPUT_INVALIDO,
        issue?.message ?? "Input inválido",
      ),
    );
  }

  const actor = await deps.profiles.obtenerPorId(actorId);
  if (!actor) {
    return err(
      new ErrorNegocio(codigos.PROFILE_NO_ENCONTRADO, "El actor no existe"),
    );
  }
  if (!actor.isSuperadmin) {
    return err(
      new ErrorNegocio(
        codigos.PERMISO_DENEGADO,
        "Solo superadmin puede crear tenants",
      ),
    );
  }

  if (await deps.tenants.existeSlug(parsed.data.slug)) {
    return err(
      new ErrorNegocio(
        codigos.TENANT_SLUG_DUPLICADO,
        `Ya existe un tenant con el slug "${parsed.data.slug}"`,
      ),
    );
  }

  const tenant = await deps.tenants.crear({
    nombre: parsed.data.nombre,
    slug: parsed.data.slug,
  });
  return ok(tenant);
}
