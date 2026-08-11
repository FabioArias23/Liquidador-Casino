/**
 * Tests del Zod schema del payload del webhook del casino.
 *
 * Es el mismo shape que `CargaExterna` (lo que viene del casino), pero
 * como JSON llega con strings/iso strings, no Date. El handler lo
 * transforma a Date antes de llamar al use case.
 */

import { describe, expect, it } from "vitest";

import { webhookCargaPayloadSchema } from "@/domain/schemas/webhook-carga";

describe("webhookCargaPayloadSchema", () => {
  const payloadValido = {
    externalRef: "casino-casino-demo-1700000000-1",
    playerRef: "jugador-a3f9",
    montoCents: 50_000,
    moneda: "ARS",
    metodo: "transferencia",
    timestamp: "2026-01-15T10:00:00Z",
    comprobanteUrl: "https://casino.com/comprobante.jpg",
  };

  it("acepta un payload valido completo", () => {
    const r = webhookCargaPayloadSchema.safeParse(payloadValido);
    expect(r.success).toBe(true);
  });

  it("acepta el payload sin comprobanteUrl (opcional)", () => {
    const { comprobanteUrl: _omit, ...rest } = payloadValido;
    const r = webhookCargaPayloadSchema.safeParse(rest);
    expect(r.success).toBe(true);
  });

  it("rechaza si falta externalRef", () => {
    const r = webhookCargaPayloadSchema.safeParse({ ...payloadValido, externalRef: "" });
    expect(r.success).toBe(false);
  });

  it("rechaza si falta playerRef", () => {
    const r = webhookCargaPayloadSchema.safeParse({ ...payloadValido, playerRef: "" });
    expect(r.success).toBe(false);
  });

  it("rechaza si montoCents no es entero positivo", () => {
    const r = webhookCargaPayloadSchema.safeParse({ ...payloadValido, montoCents: 0 });
    expect(r.success).toBe(false);
    const r2 = webhookCargaPayloadSchema.safeParse({ ...payloadValido, montoCents: -100 });
    expect(r2.success).toBe(false);
    const r3 = webhookCargaPayloadSchema.safeParse({ ...payloadValido, montoCents: 50.5 });
    expect(r3.success).toBe(false);
  });

  it("rechaza si timestamp no es ISO 8601", () => {
    const r = webhookCargaPayloadSchema.safeParse({ ...payloadValido, timestamp: "ayer" });
    expect(r.success).toBe(false);
  });

  it("rechaza si moneda no tiene 3 letras", () => {
    const r = webhookCargaPayloadSchema.safeParse({ ...payloadValido, moneda: "ARSX" });
    expect(r.success).toBe(false);
  });
});
