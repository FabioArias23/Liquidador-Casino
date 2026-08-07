/**
 * Factory de repositorios: decide entre mock (in-memory) y drizzle (Postgres real)
 * según env var `DATA_SOURCE`. Default: `mock`.
 *
 * Uso en server components / server actions:
 *   import { repos } from "@/lib/server/repositories";
 *   const tenants = await repos.tenants.listar();
 *
 * Ver PLAN-TECNICO.md §8 (Repository pattern).
 */

import type {
  CasinoCredentialsRepository,
  CbuAccountRepository,
  MemberRepository,
  ProfileRepository,
  TenantRepository,
} from "@/application/ports/repositories";
import { cargarStoreDesdeDisco, obtenerStore } from "./mock/store";
import { crearCbuMock } from "./mock/cbu.mock";
import { crearCasinoCredsMock } from "./mock/casino-creds.mock";
import { crearMembersMock } from "./mock/members.mock";
import { crearProfilesMock } from "./mock/profiles.mock";
import { crearTenantsMock } from "./mock/tenants.mock";
import { seedDemo } from "./mock/seed";

export interface Repositorios {
  tenants: TenantRepository;
  profiles: ProfileRepository;
  members: MemberRepository;
  cbuAccounts: CbuAccountRepository;
  casinoCredentials: CasinoCredentialsRepository;
}

let cache: Repositorios | null = null;
let bootstrapPromise: Promise<void> | null = null;

/**
 * Carga el store desde disco y, si está vacío, siembra con el demo.
 * Idempotente: llamar varias veces es seguro.
 */
async function bootstrap(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    const store = await cargarStoreDesdeDisco();
    if (store.tenants.size === 0 && store.profiles.size === 0) {
      seedDemo(store);
      // Snapshot inicial para que el dev server no "pierda" el seed en el
      // próximo reinicio. Si la persistencia está deshabilitada por env, no hace nada.
      const { persistirStore } = await import("./mock/store");
      await persistirStore(store);
    }
  })();
  return bootstrapPromise;
}

export async function obtenerRepositorios(): Promise<Repositorios> {
  if (cache) return cache;
  const fuente = (process.env.DATA_SOURCE ?? "mock").toLowerCase();

  if (fuente === "drizzle") {
    throw new Error(
      "DATA_SOURCE=drizzle aún no implementado. Estamos en mock hasta tener Supabase real.",
    );
  }

  if (fuente !== "mock") {
    throw new Error(`DATA_SOURCE desconocido: ${fuente}. Use 'mock' o 'drizzle'.`);
  }

  await bootstrap();
  const store = obtenerStore();
  cache = {
    tenants: crearTenantsMock(store),
    profiles: crearProfilesMock(store),
    members: crearMembersMock(store),
    cbuAccounts: crearCbuMock(store),
    casinoCredentials: crearCasinoCredsMock(store),
  };
  return cache;
}

/** Solo para tests: limpia el cache entre tests. */
export function _resetRepositoriosParaTests(): void {
  cache = null;
  bootstrapPromise = null;
}
