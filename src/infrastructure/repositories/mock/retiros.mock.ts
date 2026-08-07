import type {
  ListarRetirosFiltros,
  RetiroRepository,
} from "@/application/ports/repositories";
import type { Retiro } from "@/domain/entities";
import { errorNegocio, err, ok, type Result } from "@/domain/result";

import type { MockStore } from "./store";

export function crearRetirosMock(store: MockStore): RetiroRepository {
  return {
    async crear(retiro) {
      store.retiros.set(retiro.id, retiro);
      return retiro;
    },

    async obtenerPorId(tenantId, id) {
      const r = store.retiros.get(id);
      if (!r || r.tenantId !== tenantId) return null;
      return r;
    },

    async listarPorTenant(tenantId, filtros) {
      const todos = [...store.retiros.values()]
        .filter((r) => r.tenantId === tenantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return filtrar(todos, filtros);
    },

    async actualizar(retiro, expectedVersion): Promise<Result<Retiro>> {
      const actual = store.retiros.get(retiro.id);
      if (!actual) {
        return err(errorNegocio("RETIRO_NO_ENCONTRADO", "Retiro no encontrado."));
      }
      if (actual.tenantId !== retiro.tenantId) {
        return err(
          errorNegocio(
            "PERMISO_DENEGADO",
            "El retiro pertenece a otro tenant.",
          ),
        );
      }
      if (actual.version !== expectedVersion) {
        return err(
          errorNegocio(
            "CONCURRENCIA",
            `Otro operador ya actualizó este retiro (versión ${actual.version}).`,
          ),
        );
      }
      store.retiros.set(retiro.id, retiro);
      return ok(retiro);
    },
  };
}

function filtrar(retiros: Retiro[], filtros?: ListarRetirosFiltros): Retiro[] {
  if (!filtros) return retiros;
  let out = retiros;
  if (filtros.estado) {
    out = out.filter((r) => r.estado === filtros.estado);
  }
  if (filtros.desde) {
    out = out.filter((r) => r.createdAt >= filtros.desde!);
  }
  if (filtros.hasta) {
    out = out.filter((r) => r.createdAt <= filtros.hasta!);
  }
  if (filtros.playerRef) {
    out = out.filter((r) => r.playerRef === filtros.playerRef);
  }
  if (filtros.limit) {
    out = out.slice(0, filtros.limit);
  }
  return out;
}
