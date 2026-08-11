/**
 * Tests del NonceStore: previene replay attacks en webhooks.
 *
 * Cada nonce solo se puede usar 1 vez por tenant dentro de la ventana TTL.
 * Después de la TTL, se considera "vencido" y el siguiente uso está OK
 * (porque el timestamp window ya lo bloqueó — los dos mecanismos se
 * complementan).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NonceStore } from "@/lib/nonce-store";

describe("NonceStore", () => {
  let store: NonceStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));
    store = new NonceStore({ ttlMs: 60_000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("acepta un nonce nuevo", () => {
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
  });

  it("rechaza un nonce ya usado (mismo tenant)", () => {
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(false);
  });

  it("acepta el mismo nonce en distintos tenants (aislamiento por tenant)", () => {
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    expect(store.esNuevo("otro-tenant", "nonce-1")).toBe(true);
  });

  it("rechaza un nonce viejo (fuera de TTL)", () => {
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    vi.advanceTimersByTime(120_000); // 2 minutos — pasa la TTL
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true); // venció, se puede reusar
  });

  it("limpia nonces vencidos al insertar uno nuevo (memoria acotada)", () => {
    store.esNuevo("casino-demo", "nonce-1");
    vi.advanceTimersByTime(120_000);
    store.esNuevo("casino-demo", "nonce-2"); // dispara limpieza
    // nonce-1 ya no está, nonce-2 sí
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    expect(store.esNuevo("casino-demo", "nonce-2")).toBe(false);
  });

  it("acepta multiples nonces distintos en orden", () => {
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    expect(store.esNuevo("casino-demo", "nonce-2")).toBe(true);
    expect(store.esNuevo("casino-demo", "nonce-3")).toBe(true);
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(false);
    expect(store.esNuevo("casino-demo", "nonce-2")).toBe(false);
  });

  it("permite resetear un tenant especifico", () => {
    store.esNuevo("casino-demo", "nonce-1");
    store.esNuevo("otro-tenant", "nonce-1");
    store.resetTenant("casino-demo");
    expect(store.esNuevo("casino-demo", "nonce-1")).toBe(true);
    expect(store.esNuevo("otro-tenant", "nonce-1")).toBe(false);
  });
});
