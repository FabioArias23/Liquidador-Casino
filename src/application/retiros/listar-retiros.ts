/**
 * Caso de uso: listarRetiros.
 *
 * Devuelve los retiros del tenant ordenados por createdAt desc.
 * Filtros opcionales se aplican en el repositorio.
 */

import type { RetiroRepository } from "@/application/ports/repositories";
import type { Retiro } from "@/domain/entities";
import type { TenantId } from "@/domain/ids";

export interface ListarRetirosFiltros {
  estado?: import("@/domain/retiros").EstadoRetiro;
  desde?: Date;
  hasta?: Date;
  playerRef?: string;
  limit?: number;
}

export async function listarRetiros(
  deps: { retiros: RetiroRepository },
  tenantId: TenantId,
  filtros: ListarRetirosFiltros = {},
): Promise<Retiro[]> {
  return deps.retiros.listarPorTenant(tenantId, filtros);
}
