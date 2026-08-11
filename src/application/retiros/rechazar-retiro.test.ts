/**
 * Tests del use case rechazarRetiro.
 *
 * Cubre:
 * - Happy path: pending → rejected (con motivo)
 * - Validated → rejected (también permitido)
 * - awaiting_approval → rejected (también permitido, equivalente a rechazar aprobación)
 * - Permiso denegado: actor no es miembro activo
 * - Retiro no encontrado
 * - Retiro ya terminal (paid, rejected, failed) → TRANSICION_INVALIDA
 * - Motivo requerido (no se puede rechazar sin motivo)
 * - Escribe 1 entrada en audit_log con motivo
 */

import { describe, expect, it } from "vitest";

import {
  rechazarRetiro,
  type RechazarRetiroDeps,
} from "@/application/retiros/rechazar-retiro";
import { codigos } from "@/application/errors";
import { CODIGOS_ERROR_RETIRO } from "@/domain/retiros";
import type { Retiro } from "@/domain/entities";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { crearAuditMock } from "@/infrastructure/repositories/mock/audit.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearRetirosMock } from "@/infrastructure/repositories/mock/retiros.mock";

interface Setup {
  deps: RechazarRetiroDeps;
  store: MockStore;
  crearRetiroBase: (overrides: Partial<Retiro>) => Promise<Retiro>;
}

function setup(): Setup {
  const store = new MockStore();
  seedDemo(store);
  const retiros = crearRetirosMock(store);
  return {
    deps: {
      retiros,
      audit: crearAuditMock(store),
      members: crearMembersMock(store),
    },
    store,
    async crearRetiroBase(overrides) {
      const now = new Date("2026-01-01T00:00:00Z");
      const r: Retiro = {
        id: `ret-${Math.random().toString(36).slice(2, 10)}`,
        tenantId: seedIds.CASINO_DEMO_ID,
        playerRef: "jugador-a3f9",
        montoCents: 50_000,
        moneda: "ARS",
        cbuDestino: "2850590940090418135201",
        aliasDestino: null,
        titularDestino: "Juan Perez",
        estado: "pending",
        origen: "manual",
        externalRef: null,
        comprobanteUrl: null,
        motivoRechazo: null,
        registradaPor: seedIds.OPERADOR_ID,
        validadaPor: null,
        rechazadaPor: null,
        aprobadaPor: null,
        rechazadaAprobacionPor: null,
        pagadaPor: null,
        idempotencyKey: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      };
      await retiros.crear(r);
      return r;
    },
  };
}

describe("rechazarRetiro", () => {
  it("rechaza un retiro pending con motivo", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({});

    const r = await rechazarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "CBU no coincide con titular",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
    expect(r.data.motivoRechazo).toBe("CBU no coincide con titular");
    expect(r.data.rechazadaPor).toBe(seedIds.OPERADOR_ID);
  });

  it("rechaza un retiro validated (también permitido)", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({
      estado: "validated",
      validadaPor: seedIds.OPERADOR_ID,
    });

    const r = await rechazarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "CBU con error de tipeo",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
  });

  it("rechaza un retiro awaiting_approval", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({
      estado: "awaiting_approval",
      validadaPor: seedIds.OPERADOR_ID,
    });

    const r = await rechazarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "Monto excede política",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
  });

  it("rechaza con PERMISO_DENEGADO si el actor no es miembro", async () => {
    const { deps, crearRetiroBase, store } = setup();
    const retiro = await crearRetiroBase({});
    const { userId } = await import("@/domain/ids");
    const orphan = userId("00000000-0000-4000-8000-000000000099");
    store.profiles.set(orphan, {
      id: orphan,
      email: "intruso@x.local",
      isSuperadmin: false,
      createdAt: new Date(),
    });

    const r = await rechazarRetiro(deps, orphan, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "x",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("rechaza con RETIRO_NO_ENCONTRADO si el id no existe", async () => {
    const { deps } = setup();
    const r = await rechazarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: "00000000-0000-4000-8000-000000000xxx",
      motivo: "x",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.RETIRO_NO_ENCONTRADO);
  });

  it("rechaza con TRANSICION_INVALIDA si el retiro ya está paid", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({
      estado: "paid",
      validadaPor: seedIds.OPERADOR_ID,
      aprobadaPor: seedIds.SUPERVISOR_ID,
      pagadaPor: seedIds.OPERADOR_ID,
      comprobanteUrl: "https://x",
      idempotencyKey: "k",
    });

    const r = await rechazarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "x",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.TRANSICION_INVALIDA);
  });

  it("rechaza con MOTIVO_REQUERIDO si el motivo está vacío", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({});

    const r = await rechazarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.MOTIVO_REQUERIDO);
  });

  it("escribe 1 entrada en audit_log con el motivo", async () => {
    const { deps, crearRetiroBase, store } = setup();
    const retiro = await crearRetiroBase({});

    const r = await rechazarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
      motivo: "CBU inválido",
    });
    expect(r.ok).toBe(true);

    const audits = [...store.auditLog.values()].filter(
      (a) => a.entidadId === retiro.id,
    );
    expect(audits.length).toBe(1);
    expect(audits[0]?.accion).toBe("retiro.rechazar");
    expect(audits[0]?.motivo).toBe("CBU inválido");
  });
});
