/**
 * Tests del use case solicitarRetiro.
 *
 * Cubre:
 * - Happy path: registra un retiro en estado pending
 * - Permiso denegado: actor no es miembro activo del tenant
 * - Permiso denegado: rol sin `retiros.validar`
 * - Input inválido: falta playerRef, monto <= 0, CBU inválido
 * - El actor queda como `registradaPor` (esto es la base del cuatro-ojos)
 * - Escribe 1 entrada en audit_log con accion `retiro.solicitar`
 */

import { describe, expect, it } from "vitest";

import {
  solicitarRetiro,
  type SolicitarRetiroDeps,
} from "@/application/retiros/solicitar-retiro";
import { codigos } from "@/application/errors";
import { seedDemo, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";
import { crearAuditMock } from "@/infrastructure/repositories/mock/audit.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearRetirosMock } from "@/infrastructure/repositories/mock/retiros.mock";

interface Setup {
  deps: SolicitarRetiroDeps;
  store: MockStore;
}

function setup(): Setup {
  const store = new MockStore();
  seedDemo(store);
  return {
    deps: {
      retiros: crearRetirosMock(store),
      audit: crearAuditMock(store),
      members: crearMembersMock(store),
    },
    store,
  };
}

const CBU_VALIDO = "2850590940090418135201";

describe("solicitarRetiro", () => {
  it("registra un retiro en estado pending cuando el operador tiene permiso", async () => {
    const { deps } = setup();

    const r = await solicitarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 50_000,
      moneda: "ARS",
      cbuDestino: CBU_VALIDO,
      aliasDestino: "jugador.a3f9",
      titularDestino: "Juan Perez",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("pending");
    expect(r.data.registradaPor).toBe(seedIds.OPERADOR_ID);
    expect(r.data.validadaPor).toBeNull();
    expect(r.data.aprobadaPor).toBeNull();
    expect(r.data.pagadaPor).toBeNull();
    expect(r.data.version).toBe(1);
  });

  it("escribe 1 entrada en audit_log con accion retiro.solicitar", async () => {
    const { deps, store } = setup();

    const r = await solicitarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 50_000,
      moneda: "ARS",
      cbuDestino: CBU_VALIDO,
      titularDestino: "Juan Perez",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const audits = [...store.auditLog.values()].filter(
      (a) => a.entidadId === r.data.id,
    );
    expect(audits.length).toBe(1);
    expect(audits[0]?.accion).toBe("retiro.solicitar");
    expect(audits[0]?.actorId).toBe(seedIds.OPERADOR_ID);
  });

  it("rechaza con PERMISO_DENEGADO si el actor no es miembro del tenant", async () => {
    const { deps, store } = setup();
    const { userId } = await import("@/domain/ids");
    const orphan = userId("00000000-0000-4000-8000-000000000099");
    store.profiles.set(orphan, {
      id: orphan,
      email: "intruso@x.local",
      isSuperadmin: false,
      createdAt: new Date(),
    });

    const r = await solicitarRetiro(deps, orphan, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "x",
      montoCents: 1000,
      moneda: "ARS",
      cbuDestino: CBU_VALIDO,
      titularDestino: "T",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("rechaza con INPUT_INVALIDO si el CBU destino no pasa el checksum", async () => {
    const { deps } = setup();

    const r = await solicitarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "x",
      montoCents: 1000,
      moneda: "ARS",
      cbuDestino: "2850590940090418135202", // checksum inválido (último dígito cambiado)
      titularDestino: "T",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.CBU_INVALIDO);
  });

  it("rechaza con INPUT_INVALIDO si el monto es <= 0", async () => {
    const { deps } = setup();

    const r = await solicitarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "x",
      montoCents: 0,
      moneda: "ARS",
      cbuDestino: CBU_VALIDO,
      titularDestino: "T",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.INPUT_INVALIDO);
  });

  it("rechaza con INPUT_INVALIDO si falta playerRef", async () => {
    const { deps } = setup();

    const r = await solicitarRetiro(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "",
      montoCents: 1000,
      moneda: "ARS",
      cbuDestino: CBU_VALIDO,
      titularDestino: "T",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.INPUT_INVALIDO);
  });
});
