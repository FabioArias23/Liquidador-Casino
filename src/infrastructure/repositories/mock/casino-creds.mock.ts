import type { CasinoCredentialsRepository } from "@/application/ports/repositories";
import type { CasinoCredentials } from "@/domain/entities";
import { casinoCredentialsId, nuevoId } from "@/domain/ids";

import type { MockStore } from "./store";

export function crearCasinoCredsMock(
  store: MockStore,
): CasinoCredentialsRepository {
  return {
    async obtenerPorTenant(tenantId) {
      for (const c of store.casinoCredentials.values()) {
        if (c.tenantId === tenantId) return c;
      }
      return null;
    },

    async guardar(tenantId, input) {
      const now = new Date();
      // Buscar existente
      for (const c of store.casinoCredentials.values()) {
        if (c.tenantId === tenantId) {
          const actualizado: CasinoCredentials = {
            ...c,
            adapterType: input.adapterType,
            baseUrl: input.baseUrl,
            apiKeyCiphertext:
              input.apiKeyCiphertext !== undefined
                ? input.apiKeyCiphertext
                : c.apiKeyCiphertext,
            webhookSecret:
              input.webhookSecret !== undefined
                ? input.webhookSecret
                : c.webhookSecret,
            updatedAt: now,
          };
          store.casinoCredentials.set(actualizado.id, actualizado);
          return actualizado;
        }
      }
      const nuevo: CasinoCredentials = {
        id: casinoCredentialsId(nuevoId()),
        tenantId,
        adapterType: input.adapterType,
        baseUrl: input.baseUrl,
        apiKeyCiphertext: input.apiKeyCiphertext ?? null,
        webhookSecret: input.webhookSecret ?? null,
        createdAt: now,
        updatedAt: now,
      };
      store.casinoCredentials.set(nuevo.id, nuevo);
      return nuevo;
    },
  };
}
