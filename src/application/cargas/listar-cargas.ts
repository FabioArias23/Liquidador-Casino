/**
 * Use case: listarCargas.
 *
 * Lista las cargas de un tenant con filtros opcionales.
 * Por ahora sin paginación (limit viene del repo). El operador ve la cola
 * del día; el dashboard agrega KPIs aparte.
 */

import type { Carga } from "@/domain/entities";
import type { TenantId } from "@/domain/ids";
import type {
  CargaRepository,
  ListarCargasFiltros,
} from "@/application/ports/repositories";

export interface ListarCargasDeps {
  cargas: CargaRepository;
}

export async function listarCargas(
  deps: ListarCargasDeps,
  tenantId: TenantId,
  filtros?: ListarCargasFiltros,
): Promise<Carga[]> {
  return deps.cargas.listarPorTenant(tenantId, filtros);
}