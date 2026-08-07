import { describe, expect, it } from "vitest";

import type { Carga } from "@/domain/entities";
import {
  cargaId,
  tenantId,
  userId,
} from "@/domain/ids";

import {
  aplicarAccion,
  CODIGOS_ERROR_CARGA,
  ESTADOS_CARGA,
  ORIGENES_CARGA,
  puedeTransicionar,
  type EstadoCarga,
} from "./cargas";

function setup(estado: EstadoCarga): Carga {
  return {
    id: cargaId("00000000-0000-0000-0000-0000000000a1"),
    tenantId: tenantId("00000000-0000-0000-0000-0000000000c1"),
    playerRef: "jugador-001",
    montoCents: 10_000, // $ 100,00
    moneda: "ARS",
    metodo: "transferencia",
    origen: "manual",
    estado,
    externalRef: null,
    comprobanteUrl: null,
    motivoRechazo: null,
    registradaPor: userId("00000000-0000-0000-0000-0000000000b1"),
    validadaPor: null,
    rechazadaPor: null,
    asentadaPor: null,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

const ACTOR = userId("00000000-0000-0000-0000-0000000000b2");

describe("state machine de Carga — constantes", () => {
  it("expone 5 estados en orden de ciclo de vida", () => {
    expect(ESTADOS_CARGA).toEqual([
      "pending",
      "validating",
      "validated",
      "settled",
      "rejected",
    ]);
  });

  it("expone 2 orígenes (manual y api_casino)", () => {
    expect(ORIGENES_CARGA).toEqual(["manual", "api_casino"]);
  });
});

describe("puedeTransicionar", () => {
  const VALIDAS: [EstadoCarga, EstadoCarga][] = [
    ["pending", "validating"],
    ["pending", "rejected"],
    ["validating", "validated"],
    ["validating", "rejected"],
    ["validated", "settled"],
    ["validated", "rejected"],
  ];

  it.each(VALIDAS)("permite %s → %s", (from, to) => {
    expect(puedeTransicionar(from, to)).toBe(true);
  });

  const INVALIDAS: [EstadoCarga, EstadoCarga][] = [
    // Saltos
    ["pending", "validated"],
    ["pending", "settled"],
    ["validating", "settled"],
    // Reversas
    ["validating", "pending"],
    ["validated", "pending"],
    ["validated", "validating"],
    ["settled", "validated"],
    ["settled", "validating"],
    ["settled", "rejected"],
    ["rejected", "pending"],
    ["rejected", "validating"],
    ["rejected", "validated"],
    ["rejected", "settled"],
  ];

  it.each(INVALIDAS)("rechaza %s → %s", (from, to) => {
    expect(puedeTransicionar(from, to)).toBe(false);
  });

  it("settled es terminal (no sale)", () => {
    const ESTADOS_DESTINO: EstadoCarga[] = [
      "pending",
      "validating",
      "validated",
      "rejected",
    ];
    for (const to of ESTADOS_DESTINO) {
      expect(puedeTransicionar("settled", to)).toBe(false);
    }
  });

  it("rejected es terminal (no sale)", () => {
    const ESTADOS_DESTINO: EstadoCarga[] = [
      "pending",
      "validating",
      "validated",
      "settled",
    ];
    for (const to of ESTADOS_DESTINO) {
      expect(puedeTransicionar("rejected", to)).toBe(false);
    }
  });
});

describe("aplicarAccion — happy paths", () => {
  it("iniciar_validacion: pending → validating", () => {
    const r = aplicarAccion(setup("pending"), "iniciar_validacion", ACTOR);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validating");
    expect(r.data.version).toBe(2);
    expect(r.data.updatedAt.getTime()).toBeGreaterThan(
      setup("pending").updatedAt.getTime(),
    );
  });

  it("validar con comprobante: validating → validated (registra validadaPor)", () => {
    const r = aplicarAccion(setup("validating"), "validar", ACTOR, {
      comprobanteUrl: "/comprobantes/abc.jpg",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validated");
    expect(r.data.validadaPor).toBe(ACTOR);
    expect(r.data.comprobanteUrl).toBe("/comprobantes/abc.jpg");
    expect(r.data.version).toBe(2);
  });

  it("rechazar desde pending con motivo: → rejected (registra rechazadaPor)", () => {
    const r = aplicarAccion(setup("pending"), "rechazar", ACTOR, {
      motivo: "CBU no coincide con titular",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
    expect(r.data.rechazadaPor).toBe(ACTOR);
    expect(r.data.motivoRechazo).toBe("CBU no coincide con titular");
  });

  it("rechazar desde validating con motivo: → rejected", () => {
    const r = aplicarAccion(setup("validating"), "rechazar", ACTOR, {
      motivo: "Comprobante ilegible",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
    expect(r.data.motivoRechazo).toBe("Comprobante ilegible");
  });

  it("asentar: validated → settled (registra asentadaPor)", () => {
    const r = aplicarAccion(setup("validated"), "asentar", ACTOR);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("settled");
    expect(r.data.asentadaPor).toBe(ACTOR);
  });

  it("no muta la carga original (devuelve copia)", () => {
    const original = setup("pending");
    const r = aplicarAccion(original, "iniciar_validacion", ACTOR);

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).not.toBe(original);
    expect(original.estado).toBe("pending");
    expect(original.version).toBe(1);
  });
});

describe("aplicarAccion — validaciones de input", () => {
  it("validar sin comprobante → error COMPROBANTE_REQUERIDO", () => {
    const r = aplicarAccion(setup("validating"), "validar", ACTOR);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.COMPROBANTE_REQUERIDO);
  });

  it("rechazar sin motivo → error MOTIVO_REQUERIDO", () => {
    const r = aplicarAccion(setup("pending"), "rechazar", ACTOR);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.MOTIVO_REQUERIDO);
  });

  it("rechazar con motivo vacío → error MOTIVO_REQUERIDO", () => {
    const r = aplicarAccion(setup("pending"), "rechazar", ACTOR, {
      motivo: "   ",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.MOTIVO_REQUERIDO);
  });
});

describe("aplicarAccion — transiciones inválidas", () => {
  it("asentar desde pending → error TRANSICION_INVALIDA", () => {
    const r = aplicarAccion(setup("pending"), "asentar", ACTOR);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.TRANSICION_INVALIDA);
    expect(r.error.mensaje).toMatch(/asentar/);
    expect(r.error.mensaje).toMatch(/pending/);
  });

  it("validar desde pending → error (hay que iniciar_validacion primero)", () => {
    const r = aplicarAccion(setup("pending"), "validar", ACTOR, {
      comprobanteUrl: "/x.jpg",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.TRANSICION_INVALIDA);
  });

  it("rechazar desde settled → error (terminal)", () => {
    const r = aplicarAccion(setup("settled"), "rechazar", ACTOR, {
      motivo: "tarde",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_CARGA.TRANSICION_INVALIDA);
  });

  it("cualquier acción desde rejected → error (terminal)", () => {
    const r1 = aplicarAccion(setup("rejected"), "iniciar_validacion", ACTOR);
    expect(r1.ok).toBe(false);

    const r2 = aplicarAccion(setup("rejected"), "asentar", ACTOR);
    expect(r2.ok).toBe(false);
  });
});

describe("aplicarAccion — invariantes", () => {
  it("cada transición exitosa incrementa version en exactamente 1", () => {
    const c = setup("pending");
    const r1 = aplicarAccion(c, "iniciar_validacion", ACTOR);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    const r2 = aplicarAccion(r1.data, "validar", ACTOR, {
      comprobanteUrl: "/x.jpg",
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;

    const r3 = aplicarAccion(r2.data, "asentar", ACTOR);
    expect(r3.ok).toBe(true);
    if (!r3.ok) return;

    expect(r3.data.version).toBe(c.version + 3);
  });

  it("transición fallida NO modifica la carga (version intacta)", () => {
    const c = setup("pending");
    const r = aplicarAccion(c, "asentar", ACTOR); // transición inválida
    expect(r.ok).toBe(false);

    expect(c.version).toBe(1);
    expect(c.estado).toBe("pending");
  });
});