/**
 * Datos de seed del mock (para que la app abra con algo visible).
 * 1 superadmin + 1 tenant demo + 3 miembros + 1 CBU + 1 casino creds (vacías).
 */

import { calcularDigito } from "@/domain/cbu";
import type {
  CasinoCredentials,
  CbuAccount,
  Member,
  Profile,
  Tenant,
} from "@/domain/entities";
import {
  cbuAccountId,
  casinoCredentialsId,
  memberId,
  tenantId,
  userId,
} from "@/domain/ids";

import type { MockStore } from "./store";

// IDs seed: deben ser UUIDs v4 válidos (Zod valida con RFC 4122 — el 13° char
// del 3er grupo debe ser "4" y el 17° del 4to grupo debe ser "8"|"9"|"a"|"b").
// Usamos el rango 00000000-0000-4000-8000-0000000000NN para mantener legibilidad.
const SUPERADMIN_ID = userId("00000000-0000-4000-8000-000000000001");
const OPERADOR_ID = userId("00000000-0000-4000-8000-000000000002");
const SUPERVISOR_ID = userId("00000000-0000-4000-8000-000000000003");
const ADMIN_ID = userId("00000000-0000-4000-8000-000000000004");

const CASINO_DEMO_ID = tenantId("00000000-0000-4000-8000-000000000010");

const MEMBER_OPERADOR_ID = memberId("00000000-0000-4000-8000-000000000020");
const MEMBER_SUPERVISOR_ID = memberId("00000000-0000-4000-8000-000000000021");
const MEMBER_ADMIN_ID = memberId("00000000-0000-4000-8000-000000000022");

const CBU_DEMO_ID = cbuAccountId("00000000-0000-4000-8000-000000000030");
const CASINO_CREDS_ID = casinoCredentialsId(
  "00000000-0000-4000-8000-000000000040",
);

function generarCbuValidoSeed(): string {
  const c1 = "0000000";
  const c2 = "0000000000001";
  return c1 + String(calcularDigito(c1)) + c2 + String(calcularDigito(c2));
}

export function seedDemo(store: MockStore): void {
  const now = new Date("2026-01-01T00:00:00Z");

  const profiles: Profile[] = [
    {
      id: SUPERADMIN_ID,
      email: "superadmin@liquidador.local",
      isSuperadmin: true,
      createdAt: now,
    },
    {
      id: ADMIN_ID,
      email: "admin@casinodemo.local",
      isSuperadmin: false,
      createdAt: now,
    },
    {
      id: SUPERVISOR_ID,
      email: "supervisor@casinodemo.local",
      isSuperadmin: false,
      createdAt: now,
    },
    {
      id: OPERADOR_ID,
      email: "operador@casinodemo.local",
      isSuperadmin: false,
      createdAt: now,
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
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
    },
    {
      id: MEMBER_SUPERVISOR_ID,
      tenantId: CASINO_DEMO_ID,
      userId: SUPERVISOR_ID,
      email: "supervisor@casinodemo.local",
      rol: "supervisor",
      estado: "activo",
      createdAt: now,
    },
    {
      id: MEMBER_OPERADOR_ID,
      tenantId: CASINO_DEMO_ID,
      userId: OPERADOR_ID,
      email: "operador@casinodemo.local",
      rol: "operador",
      estado: "activo",
      createdAt: now,
    },
  ];
  for (const m of members) store.members.set(m.id, m);

  const cbuAccounts: CbuAccount[] = [
    {
      id: CBU_DEMO_ID,
      tenantId: CASINO_DEMO_ID,
      cbu: generarCbuValidoSeed(),
      alias: "casino.demo.ars",
      titular: "Casino Demo S.A.",
      moneda: "ARS",
      activa: true,
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const c of casinoCreds) store.casinoCredentials.set(c.id, c);
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
  CASINO_CREDS_ID,
} as const;
