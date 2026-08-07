/**
 * Tests del use case validarRetiro.
 *
 * Cubre:
 * - Happy path: pending → validated (operador con permiso)
 * - Si supera umbral: pending → validated → awaiting_approval
 * - Permiso denegado: rol sin `retiros.validar`
 * - Retiro no encontrado
 * - Retiro ya validado (estado != pending)
 * - CBU destino con checksum inválido
 * - Cuatro-ojos: si el operador es el mismo que registró el retiro,
 *   validar OK (validar no es parte de cuatro-ojos — el cuatro-ojos es
 *   entre validar y aprobar). Documentado para que no se rompa en refactors.
 */

import { describe, expect, it } from "vitest";

import {
  validarRetiro,
  type ValidarRetiroDeps,
} from "@/application/retiros/validar-retiro";
import { codigos } from "@/application/errors";
import { CODIGOS_ERROR_RETIRO } from "@/domain/retiros";
import type { Retiro } from "@/domain/entities";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { crearAuditMock } from "@/infrastructure/repositories/mock/audit.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearRetirosMock } from "@/infrastructure/repositories/mock/retiros.mock";

interface Setup {
  deps: ValidarRetiroDeps;
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
        montoCents: 50_000, // $500
        moneda: "ARS",
        cbuDestino: "2850590940090418135201", // CBU seed válido
        aliasDestino: "jugador.a3f9",
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

describe("validarRetiro", () => {
  it("valida un retiro pendiente cuando el operador tiene permiso", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({ montoCents: 50_000 });

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validated");
    expect(r.data.validadaPor).toBe(seedIds.OPERADOR_ID);
  });

  it("si supera el umbral, además pasa a awaiting_approval", async () => {
    const { deps, crearRetiroBase } = setup();
    // monto 2_000_000 = $20.000 > umbral 1_000_000
    const retiro = await crearRetiroBase({ montoCents: 2_000_000 });

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("awaiting_approval");
  });

  it("si NO supera el umbral, queda en validated (no awaiting_approval)", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({ montoCents: 500_000 }); // $5.000 < umbral 1_000_000

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validated");
  });

  it("rechaza con PERMISO_DENEGADO si el actor no es miembro activo", async () => {
    const { deps, crearRetiroBase, store } = setup();
    const retiro = await crearRetiroBase({});

    // Crear un profile huérfano (sin member) y usar su id
    const { userId } = await import("@/domain/ids");
    const orphan = userId("00000000-0000-4000-8000-000000000099");
    store.profiles.set(orphan, {
      id: orphan,
      email: "intruso@x.local",
      isSuperadmin: false,
      createdAt: new Date(),
    });

    const r = await validarRetiro(
      deps,
      orphan,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("rechaza con RETIRO_NO_ENCONTRADO si el id no existe", async () => {
    const { deps } = setup();
    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      {
        tenantId: seedIds.CASINO_DEMO_ID,
        retiroId: "00000000-0000-4000-8000-000000000xxx",
        umbralDobleAprobacionCents: 1_000_000,
      },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.RETIRO_NO_ENCONTRADO);
  });

  it("rechaza con TRANSICION_INVALIDA si el retiro ya está validated", async () => {
    const { deps, crearRetiroBase } = setup();
    const retiro = await crearRetiroBase({ estado: "validated", validadaPor: seedIds.OPERADOR_ID });

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(CODIGOS_ERROR_RETIRO.TRANSICION_INVALIDA);
  });

  it("rechaza si el CBU destino no pasa el checksum oficial (BCRA)", async () => {
    const { deps, crearRetiroBase } = setup();
    // CBU con caracteres no numéricos → normalizarCBU devuelve null.
    const retiro = await crearRetiroBase({ cbuDestino: "abcdefghijklmnopqrstuv" });

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.CBU_INVALIDO);
  });

  it("rechaza input inválido (falta retiroId)", async () => {
    const { deps } = setup();
    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: "", umbralDobleAprobacionCents: 1_000_000 },
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.INPUT_INVALIDO);
  });

  it("escribe 2 entradas en audit_log cuando supera umbral (validar + solicitar_aprobacion)", async () => {
    const { deps, crearRetiroBase, store } = setup();
    const retiro = await crearRetiroBase({ montoCents: 2_000_000 });

    const r = await validarRetiro(
      deps,
      seedIds.OPERADOR_ID,
      { tenantId: seedIds.CASINO_DEMO_ID, retiroId: retiro.id, umbralDobleAprobacionCents: 1_000_000 },
    );
    expect(r.ok).toBe(true);
    const audits = [...store.auditLog.values()].filter(
      (a) => a.entidadId === retiro.id,
    );
    expect(audits.length).toBe(2);
    expect(audits.map((a) => a.accion).sort()).toEqual([
      "retiro.solicitar_aprobacion",
      "retiro.validar",
    ]);
  });

  // (Sanity de un detalle del mock para confirmar que `actualizar` con version
  // desfasada devuelve CONCURRENCIA. No es del use case, pero lo dejo
  // documentado porque es el comportamiento que el código depende.)
  it("mock: actualizar con version desfasada devuelve CONCURRENCIA", async () => {
    const store = new MockStore();
    seedDemo(store);
    const retiros = crearRetirosMock(store);
    const now = new Date();
    const r: Retiro = {
      id: "r-test",
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "x",
      montoCents: 1,
      moneda: "ARS",
      cbuDestino: "2850590940090418135201",
      aliasDestino: null,
      titularDestino: "T",
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
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await retiros.crear(r);
    // 1ra actualización: storage v=1, caller vio v=1, manda v=2 → OK
    const primerUpdate = await retiros.actualizar({ ...r, version: 2 }, 1);
    expect(primerUpdate.ok).toBe(true);
    // 2da actualización: storage v=2, caller cree ver v=1 → CONCURRENCIA
    const segundoUpdate = await retiros.actualizar({ ...r, version: 3 }, 1);
    expect(segundoUpdate.ok).toBe(false);
    if (segundoUpdate.ok) return;
    expect(segundoUpdate.error.codigo).toBe("CONCURRENCIA");
  });
});
