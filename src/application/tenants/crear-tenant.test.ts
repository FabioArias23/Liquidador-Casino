import { describe, expect, it } from "vitest";

import { codigos } from "@/application/errors";
import { crearTenant } from "@/application/tenants/crear-tenant";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { crearProfilesMock } from "@/infrastructure/repositories/mock/profiles.mock";
import { crearTenantsMock } from "@/infrastructure/repositories/mock/tenants.mock";

function setup() {
  const store = new MockStore();
  seedDemo(store);
  const deps = {
    tenants: crearTenantsMock(store),
    profiles: crearProfilesMock(store),
  };
  return { store, deps };
}

describe("crearTenant", () => {
  it("crea un tenant cuando el actor es superadmin y el input es válido", async () => {
    const { deps } = setup();
    const resultado = await crearTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      { nombre: "Casino Nuevo", slug: "casino-nuevo" },
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.data.nombre).toBe("Casino Nuevo");
    expect(resultado.data.slug).toBe("casino-nuevo");
    expect(resultado.data.estado).toBe("activo");
  });

  it("rechaza cuando el actor no existe", async () => {
    const { deps } = setup();
    // Usamos un nombre válido para que Zod pase; el error real debe ser el actor inexistente.
    const actorFalso = "00000000-0000-0000-0000-000000000999" as never;
    const resultado = await crearTenant(
      deps,
      actorFalso,
      { nombre: "Casino Válido", slug: "casino-valido" },
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe(codigos.PROFILE_NO_ENCONTRADO);
  });

  it("rechaza cuando el actor no es superadmin", async () => {
    const { deps } = setup();
    const resultado = await crearTenant(
      deps,
      seedIds.ADMIN_ID, // tenant_admin, NO superadmin
      { nombre: "Otro", slug: "otro" },
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("rechaza slug duplicado", async () => {
    const { deps } = setup();
    const resultado = await crearTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      { nombre: "Otro", slug: "casino-demo" }, // el seed ya tiene este slug
    );
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe(codigos.TENANT_SLUG_DUPLICADO);
  });

  it.each([
    { nombre: "A", slug: "valido", esperado: /nombre/i },
    { nombre: "Válido", slug: "CON-MAYUSCULAS", esperado: /slug/i },
    { nombre: "Válido", slug: "con_underscore", esperado: /slug/i },
    { nombre: "Válido", slug: "a", esperado: /slug/i },
  ])("rechaza input inválido: $nombre / $slug", async ({ nombre, slug, esperado }) => {
    const { deps } = setup();
    const resultado = await crearTenant(deps, seedIds.SUPERADMIN_ID, {
      nombre,
      slug,
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe(codigos.INPUT_INVALIDO);
    expect(resultado.error.mensaje).toMatch(esperado);
  });

  it("normaliza slug a minúsculas antes de chequear duplicados", async () => {
    const { deps, store } = setup();
    // Pre-existente con slug en minúsculas
    await deps.tenants.crear({ nombre: "Ya existe", slug: "duplicado" });

    const resultado = await crearTenant(
      deps,
      seedIds.SUPERADMIN_ID,
      { nombre: "Otro", slug: "DUPLICADO" },
    );
    // El mock guarda el slug tal cual llega; pero el caso de uso confía en
    // que la validación Zod ya forzó minúsculas antes. Verificamos que Zod rechace.
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.error.codigo).toBe(codigos.INPUT_INVALIDO);

    // Bonus: si pasara minúsculas, el mock SÍ lo detecta como duplicado
    const segundo = await crearTenant(deps, seedIds.SUPERADMIN_ID, {
      nombre: "Tercero",
      slug: "duplicado",
    });
    expect(segundo.ok).toBe(false);
    if (segundo.ok) return;
    expect(segundo.error.codigo).toBe(codigos.TENANT_SLUG_DUPLICADO);

    // Y el store tiene 2 tenants: el del seed + el primero que creamos
    expect(store.tenants.size).toBe(2);
  });
});
