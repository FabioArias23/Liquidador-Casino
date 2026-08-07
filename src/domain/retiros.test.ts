/**
 * Tests del state machine de Retiro (puro, sin frameworks).
 * PLAN-TECNICO.md §4:
 *   pending → validated → awaiting_approval → approved → paying → paid
 *              ↘ rejected        ↘ rejected        ↘ failed
 *
 * El state machine valida solo transiciones + datos requeridos.
 * El cuatro-ojos se valida en el caso de uso (necesita conocer al actor anterior).
 */

import { describe, it, expect } from "vitest";

import { userId } from "@/domain/ids";
import { centavos } from "@/domain/money";

import {
  aplicarAccion,
  CODIGOS_ERROR_RETIRO,
  ESTADOS_RETIRO,
  type EstadoRetiro,
  puedeTransicionar,
} from "./retiros";
import type { Retiro } from "./entities";

const TENANT = userId("00000000-0000-4000-8000-000000000010") as never;
const OPERADOR = userId("00000000-0000-4000-8000-000000000002");
const SUPERVISOR = userId("00000000-0000-4000-8000-000000000003");

function retiroBase(overrides: Partial<Retiro> = {}): Retiro {
  return {
    id: "ret-1" as never,
    tenantId: TENANT as never,
    playerRef: "jugador-a3f9",
    montoCents: centavos(50_000),
    moneda: "ARS",
    cbuDestino: "2850590940090418135201",
    aliasDestino: "jugador.a3f9",
    titularDestino: "Juan Perez",
    estado: "pending",
    origen: "manual",
    externalRef: null,
    comprobanteUrl: null,
    motivoRechazo: null,
    registradaPor: OPERADOR,
    validadaPor: null,
    rechazadaPor: null,
    aprobadaPor: null,
    rechazadaAprobacionPor: null,
    pagadaPor: null,
    version: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("retiros · state machine", () => {
  describe("estados", () => {
    it("define los 7 estados del dominio", () => {
      expect(ESTADOS_RETIRO).toEqual([
        "pending",
        "validated",
        "awaiting_approval",
        "approved",
        "paying",
        "paid",
        "rejected",
        "failed",
      ]);
    });
  });

  describe("puedeTransicionar", () => {
    it("pending puede ir a validated o rejected", () => {
      expect(puedeTransicionar("pending", "validated")).toBe(true);
      expect(puedeTransicionar("pending", "rejected")).toBe(true);
      expect(puedeTransicionar("pending", "awaiting_approval")).toBe(false);
      expect(puedeTransicionar("pending", "approved")).toBe(false);
      expect(puedeTransicionar("pending", "paying")).toBe(false);
      expect(puedeTransicionar("pending", "paid")).toBe(false);
      expect(puedeTransicionar("pending", "failed")).toBe(false);
    });

    it("validated puede ir a awaiting_approval o rejected", () => {
      expect(puedeTransicionar("validated", "awaiting_approval")).toBe(true);
      expect(puedeTransicionar("validated", "rejected")).toBe(true);
      expect(puedeTransicionar("validated", "approved")).toBe(false);
    });

    it("awaiting_approval puede ir a approved o rejected", () => {
      expect(puedeTransicionar("awaiting_approval", "approved")).toBe(true);
      expect(puedeTransicionar("awaiting_approval", "rejected")).toBe(true);
    });

    it("approved puede ir a paying", () => {
      expect(puedeTransicionar("approved", "paying")).toBe(true);
      expect(puedeTransicionar("approved", "rejected")).toBe(false);
    });

    it("paying puede ir a paid o failed", () => {
      expect(puedeTransicionar("paying", "paid")).toBe(true);
      expect(puedeTransicionar("paying", "failed")).toBe(true);
    });

    it("terminales: paid, rejected y failed no transicionan", () => {
      const terminales: EstadoRetiro[] = ["paid", "rejected", "failed"];
      for (const t of terminales) {
        for (const destino of ESTADOS_RETIRO) {
          expect(puedeTransicionar(t, destino)).toBe(false);
        }
      }
    });
  });

  describe("aplicarAccion · validar (pending → validated)", () => {
    it("valida un retiro pendiente con CBU correcto y titular presente", () => {
      const r = aplicarAccion(retiroBase(), "validar", OPERADOR);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.estado).toBe("validated");
      expect(r.data.validadaPor).toBe(OPERADOR);
      expect(r.data.version).toBe(2);
    });

    it("rechaza si el CBU destino está vacío", () => {
      const r = aplicarAccion(retiroBase({ cbuDestino: "" }), "validar", OPERADOR);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.CBU_DESTINO_REQUERIDO);
    });

    it("rechaza si el titular destino está vacío", () => {
      const r = aplicarAccion(retiroBase({ titularDestino: "" }), "validar", OPERADOR);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.TITULAR_DESTINO_REQUERIDO);
    });

    it("no se puede validar dos veces", () => {
      const yaValidado = { ...retiroBase(), estado: "validated" as EstadoRetiro };
      const r = aplicarAccion(yaValidado, "validar", OPERADOR);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.TRANSICION_INVALIDA);
    });
  });

  describe("aplicarAccion · rechazar (cualquier estado no terminal → rejected)", () => {
    it("rechaza un retiro pendiente con motivo", () => {
      const r = aplicarAccion(retiroBase(), "rechazar", OPERADOR, { motivo: "CBU no pertenece al jugador." });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.estado).toBe("rejected");
      expect(r.data.rechazadaPor).toBe(OPERADOR);
      expect(r.data.motivoRechazo).toBe("CBU no pertenece al jugador.");
    });

    it("rechaza un retiro validated con motivo", () => {
      const validated = { ...retiroBase(), estado: "validated" as EstadoRetiro };
      const r = aplicarAccion(validated, "rechazar", OPERADOR, { motivo: "Datos no coinciden." });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.estado).toBe("rejected");
    });

    it("no se puede rechazar un retiro paid", () => {
      const paid = { ...retiroBase(), estado: "paid" as EstadoRetiro };
      const r = aplicarAccion(paid, "rechazar", OPERADOR, { motivo: "tarde" });
      expect(r.ok).toBe(false);
    });

    it("rechazar sin motivo falla con MOTIVO_REQUERIDO", () => {
      const r = aplicarAccion(retiroBase(), "rechazar", OPERADOR, { motivo: "" });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.MOTIVO_REQUERIDO);
    });
  });

  describe("aplicarAccion · solicitar_aprobacion (validated → awaiting_approval)", () => {
    it("pasa a awaiting_approval cuando el monto supera el umbral", () => {
      const validated = {
        ...retiroBase(),
        estado: "validated" as EstadoRetiro,
        validadaPor: OPERADOR,
      };
      const r = aplicarAccion(validated, "solicitar_aprobacion", OPERADOR);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.estado).toBe("awaiting_approval");
    });
  });

  describe("aplicarAccion · aprobar (awaiting_approval → approved)", () => {
    it("aprueba con un supervisor distinto al que validó", () => {
      const enAprobacion = {
        ...retiroBase(),
        estado: "awaiting_approval" as EstadoRetiro,
        validadaPor: OPERADOR,
      };
      const r = aplicarAccion(enAprobacion, "aprobar", SUPERVISOR);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.data.estado).toBe("approved");
      expect(r.data.aprobadaPor).toBe(SUPERVISOR);
    });
  });
});
