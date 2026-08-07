/**
 * Entidades de dominio (puras, sin frameworks).
 * Lo que devuelven los repositorios. El schema Drizzle se mapea a estas formas.
 */

import type {
  AuditLogId,
  CargaId,
  CasinoCredentialsId,
  CbuAccountId,
  LedgerEntryId,
  MemberId,
  TenantConfigId,
  TenantId,
  UserId,
} from "./ids";
import type { OrigenCarga, EstadoCarga, AccionCarga } from "./cargas";
import type { TipoMovimientoLedger } from "./ledger";
import type { Rol } from "./roles";

export type EstadoTenant = "activo" | "suspendido";

export interface Tenant {
  id: TenantId;
  nombre: string;
  slug: string;
  estado: EstadoTenant;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile {
  id: UserId;
  email: string;
  isSuperadmin: boolean;
  createdAt: Date;
}

export type EstadoMiembro = "activo" | "inactivo";

export interface Member {
  id: MemberId;
  tenantId: TenantId;
  userId: UserId;
  email: string; // desnormalizado para mostrar en UI
  rol: Rol;
  estado: EstadoMiembro;
  createdAt: Date;
}

export interface CbuAccount {
  id: CbuAccountId;
  tenantId: TenantId;
  cbu: string;
  alias: string | null;
  titular: string;
  moneda: string; // ISO 4217
  activa: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CasinoCredentials {
  id: CasinoCredentialsId;
  tenantId: TenantId;
  adapterType: string;
  baseUrl: string;
  apiKeyCiphertext: string | null;
  webhookSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Phase 3: Retiros + Pagos ────────────────────────────────────────────────

/**
 * Retiro — el movimiento de plata que sale del sistema (pago a jugador).
 * El campo `estado` recorre una state machine pura (ver domain/retiros.ts).
 *
 * Cuatro-ojos (validación cruzada por código Y por BD):
 * - `validadaPor` y `aprobadaPor` deben ser UserIds distintos.
 * - `aprobadaPor` y `pagadaPor` deben ser UserIds distintos.
 * El CHECK vive en BD; el código de aplicación también lo valida en cada
 * transición (defensa en profundidad).
 */
export interface Retiro {
  id: string;
  tenantId: TenantId;
  playerRef: string;
  montoCents: number;
  moneda: string;
  cbuDestino: string;
  aliasDestino: string | null;
  titularDestino: string;
  estado: import("./retiros").EstadoRetiro;
  origen: "manual" | "api_casino";
  externalRef: string | null;
  comprobanteUrl: string | null;
  motivoRechazo: string | null;

  registradaPor: UserId;
  validadaPor: UserId | null;
  rechazadaPor: UserId | null;
  aprobadaPor: UserId | null;
  rechazadaAprobacionPor: UserId | null;
  pagadaPor: UserId | null;

  /** Clave de idempotencia para pagos manuales (evita doble pago por reintento). */
  idempotencyKey: string | null;

  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Phase 2: Cargas + Ledger + Audit + TenantConfig ────────────────────────

/**
 * Carga — el movimiento de plata que entra al sistema (depósito del jugador).
 * El campo `estado` recorre una state machine pura (ver domain/cargas.ts).
 */
export interface Carga {
  id: CargaId;
  tenantId: TenantId;
  /** Referencia del jugador en el casino (provista por el casino, no manejamos cuentas propias). */
  playerRef: string;
  /** Monto SIEMPRE en centavos (regla de oro: nunca floats). */
  montoCents: number;
  /** ISO 4217 (v1: una sola moneda por tenant). */
  moneda: string;
  /** Método: "transferencia", "tarjeta", "efectivo", etc. (libre por ahora). */
  metodo: string;
  origen: OrigenCarga;
  estado: EstadoCarga;

  /** Idempotencia con casino: UNIQUE (tenant_id, external_ref). Null si origen=manual. */
  externalRef: string | null;
  /** URL del comprobante subido por el operador (manual) o recibido (casino). */
  comprobanteUrl: string | null;
  /** Motivo si la carga fue rechazada. */
  motivoRechazo: string | null;

  // Auditores: cada transición válida registra quién.
  registradaPor: UserId;
  validadaPor: UserId | null;
  rechazadaPor: UserId | null;
  asentadaPor: UserId | null;

  /** Optimistic lock: el caso de uso hace UPDATE WHERE version=? */
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * LedgerEntry — partida doble inmutable.
 * Cada movimiento de plata genera exactamente 2 entries (débito + crédito) con Σ = 0.
 * Append-only: la BD hace REVOKE de UPDATE/DELETE.
 */
export interface LedgerEntry {
  id: LedgerEntryId;
  tenantId: TenantId;
  /** Tipo de operación que originó el asiento: "carga", "retiro", "pago", etc. */
  operacionTipo: string;
  /** ID de la operación (ej: CargaId como string). */
  operacionId: string;
  /** Cuenta contable (libre: "banco:cbu", "casino:ingresos", "jugador:a3f9", etc.). */
  cuenta: string;
  tipo: TipoMovimientoLedger;
  montoCents: number;
  /** ISO 4217 (la del asiento = la de la operación). */
  moneda: string;
  descripcion: string;
  /** Para agrupar las 2 entries de un mismo asiento y consultar el par. */
  asientoId: string;
  createdAt: Date;
}

/**
 * AuditLog — append-only de TODA mutación del sistema.
 * De acá sale el historial del operador (Phase 4) gratis.
 */
export interface AuditLog {
  id: AuditLogId;
  tenantId: TenantId;
  actorId: UserId;
  /** Tipo de operación: "carga.crear", "carga.validar", "tenant.crear", etc. */
  accion: string;
  /** Entidad afectada: "carga", "tenant", "member", etc. */
  entidadTipo: string;
  /** ID de la entidad afectada. */
  entidadId: string;
  /** Estado anterior serializado (JSON). Null si es creación. */
  before: unknown;
  /** Estado posterior serializado (JSON). */
  after: unknown;
  /** Motivo cuando aplica (ej: rechazo). */
  motivo: string | null;
  /** Metadata opcional: IP, user-agent, etc. */
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * AccionMetadata — payload estructurado de AuditLog.metadata.
 * Tipos auxiliares para el port que escribe audit (ver application/ports/repositories.ts).
 */
export interface AccionMetadata {
  accion: AccionCarga | string;
  ip?: string;
  userAgent?: string;
}

/**
 * TenantConfig — configuración por tenant que vive como JSON validado con Zod.
 * Acá vive el mapping declarativo del casino (qué campo de la respuesta es monto, etc.).
 */
export interface TenantConfig {
  id: TenantConfigId;
  tenantId: TenantId;
  /** Mapping declarativo del ConfigurableHttpAdapter. */
  casinoMapping: CasinoMapping;
  /** Monto mínimo (en centavos) para requerir doble aprobación en retiros. */
  umbralDobleAprobacionsCents: number;
  updatedAt: Date;
}

/**
 * Mapping declarativo del casino para ConfigurableHttpAdapter.
 * Permite enchufar casinos sin código: declarar qué campo es monto, player_ref, etc.
 */
export interface CasinoMapping {
  /** Tipo de adapter ("configurable_http" por default). */
  adapterType: string;
  /** Path en el JSON de respuesta del casino que contiene el monto (dot notation). */
  montoPath: string;
  /** Path para el ref del jugador. */
  playerRefPath: string;
  /** Path para el ID externo (idempotencia). */
  externalRefPath: string;
  /** Path para el timestamp de la operación. */
  timestampPath: string;
  /** Headers extra para autenticar al casino. */
  authHeaders: Record<string, string>;
}