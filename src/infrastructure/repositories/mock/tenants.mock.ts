import type { TenantRepository } from "@/application/ports/repositories";
import type { Tenant } from "@/domain/entities";
import type { TenantId } from "@/domain/ids";
import { nuevoId } from "@/domain/ids";

import type { MockStore } from "./store";

export function crearTenantsMock(store: MockStore): TenantRepository {
  return {
    async listar() {
      return [...store.tenants.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre),
      );
    },

    async obtenerPorId(id) {
      return store.tenants.get(id) ?? null;
    },

    async obtenerPorSlug(slug) {
      const target = slug.toLowerCase();
      for (const t of store.tenants.values()) {
        if (t.slug === target) return t;
      }
      return null;
    },

    async existeSlug(slug) {
      const target = slug.toLowerCase();
      for (const t of store.tenants.values()) {
        if (t.slug === target) return true;
      }
      return false;
    },

    async crear({ nombre, slug }) {
      const now = new Date();
      const tenant: Tenant = {
        id: nuevoId() as TenantId,
        nombre: nombre.trim(),
        slug: slug.toLowerCase().trim(),
        estado: "activo",
        createdAt: now,
        updatedAt: now,
      };
      store.tenants.set(tenant.id, tenant);
      return tenant;
    },

    async actualizar(id, cambios) {
      const actual = store.tenants.get(id);
      if (!actual) {
        throw new Error(`Tenant ${id} no encontrado`);
      }
      const actualizado: Tenant = {
        ...actual,
        ...(cambios.nombre !== undefined && { nombre: cambios.nombre.trim() }),
        ...(cambios.estado !== undefined && { estado: cambios.estado }),
        updatedAt: new Date(),
      };
      store.tenants.set(id, actualizado);
      return actualizado;
    },
  };
}
