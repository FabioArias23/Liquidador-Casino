import { codigos, errorNegocio } from "@/application/errors";
import type { MemberRepository } from "@/application/ports/repositories";
import type { Member } from "@/domain/entities";
import { memberId, nuevoId, userId as toUserId } from "@/domain/ids";
import type { TenantId } from "@/domain/ids";
import type { Rol } from "@/domain/roles";

import type { MockStore } from "./store";

export function crearMembersMock(store: MockStore): MemberRepository {
  return {
    async listarPorTenant(tenantId) {
      return [...store.members.values()]
        .filter((m) => m.tenantId === tenantId)
        .sort((a, b) => a.email.localeCompare(b.email));
    },

    async obtener(id) {
      return store.members.get(id) ?? null;
    },

    async obtenerPorUsuarioYTenant(tenantId, userId) {
      for (const m of store.members.values()) {
        if (m.tenantId === tenantId && m.userId === userId) return m;
      }
      return null;
    },

    async existeEnTenant(tenantId, email) {
      const target = email.toLowerCase();
      for (const m of store.members.values()) {
        if (m.tenantId === tenantId && m.email === target) return true;
      }
      return false;
    },

    async invitar(tenantId, input) {
      const email = input.email.toLowerCase();
      for (const m of store.members.values()) {
        if (
          m.tenantId === tenantId &&
          m.email === email &&
          m.estado === "activo"
        ) {
          throw errorNegocio(
            codigos.MIEMBRO_DUPLICADO,
            `Ya existe ${email} en el tenant`,
          );
        }
      }

      // Reusar profile si ya existe; si no, crearlo.
      let uid = store.emails.get(email);
      if (!uid) {
        uid = toUserId(nuevoId());
        store.profiles.set(uid, {
          id: uid,
          email,
          isSuperadmin: false,
          createdAt: new Date(),
        });
        store.emails.set(email, uid);
      }

      const member: Member = {
        id: memberId(nuevoId()),
        tenantId,
        userId: uid,
        email,
        rol: input.rol,
        estado: "activo",
        createdAt: new Date(),
      };
      store.members.set(member.id, member);
      return member;
    },

    async cambiarRol(id, rol) {
      const actual = store.members.get(id);
      if (!actual) {
        throw errorNegocio(codigos.MIEMBRO_NO_ENCONTRADO, `Member ${id}`);
      }
      const actualizado: Member = { ...actual, rol };
      store.members.set(id, actualizado);
      return actualizado;
    },

    async desactivar(id) {
      const actual = store.members.get(id);
      if (!actual) {
        throw errorNegocio(codigos.MIEMBRO_NO_ENCONTRADO, `Member ${id}`);
      }
      const actualizado: Member = { ...actual, estado: "inactivo" };
      store.members.set(id, actualizado);
      return actualizado;
    },
  };
}

// Mantengo el export por compat si alguien lo usa en scripts, pero la firma
// canónica es la del repo. (No se usa desde los casos de uso.)
export async function _legacy_invitarMiembro(
  store: MockStore,
  tenantId: TenantId,
  input: { email: string; rol: Rol },
): Promise<Member> {
  return crearMembersMock(store).invitar(tenantId, input);
}
