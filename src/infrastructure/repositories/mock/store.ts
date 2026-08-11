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
      this.tenants.set(k as TenantId, hidratarTenant(v));
    for (const [k, v] of Object.entries(safe("profiles"))) {
      const profile = hidratarProfile(v);
      this.profiles.set(k as UserId, profile);
      this.emails.set(profile.email.toLowerCase(), profile.id);
    }
    for (const [k, v] of Object.entries(safe("members")))
      this.members.set(k as MemberId, hidratarMember(v));
    for (const [k, v] of Object.entries(safe("cbuAccounts")))
      this.cbuAccounts.set(k as CbuAccountId, hidratarCbuAccount(v));
    for (const [k, v] of Object.entries(safe("casinoCredentials")))
      this.casinoCredentials.set(k as CasinoCredentialsId, hidratarCasinoCredentials(v));
    // Phase 2 — defaults a {} si el snapshot es viejo
    for (const [k, v] of Object.entries(safe("cargas")))
      this.cargas.set(k as CargaId, hidratarCarga(v));
    for (const [k, v] of Object.entries(safe("ledgerEntries")))
      this.ledgerEntries.set(k as LedgerEntryId, hidratarLedgerEntry(v));
    for (const [k, v] of Object.entries(safe("auditLog")))
      this.auditLog.set(k as AuditLogId, hidratarAuditLog(v));
    // Phase 3
    for (const [k, v] of Object.entries(safe("retiros")))
      this.retiros.set(k, hidratarRetiro(v));
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

// ── Hidratación de fechas ────────────────────────────────────────────────────
// JSON.stringify(Date) → ISO string. Al leer el snapshot de vuelta, las fechas
// vienen como string. Esta capa las re-hidrata a Date para mantener el
// contrato del dominio. Sin esto, el código que llama .getTime() o
// formatRelativeTime(date) explota en runtime.

/** Convierte string|Date|undefined → Date. Si ya es Date, lo devuelve igual. */
function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  throw new Error(`No se pudo hidratar fecha: ${String(v)}`);
}

function hidratarTenant(raw: unknown): Tenant {
  const t = raw as Tenant;
  return { ...t, createdAt: toDate(t.createdAt), updatedAt: toDate(t.updatedAt) };
}

function hidratarProfile(raw: unknown): Profile {
  const p = raw as Profile;
  return { ...p, createdAt: toDate(p.createdAt) };
}

function hidratarMember(raw: unknown): Member {
  const m = raw as Member;
  return { ...m, createdAt: toDate(m.createdAt) };
}

function hidratarCbuAccount(raw: unknown): CbuAccount {
  const c = raw as CbuAccount;
  return { ...c, createdAt: toDate(c.createdAt), updatedAt: toDate(c.updatedAt) };
}

function hidratarCasinoCredentials(raw: unknown): CasinoCredentials {
  const c = raw as CasinoCredentials;
  return { ...c, createdAt: toDate(c.createdAt), updatedAt: toDate(c.updatedAt) };
}

function hidratarCarga(raw: unknown): Carga {
  const c = raw as Carga;
  return { ...c, createdAt: toDate(c.createdAt), updatedAt: toDate(c.updatedAt) };
}

function hidratarLedgerEntry(raw: unknown): LedgerEntry {
  const e = raw as LedgerEntry;
  return { ...e, createdAt: toDate(e.createdAt) };
}

function hidratarAuditLog(raw: unknown): AuditLog {
  const a = raw as AuditLog;
  return { ...a, createdAt: toDate(a.createdAt) };
}

function hidratarRetiro(raw: unknown): Retiro {
  const r = raw as Retiro;
  return {
    ...r,
    createdAt: toDate(r.createdAt),
    updatedAt: toDate(r.updatedAt),
  };
}