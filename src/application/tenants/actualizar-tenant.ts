/**
 * Caso de uso: actualizarTenant (nombre y/o estado).
 * Solo superadmin.
 */

import { z } from "zod";

import { codigos } from "@/application/errors";
import type {
  ProfileRepository,
  TenantRepository,
} from "@/application/ports/repositories";
import type { Tenant } from "@/domain/entities";
import type { TenantId, UserId } from "@/domain/ids";
import { err, ErrorNegocio, ok } from "@/domain/result";
import type { Result } from "@/domain/result";

const schema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .optional(),
    estado: z.enum(["activo", "suspendido"]).optional(),
  })
  .refine(
    (v) => v.nombre !== undefined || v.estado !== undefined,
    "Tenés que cambiar al menos un campo",
  );

export type ActualizarTenantInput = z.infer<typeof schema>;

export async function actualizarTenant(
  deps: {
    tenants: TenantRepository;
    profiles: ProfileRepository;
  },
  actorId: UserId,
  tenantId: TenantId,
  input: unknown,
): Promise<Result<Tenant, ErrorNegocio>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return err(
      new ErrorNegocio(
        codigos.INPUT_INVALIDO,
        parsed.error.issues[0]?.message ?? "Input inválido",
      ),
    );
  }

  const actor = await deps.profiles.obtenerPorId(actorId);
  if (!actor || !actor.isSuperadmin) {
    return err(
      new ErrorNegocio(
        codigos.PERMISO_DENEGADO,
        "Solo superadmin puede modificar tenants",
      ),
    );
  }

  const actual = await deps.tenants.obtenerPorId(tenantId);
  if (!actual) {
    return err(
      new ErrorNegocio(codigos.TENANT_NO_ENCONTRADO, `Tenant ${tenantId}`),
    );
  }

  const actualizado = await deps.tenants.actualizar(tenantId, parsed.data);
  return ok(actualizado);
}
