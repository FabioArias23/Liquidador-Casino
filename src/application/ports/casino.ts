/**
 * Puerto CasinoAdapter (PLAN-TECNICO.md §5).
 *
 * Abstrae la integración con el casino online. Hoy se enchufa
 * `ConfigurableHttpAdapter` (con mapping declarativo desde tenant_configs.config)
 * y un endpoint mock para la demo. Mañana, adapters específicos por casino
 * implementan el mismo puerto sin tocar el dominio.
 */

import type { TenantId } from "@/domain/ids";

/** Carga tal como la reporta el casino (aún sin validar). */
export interface CargaExterna {
  /** ID externo único del casino (idempotencia con nuestro external_ref). */
  externalRef: string;
  /** Ref del jugador en el casino. */
  playerRef: string;
  /** Monto SIEMPRE en centavos. */
  montoCents: number;
  /** ISO 4217. */
  moneda: string;
  /** Método: "transferencia", "tarjeta", etc. */
  metodo: string;
  /** Timestamp del casino. */
  timestamp: Date;
  /** URL del comprobante que el casino nos pasa (si existe). */
  comprobanteUrl?: string;
}

/** Retiro tal como lo reporta el casino (Phase 3). */
export interface RetiroExterno {
  externalRef: string;
  playerRef: string;
  montoCents: number;
  moneda: string;
  cbuDestino: string;
  timestamp: Date;
}

export interface CasinoAdapter {
  /** ¿El casino responde? Para health check desde la UI. */
  health(tenantId: TenantId): Promise<boolean>;

  /** Trae las cargas del casino entre dos fechas (polling). */
  fetchCargas(
    tenantId: TenantId,
    desde: Date,
    hasta: Date,
  ): Promise<CargaExterna[]>;

  /** Trae los retiros del casino entre dos fechas (Phase 3). */
  fetchRetiros(
    tenantId: TenantId,
    desde: Date,
    hasta: Date,
  ): Promise<RetiroExterno[]>;

  /** Notifica al casino que acreditamos la carga (cuando validamos). */
  notificarCargaAcreditada(
    tenantId: TenantId,
    externalRef: string,
  ): Promise<void>;

  /** Notifica al casino que pagamos el retiro (cuando pagamos). */
  notificarPagoRealizado(
    tenantId: TenantId,
    externalRef: string,
    comprobanteUrl?: string,
  ): Promise<void>;
}