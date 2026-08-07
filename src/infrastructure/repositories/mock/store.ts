/**
 * Store central del mock: contiene todos los Maps por entidad.
 *
 * - Una sola instancia compartida por la app (singleton).
 * - Persistencia opcional a `.data/mock.json` (si MOCK_PERSIST !== "false").
 * - Tests crean su propio store con `new MockStore()` para aislar.
 *
 * Ver PLAN-TECNICO.md §8 (Repository pattern con mock hasta tener DB real).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

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
import type {
  AuditLogId,
  CargaId,
  CasinoCredentialsId,
  CbuAccountId,
  LedgerEntryId,
  MemberId,
  TenantId,
  UserId,
} from "@/domain/ids";

interface Snapshot {
  tenants: Record<string, Tenant>;
  profiles: Record<string, Profile>;
  members: Record<string, Member>;
  cbuAccounts: Record<string, CbuAccount>;
  casinoCredentials: Record<string, CasinoCredentials>;
  // Phase 2
  cargas: Record<string, Carga>;
  ledgerEntries: Record<string, LedgerEntry>;
  auditLog: Record<string, AuditLog>;
  // Phase 3
  retiros: Record<string, Retiro>;
}

export class MockStore {
  // Phase 1
  tenants = new Map<TenantId, Tenant>();
  profiles = new Map<UserId, Profile>();
  members = new Map<MemberId, Member>();
  cbuAccounts = new Map<CbuAccountId, CbuAccount>();
  casinoCredentials = new Map<CasinoCredentialsId, CasinoCredentials>();
  /** Email → userId para búsquedas rápidas (members vienen con email desnormalizado). */
  emails = new Map<string, UserId>();

  // Phase 2
  cargas = new Map<CargaId, Carga>();
  ledgerEntries = new Map<LedgerEntryId, LedgerEntry>();
  auditLog = new Map<AuditLogId, AuditLog>();

  // Phase 3
  retiros = new Map<string, Retiro>();

  reset(): void {
    this.tenants.clear();
    this.profiles.clear();
    this.members.clear();
    this.cbuAccounts.clear();
    this.casinoCredentials.clear();
    this.emails.clear();
    this.cargas.clear();
    this.ledgerEntries.clear();
    this.auditLog.clear();
    this.retiros.clear();
  }

  toSnapshot(): Snapshot {
    return {
      tenants: Object.fromEntries(this.tenants),
      profiles: Object.fromEntries(this.profiles),
      members: Object.fromEntries(this.members),
      cbuAccounts: Object.fromEntries(this.cbuAccounts),
      casinoCredentials: Object.fromEntries(this.casinoCredentials),
      cargas: Object.fromEntries(this.cargas),
      ledgerEntries: Object.fromEntries(this.ledgerEntries),
      auditLog: Object.fromEntries(this.auditLog),
      retiros: Object.fromEntries(this.retiros),
    };
  }

  loadSnapshot(snap: Snapshot): void {
    this.reset();
    // Defensivo: snapshots viejos no tienen las keys nuevas.
    // Las tratamos como {} para que la migración sea silenciosa.
    const safe = <K extends keyof Snapshot>(k: K): Record<string, Snapshot[K] extends Record<string, infer V> | undefined ? V : never> => {
      const v = snap[k] as unknown;
      return (v && typeof v === "object" ? v : {}) as never;
    };
    for (const [k, v] of Object.entries(safe("tenants")))
      this.tenants.set(k as TenantId, v as Tenant);
    for (const [k, v] of Object.entries(safe("profiles"))) {
      const profile = v as Profile;
      this.profiles.set(k as UserId, profile);
      this.emails.set(profile.email.toLowerCase(), profile.id);
    }
    for (const [k, v] of Object.entries(safe("members")))
      this.members.set(k as MemberId, v as Member);
    for (const [k, v] of Object.entries(safe("cbuAccounts")))
      this.cbuAccounts.set(k as CbuAccountId, v as CbuAccount);
    for (const [k, v] of Object.entries(safe("casinoCredentials")))
      this.casinoCredentials.set(k as CasinoCredentialsId, v as CasinoCredentials);
    // Phase 2 — defaults a {} si el snapshot es viejo
    for (const [k, v] of Object.entries(safe("cargas")))
      this.cargas.set(k as CargaId, v as Carga);
    for (const [k, v] of Object.entries(safe("ledgerEntries")))
      this.ledgerEntries.set(k as LedgerEntryId, v as LedgerEntry);
    for (const [k, v] of Object.entries(safe("auditLog")))
      this.auditLog.set(k as AuditLogId, v as AuditLog);
    // Phase 3
    for (const [k, v] of Object.entries(safe("retiros")))
      this.retiros.set(k, v as Retiro);
  }
}

// ── Singleton + persistencia ────────────────────────────────────────────────

let singleton: MockStore | null = null;

const PERSIST_PATH = path.resolve(process.cwd(), ".data", "mock.json");

export function obtenerStore(): MockStore {
  if (!singleton) {
    singleton = new MockStore();
  }
  return singleton;
}

/** Carga el snapshot desde disco (si existe) al store singleton. Idempotente. */
export async function cargarStoreDesdeDisco(): Promise<MockStore> {
  const store = obtenerStore();
  try {
    const raw = await fs.readFile(PERSIST_PATH, "utf-8");
    store.loadSnapshot(JSON.parse(raw) as Snapshot);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  return store;
}

export async function persistirStore(store: MockStore): Promise<void> {
  if (process.env.MOCK_PERSIST === "false") return;
  await fs.mkdir(path.dirname(PERSIST_PATH), { recursive: true });
  await fs.writeFile(
    PERSIST_PATH,
    JSON.stringify(store.toSnapshot(), null, 2),
    "utf-8",
  );
}