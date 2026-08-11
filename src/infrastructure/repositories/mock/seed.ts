/**
 * Datos de seed del mock (para que la app abra con algo visible).
 *
 * - 1 superadmin + 3 miembros (operador, supervisor, admin) en el tenant demo
 * - 1 tenant demo "Casino Demo" con 2 CBUs y 1 casino credentials
 * - 9 cargas en distintos estados (para mostrar el flujo de pagos)
 * - 3 retiros en distintos estados (incluyendo uno con cuatro-ojos completo)
 * - Audit log + ledger entries coherentes con las transiciones
 *
 * Los IDs son UUIDs v4 válidos (Zod valida con RFC 4122 — el 13° char
 * del 3er grupo debe ser "4" y el 17° del 4to grupo debe ser "8"|"9"|"a"|"b").
 * Usamos el rango 00000000-0000-4000-8000-0000000000NN para mantener legibilidad.
 *
 * Cargas: rango 00000000-0000-4000-8000-000000000100 a 109
 * Retiros: rango 00000000-0000-4000-8000-000000000200 a 202
 * Ledger:  rango 00000000-0000-4000-8000-000000000300 a 307
 * Audit:   rango 00000000-0000-4000-8000-000000000400 a 4FF
 */

import { calcularDigito } from "@/domain/cbu";
import type {
  AuditLog,
  Carga,
  CasinoCredentials,
  CbuAccount,
  LedgerEntry,
  Member,
  Profile,
  Retiro,
  Tenant,
} from "@/domain/entities";
import {
  auditLogId,
  cargaId,
  cbuAccountId,
  casinoCredentialsId,
  ledgerEntryId,
  memberId,
  tenantId,
  userId,
} from "@/domain/ids";

import type { MockStore } from "./store";

// IDs seed: deben ser UUIDs v4 válidos (Zod valida con RFC 4122).
const SUPERADMIN_ID = userId("00000000-0000-4000-8000-000000000001");
const OPERADOR_ID = userId("00000000-0000-4000-8000-000000000002");
const SUPERVISOR_ID = userId("00000000-0000-4000-8000-000000000003");
const ADMIN_ID = userId("00000000-0000-4000-8000-000000000004");

const CASINO_DEMO_ID = tenantId("00000000-0000-4000-8000-000000000010");

const MEMBER_OPERADOR_ID = memberId("00000000-0000-4000-8000-000000000020");
const MEMBER_SUPERVISOR_ID = memberId("00000000-0000-4000-8000-000000000021");
const MEMBER_ADMIN_ID = memberId("00000000-0000-4000-8000-000000000022");

const CBU_DEMO_ID = cbuAccountId("00000000-0000-4000-8000-000000000030");
const CBU_DEMO_2_ID = cbuAccountId("00000000-0000-4000-8000-000000000031");
const CASINO_CREDS_ID = casinoCredentialsId(
  "00000000-0000-4000-8000-000000000040",
);

// Cargas — IDs en rango 100-109 (9 cargas).
const CARGAS_IDS = {
  A3F9_2K_SETTLED: cargaId("00000000-0000-4000-8000-000000000100"),
  A3F9_5K_SETTLED: cargaId("00000000-0000-4000-8000-000000000101"),
  B7C2_1K5_SETTLED: cargaId("00000000-0000-4000-8000-000000000102"),
  B7C2_30K_SETTLED: cargaId("00000000-0000-4000-8000-000000000103"),
  A3F9_8K_VALIDATED: cargaId("00000000-0000-4000-8000-000000000104"),
  B7C2_2K5_VALIDATING: cargaId("00000000-0000-4000-8000-000000000105"),
  A3F9_12K_VALIDATING: cargaId("00000000-0000-4000-8000-000000000106"),
  B7C2_3K5_PENDING: cargaId("00000000-0000-4000-8000-000000000107"),
  A3F9_15K_REJECTED: cargaId("00000000-0000-4000-8000-000000000108"),
} as const;

// Retiros — IDs en rango 200-202 (3 retiros).
const RETIROS_IDS = {
  B7C2_500_PENDING: "00000000-0000-4000-8000-000000000200",
  A3F9_15K_AWAITING: "00000000-0000-4000-8000-000000000201",
  B7C2_3K_PAID: "00000000-0000-4000-8000-000000000202",
} as const;

function generarCbuValidoSeed(bloque1Cuerpo: string, bloque2Cuerpo: string): string {
  return (
    bloque1Cuerpo + String(calcularDigito(bloque1Cuerpo)) +
    bloque2Cuerpo + String(calcularDigito(bloque2Cuerpo))
  );
}

export function seedDemo(store: MockStore): void {
  seedBase(store);
  seedDemoNarrativo(store);
}

/**
 * Siembra solo las entidades base (identidad, tenant, miembros, CBUs, credenciales).
 * Los tests de use cases usan esto para tener IDs estables sin contaminar el store
 * con datos narrativos.
 */
export function seedBase(store: MockStore): void {
  const t0 = new Date("2026-01-01T00:00:00Z");

  const profiles: Profile[] = [
    {
      id: SUPERADMIN_ID,
      email: "superadmin@liquidador.local",
      isSuperadmin: true,
      createdAt: t0,
    },
    {
      id: ADMIN_ID,
      email: "admin@casinodemo.local",
      isSuperadmin: false,
      createdAt: t0,
    },
    {
      id: SUPERVISOR_ID,
      email: "supervisor@casinodemo.local",
      isSuperadmin: false,
      createdAt: t0,
    },
    {
      id: OPERADOR_ID,
      email: "operador@casinodemo.local",
      isSuperadmin: false,
      createdAt: t0,
    },
  ];
  for (const p of profiles) {
    store.profiles.set(p.id, p);
    store.emails.set(p.email, p.id);
  }

  const tenants: Tenant[] = [
    {
      id: CASINO_DEMO_ID,
      nombre: "Casino Demo",
      slug: "casino-demo",
      estado: "activo",
      createdAt: t0,
      updatedAt: t0,
    },
  ];
  for (const t of tenants) store.tenants.set(t.id, t);

  const members: Member[] = [
    {
      id: MEMBER_ADMIN_ID,
      tenantId: CASINO_DEMO_ID,
      userId: ADMIN_ID,
      email: "admin@casinodemo.local",
      rol: "tenant_admin",
      estado: "activo",
      createdAt: t0,
    },
    {
      id: MEMBER_SUPERVISOR_ID,
      tenantId: CASINO_DEMO_ID,
      userId: SUPERVISOR_ID,
      email: "supervisor@casinodemo.local",
      rol: "supervisor",
      estado: "activo",
      createdAt: t0,
    },
    {
      id: MEMBER_OPERADOR_ID,
      tenantId: CASINO_DEMO_ID,
      userId: OPERADOR_ID,
      email: "operador@casinodemo.local",
      rol: "operador",
      estado: "activo",
      createdAt: t0,
    },
  ];
  for (const m of members) store.members.set(m.id, m);

  const cbuAccounts: CbuAccount[] = [
    {
      id: CBU_DEMO_ID,
      tenantId: CASINO_DEMO_ID,
      cbu: generarCbuValidoSeed("0000000", "0000000000001"),
      alias: "casino.demo.ars",
      titular: "Casino Demo S.A.",
      moneda: "ARS",
      activa: true,
      createdAt: t0,
      updatedAt: t0,
    },
    {
      id: CBU_DEMO_2_ID,
      tenantId: CASINO_DEMO_ID,
      cbu: generarCbuValidoSeed("0000000", "0000000000002"),
      alias: "casino.demo.ars.2",
      titular: "Casino Demo S.A.",
      moneda: "ARS",
      activa: true,
      createdAt: t0,
      updatedAt: t0,
    },
  ];
  for (const c of cbuAccounts) store.cbuAccounts.set(c.id, c);

  const casinoCreds: CasinoCredentials[] = [
    {
      id: CASINO_CREDS_ID,
      tenantId: CASINO_DEMO_ID,
      adapterType: "configurable_http",
      baseUrl: "https://api.casino-demo.example.com",
      apiKeyCiphertext: null,
      webhookSecret: null,
      createdAt: t0,
      updatedAt: t0,
    },
  ];
  for (const c of casinoCreds) store.casinoCredentials.set(c.id, c);
}

/**
 * Siembra los datos narrativos del demo: 9 cargas + 8 ledger entries + 3 retiros
 * + audit log coherente con las transiciones.
 * Asume que `seedBase` ya corrió (necesita tenants, profiles, members, CBUs).
 */
export function seedDemoNarrativo(store: MockStore): void {
  // Las fechas se eligen para que el "formatRelativeTime" muestre tiempos razonables
  // cuando se opera la app recién clonada.
  const hace1h = new Date(Date.now() - 60 * 60 * 1000);
  const hace2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hace4h = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const hace5h = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const hace6h = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const hace8h = new Date(Date.now() - 8 * 60 * 60 * 1000);
  const hace10h = new Date(Date.now() - 10 * 60 * 60 * 1000);
  const hace12h = new Date(Date.now() - 12 * 60 * 60 * 1000);

  // ── Cargas (9 en distintos estados) ────────────────────────────────────
  const cargas: Carga[] = [
    {
      id: CARGAS_IDS.A3F9_2K_SETTLED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 200_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "manual",
      estado: "settled",
      externalRef: null,
      comprobanteUrl: "https://banco.demo/comprobante/100",
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: SUPERVISOR_ID,
      rechazadaPor: null,
      asentadaPor: ADMIN_ID,
      version: 4,
      createdAt: hace12h,
      updatedAt: hace10h,
    },
    {
      id: CARGAS_IDS.A3F9_5K_SETTLED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 500_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "api_casino",
      estado: "settled",
      externalRef: "casino-dep-2026-0001",
      comprobanteUrl: "https://api.casino-demo.example.com/dep/1",
      motivoRechazo: null,
      registradaPor: SUPERVISOR_ID,
      validadaPor: SUPERVISOR_ID,
      rechazadaPor: null,
      asentadaPor: ADMIN_ID,
      version: 4,
      createdAt: hace10h,
      updatedAt: hace8h,
    },
    {
      id: CARGAS_IDS.B7C2_1K5_SETTLED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 150_000,
      moneda: "ARS",
      metodo: "tarjeta",
      origen: "api_casino",
      estado: "settled",
      externalRef: "casino-dep-2026-0002",
      comprobanteUrl: "https://api.casino-demo.example.com/dep/2",
      motivoRechazo: null,
      registradaPor: SUPERVISOR_ID,
      validadaPor: ADMIN_ID,
      rechazadaPor: null,
      asentadaPor: ADMIN_ID,
      version: 4,
      createdAt: hace8h,
      updatedAt: hace6h,
    },
    {
      id: CARGAS_IDS.B7C2_30K_SETTLED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 3_000_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "manual",
      estado: "settled",
      externalRef: null,
      comprobanteUrl: "https://banco.demo/comprobante/103",
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: SUPERVISOR_ID,
      rechazadaPor: null,
      asentadaPor: ADMIN_ID,
      version: 4,
      createdAt: hace6h,
      updatedAt: hace5h,
    },
    {
      id: CARGAS_IDS.A3F9_8K_VALIDATED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 800_000,
      moneda: "ARS",
      metodo: "tarjeta",
      origen: "manual",
      estado: "validated",
      externalRef: null,
      comprobanteUrl: "https://banco.demo/comprobante/104",
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: SUPERVISOR_ID,
      rechazadaPor: null,
      asentadaPor: null,
      version: 3,
      createdAt: hace3h,
      updatedAt: hace2h,
    },
    {
      id: CARGAS_IDS.B7C2_2K5_VALIDATING,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 250_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "manual",
      estado: "validating",
      externalRef: null,
      comprobanteUrl: null,
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: null,
      rechazadaPor: null,
      asentadaPor: null,
      version: 2,
      createdAt: hace1h,
      updatedAt: hace1h,
    },
    {
      id: CARGAS_IDS.A3F9_12K_VALIDATING,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 1_200_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "api_casino",
      estado: "validating",
      externalRef: "casino-dep-2026-0003",
      comprobanteUrl: null,
      motivoRechazo: null,
      registradaPor: SUPERVISOR_ID,
      validadaPor: null,
      rechazadaPor: null,
      asentadaPor: null,
      version: 2,
      createdAt: hace1h,
      updatedAt: hace1h,
    },
    {
      id: CARGAS_IDS.B7C2_3K5_PENDING,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 350_000,
      moneda: "ARS",
      metodo: "tarjeta",
      origen: "manual",
      estado: "pending",
      externalRef: null,
      comprobanteUrl: null,
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: null,
      rechazadaPor: null,
      asentadaPor: null,
      version: 1,
      createdAt: hace2h,
      updatedAt: hace2h,
    },
    {
      id: CARGAS_IDS.A3F9_15K_REJECTED,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 1_500_000,
      moneda: "ARS",
      metodo: "transferencia",
      origen: "api_casino",
      estado: "rejected",
      externalRef: "casino-dep-2026-0004",
      comprobanteUrl: "https://api.casino-demo.example.com/dep/4",
      motivoRechazo: "CBU destino no coincide con el titular de la cuenta.",
      registradaPor: SUPERVISOR_ID,
      validadaPor: null,
      rechazadaPor: SUPERVISOR_ID,
      asentadaPor: null,
      version: 3,
      createdAt: hace4h,
      updatedAt: hace3h,
    },
  ];
  for (const c of cargas) store.cargas.set(c.id, c);

  // ── Ledger entries: 1 asiento (débito + crédito) por cada carga settled ──
  const ledgerEntries: LedgerEntry[] = [];
  const cargasSettled = cargas.filter((c) => c.estado === "settled");
  let ledgerSeq = 0x300;
  for (const c of cargasSettled) {
    const asientoId = `asiento-seed-${c.id.slice(-12)}`;
    const debitoId = ledgerEntryId(
      `00000000-0000-4000-8000-${String(ledgerSeq++).padStart(12, "0")}`,
    );
    const creditoId = ledgerEntryId(
      `00000000-0000-4000-8000-${String(ledgerSeq++).padStart(12, "0")}`,
    );
    ledgerEntries.push({
      id: debitoId,
      tenantId: CASINO_DEMO_ID,
      operacionTipo: "carga",
      operacionId: c.id,
      cuenta: `banco:carga:${c.id}`,
      tipo: "debito",
      montoCents: c.montoCents,
      moneda: c.moneda,
      descripcion: `Carga validada del jugador ${c.playerRef}`,
      asientoId,
      createdAt: c.updatedAt,
    });
    ledgerEntries.push({
      id: creditoId,
      tenantId: CASINO_DEMO_ID,
      operacionTipo: "carga",
      operacionId: c.id,
      cuenta: "casino:ingresos",
      tipo: "credito",
      montoCents: c.montoCents,
      moneda: c.moneda,
      descripcion: `Carga validada del jugador ${c.playerRef}`,
      asientoId,
      createdAt: c.updatedAt,
    });
  }
  for (const e of ledgerEntries) store.ledgerEntries.set(e.id, e);

  // ── Retiros (3 en distintos estados) ───────────────────────────────────
  const retiros: Retiro[] = [
    {
      id: RETIROS_IDS.B7C2_500_PENDING,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 50_000,
      moneda: "ARS",
      cbuDestino: generarCbuValidoSeed("0000000", "0000000000003"),
      aliasDestino: "jugador.b7c2.mp",
      titularDestino: "Maria Lopez",
      estado: "pending",
      origen: "manual",
      externalRef: null,
      comprobanteUrl: null,
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: null,
      rechazadaPor: null,
      aprobadaPor: null,
      rechazadaAprobacionPor: null,
      pagadaPor: null,
      idempotencyKey: null,
      version: 1,
      createdAt: hace1h,
      updatedAt: hace1h,
    },
    {
      id: RETIROS_IDS.A3F9_15K_AWAITING,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-a3f9",
      montoCents: 1_500_000,
      moneda: "ARS",
      cbuDestino: generarCbuValidoSeed("0000000", "0000000000004"),
      aliasDestino: "jugador.a3f9.mp",
      titularDestino: "Juan Perez",
      estado: "awaiting_approval",
      origen: "manual",
      externalRef: null,
      comprobanteUrl: null,
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: OPERADOR_ID,
      rechazadaPor: null,
      aprobadaPor: null,
      rechazadaAprobacionPor: null,
      pagadaPor: null,
      idempotencyKey: null,
      version: 3,
      createdAt: hace3h,
      updatedAt: hace2h,
    },
    {
      id: RETIROS_IDS.B7C2_3K_PAID,
      tenantId: CASINO_DEMO_ID,
      playerRef: "jugador-b7c2",
      montoCents: 300_000,
      moneda: "ARS",
      cbuDestino: generarCbuValidoSeed("0000000", "0000000000005"),
      aliasDestino: null,
      titularDestino: "Maria Lopez",
      estado: "paid",
      origen: "manual",
      externalRef: null,
      comprobanteUrl: "https://banco.demo/comprobante-pago/202",
      motivoRechazo: null,
      registradaPor: OPERADOR_ID,
      validadaPor: SUPERVISOR_ID,
      rechazadaPor: null,
      aprobadaPor: ADMIN_ID,
      rechazadaAprobacionPor: null,
      pagadaPor: OPERADOR_ID,
      idempotencyKey: "pago-seed-b7c2-300k-001",
      version: 6,
      createdAt: hace8h,
      updatedAt: hace5h,
    },
  ];
  for (const r of retiros) store.retiros.set(r.id, r);

  // ── Audit log: 1 entrada por transición relevante ─────────────────────
  const audits: AuditLog[] = [];
  let auditSeq = 0x400;
  function pushAudit(
    args: Omit<AuditLog, "id" | "createdAt">,
    when: Date,
  ): void {
    audits.push({
      ...args,
      id: auditLogId(
        `00000000-0000-4000-8000-${String(auditSeq++).padStart(12, "0")}`,
      ),
      createdAt: when,
    });
  }

  // Cargas: registrar, validar (si aplica), asentar (si settled), rechazar (si rejected).
  for (const c of cargas) {
    pushAudit(
      {
        tenantId: CASINO_DEMO_ID,
        actorId: c.registradaPor,
        accion: "carga.crear",
        entidadTipo: "carga",
        entidadId: c.id,
        before: null,
        after: { estado: "pending", montoCents: c.montoCents, playerRef: c.playerRef },
        motivo: null,
        metadata: { origen: c.origen, metodo: c.metodo },
      },
      c.createdAt,
    );
    if (c.validadaPor) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: c.validadaPor,
          accion: "carga.validar",
          entidadTipo: "carga",
          entidadId: c.id,
          before: { estado: "validating" },
          after: { estado: "validated", comprobanteUrl: c.comprobanteUrl },
          motivo: null,
          metadata: {},
        },
        new Date(c.createdAt.getTime() + 30 * 60 * 1000),
      );
    }
    if (c.rechazadaPor && c.motivoRechazo) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: c.rechazadaPor,
          accion: "carga.rechazar",
          entidadTipo: "carga",
          entidadId: c.id,
          before: { estado: c.estado === "rejected" ? "validating" : "validated" },
          after: { estado: "rejected" },
          motivo: c.motivoRechazo,
          metadata: {},
        },
        c.updatedAt,
      );
    }
    if (c.asentadaPor) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: c.asentadaPor,
          accion: "carga.asentar",
          entidadTipo: "carga",
          entidadId: c.id,
          before: { estado: "validated" },
          after: { estado: "settled" },
          motivo: null,
          metadata: { montoCents: c.montoCents },
        },
        c.updatedAt,
      );
    }
  }

  // Retiros: solicitar, validar (si aplica), aprobar (si aplica), iniciar_pago + completar_pago (si paid).
  for (const r of retiros) {
    pushAudit(
      {
        tenantId: CASINO_DEMO_ID,
        actorId: r.registradaPor,
        accion: "retiro.solicitar",
        entidadTipo: "retiro",
        entidadId: r.id,
        before: null,
        after: { estado: "pending", montoCents: r.montoCents, playerRef: r.playerRef },
        motivo: null,
        metadata: { montoCents: r.montoCents, playerRef: r.playerRef },
      },
      r.createdAt,
    );
    if (r.validadaPor) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: r.validadaPor,
          accion: "retiro.validar",
          entidadTipo: "retiro",
          entidadId: r.id,
          before: { estado: "pending" },
          after: { estado: "validated" },
          motivo: null,
          metadata: {},
        },
        new Date(r.createdAt.getTime() + 30 * 60 * 1000),
      );
    }
    if (r.estado === "awaiting_approval" || r.estado === "approved" || r.estado === "paying" || r.estado === "paid") {
      // El awaiting se gatilla cuando se valida un monto > umbral.
      if (r.validadaPor) {
        pushAudit(
          {
            tenantId: CASINO_DEMO_ID,
            actorId: r.validadaPor,
            accion: "retiro.solicitar_aprobacion",
            entidadTipo: "retiro",
            entidadId: r.id,
            before: { estado: "validated" },
            after: { estado: "awaiting_approval" },
            motivo: null,
            metadata: { montoCents: r.montoCents, umbral: 1_000_000 },
          },
          new Date(r.createdAt.getTime() + 31 * 60 * 1000),
        );
      }
    }
    if (r.aprobadaPor) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: r.aprobadaPor,
          accion: "retiro.aprobar",
          entidadTipo: "retiro",
          entidadId: r.id,
          before: { estado: "awaiting_approval" },
          after: { estado: "approved" },
          motivo: null,
          metadata: { validadaPor: r.validadaPor, aprobadaPor: r.aprobadaPor },
        },
        new Date(r.createdAt.getTime() + 60 * 60 * 1000),
      );
    }
    if (r.pagadaPor) {
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: r.pagadaPor,
          accion: "retiro.iniciar_pago",
          entidadTipo: "retiro",
          entidadId: r.id,
          before: { estado: "approved" },
          after: { estado: "paying" },
          motivo: null,
          metadata: { comprobanteUrl: r.comprobanteUrl, idempotencyKey: r.idempotencyKey },
        },
        new Date(r.createdAt.getTime() + 90 * 60 * 1000),
      );
      pushAudit(
        {
          tenantId: CASINO_DEMO_ID,
          actorId: r.pagadaPor,
          accion: "retiro.completar_pago",
          entidadTipo: "retiro",
          entidadId: r.id,
          before: { estado: "paying" },
          after: { estado: "paid" },
          motivo: null,
          metadata: { comprobanteUrl: r.comprobanteUrl, idempotencyKey: r.idempotencyKey },
        },
        r.updatedAt,
      );
    }
  }

  for (const a of audits) store.auditLog.set(a.id, a);
}

export const seedIds = {
  SUPERADMIN_ID,
  OPERADOR_ID,
  SUPERVISOR_ID,
  ADMIN_ID,
  CASINO_DEMO_ID,
  MEMBER_OPERADOR_ID,
  MEMBER_SUPERVISOR_ID,
  MEMBER_ADMIN_ID,
  CBU_DEMO_ID,
  CBU_DEMO_2_ID,
  CASINO_CREDS_ID,
  CARGAS_IDS,
  RETIROS_IDS,
} as const;
