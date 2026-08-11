/**
 * Tests de la hidratación de fechas en loadSnapshot.
 *
 * Bug que cazó este test: JSON.stringify(Date) produce un ISO string.
 * Al leer el snapshot de vuelta, sin hidratar, las fechas quedaban como
 * `string` y el código que llama `.getTime()` o `formatRelativeTime(date)`
 * explotaba en runtime ("b.createdAt.getTime is not a function").
 */

import { describe, expect, it } from "vitest";

import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";

describe("loadSnapshot - hidratación de fechas", () => {
  it("después del round-trip (persistir → cargar), todas las fechas son Date", () => {
    const original = new MockStore();
    seedDemo(original);

    // Simular persistencia: JSON.stringify convierte Date → ISO string.
    const json = JSON.stringify(original.toSnapshot());
    const snap = JSON.parse(json);

    // Confirmar que el JSON tiene fechas como string (este es el problema).
    const primerMiembroJson = Object.values(snap.members)[0] as { createdAt: unknown };
    expect(typeof primerMiembroJson.createdAt).toBe("string");

    // Cargar el snapshot en un store nuevo: loadSnapshot debe hidratar.
    const reloaded = new MockStore();
    reloaded.loadSnapshot(snap);

    // Verificar que todas las fechas son `instanceof Date` en cada entity.
    for (const m of reloaded.members.values()) {
      expect(m.createdAt).toBeInstanceOf(Date);
    }
    for (const t of reloaded.tenants.values()) {
      expect(t.createdAt).toBeInstanceOf(Date);
      expect(t.updatedAt).toBeInstanceOf(Date);
    }
    for (const p of reloaded.profiles.values()) {
      expect(p.createdAt).toBeInstanceOf(Date);
    }
    for (const c of reloaded.cargas.values()) {
      expect(c.createdAt).toBeInstanceOf(Date);
      expect(c.updatedAt).toBeInstanceOf(Date);
    }
    for (const e of reloaded.ledgerEntries.values()) {
      expect(e.createdAt).toBeInstanceOf(Date);
    }
    for (const a of reloaded.auditLog.values()) {
      expect(a.createdAt).toBeInstanceOf(Date);
    }
    for (const r of reloaded.retiros.values()) {
      expect(r.createdAt).toBeInstanceOf(Date);
      expect(r.updatedAt).toBeInstanceOf(Date);
    }
    for (const c of reloaded.cbuAccounts.values()) {
      expect(c.createdAt).toBeInstanceOf(Date);
      expect(c.updatedAt).toBeInstanceOf(Date);
    }
    for (const c of reloaded.casinoCredentials.values()) {
      expect(c.createdAt).toBeInstanceOf(Date);
      expect(c.updatedAt).toBeInstanceOf(Date);
    }
  });

  it("el round-trip preserva el valor temporal (mismo epoch ms)", () => {
    const original = new MockStore();
    seedDemo(original);
    const originalCreatedAt = original.members.get(seedIds.MEMBER_OPERADOR_ID)!.createdAt.getTime();

    const snap = JSON.parse(JSON.stringify(original.toSnapshot()));
    const reloaded = new MockStore();
    reloaded.loadSnapshot(snap);

    const reloadedCreatedAt = reloaded.members.get(seedIds.MEMBER_OPERADOR_ID)!.createdAt.getTime();
    expect(reloadedCreatedAt).toBe(originalCreatedAt);
  });

  it("sort por .getTime() funciona después del round-trip (caso real del bug)", () => {
    const original = new MockStore();
    seedDemo(original);
    const snap = JSON.parse(JSON.stringify(original.toSnapshot()));
    const reloaded = new MockStore();
    reloaded.loadSnapshot(snap);

    // El page de miembros ordena por createdAt desc. Sin hidratar, esto explota.
    const miembros = [...reloaded.members.values()];
    expect(() =>
      miembros.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    ).not.toThrow();
  });
});
