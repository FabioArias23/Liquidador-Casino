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
  CasinoCredentials,
  CbuAccount,
  Member,
  Profile,
  Tenant,
} from "@/domain/entities";
import type {
  CasinoCredentialsId,
  CbuAccountId,
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
}

export class MockStore {
  tenants = new Map<TenantId, Tenant>();
  profiles = new Map<UserId, Profile>();
  members = new Map<MemberId, Member>();
  cbuAccounts = new Map<CbuAccountId, CbuAccount>();
  casinoCredentials = new Map<CasinoCredentialsId, CasinoCredentials>();

  /** Email → userId para búsquedas rápidas (members vienen con email desnormalizado). */
  emails = new Map<string, UserId>();

  reset(): void {
    this.tenants.clear();
    this.profiles.clear();
    this.members.clear();
    this.cbuAccounts.clear();
    this.casinoCredentials.clear();
    this.emails.clear();
  }

  toSnapshot(): Snapshot {
    return {
      tenants: Object.fromEntries(this.tenants),
      profiles: Object.fromEntries(this.profiles),
      members: Object.fromEntries(this.members),
      cbuAccounts: Object.fromEntries(this.cbuAccounts),
      casinoCredentials: Object.fromEntries(this.casinoCredentials),
    };
  }

  loadSnapshot(snap: Snapshot): void {
    this.reset();
    for (const [k, v] of Object.entries(snap.tenants))
      this.tenants.set(k as TenantId, v);
    for (const [k, v] of Object.entries(snap.profiles)) {
      this.profiles.set(k as UserId, v);
      this.emails.set(v.email.toLowerCase(), v.id);
    }
    for (const [k, v] of Object.entries(snap.members))
      this.members.set(k as MemberId, v);
    for (const [k, v] of Object.entries(snap.cbuAccounts))
      this.cbuAccounts.set(k as CbuAccountId, v);
    for (const [k, v] of Object.entries(snap.casinoCredentials))
      this.casinoCredentials.set(k as CasinoCredentialsId, v);
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
