import type { LedgerRepository } from "@/application/ports/repositories";

import type { MockStore } from "./store";

/**
 * Ledger mock — append-only por convención (no expone update/delete).
 * Las 2 entries de un asiento se persisten atómicamente (en BD real: 1 TX).
 */
export function crearLedgerMock(store: MockStore): LedgerRepository {
  return {
    async append(entries) {
      // Atomicidad: si alguna falla, ninguna se persiste.
      // En el mock simplemente las metemos en el Map; en la BD real sería BEGIN/COMMIT.
      store.ledgerEntries.set(entries[0].id, entries[0]);
      store.ledgerEntries.set(entries[1].id, entries[1]);
      return {
        asientoId: entries[0].asientoId,
        entries,
      };
    },

    async listarPorOperacion(tenantId, operacionTipo, operacionId) {
      return [...store.ledgerEntries.values()]
        .filter(
          (e) =>
            e.tenantId === tenantId &&
            e.operacionTipo === operacionTipo &&
            e.operacionId === operacionId,
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
  };
}