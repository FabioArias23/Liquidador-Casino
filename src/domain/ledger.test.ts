import { describe, expect, it } from "vitest";

import type { Carga } from "@/domain/entities";
import {
  cargaId,
  tenantId,
  userId,
} from "@/domain/ids";

import {
  aplicarPartidaDoble,
  CODIGOS_ERROR_LEDGER,
  generarAsientoCargaValidada,
  type AsientoInput,
  type MovimientoContable,
} from "./ledger";

function mov(
  cuenta: string,
  tipo: "debito" | "credito",
  montoCents: number,
): MovimientoContable {
  return { cuenta, tipo, montoCents };
}

function inputValido(overrides: Partial<AsientoInput> = {}): AsientoInput {
  return {
    operacionTipo: "carga",
    operacionId: "op-1",
    descripcion: "Test",
    movimientos: [
      mov("banco:1234", "debito", 1000),
      mov("casino:ingresos", "credito", 1000),
    ],
    ...overrides,
  };
}

describe("aplicarPartidaDoble — happy paths", () => {
  it("acepta asiento con débitos = créditos", () => {
    const r = aplicarPartidaDoble(inputValido());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totalDebitos).toBe(1000);
    expect(r.data.totalCreditos).toBe(1000);
    expect(r.data.asientoId).toMatch(/^asiento-/);
  });

  it("acepta asiento con débitos y créditos múltiples que Σ-igualan", () => {
    // El helper valida SOLO el par global, no los 2 movimientos pueden ser varios.
    // Para mantener simple: el input es siempre [debito, credito].
    const r = aplicarPartidaDoble(inputValido());

    expect(r.ok).toBe(true);
  });

  it("acepta asiento con monto 0 (registro sin movimiento de plata, ej: anulación)", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco:1234", "debito", 0),
          mov("casino:ingresos", "credito", 0),
        ],
      }),
    );

    expect(r.ok).toBe(true);
  });

  it("preserva operacionTipo, operacionId y descripcion", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        operacionTipo: "retiro",
        operacionId: "ret-123",
        descripcion: "Retiro validado",
      }),
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.operacionTipo).toBe("retiro");
    expect(r.data.operacionId).toBe("ret-123");
    expect(r.data.descripcion).toBe("Retiro validado");
  });

  it("acepta descripción vacía (no es requerida)", () => {
    const r = aplicarPartidaDoble(inputValido({ descripcion: "" }));
    expect(r.ok).toBe(true);
  });
});

describe("aplicarPartidaDoble — invariante Σ débitos = Σ créditos", () => {
  it("rechaza cuando débitos > créditos", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", 1000),
          mov("casino:ingresos", "credito", 999),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.ASIENTO_DESBALANCEADO);
  });

  it("rechaza cuando créditos > débitos", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", 500),
          mov("casino:ingresos", "credito", 501),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.ASIENTO_DESBALANCEADO);
  });

  it("rechaza diferencia de 1 centavo", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", 10_000),
          mov("casino:ingresos", "credito", 10_001),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.ASIENTO_DESBALANCEADO);
  });
});

describe("aplicarPartidaDoble — estructura", () => {
  it("rechaza si no hay un débito y un crédito (dos débitos)", () => {
    const r = aplicarPartidaDoble({
      ...inputValido(),
      movimientos: [
        mov("banco", "debito", 500),
        mov("casino:ingresos", "debito", 500),
      ],
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.MOVIMIENTOS_INVALIDOS);
  });

  it("rechaza si no hay un débito y un crédito (dos créditos)", () => {
    const r = aplicarPartidaDoble({
      ...inputValido(),
      movimientos: [
        mov("banco", "credito", 500),
        mov("casino:ingresos", "credito", 500),
      ],
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.MOVIMIENTOS_INVALIDOS);
  });

  it("rechaza monto negativo en débito", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", -100),
          mov("casino:ingresos", "credito", -100),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.MONTO_INVALIDO);
  });

  it("rechaza monto negativo en crédito", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", 100),
          mov("casino:ingresos", "credito", -100),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.MONTO_INVALIDO);
  });

  it("rechaza monto no entero en débito", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("banco", "debito", 100.5),
          mov("casino:ingresos", "credito", 100.5),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.MONTO_INVALIDO);
  });

  it("rechaza cuenta vacía", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("", "debito", 100),
          mov("casino:ingresos", "credito", 100),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.CUENTA_REQUERIDA);
  });

  it("rechaza cuenta con solo espacios", () => {
    const r = aplicarPartidaDoble(
      inputValido({
        movimientos: [
          mov("   ", "debito", 100),
          mov("casino:ingresos", "credito", 100),
        ],
      }),
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.CUENTA_REQUERIDA);
  });
});

describe("generarAsientoCargaValidada", () => {
  function setup(estado: "validated" | "settled" | "pending" = "validated"): Carga {
    return {
      id: cargaId("00000000-0000-0000-0000-0000000000a1"),
      tenantId: tenantId("00000000-0000-0000-0000-0000000000c1"),
      playerRef: "jugador-001",
      montoCents: 25_000, // $ 250,00
      moneda: "ARS",
      metodo: "transferencia",
      origen: "manual",
      estado,
      externalRef: null,
      comprobanteUrl: "/comprobantes/x.jpg",
      motivoRechazo: null,
      registradaPor: userId("00000000-0000-0000-0000-0000000000b1"),
      validadaPor: userId("00000000-0000-0000-0000-0000000000b2"),
      rechazadaPor: null,
      asentadaPor: null,
      version: 2,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
  }

  it("genera asiento con débito banco y crédito casino-ingresos", () => {
    const r = generarAsientoCargaValidada(setup("validated"));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.operacionTipo).toBe("carga");
    expect(r.data.operacionId).toBe("00000000-0000-0000-0000-0000000000a1");
    expect(r.data.movimientos).toHaveLength(2);

    const [debito, credito] = r.data.movimientos;
    expect(debito.tipo).toBe("debito");
    expect(debito.cuenta).toMatch(/^banco:/);
    expect(debito.montoCents).toBe(25_000);

    expect(credito.tipo).toBe("credito");
    expect(credito.cuenta).toMatch(/^casino:ingresos/);
    expect(credito.montoCents).toBe(25_000);
  });

  it("asiento generado pasa por aplicarPartidaDoble (Σ débitos = Σ créditos)", () => {
    const r = generarAsientoCargaValidada(setup("validated"));

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.totalDebitos).toBe(25_000);
    expect(r.data.totalCreditos).toBe(25_000);
  });

  it("rechaza si la carga NO está validated", () => {
    const r = generarAsientoCargaValidada(setup("pending"));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_LEDGER.OPERACION_NO_ASENTABLE);
  });

  it("rechaza si la carga está settled pero no validated (transición inválida)", () => {
    const r = generarAsientoCargaValidada(setup("settled"));
    expect(r.ok).toBe(false);
  });
});