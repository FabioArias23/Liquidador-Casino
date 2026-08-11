/**
 * Caso de uso: listarAuditLog.
 *
 * Devuelve el audit log del tenant ordenado por createdAt desc.
 * Los filtros son opcionales y se aplican en el repositorio.
 */

import type { AuditRepository } from "@/application/ports/repositories";
import type { AuditLog } from "@/domain/entities";
import type { TenantId } from "@/domain/ids";

export interface ListarAuditLogFiltros {
  desde?: Date;
  hasta?: Date;
  entidadTipo?: string;
  entidadId?: string;
  actorId?: string;
  limit?: number;
}

export async function listarAuditLog(
  deps: { audit: AuditRepository },
  tenantId: TenantId,
  filtros: ListarAuditLogFiltros = {},
): Promise<AuditLog[]> {
  return deps.audit.listarPorTenant(tenantId, filtros);
}
