import type { CargaRepository, ListarCargasFiltros } from "@/application/ports/repositories";
import type { Carga } from "@/domain/entities";
import { errorNegocio, err, ok, type Result } from "@/domain/result";

import type { MockStore } from "./store";

export function crearCargasMock(store: MockStore): CargaRepository {
  return {
    async crear(carga) {
      store.cargas.set(carga.id, carga);
      return carga;
    },

    async obtenerPorId(tenantId, id) {
      const c = store.cargas.get(id);
      if (!c || c.tenantId !== tenantId) return null;
      return c;
    },

    async obtenerPorTenantYExternalRef(tenantId, externalRef) {
      for (const c of store.cargas.values()) {
        if (c.tenantId === tenantId && c.externalRef === externalRef) {
          return c;
        }
      }
      return null;
    },

    async listarPorTenant(tenantId, filtros) {
      const todas = [...store.cargas.values()]
        .filter((c) => c.tenantId === tenantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return filtrar(todas, filtros);
    },

    async actualizar(carga, expectedVersion): Promise<Result<Carga>> {
      const actual = store.cargas.get(carga.id);
      if (!actual) {
        return err(errorNegocio("CARGA_NO_ENCONTRADA", "Carga no encontrada."));
      }
      if (actual.version !== expectedVersion) {
        return err(
          errorNegocio(
            "CONCURRENCIA",
            `Otro operador ya actualizó esta carga (versión ${actual.version}).`,
          ),
        );
      }
      store.cargas.set(carga.id, carga);
      return ok(carga);
    },
  };
}

function filtrar(cargas: Carga[], filtros?: ListarCargasFiltros): Carga[] {
  if (!filtros) return cargas;
  let out = cargas;
  if (filtros.estado) {
    out = out.filter((c) => c.estado === filtros.estado);
  }
  if (filtros.desde) {
    out = out.filter((c) => c.createdAt >= filtros.desde!);
  }
  if (filtros.hasta) {
    out = out.filter((c) => c.createdAt <= filtros.hasta!);
  }
  if (filtros.playerRef) {
    out = out.filter((c) => c.playerRef === filtros.playerRef);
  }
  if (filtros.limit) {
    out = out.slice(0, filtros.limit);
  }
  return out;
}