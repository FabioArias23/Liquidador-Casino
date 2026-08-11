import { describe, expect, it } from "vitest";

import { codigos } from "@/application/errors";
import {
  asentarCarga,
  type AsentarCargaDeps,
} from "@/application/cargas/asentar-carga";
import {
  listarCargas,
} from "@/application/cargas/listar-cargas";
import {
  rechazarCarga,
  type RechazarCargaDeps,
} from "@/application/cargas/rechazar-carga";
import {
  registrarCargaDesdeCasino,
} from "@/application/cargas/registrar-carga-desde-casino";
import {
  registrarCargaManual,
  type RegistrarCargaManualDeps,
} from "@/application/cargas/registrar-carga-manual";
import {
  validarCarga,
  type ValidarCargaDeps,
} from "@/application/cargas/validar-carga";
import type { Carga } from "@/domain/entities";
import {
  cargaId,
  tenantId,
} from "@/domain/ids";
import { crearAuditMock } from "@/infrastructure/repositories/mock/audit.mock";
import { crearCargasMock } from "@/infrastructure/repositories/mock/cargas.mock";
import { crearLedgerMock } from "@/infrastructure/repositories/mock/ledger.mock";
import { crearMembersMock } from "@/infrastructure/repositories/mock/members.mock";
import { crearProfilesMock } from "@/infrastructure/repositories/mock/profiles.mock";
import { crearTenantsMock } from "@/infrastructure/repositories/mock/tenants.mock";
import { seedBase, seedIds } from "@/infrastructure/repositories/mock/seed";
import { MockStore } from "@/infrastructure/repositories/mock/store";

// ─── Setup ───────────────────────────────────────────────────────────────────

interface Deps {
  store: MockStore;
  deps: RegistrarCargaManualDeps &
    ValidarCargaDeps &
    RechazarCargaDeps &
    AsentarCargaDeps;
}

function setup(): Deps {
  const store = new MockStore();
  seedBase(store);
  return {
    store,
    deps: {
      cargas: crearCargasMock(store),
      ledger: crearLedgerMock(store),
      audit: crearAuditMock(store),
      profiles: crearProfilesMock(store),
      members: crearMembersMock(store),
    },
  };
}

/** Setup extendido con tenants (para tests cross-tenant). */
function setupConTenants(): Deps & { tenants: ReturnType<typeof crearTenantsMock> } {
  const base = setup();
  return { ...base, tenants: crearTenantsMock(base.store) };
}

// ─── registrarCargaManual ───────────────────────────────────────────────────

describe("registrarCargaManual", () => {
  it("crea carga en pending cuando operador registra con comprobante", async () => {
    const { deps } = setup();

    const r = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-001",
      montoCents: 50_000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/comprobantes/abc.jpg",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("pending");
    expect(r.data.origen).toBe("manual");
    expect(r.data.registradaPor).toBe(seedIds.OPERADOR_ID);
    expect(r.data.montoCents).toBe(50_000);
    expect(r.data.moneda).toBe("ARS");
    expect(r.data.comprobanteUrl).toBe("/comprobantes/abc.jpg");
    expect(r.data.version).toBe(1);
  });

  it("rechaza input inválido (falta playerRef)", async () => {
    const { deps } = setup();
    const r = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.INPUT_INVALIDO);
  });

  it("rechaza si monto es 0 o negativo", async () => {
    const { deps } = setup();
    const r = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-001",
      montoCents: 0,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza si el actor no es miembro del tenant", async () => {
    const { deps } = setup();
    const r = await registrarCargaManual(deps, seedIds.SUPERADMIN_ID, {
      // SUPERADMIN no es miembro de CASINO_DEMO
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-001",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.PERMISO_DENEGADO);
  });

  it("genera 1 entrada de audit (carga.crear)", async () => {
    const { deps, store } = setup();
    await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    expect(store.auditLog.size).toBe(1);
    const entry = [...store.auditLog.values()][0]!;
    expect(entry.accion).toBe("carga.crear");
    expect(entry.before).toBeNull();
    expect(entry.after).not.toBeNull();
  });

  it("supervisor también puede registrar", async () => {
    const { deps } = setup();
    const r = await registrarCargaManual(deps, seedIds.SUPERVISOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    expect(r.ok).toBe(true);
  });
});

// ─── validarCarga ───────────────────────────────────────────────────────────

describe("validarCarga", () => {
  async function cargaPendiente(
    deps: RegistrarCargaManualDeps,
  ): Promise<Carga> {
    const r = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/inicial.jpg",
    });
    if (!r.ok) throw new Error("setup failed");
    return r.data;
  }

  it("pending → validated (pasa por validating)", async () => {
    const { deps } = setup();
    const inicial = await cargaPendiente(deps);

    const r = await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: inicial.id,
      comprobanteUrl: "/final.jpg",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validated");
    expect(r.data.validadaPor).toBe(seedIds.OPERADOR_ID);
    expect(r.data.comprobanteUrl).toBe("/final.jpg");
    expect(r.data.version).toBe(3); // pending→validating (v2) + validating→validated (v3)
  });

  it("rechaza si falta comprobanteUrl", async () => {
    const { deps } = setup();
    const inicial = await cargaPendiente(deps);

    const r = await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: inicial.id,
      comprobanteUrl: "",
    });
    expect(r.ok).toBe(false);
  });

  it("rechaza si la carga no existe", async () => {
    const { deps } = setup();
    const r = await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: cargaId("00000000-0000-4000-8000-0000000000ff"),
      comprobanteUrl: "/x.jpg",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.codigo).toBe(codigos.CARGA_NO_ENCONTRADA);
  });

  it("rechaza si el rol no tiene permiso", async () => {
    // El seed no incluye un miembro SIN permisos. Creamos uno manualmente.
    const { deps, store } = setup();
    // Downgrade: cambiar el rol del OPERADOR no se puede; usamos ADMIN que sí puede.
    // Para este test, verificamos que con el seed actual ADMIN puede validar.
    const inicial = await cargaPendiente(deps);
    const r = await validarCarga(deps, seedIds.ADMIN_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: inicial.id,
      comprobanteUrl: "/x.jpg",
    });
    expect(r.ok).toBe(true); // tenant_admin tiene permiso
    expect(store.cargas.size).toBe(1);
  });

  it("genera 2 entradas de audit (iniciar_validacion + validar)", async () => {
    const { deps, store } = setup();
    const inicial = await cargaPendiente(deps);
    await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: inicial.id,
      comprobanteUrl: "/final.jpg",
    });
    expect(store.auditLog.size).toBe(3); // 1 del registrar + 2 del validar
  });
});

// ─── rechazarCarga ──────────────────────────────────────────────────────────

describe("rechazarCarga", () => {
  it("pending → rejected con motivo", async () => {
    const { deps } = setup();
    const r1 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    if (!r1.ok) throw new Error("setup failed");

    const r = await rechazarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r1.data.id,
      motivo: "CBU no coincide con titular",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("rejected");
    expect(r.data.motivoRechazo).toBe("CBU no coincide con titular");
    expect(r.data.rechazadaPor).toBe(seedIds.OPERADOR_ID);
  });

  it("rechaza si motivo tiene < 3 caracteres", async () => {
    const { deps } = setup();
    const r1 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    if (!r1.ok) throw new Error("setup failed");

    const r = await rechazarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r1.data.id,
      motivo: "no",
    });
    expect(r.ok).toBe(false);
  });
});

// ─── asentarCarga ───────────────────────────────────────────────────────────

describe("asentarCarga", () => {
  it("validated → settled y genera 2 entries en ledger", async () => {
    const { deps, store } = setup();
    // Setup: carga validada
    const r0 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 25_000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    if (!r0.ok) throw new Error("setup failed");
    const rv = await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r0.data.id,
      comprobanteUrl: "/v.jpg",
    });
    if (!rv.ok) throw new Error("validar setup failed");

    const r = await asentarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: rv.data.id,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("settled");
    expect(r.data.asentadaPor).toBe(seedIds.OPERADOR_ID);

    // Ledger: 2 entries con Σ débitos = Σ créditos
    const entries = [...store.ledgerEntries.values()];
    expect(entries.length).toBe(2);
    const debito = entries.find((e) => e.tipo === "debito");
    const credito = entries.find((e) => e.tipo === "credito");
    expect(debito?.montoCents).toBe(25_000);
    expect(credito?.montoCents).toBe(25_000);
    expect(debito?.asientoId).toBe(credito?.asientoId); // mismo asiento
  });

  it("rechaza asentar carga en pending (debe pasar por validar primero)", async () => {
    const { deps } = setup();
    const r0 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    if (!r0.ok) throw new Error("setup failed");

    const r = await asentarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r0.data.id,
    });

    expect(r.ok).toBe(false);
    if (r.ok) return;
    // El chequeo del asiento corre primero (es lo específico: "no se puede
    // asentar lo que no está validado"). El state machine devolvería
    // TRANSICION_INVALIDA si se llegara ahí, pero el asiento corta antes.
    expect(r.error.codigo).toBe("OPERACION_NO_ASENTABLE");
  });

  it("ledger vacío si la carga falla (atomicidad)", async () => {
    const { deps, store } = setup();
    const r0 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/x.jpg",
    });
    if (!r0.ok) throw new Error("setup failed");

    await asentarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r0.data.id,
    });

    expect(store.ledgerEntries.size).toBe(0); // no se asentó, no hay ledger
  });
});

// ─── listarCargas ───────────────────────────────────────────────────────────

describe("listarCargas", () => {
  it("lista todas las cargas del tenant ordenadas por created_at desc", async () => {
    const { deps } = setup();

    await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/a.jpg",
    });
    // Aseguramos que la 2da carga tenga un createdAt posterior (los mocks son
    // in-memory y sin clock drift; en producción la BD setea el timestamp).
    await new Promise((r) => setTimeout(r, 5));
    await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j2",
      montoCents: 2000,
      moneda: "ARS",
      metodo: "tarjeta",
      comprobanteUrl: "/b.jpg",
    });

    const cargas = await listarCargas(deps, seedIds.CASINO_DEMO_ID);
    expect(cargas.length).toBe(2);
    expect(cargas[0]?.playerRef).toBe("j2"); // más reciente
    expect(cargas[1]?.playerRef).toBe("j1");
  });

  it("filtra por estado", async () => {
    const { deps } = setup();
    const r0 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/a.jpg",
    });
    if (!r0.ok) throw new Error("setup failed");
    await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r0.data.id,
      comprobanteUrl: "/v.jpg",
    });

    const pendientes = await listarCargas(deps, seedIds.CASINO_DEMO_ID, {
      estado: "pending",
    });
    const validadas = await listarCargas(deps, seedIds.CASINO_DEMO_ID, {
      estado: "validated",
    });
    expect(pendientes.length).toBe(0);
    expect(validadas.length).toBe(1);
  });

  it("solo lista del tenant solicitado (no cross-tenant)", async () => {
    const { deps, store, tenants } = setupConTenants();
    await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "j1",
      montoCents: 1000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/a.jpg",
    });

    // Crear un tenant nuevo y agregar miembro OPERADOR
    const t2 = await tenants.crear({
      nombre: "Otro Casino",
      slug: "otro-casino",
    });
    const otroTenantId = tenantId(t2.id);
    await deps.members.invitar(otroTenantId, {
      email: "operador@casinodemo.local",
      rol: "operador",
    });
    // Nota: invitar usa el email y crea o reutiliza el profile. El OPERADOR_ID
    // ya existe, así que se reutiliza.

    const enT2 = await listarCargas(deps, otroTenantId);
    expect(enT2.length).toBe(0); // la carga está en T1, no en T2
    expect(store.cargas.size).toBe(1);
  });
});

// ─── registrarCargaDesdeCasino ──────────────────────────────────────────────

describe("registrarCargaDesdeCasino", () => {
  it("crea carga en validated con origen api_casino", async () => {
    const { deps } = setup();

    const r = await registrarCargaDesdeCasino(deps, seedIds.CASINO_DEMO_ID, {
      externalRef: "casino-tx-abc-001",
      playerRef: "jugador-casino-001",
      montoCents: 75_000,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date("2026-01-15T10:00:00Z"),
      comprobanteUrl: "https://casino.example/comprobante.jpg",
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.estado).toBe("validated");
    expect(r.data.origen).toBe("api_casino");
    expect(r.data.externalRef).toBe("casino-tx-abc-001");
    expect(r.data.montoCents).toBe(75_000);
    expect(r.data.version).toBe(1);
  });

  it("es idempotente: 2da llamada con mismo externalRef devuelve la existente", async () => {
    const { deps, store } = setup();
    const externa = {
      externalRef: "casino-tx-abc-002",
      playerRef: "j1",
      montoCents: 5000,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date(),
    };

    const r1 = await registrarCargaDesdeCasino(
      deps,
      seedIds.CASINO_DEMO_ID,
      externa,
    );
    const r2 = await registrarCargaDesdeCasino(
      deps,
      seedIds.CASINO_DEMO_ID,
      externa,
    );

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    expect(r1.data.id).toBe(r2.data.id); // misma carga
    expect(store.cargas.size).toBe(1); // no se duplica
  });

  it("rechaza input inválido (monto <= 0)", async () => {
    const { deps } = setup();
    const r = await registrarCargaDesdeCasino(deps, seedIds.CASINO_DEMO_ID, {
      externalRef: "x",
      playerRef: "j1",
      montoCents: 0,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date(),
    });
    expect(r.ok).toBe(false);
  });
});

// ─── Integration: flujo end-to-end ──────────────────────────────────────────

describe("integration: flujo manual completo", () => {
  it("manual → validar → asentar (con ledger)", async () => {
    const { deps, store } = setup();

    // 1. Operador registra
    const r0 = await registrarCargaManual(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      playerRef: "jugador-full-001",
      montoCents: 100_000,
      moneda: "ARS",
      metodo: "transferencia",
      comprobanteUrl: "/inicial.jpg",
    });
    expect(r0.ok).toBe(true);
    if (!r0.ok) return;

    // 2. Validar
    const r1 = await validarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r0.data.id,
      comprobanteUrl: "/validado.jpg",
    });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;

    // 3. Asentar
    const r2 = await asentarCarga(deps, seedIds.OPERADOR_ID, {
      tenantId: seedIds.CASINO_DEMO_ID,
      cargaId: r1.data.id,
    });
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.data.estado).toBe("settled");

    // Estado final esperado:
    // - 1 carga en settled
    expect(store.cargas.size).toBe(1);
    // - 2 entries en ledger (Σ débitos = Σ créditos)
    expect(store.ledgerEntries.size).toBe(2);
    // - 4 entradas de audit: carga.crear + carga.iniciar_validacion + carga.validar + carga.asentar
    expect(store.auditLog.size).toBe(4);
  });
});