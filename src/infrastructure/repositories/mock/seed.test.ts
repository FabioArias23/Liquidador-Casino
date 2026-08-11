/**
 * Tests del seed narrativo.
 *
 * Verifica que el seed crea las entidades con la forma y los conteos esperados.
 * Es un test estructural: si cambia la forma, este test avisa.
 */

import { describe, expect, it } from "vitest";

import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";

describe("seedDemo", () => {
  it("crea 1 tenant demo con 4 profiles y 3 members", () => {
    const store = new MockStore();
    seedDemo(store);
    expect(store.tenants.size).toBe(1);
    expect(store.profiles.size).toBe(4);
    expect(store.members.size).toBe(3);
  });

  it("crea 2 CBUs y 1 casino credentials en el tenant demo", () => {
    const store = new MockStore();
    seedDemo(store);
    expect(store.cbuAccounts.size).toBe(2);
    expect(store.casinoCredentials.size).toBe(1);
  });

  it("crea 9 cargas en estados variados (pending, validating, validated, settled, rejected)", () => {
    const store = new MockStore();
    seedDemo(store);
    expect(store.cargas.size).toBe(9);
    const counts = {
      pending: 0,
      validating: 0,
      validated: 0,
      settled: 0,
      rejected: 0,
    };
    for (const c of store.cargas.values()) {
      counts[c.estado]++;
    }
    expect(counts.settled).toBe(4);
    expect(counts.validating).toBe(2);
    expect(counts.validated).toBe(1);
    expect(counts.pending).toBe(1);
    expect(counts.rejected).toBe(1);
  });

  it("cada carga settled genera 2 ledger entries (débito + crédito) con mismo asientoId", () => {
    const store = new MockStore();
    seedDemo(store);
    const settled = [...store.cargas.values()].filter((c) => c.estado === "settled");
    expect(settled.length).toBe(4);
    for (const c of settled) {
      const entries = [...store.ledgerEntries.values()].filter(
        (e) => e.operacionTipo === "carga" && e.operacionId === c.id,
      );
      expect(entries.length).toBe(2);
      // Mismo asiento agrupa las 2 entries
      expect(entries[0]?.asientoId).toBe(entries[1]?.asientoId);
      // Σ = 0 (débito = crédito)
      const debitos = entries.filter((e) => e.tipo === "debito");
      const creditos = entries.filter((e) => e.tipo === "credito");
      expect(debitos.length).toBe(1);
      expect(creditos.length).toBe(1);
      expect(debitos[0]?.montoCents).toBe(c.montoCents);
      expect(creditos[0]?.montoCents).toBe(c.montoCents);
    }
  });

  it("crea 3 retiros en estados variados (pending, awaiting_approval, paid)", () => {
    const store = new MockStore();
    seedDemo(store);
    expect(store.retiros.size).toBe(3);
    const estados = [...store.retiros.values()].map((r) => r.estado).sort();
    expect(estados).toEqual(["awaiting_approval", "paid", "pending"]);
  });

  it("el retiro paid tiene los 4 actores (registrada, validada, aprobada, pagada) con cuatro-ojos cumplido", () => {
    const store = new MockStore();
    seedDemo(store);
    const paid = [...store.retiros.values()].find((r) => r.id === seedIds.RETIROS_IDS.B7C2_3K_PAID);
    expect(paid).toBeDefined();
    if (!paid) return;
    // registradaPor != aprobadaPor != pagadaPor
    expect(paid.registradaPor).toBeTruthy();
    expect(paid.validadaPor).toBeTruthy();
    expect(paid.aprobadaPor).toBeTruthy();
    expect(paid.pagadaPor).toBeTruthy();
    // cuatro-ojos: validadaPor !== aprobadaPor y aprobadaPor !== pagadaPor
    expect(paid.validadaPor).not.toBe(paid.aprobadaPor);
    expect(paid.aprobadaPor).not.toBe(paid.pagadaPor);
  });

  it("crea audit log con al menos 1 entrada por carga y por retiro", () => {
    const store = new MockStore();
    seedDemo(store);
    const auditPorCarga = [...store.auditLog.values()].filter((a) => a.entidadTipo === "carga");
    const auditPorRetiro = [...store.auditLog.values()].filter((a) => a.entidadTipo === "retiro");
    expect(auditPorCarga.length).toBeGreaterThanOrEqual(9);
    expect(auditPorRetiro.length).toBeGreaterThanOrEqual(3);
  });

  it("el rechazo de la carga rechazada tiene motivo en el audit log", () => {
    const store = new MockStore();
    seedDemo(store);
    const rechazada = [...store.auditLog.values()].find(
      (a) => a.entidadTipo === "carga" && a.accion === "carga.rechazar",
    );
    expect(rechazada).toBeDefined();
    expect(rechazada?.motivo).toMatch(/CBU/i);
  });

  it("los IDs de seed son exportados y son únicos", () => {
    const ids = [
      seedIds.OPERADOR_ID,
      seedIds.SUPERVISOR_ID,
      seedIds.ADMIN_ID,
      seedIds.SUPERADMIN_ID,
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
