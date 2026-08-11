/**
 * Tests del helper generarCierrePDF.
 *
 * No testeamos el contenido exacto del PDF (jspdf no es 100% determinístico).
 * Testeamos que:
 * - Devuelve un Buffer
 * - El buffer empieza con la firma `%PDF-` (es un PDF válido)
 * - El tamaño es razonable (> 500 bytes para header + datos básicos)
 */

import { describe, expect, it } from "vitest";

import { generarCierrePDF, type CierrePDFData } from "@/lib/cierre-pdf";

const dataMock: CierrePDFData = {
  tenantNombre: "Casino Demo",
  tenantSlug: "casino-demo",
  fecha: new Date("2026-01-15T20:00:00Z"),
  inicioDelDia: new Date("2026-01-15T00:00:00Z"),
  totalCargasFormateado: "$3.500,00",
  totalRetirosFormateado: "$1.000,00",
  netoFormateado: "$2.500,00",
  cantidadCargas: 2,
  cantidadRetiros: 1,
  operaciones: [
    {
      tipo: "carga",
      id: "c1",
      playerRef: "jugador-a3f9",
      montoCents: 100_000,
      moneda: "ARS",
      estado: "settled",
      updatedAt: new Date("2026-01-15T10:00:00Z"),
    },
    {
      tipo: "retiro",
      id: "r1",
      playerRef: "jugador-b7c2",
      montoCents: 50_000,
      moneda: "ARS",
      estado: "paid",
      updatedAt: new Date("2026-01-15T12:00:00Z"),
    },
  ],
};

describe("generarCierrePDF", () => {
  it("devuelve un Buffer que empieza con la firma %PDF-", () => {
    const buf = generarCierrePDF(dataMock);
    expect(Buffer.isBuffer(buf)).toBe(true);
    const head = buf.subarray(0, 5).toString("ascii");
    expect(head).toBe("%PDF-");
  });

  it("el PDF generado tiene un tamaño razonable", () => {
    const buf = generarCierrePDF(dataMock);
    expect(buf.length).toBeGreaterThan(500);
  });

  it("soporta data con 0 operaciones (no rompe)", () => {
    const dataVacia: CierrePDFData = {
      ...dataMock,
      totalCargasFormateado: "$0,00",
      totalRetirosFormateado: "$0,00",
      netoFormateado: "$0,00",
      cantidadCargas: 0,
      cantidadRetiros: 0,
      operaciones: [],
    };
    const buf = generarCierrePDF(dataVacia);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(300);
  });
});
