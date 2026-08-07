import { describe, expect, it } from "vitest";

import { codigos } from "@/application/errors";
import { actualizarTenant } from "@/application/tenants/actualizar-tenant";
import { listarTenants } from "@/application/tenants/listar-tenants";
import { tenantId } from "@/domain/ids";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearProfilesMock } from "@/infrastructure/repositories/mock/profiles.mock";
import { crearTenantsMock } from "@/infrastructure/repositories/mock/tenants.mock";

function setup() {
  const store = new MockStore();
  seedDemo(store);
  return {
    store,
    deps: {
      tenants: crearTenantsMock(store),
      profiles: crearProfilesMock(store),
      members: crearMembersMock(store),
    },
  };
}

describe("listarTenants", () => {
  it("superadmin ve todos los tenants", async () => {
    const { deps } = setup();
    const r = await listarTenants(deps, seedIds.SUPERADMIN_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.esSuperadmin).toBe(true);
    expect(r.data.tenants.length).toBe(1);
    expect(r.data.tenants[0]?.slug).toBe("casino-demo");
  });

  it("operador ve solo los tenants donde es miembro activo", async () => {
    const { deps, store } = setup();
    // Crear un tenant extra donde el operador NO es miembro
    const nuevo = await deps.tenants.crear({
      nombre: "Casino Sin Permiso",
      slug: "casino-otro",
    });
    expect(store.tenants.size).toBe(2);

    const r = await listarTenants(deps, seedIds.OPERADOR_ID);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.esSuperadmin).toBe(false);
    expect(r.data.tenants.length).toBe(1);
    expect(r.data.tenants[0]?.slug).toBe("casino-demo");
    expect(r.data.tenants.some((t) => t.id === nuevo.id)).toBe(false);
  });

  it("rechaza si el actor no existe", async () => {
    const { deps } = setup();
    const r = await listarTenants(
      deps,
      "00000000-0000-0000-0000-000000000999" as never,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PROFILE_NO_ENCONTRADO);
  });
});

describe("actualizarTenant", () => {
  it("superadmin puede renombrar y suspender", async () => {
    const { deps } = setup();
    const id = seedIds.CASINO_DEMO_ID;

    const r1 = await actualizarTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      id,
      { nombre: "Casino Demo Renombrado" },
    );
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.data.nombre).toBe("Casino Demo Renombrado");
    expect(r1.data.estado).toBe("activo");

    const r2 = await actualizarTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      id,
      { estado: "suspendido" },
    );
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.estado).toBe("suspendido");
  });

  it("no superadmin no puede modificar", async () => {
    const { deps } = setup();
    const r = await actualizarTenant(
      deps,
      seedIds.ADMIN_ID,
      seedIds.CASINO_DEMO_ID,
      { nombre: "Hack" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("rechaza si no se pasa ningún campo a cambiar", async () => {
    const { deps } = setup();
    const r = await actualizarTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      seedIds.CASINO_DEMO_ID,
      {},
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.INPUT_INVALIDO);
  });

  it("rechaza si el tenant no existe", async () => {
    const { deps } = setup();
    const idFalso = tenantId("00000000-0000-0000-0000-000000000fff");
    const r = await actualizarTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      idFalso,
      { nombre: "Nada" },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.TENANT_NO_ENCONTRADO);
  });
});
