import { codigos, errorNegocio } from "@/application/errors";
import type { CbuAccountRepository } from "@/application/ports/repositories";
import type { CbuAccount } from "@/domain/entities";
import { cbuAccountId, nuevoId } from "@/domain/ids";
import type { CbuAccountId } from "@/domain/ids";
import { validarCBU } from "@/domain/cbu";

import type { MockStore } from "./store";

export function crearCbuMock(store: MockStore): CbuAccountRepository {
  return {
    async listarPorTenant(tenantId) {
      return [...store.cbuAccounts.values()]
        .filter((c) => c.tenantId === tenantId)
        .sort((a, b) => a.titular.localeCompare(b.titular));
    },

    async obtenerPorTenantYCbu(tenantId, cbu) {
      for (const c of store.cbuAccounts.values()) {
        if (c.tenantId === tenantId && c.cbu === cbu) return c;
      }
      return null;
    },

    async agregar(tenantId, input) {
      if (!validarCBU(input.cbu)) {
        throw errorNegocio(codigos.CBU_INVALIDO, "CBU con checksum inválido");
      }
      for (const c of store.cbuAccounts.values()) {
        if (c.tenantId === tenantId && c.cbu === input.cbu && c.activa) {
          throw errorNegocio(codigos.CBU_DUPLICADO, "Ese CBU ya está cargado");
        }
      }
      const now = new Date();
      const account: CbuAccount = {
        id: cbuAccountId(nuevoId()),
        tenantId,
        cbu: input.cbu,
        alias: input.alias ?? null,
        titular: input.titular.trim(),
        moneda: input.moneda ?? "ARS",
        activa: true,
        createdAt: now,
        updatedAt: now,
      };
      store.cbuAccounts.set(account.id, account);
      return account;
    },

    async desactivar(id) {
      const actual = store.cbuAccounts.get(id);
      if (!actual) {
        throw errorNegocio(
          codigos.CBU_INVALIDO,
          `CBU ${id} no encontrado`,
        );
      }
      const actualizado: CbuAccount = {
        ...actual,
        activa: false,
        updatedAt: new Date(),
      };
      store.cbuAccounts.set(id, actualizado);
      return actualizado;
    },
  };
}

export async function _legacy_agregarCbu(
  store: MockStore,
  id: CbuAccountId,
): Promise<CbuAccount | null> {
  return (await crearCbuMock(store).desactivar(id)) ?? null;
}
