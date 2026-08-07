/**
 * Schemas Zod del dominio.
 *
 * El dominio PUEDE tener schemas de Zod para auto-validación (no rompe hexagonalidad
 * porque Zod es solo una herramienta de parsing, no una dependencia de framework).
 *
 * Los casos de uso de `application/` consumen estos schemas para validar input.
 * La UI también puede reutilizarlos (RHF + Zod resolver).
 */

import { z } from "zod";

import { type ErrorNegocio, errorNegocio, type Result, ok, err } from "../result";

// ─── TenantConfig ────────────────────────────────────────────────────────────

/** Mapping declarativo del casino para ConfigurableHttpAdapter. */
export const casinoMappingSchema = z.object({
  adapterType: z.string().min(1),
  montoPath: z.string().min(1),
  playerRefPath: z.string().min(1),
  externalRefPath: z.string().min(1),
  timestampPath: z.string().min(1),
  authHeaders: z.record(z.string(), z.string()),
});

export const tenantConfigSchema = z.object({
  casinoMapping: casinoMappingSchema,
  /** Monto mínimo (centavos) para requerir doble aprobación en retiros. */
  umbralDobleAprobacionsCents: z.number().int().nonnegative(),
});

export type TenantConfigInput = z.infer<typeof tenantConfigSchema>;

export interface TenantConfigValidado {
  casinoMapping: {
    adapterType: string;
    montoPath: string;
    playerRefPath: string;
    externalRefPath: string;
    timestampPath: string;
    authHeaders: Record<string, string>;
  };
  umbralDobleAprobacionsCents: number;
}

/** Error code estable para config inválido (registrado también en application/errors). */
export const CODIGO_CONFIG_INVALIDA = "TENANT_CONFIG_INVALIDA";

/**
 * Parsea y valida el JSON de tenant_configs.config.
 * Devuelve el config tipado o un error con detalle.
 */
export function parsearTenantConfig(
  raw: unknown,
): Result<TenantConfigValidado, ErrorNegocio> {
  const result = tenantConfigSchema.safeParse(raw);
  if (result.success) {
    return ok(result.data);
  }
  const detalle = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return err(
    errorNegocio(
      CODIGO_CONFIG_INVALIDA,
      `Config del tenant inválida: ${detalle}`,
    ),
  );
}

/**
 * Default sensato para tenant_configs.config cuando se crea un tenant nuevo.
 * El operador puede sobreescribirlo desde la UI después.
 */
export function tenantConfigDefault(): TenantConfigInput {
  return {
    casinoMapping: {
      adapterType: "configurable_http",
      montoPath: "data.monto_cents",
      playerRefPath: "data.player_ref",
      externalRefPath: "data.id",
      timestampPath: "data.timestamp",
      authHeaders: {},
    },
    umbralDobleAprobacionsCents: 1_000_000, // $10.000 por default
  };
}