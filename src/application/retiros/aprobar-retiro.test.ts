/**
 * Tests del use case aprobarRetiro.
 *
 * Cubre el "cuatro-ojos" (ver PLAN-TECNICO.md §3 y §6):
 * el supervisor que aprueba NO puede ser el mismo operador que validó.
 *
 * Casos:
 * - Happy path: supervisor != operador que validó → approved.
 * - Cuatro-ojos: supervisor == validador → CUATRO_OJOS_APROBACION.
 * - Permiso: operador no puede aprobar.
 * - Estado: si el retiro no está en awaiting_approval, falla.
 * - Retiro no encontrado.
 * - Miembro inactivo o sin membresía → PERMISO_DENEGADO.
 */

import { describe, expect, it } from "vitest";

import { aprobarRetiro, type AprobarRetiroDeps } from "@/application/retiros/aprobar-retiro";
import { codigos } from "@/application/errors";
import { CODIGOS_ERROR_RETIRO } from "@/domain/retiros";
import type { Retiro } from "@/domain/entities";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { crearAuditMock } from "@/infrastructure/repositories/mock/audit.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearRetirosMock } from "@/infrastructure/repositories/mock/retiros.mock";

interface Setup {
  deps: AprobarRetiroDeps;
  store: MockStore;
  crearRetiro: (
    overrides: Partial<Retiro>,
    validadaPor?: Retiro["validadaPor"],
  ) => Promise<Retiro>;
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
    async crearRetiro(overrides, validadaPor = seedIds.OPERADOR_ID) {
      const now = new Date("2026-01-01T00:00:00Z");
      const r: Retiro = {
        id: `ret-${Math.random().toString(36).slice(2, 10)}`,
        tenantId: seedIds.CASINO_DEMO_ID,
        playerRef: "jugador-a3f9",
        montoCents: 2_000_000,
        moneda: "ARS",
        cbuDestino: "2850590940090418135201",
        aliasDestino: "jugador.a3f9",
        titularDestino: "Juan Perez",
        estado: "awaiting_approval",
        origen: "manual",
        externalRef: null,
        comprobanteUrl: null,
        motivoRechazo: null,
        registradaPor: seedIds.OPERADOR_ID,
        validadaPor,
        rechazadaPor: null,
        aprobadaPor: null,
        rechazadaAprobacionPor: null,
        pagadaPor: null,
        idempotencyKey: null,
        version: 2,
        createdAt: now,
        updatedAt: now,
        ...overrides,
      };
      await retiros.crear(r);
      return r;
    },
  };
}

describe("aprobarRetiro", () => {
  it("supervisor distinto al validador aprueba: awaiting_approval → approved", async () => {
    const { deps, crearRetiro } = setup();
    const retiro = await crearRetiro(
      {},
      seedIds.OPERADOR_ID, // validado por OPERADOR
    );

    const r = await aprobarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("approved");
    expect(r.data.aprobadaPor).toBe(seedIds.SUPERVISOR_ID);
  });

  it("cuatro-ojos: si el supervisor ES el validador, falla con CUATRO_OJOS_APROBACION", async () => {
    const { deps, crearRetiro } = setup();
    // Edge case hipotético: el supervisor validó. No debería poder aprobar.
    const retiro = await crearRetiro(
      {},
      seedIds.SUPERVISOR_ID, // validado por SUPERVISOR
    );

    const r = await aprobarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.CUATRO_OJOS_APROBACION);
  });

  it("permiso denegado: operador no puede aprobar retiros", async () => {
    const { deps, crearRetiro } = setup();
    const retiro = await crearRetiro({});

    const r = await aprobarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("estado inválido: si el retiro está en `validated`, falla con TRANSICION_INVALIDA", async () => {
    const { deps, crearRetiro } = setup();
    const retiro = await crearRetiro({ estado: "validated" });

    const r = await aprobarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.TRANSICION_INVALIDA);
  });

  it("retiro no encontrado", async () => {
    const { deps } = setup();
    const r = await aprobarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: "00000000-0000-4000-8000-000000000xxx",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.RETIRO_NO_ENCONTRADO);
  });

  it("actor sin membresía en el tenant → PERMISO_DENEGADO", async () => {
    const { deps, crearRetiro, store } = setup();
    const retiro = await crearRetiro({});

    // Crear un profile huérfano (no es miembro del tenant)
    const { userId } = await import("@/domain/ids");
    const orphan = userId("00000000-0000-4000-8000-000000000099");
    store.profiles.set(orphan, {
      id: orphan,
      email: "intruso@x.local",
      isSuperadmin: false,
      createdAt: new Date(),
    });

    const r = await aprobarRetiro(deps, orphan, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("escribe 1 entrada en audit_log con accion 'retiro.aprobar'", async () => {
    const { deps, crearRetiro, store } = setup();
    const retiro = await crearRetiro({});

    const r = await aprobarRetiro(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      retiroId: retiro.id,
    });
    expect(r.ok).toBe(true);

    const audits = [...store.auditLog.values()].filter(
      (a) => a.entidadId === retiro.id,
    );
    expect(audits.length).toBe(1);
    expect(audits[0].accion).toBe("retiro.aprobar");
    expect(audits[0].actorId).toBe(seedIds.SUPERVISOR_ID);
  });
});
