/**
 * Puertos de la capa de aplicación: interfaces de los repositorios.
 * Los casos de uso consumen estas interfaces, no Drizzle directamente.
 * Ver PLAN-TECNICO.md §8 (patrón Repository).
 *
 * Hoy hay dos implementaciones:
 *   - src/infrastructure/repositories/mock/* (in-memory + snapshot JSON)
 *   - src/infrastructure/repositories/drizzle/* (Postgres real — stub por ahora)
 *
 * El switch se hace en src/infrastructure/repositories/index.ts por env var.
 */

import type {
  CasinoCredentials,
  CbuAccount,
  Member,
  Profile,
  Tenant,
} from "@/domain/entities";
import type {
  CbuAccountId,
  MemberId,
  TenantId,
  UserId,
} from "@/domain/ids";
import type { Rol } from "@/domain/roles";

// ─── Tenants ────────────────────────────────────────────────────────────────

export interface TenantRepository {
  listar(): Promise<Tenant[]>;
  obtenerPorId(id: TenantId): Promise<Tenant | null>;
  obtenerPorSlug(slug: string): Promise<Tenant | null>;
  existeSlug(slug: string): Promise<boolean>;
  crear(input: { nombre: string; slug: string }): Promise<Tenant>;
  actualizar(
    id: TenantId,
    cambios: { nombre?: string; estado?: Tenant["estado"] },
  ): Promise<Tenant>;
}

// ─── Profiles ───────────────────────────────────────────────────────────────

export interface ProfileRepository {
  obtenerPorId(id: UserId): Promise<Profile | null>;
  obtenerPorEmail(email: string): Promise<Profile | null>;
  listar(): Promise<Profile[]>;
  crear(input: {
    id: UserId;
    email: string;
    isSuperadmin?: boolean;
  }): Promise<Profile>;
  setSuperadmin(id: UserId, es: boolean): Promise<Profile>;
}

// ─── Members (pertenencia usuario ↔ tenant con rol) ─────────────────────────

export interface MemberRepository {
  listarPorTenant(tenantId: TenantId): Promise<Member[]>;
  obtener(id: MemberId): Promise<Member | null>;
  obtenerPorUsuarioYTenant(
    tenantId: TenantId,
    userId: UserId,
  ): Promise<Member | null>;
  existeEnTenant(tenantId: TenantId, email: string): Promise<boolean>;
  /** Crea (o reutiliza) el profile del email y lo vincula al tenant con el rol. */
  invitar(
    tenantId: TenantId,
    input: { email: string; rol: Rol },
    ctx?: { actor: UserId },
  ): Promise<Member>;
  cambiarRol(
    id: MemberId,
    rol: Rol,
    ctx?: { actor: UserId },
  ): Promise<Member>;
  desactivar(id: MemberId, ctx?: { actor: UserId }): Promise<Member>;
}

// ─── CBU ───────────────────────────────────────────────────────────────────

export interface CbuAccountRepository {
  listarPorTenant(tenantId: TenantId): Promise<CbuAccount[]>;
  obtenerPorTenantYCbu(
    tenantId: TenantId,
    cbu: string,
  ): Promise<CbuAccount | null>;
  agregar(
    tenantId: TenantId,
    input: {
      cbu: string;
      alias?: string | null;
      titular: string;
      moneda?: string;
    },
    ctx?: { actor: UserId },
  ): Promise<CbuAccount>;
  desactivar(
    id: CbuAccountId,
    ctx?: { actor: UserId },
  ): Promise<CbuAccount>;
}

// ─── Casino credentials ─────────────────────────────────────────────────────

export interface CasinoCredentialsRepository {
  obtenerPorTenant(tenantId: TenantId): Promise<CasinoCredentials | null>;
  guardar(
    tenantId: TenantId,
    input: {
      adapterType: string;
      baseUrl: string;
      apiKeyCiphertext?: string | null;
      webhookSecret?: string | null;
    },
    ctx?: { actor: UserId },
  ): Promise<CasinoCredentials>;
}
