/**
 * Caso de uso: listarTenants.
 *
 * Visible para cualquier usuario autenticado (la UI filtrará después según
 * permisos: superadmin ve todos, otros ven solo los que son miembros).
 */

import type {
  ProfileRepository,
  TenantRepository,
} from "@/application/ports/repositories";
import type { Tenant } from "@/domain/entities";
import type { UserId } from "@/domain/ids";
import { err, ErrorNegocio, ok } from "@/domain/result";
import type { Result } from "@/domain/result";
import { codigos } from "@/application/errors";

export interface ListarTenantsOutput {
  /** Todos los tenants si el actor es superadmin. Si no, solo donde es miembro. */
  tenants: Tenant[];
  /** El actor existe (para que la UI sepa si mostrar vista de "no autenticado"). */
  esSuperadmin: boolean;
}

export async function listarTenants(
  deps: {
    tenants: TenantRepository;
    profiles: ProfileRepository;
    members: import("@/application/ports/repositories").MemberRepository;
  },
  actorId: UserId,
): Promise<Result<ListarTenantsOutput, ErrorNegocio>> {
  const actor = await deps.profiles.obtenerPorId(actorId);
  if (!actor) {
    return err(
      new ErrorNegocio(codigos.PROFILE_NO_ENCONTRADO, "El actor no existe"),
    );
  }

  if (actor.isSuperadmin) {
    const tenants = await deps.tenants.listar();
    return ok({ tenants, esSuperadmin: true });
  }

  // No superadmin: listar solo los tenants donde es miembro activo.
  const todos = await deps.tenants.listar();
  const visibles: Tenant[] = [];
  for (const t of todos) {
    const membresia = await deps.members.obtenerPorUsuarioYTenant(t.id, actorId);
    if (membresia && membresia.estado === "activo") visibles.push(t);
  }
  return ok({ tenants: visibles, esSuperadmin: false });
}
