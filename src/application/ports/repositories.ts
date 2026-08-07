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
  CargaId,
  CbuAccountId,
  MemberId,
  TenantId,
  UserId,
} from "@/domain/ids";
import type { EstadoCarga } from "@/domain/cargas";
import type { EstadoRetiro } from "@/domain/retiros";
import type { ErrorNegocio, Result } from "@/domain/result";
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

// ─── Phase 2: Cargas + Ledger + Audit ────────────────────────────────────────

/** Filtros opcionales para listar cargas de un tenant. */
export interface ListarCargasFiltros {
  estado?: EstadoCarga;
  desde?: Date;
  hasta?: Date;
  playerRef?: string;
  limit?: number;
}

export interface CargaRepository {
  /** Inserta una carga nueva (estado inicial: pending). */
  crear(carga: Carga): Promise<Carga>;

  /** Obtiene por ID dentro de un tenant (no cross-tenant). */
  obtenerPorId(tenantId: TenantId, id: CargaId): Promise<Carga | null>;

  /** Busca por externalRef (para idempotencia del casino). Null si no existe. */
  obtenerPorTenantYExternalRef(
    tenantId: TenantId,
    externalRef: string,
  ): Promise<Carga | null>;

  /** Lista cargas de un tenant, ordenadas por created_at desc. */
  listarPorTenant(
    tenantId: TenantId,
    filtros?: ListarCargasFiltros,
  ): Promise<Carga[]>;

  /**
   * Update atómico con optimistic lock.
   * Si la versión del storage difiere de `expectedVersion`, falla con
   * `CONCURRENCIA` (otro operador ya actualizó la carga).
   */
  actualizar(
    carga: Carga,
    expectedVersion: number,
  ): Promise<Result<Carga, ErrorNegocio>>;
}

/**
 * LedgerRepository — append-only.
 * El dominio (domain/ledger.ts) garantiza el invariante de partida doble
 * antes de llamar al repositorio.
 */
export interface LedgerRepository {
  /**
   * Inserta 2 entries en una sola operación (atómica).
   * Devuelve el asientoId generado y las entries persistidas.
   */
  append(entries: [LedgerEntry, LedgerEntry]): Promise<{
    asientoId: string;
    entries: [LedgerEntry, LedgerEntry];
  }>;

  /** Lista las entries de una operación específica (para mostrar en UI). */
  listarPorOperacion(
    tenantId: TenantId,
    operacionTipo: string,
    operacionId: string,
  ): Promise<LedgerEntry[]>;
}

/**
 * AuditRepository — append-only.
 * Se invoca una vez por mutación del sistema (state change de una carga,
 * creación de tenant, invitación de miembro, etc.).
 */
export interface AuditRepository {
  append(
    entry: Omit<AuditLog, "id" | "createdAt">,
  ): Promise<AuditLog>;

  listarPorTenant(
    tenantId: TenantId,
    filtros?: {
      desde?: Date;
      hasta?: Date;
      entidadTipo?: string;
      entidadId?: string;
      limit?: number;
    },
  ): Promise<AuditLog[]>;
}

// ─── Phase 3: Retiros ────────────────────────────────────────────────────────

/** Filtros opcionales para listar retiros de un tenant. */
export interface ListarRetirosFiltros {
  estado?: EstadoRetiro;
  desde?: Date;
  hasta?: Date;
  playerRef?: string;
  limit?: number;
}

export interface RetiroRepository {
  /** Inserta un retiro nuevo (estado inicial: pending). */
  crear(retiro: Retiro): Promise<Retiro>;

  /** Obtiene por ID dentro de un tenant (no cross-tenant). */
  obtenerPorId(tenantId: TenantId, id: string): Promise<Retiro | null>;

  /** Lista retiros de un tenant, ordenados por created_at desc. */
  listarPorTenant(
    tenantId: TenantId,
    filtros?: ListarRetirosFiltros,
  ): Promise<Retiro[]>;

  /**
   * Update atómico con optimistic lock.
   * Si la versión del storage difiere de `expectedVersion`, falla con
   * `CONCURRENCIA` (otro operador ya actualizó el retiro).
   */
  actualizar(
    retiro: Retiro,
    expectedVersion: number,
  ): Promise<Result<Retiro, ErrorNegocio>>;
}
