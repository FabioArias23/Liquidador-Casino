import type { ProfileRepository } from "@/application/ports/repositories";
import type { Profile } from "@/domain/entities";

import type { MockStore } from "./store";

export function crearProfilesMock(store: MockStore): ProfileRepository {
  return {
    async obtenerPorId(id) {
      return store.profiles.get(id) ?? null;
    },

    async obtenerPorEmail(email) {
      const id = store.emails.get(email.toLowerCase());
      return id ? (store.profiles.get(id) ?? null) : null;
    },

    async listar() {
      return [...store.profiles.values()].sort((a, b) =>
        a.email.localeCompare(b.email),
      );
    },

    async crear({ id, email, isSuperadmin = false }) {
      const profile: Profile = {
        id,
        email: email.toLowerCase(),
        isSuperadmin,
        createdAt: new Date(),
      };
      store.profiles.set(id, profile);
      store.emails.set(profile.email, id);
      return profile;
    },

    async setSuperadmin(id, es) {
      const actual = store.profiles.get(id);
      if (!actual) throw new Error(`Profile ${id} no encontrado`);
      const actualizado: Profile = { ...actual, isSuperadmin: es };
      store.profiles.set(id, actualizado);
      return actualizado;
    },
  };
}
