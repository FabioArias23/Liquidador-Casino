import type { AuditRepository } from "@/application/ports/repositories";
import type { AuditLog } from "@/domain/entities";
import { auditLogId } from "@/domain/ids";

import type { MockStore } from "./store";

export interface ListarAuditFiltros {
  desde?: Date;
  hasta?: Date;
  entidadTipo?: string;
  entidadId?: string;
  limit?: number;
}

export function crearAuditMock(store: MockStore): AuditRepository {
  return {
    async append(input) {
      const entry: AuditLog = {
        ...input,
        id: auditLogId(crypto.randomUUID()),
        createdAt: new Date(),
      };
      store.auditLog.set(entry.id, entry);
      return entry;
    },

    async listarPorTenant(tenantId, filtros) {
      const todos = [...store.auditLog.values()]
        .filter((a) => a.tenantId === tenantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return filtrar(todos, filtros);
    },
  };
}

function filtrar(logs: AuditLog[], filtros?: ListarAuditFiltros): AuditLog[] {
  if (!filtros) return logs;
  let out = logs;
  if (filtros.desde) out = out.filter((l) => l.createdAt >= filtros.desde!);
  if (filtros.hasta) out = out.filter((l) => l.createdAt <= filtros.hasta!);
  if (filtros.entidadTipo)
    out = out.filter((l) => l.entidadTipo === filtros.entidadTipo);
  if (filtros.entidadId)
    out = out.filter((l) => l.entidadId === filtros.entidadId);
  if (filtros.limit) out = out.slice(0, filtros.limit);
  return out;
}