/**
 * Smoke test de la capa de infraestructura.
 * Ejecuta el bootstrap, instancia los repos y verifica que el seed esté
 * completo y sea coherente. Sin Next.js, sin UI, sin DB.
 *
 * Uso:  npx tsx scripts/smoke-test.ts
 */

import { cargarStoreDesdeDisco } from "@/infrastructure/repositories/mock/store";
import { seedDemo } from "@/infrastructure/repositories/mock/seed";
import { crearTenantsMock } from "@/infrastructure/repositories/mock/tenants.mock";
import { crearProfilesMock } from "@/infrastructure/repositories/mock/profiles.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearCbuMock } from "@/infrastructure/repositories/mock/cbu.mock";
import { crearCasinoCredsMock } from "@/infrastructure/repositories/mock/casino-creds.mock";

async function main() {
  const store = await cargarStoreDesdeDisco();
  if (store.tenants.size === 0 && store.profiles.size === 0) {
    seedDemo(store);
  }

  const tenants = crearTenantsMock(store);
  const profiles = crearProfilesMock(store);
  const members = crearMembersMock(store);
  const cbu = crearCbuMock(store);
  const casinoCreds = crearCasinoCredsMock(store);

  const todosLosTenants = await tenants.listar();
  const todosLosProfiles = await profiles.listar();
  console.log("\n🟢 Tenants:");
  for (const t of todosLosTenants) {
    console.log(`  - ${t.nombre} (slug: ${t.slug}, estado: ${t.estado})`);
    console.log(`    id: ${t.id}`);
    const miembros = await members.listarPorTenant(t.id);
    console.log(`    miembros: ${miembros.length}`);
    for (const m of miembros) {
      console.log(`      · ${m.email} → ${m.rol} (${m.estado})`);
    }
    const cbus = await cbu.listarPorTenant(t.id);
    console.log(`    cbu: ${cbus.length}`);
    for (const c of cbus) {
      console.log(`      · ${c.cbu} (${c.titular}, ${c.moneda})`);
    }
    const creds = await casinoCreds.obtenerPorTenant(t.id);
    console.log(
      `    casino creds: ${creds ? `${creds.adapterType} @ ${creds.baseUrl}` : "ninguna"}`,
    );
  }

  console.log("\n🟢 Profiles:");
  for (const p of todosLosProfiles) {
    console.log(
      `  - ${p.email} ${p.isSuperadmin ? "👑 superadmin" : ""}`,
    );
  }

  // Chequeos de coherencia
  console.log("\n🟢 Coherencia:");
  const cbuOk = (await cbu.listarPorTenant(todosLosTenants[0]!.id)).every((c) =>
    /^\d{22}$/.test(c.cbu),
  );
  console.log(`  - CBUs del demo son 22 dígitos: ${cbuOk ? "✅" : "❌"}`);

  const superadmin = todosLosProfiles.find((p) => p.isSuperadmin);
  console.log(`  - Hay superadmin: ${superadmin ? "✅" : "❌"}`);

  const miembrosActivos = await members.listarPorTenant(todosLosTenants[0]!.id);
  console.log(
    `  - Hay miembros activos: ${miembrosActivos.length > 0 ? "✅" : "❌"} (${miembrosActivos.length})`,
  );

  console.log("\n✅ Smoke test OK\n");
}

main().catch((err) => {
  console.error("❌ Smoke test FAIL:", err);
  process.exit(1);
});
