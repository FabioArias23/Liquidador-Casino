import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Schema multi-tenant (Phase 1 + Phase 2).
 *
 * Reglas (PLAN-TECNICO.md §3 y §7):
 * - Toda tabla operativa lleva tenant_id + índice compuesto (tenant_id, created_at desc).
 * - IDs en uuid (gen_random_uuid).
 * - Append-only real en BD: ledger_entries y audit_log NO se updatean ni borran
 *   (la app nunca llama UPDATE/DELETE; el REVOKE se agrega cuando se levante Supabase).
 * - UNIQUE (tenant_id, external_ref) en cargas para idempotencia del casino.
 * - monto_cents siempre bigint (regla de oro: centavos, nunca floats).
 *
 * RLS: por ahora el scoping por tenant se aplica en los repositorios
 * (la conexión directa postgres superuser bypasea RLS). RLS queda como
 * defensa en profundidad cuando se conecte supabase-js/Realtime (PLAN-TECNICO §7).
 */

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nombre: text("nombre").notNull(),
    slug: text("slug").notNull(),
    estado: text("estado").notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("tenants_slug_idx").on(t.slug)],
);

export const tenantConfigs = pgTable("tenant_configs", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "cascade" }),
  /** JSON libre validado por Zod (ver src/domain/schemas/tenant-config.ts). */
  config: jsonb("config").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    rol: text("rol").notNull(),
    estado: text("estado").notNull().default("activo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("tenant_members_tenant_user_idx").on(t.tenantId, t.userId),
  ],
);

export const cbuAccounts = pgTable(
  "cbu_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    cbu: text("cbu").notNull(),
    alias: text("alias"),
    titular: text("titular").notNull(),
    moneda: text("moneda").notNull().default("ARS"),
    activa: boolean("activa").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("cbu_accounts_tenant_cbu_idx").on(t.tenantId, t.cbu)],
);

export const casinoCredentials = pgTable(
  "casino_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    adapterType: text("adapter_type").notNull().default("configurable_http"),
    baseUrl: text("base_url").notNull(),
    apiKeyCiphertext: text("api_key_ciphertext"),
    webhookSecret: text("webhook_secret"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("casino_credentials_tenant_idx").on(t.tenantId)],
);

// ─── Phase 2: cargas + ledger + audit ────────────────────────────────────────

/**
 * Cargas — entradas de plata del jugador al casino.
 * El `estado` recorre la state machine de src/domain/cargas.ts:
 *   pending → validating → validated → settled (terminal)
 *                       ↘ rejected (terminal)
 * Idempotencia con casino: UNIQUE (tenant_id, external_ref) WHERE external_ref NOT NULL.
 * Optimistic lock: el caso de uso hace UPDATE WHERE version = ?.
 */
export const cargas = pgTable(
  "cargas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    playerRef: text("player_ref").notNull(),
    montoCents: bigint("monto_cents", { mode: "number" }).notNull(),
    moneda: text("moneda").notNull().default("ARS"),
    metodo: text("metodo").notNull(),
    origen: text("origen").notNull(), // "manual" | "api_casino"
    estado: text("estado").notNull().default("pending"),

    /** Null si origen = manual. UNIQUE (tenant_id, external_ref). */
    externalRef: text("external_ref"),
    comprobanteUrl: text("comprobante_url"),
    motivoRechazo: text("motivo_rechazo"),

    registradaPor: uuid("registrada_por")
      .notNull()
      .references(() => profiles.id),
    validadaPor: uuid("validada_por").references(() => profiles.id),
    rechazadaPor: uuid("rechazada_por").references(() => profiles.id),
    asentadaPor: uuid("asentada_por").references(() => profiles.id),

    version: integer("version").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cargas_tenant_estado_idx").on(t.tenantId, t.estado),
    index("cargas_tenant_created_at_idx").on(t.tenantId, t.createdAt),
    // Idempotencia del casino: solo si externalRef no es null
    uniqueIndex("cargas_tenant_external_ref_idx")
      .on(t.tenantId, t.externalRef)
      .where(sql`${t.externalRef} IS NOT NULL`),
  ],
);

/**
 * Ledger de partida doble — INMUTABLE.
 * Cada movimiento de plata genera exactamente 2 entries (débito + crédito)
 * con Σ = 0, agrupadas por `asiento_id`.
 *
 * Append-only en BD (la app no llama UPDATE/DELETE; cuando se levante Supabase
 * se agrega `REVOKE UPDATE, DELETE ON ledger_entries FROM PUBLIC`).
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    operacionTipo: text("operacion_tipo").notNull(), // "carga" | "retiro" | "pago"
    operacionId: text("operacion_id").notNull(), // ID de la operación
    cuenta: text("cuenta").notNull(),
    tipo: text("tipo").notNull(), // "debito" | "credito"
    montoCents: bigint("monto_cents", { mode: "number" }).notNull(),
    moneda: text("moneda").notNull().default("ARS"),
    descripcion: text("descripcion").notNull(),
    asientoId: text("asiento_id").notNull(), // agrupa las 2 entries de un asiento
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ledger_tenant_operacion_idx").on(t.tenantId, t.operacionTipo, t.operacionId),
    index("ledger_tenant_asiento_idx").on(t.tenantId, t.asientoId),
    index("ledger_tenant_created_at_idx").on(t.tenantId, t.createdAt),
  ],
);

/**
 * Audit log — append-only de TODA mutación del sistema.
 * De acá sale el historial del operador (Phase 4) y la auditoría.
 * before/after son jsonb: estado anterior y posterior serializados.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => profiles.id),
    accion: text("accion").notNull(), // "carga.crear", "carga.validar", etc.
    entidadTipo: text("entidad_tipo").notNull(),
    entidadId: text("entidad_id").notNull(),
    before: jsonb("before"), // estado anterior (null si es creación)
    after: jsonb("after"), // estado posterior
    motivo: text("motivo"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_tenant_created_at_idx").on(t.tenantId, t.createdAt),
    index("audit_tenant_entidad_idx").on(
      t.tenantId,
      t.entidadTipo,
      t.entidadId,
    ),
    index("audit_actor_idx").on(t.actorId),
  ],
);