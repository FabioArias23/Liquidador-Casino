/**
 * Tests del helper calcularCierreDiario.
 *
 * Cubre:
 * - Suma de cargas asentadas (settled) del día
 * - Suma de retiros pagados (paid) del día
 * - Neto (cargas - retiros)
 * - Cantidades
 * - Operaciones detalladas (para la tabla del día)
 * - Solo cuenta lo del día (filtro por updatedAt >= inicioDelDia)
 * - Ignora estados que no son terminales (pending, validated, etc.)
 */

import { describe, expect, it } from "vitest";

import { calcularCierreDiario } from "@/application/cierre/calcular-cierre";
import type { Carga, Retiro } from "@/domain/entities";
import { cargaId } from "@/domain/ids";

function fecha(iso: string): Date {
  return new Date(iso);
}

function carga(
  overrides: Partial<Carga> & { updatedAt: Date },
): Carga {
  return {
    id: cargaId("c-1"),
    tenantId: "t-1" as never,
    playerRef: "j-1",
    montoCents: 0,
    moneda: "ARS",
    metodo: "transferencia",
    origen: "manual",
    estado: "settled",
    externalRef: null,
    comprobanteUrl: null,
    motivoRechazo: null,
    registradaPor: "u-1" as never,
    validadaPor: null,
    rechazadaPor: null,
    asentadaPor: null,
    version: 1,
    createdAt: overrides.updatedAt,
    ...overrides,
  };
}

function retiro(
  overrides: Partial<Retiro> & { updatedAt: Date },
): Retiro {
  return {
    id: "r-1",
    tenantId: "t-1" as never,
    playerRef: "j-1",
    montoCents: 0,
    moneda: "ARS",
    cbuDestino: "0000000000000000000000",
    aliasDestino: null,
    titularDestino: "T",
    estado: "paid",
    origen: "manual",
    externalRef: null,
    comprobanteUrl: null,
    motivoRechazo: null,
    registradaPor: "u-1" as never,
    validadaPor: null,
    rechazadaPor: null,
    aprobadaPor: null,
    rechazadaAprobacionPor: null,
    pagadaPor: null,
    idempotencyKey: null,
    version: 1,
    createdAt: overrides.updatedAt,
    ...overrides,
  };
}

describe("calcularCierreDiario", () => {
  const inicio = fecha("2026-01-15T00:00:00Z");
  const fin = fecha("2026-01-15T23:59:59Z");

  it("suma cargas settled y retiros paid del día en ARS", () => {
    const cargas: Carga[] = [
      carga({ id: cargaId("c1"), montoCents: 100_000, estado: "settled", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      carga({ id: cargaId("c2"), montoCents: 250_000, estado: "settled", updatedAt: fecha("2026-01-15T15:00:00Z") }),
    ];
    const retiros: Retiro[] = [
      retiro({ id: "r1", montoCents: 50_000, estado: "paid", updatedAt: fecha("2026-01-15T12:00:00Z") }),
    ];
    const r = calcularCierreDiario({ cargas, retiros, inicio, fin });
    expect(r.totalCargasCents).toBe(350_000);
    expect(r.totalRetirosCents).toBe(50_000);
    expect(r.netoCents).toBe(300_000);
    expect(r.cantidadCargas).toBe(2);
    expect(r.cantidadRetiros).toBe(1);
  });

  it("ignora cargas que no están en estado settled", () => {
    const cargas: Carga[] = [
      carga({ id: cargaId("c1"), montoCents: 100_000, estado: "settled", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      carga({ id: cargaId("c2"), montoCents: 200_000, estado: "pending", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      carga({ id: cargaId("c3"), montoCents: 300_000, estado: "validated", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      carga({ id: cargaId("c4"), montoCents: 400_000, estado: "rejected", updatedAt: fecha("2026-01-15T10:00:00Z") }),
    ];
    const r = calcularCierreDiario({ cargas, retiros: [], inicio, fin });
    expect(r.totalCargasCents).toBe(100_000);
    expect(r.cantidadCargas).toBe(1);
  });

  it("ignora retiros que no están en estado paid", () => {
    const retiros: Retiro[] = [
      retiro({ id: "r1", montoCents: 100_000, estado: "paid", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      retiro({ id: "r2", montoCents: 200_000, estado: "approved", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      retiro({ id: "r3", montoCents: 300_000, estado: "awaiting_approval", updatedAt: fecha("2026-01-15T10:00:00Z") }),
    ];
    const r = calcularCierreDiario({ cargas: [], retiros, inicio, fin });
    expect(r.totalRetirosCents).toBe(100_000);
    expect(r.cantidadRetiros).toBe(1);
  });

  it("ignora operaciones fuera del rango de fechas", () => {
    const cargas: Carga[] = [
      carga({ id: cargaId("c1"), montoCents: 100_000, estado: "settled", updatedAt: fecha("2026-01-15T10:00:00Z") }),
      carga({ id: cargaId("c2"), montoCents: 200_000, estado: "settled", updatedAt: fecha("2026-01-14T10:00:00Z") }), // ayer
      carga({ id: cargaId("c3"), montoCents: 300_000, estado: "settled", updatedAt: fecha("2026-01-16T10:00:00Z") }), // mañana
    ];
    const r = calcularCierreDiario({ cargas, retiros: [], inicio, fin });
    expect(r.totalCargasCents).toBe(100_000);
    expect(r.cantidadCargas).toBe(1);
  });

  it("devuelve el listado de operaciones del día para la tabla", () => {
    const cargas: Carga[] = [
      carga({ id: cargaId("c1"), montoCents: 100_000, estado: "settled", updatedAt: fecha("2026-01-15T10:00:00Z"), playerRef: "j-a" }),
    ];
    const retiros: Retiro[] = [
      retiro({ id: "r1", montoCents: 50_000, estado: "paid", updatedAt: fecha("2026-01-15T12:00:00Z"), playerRef: "j-b" }),
    ];
    const r = calcularCierreDiario({ cargas, retiros, inicio, fin });
    expect(r.operaciones.length).toBe(2);
    const tipos = r.operaciones.map((o) => o.tipo).sort();
    expect(tipos).toEqual(["carga", "retiro"]);
  });

  it("con 0 operaciones del día, totales en 0 y neto en 0", () => {
    const r = calcularCierreDiario({ cargas: [], retiros: [], inicio, fin });
    expect(r.totalCargasCents).toBe(0);
    expect(r.totalRetirosCents).toBe(0);
    expect(r.netoCents).toBe(0);
    expect(r.cantidadCargas).toBe(0);
    expect(r.cantidadRetiros).toBe(0);
    expect(r.operaciones).toEqual([]);
  });
});
