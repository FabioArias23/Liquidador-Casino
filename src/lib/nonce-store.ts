/**
 * NonceStore — previene replay attacks en webhooks del casino.
 *
 * Cada nonce se puede usar 1 sola vez por tenant dentro de la ventana TTL.
 * Pasada la TTL, se considera vencido y el reuso está OK (porque el
 * timestamp window ya lo bloqueó antes — los dos mecanismos se complementan).
 *
 * Por diseño: en memoria (no persistido). Si el proceso se reinicia, los
 * nonces viejos ya pasaron la TTL, así que el riesgo de replay es 0.
 *
 * Pensado para uso singleton por proceso (un webhook receiver por app).
 */

export interface NonceStoreOptions {
  /** TTL de cada nonce en ms. Default: 10 minutos (alineado con timestamp window). */
  ttlMs?: number;
}

export class NonceStore {
  private readonly ttlMs: number;
  /** tenantSlug -> nonce -> timestamp de expiracion. */
  private readonly store = new Map<string, Map<string, number>>();

  constructor(options: NonceStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? 10 * 60 * 1000;
  }

  /**
   * Devuelve true si el nonce es nuevo (y lo registra).
   * Devuelve false si ya fue usado dentro de la TTL.
   */
  esNuevo(tenantSlug: string, nonce: string, ahoraMs: number = Date.now()): boolean {
    this.limpiarVencidos(tenantSlug, ahoraMs);
    let bucket = this.store.get(tenantSlug);
    if (!bucket) {
      bucket = new Map();
      this.store.set(tenantSlug, bucket);
    }
    if (bucket.has(nonce)) return false;
    bucket.set(nonce, ahoraMs + this.ttlMs);
    return true;
  }

  /** Limpia los nonces de un tenant que ya pasaron la TTL. */
  private limpiarVencidos(tenantSlug: string, ahoraMs: number): void {
    const bucket = this.store.get(tenantSlug);
    if (!bucket) return;
    for (const [nonce, expira] of bucket) {
      if (expira <= ahoraMs) bucket.delete(nonce);
    }
    if (bucket.size === 0) this.store.delete(tenantSlug);
  }

  /** Resetea el bucket de un tenant especifico. */
  resetTenant(tenantSlug: string): void {
    this.store.delete(tenantSlug);
  }

  /** Solo para tests/diagnostico. */
  size(tenantSlug?: string): number {
    if (tenantSlug) return this.store.get(tenantSlug)?.size ?? 0;
    let total = 0;
    for (const bucket of this.store.values()) total += bucket.size;
    return total;
  }
}

/** Singleton del proceso. Reusa el mismo bucket entre todos los requests. */
let singleton: NonceStore | null = null;

export function obtenerNonceStore(): NonceStore {
  if (!singleton) singleton = new NonceStore();
  return singleton;
}

/** Solo para tests: limpia el singleton. */
export function _resetNonceStoreParaTests(): void {
  singleton = null;
}
