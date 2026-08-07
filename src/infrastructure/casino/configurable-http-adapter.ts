/**
 * ConfigurableHttpAdapter — implementación del puerto CasinoAdapter.
 *
 * Hoy: hace fetch al endpoint configurado (en demo: nuestro propio
 * /api/casino-mock/[slug]). Mañana: URL real del casino + headers del mapping.
 *
 * El adapter NO lee tenant_configs directamente — recibe la config por
 * parámetro. Eso lo hace testeable y reusable (un mismo adapter sirve para
 * N tenants con N configs distintas).
 */

import type {
  CasinoAdapter,
  CargaExterna,
  RetiroExterno,
} from "@/application/ports/casino";
import type { TenantConfigValidado } from "@/domain/schemas/tenant-config";

export interface FetchCargasOptions {
  desde?: Date;
  hasta?: Date;
  baseUrlOverride?: string;
}

export interface FetchCargasResult {
  ok: boolean;
  cargas: CargaExterna[];
  error?: string;
}

/**
 * Hace polling de cargas al endpoint configurado.
 * Si config es null, usamos defaults (apunta al mock local).
 */
export async function fetchCargasDeCasino(
  config: TenantConfigValidado | null,
  options: FetchCargasOptions = {},
): Promise<FetchCargasResult> {
  const baseUrl =
    options.baseUrlOverride ??
    config?.casinoMapping.baseUrl ??
    "";
  const authHeaders = config?.casinoMapping.authHeaders ?? {};
  const hasta = options.hasta ?? new Date();
  const desde =
    options.desde ?? new Date(hasta.getTime() - 24 * 60 * 60 * 1000);

  if (!baseUrl) {
    return {
      ok: false,
      cargas: [],
      error: "El tenant no tiene casinoMapping.baseUrl configurado.",
    };
  }

  const url = construirUrlCargas(baseUrl, { desde, hasta });
  try {
    const response = await fetch(url, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        ok: false,
        cargas: [],
        error: `Casino respondió ${response.status}: ${response.statusText}`,
      };
    }
    const raw = (await response.json()) as {
      cargas?: Array<Record<string, unknown>>;
    };
    const externas: CargaExterna[] = (raw.cargas ?? []).map((r) =>
      mapearCargaExterna(r, config?.casinoMapping),
    );
    return { ok: true, cargas: externas };
  } catch (err) {
    return {
      ok: false,
      cargas: [],
      error: `Error contacting casino: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function construirUrlCargas(
  baseUrl: string,
  range: { desde: Date; hasta: Date },
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("desde", range.desde.toISOString());
  url.searchParams.set("hasta", range.hasta.toISOString());
  return url.toString();
}

function mapearCargaExterna(
  raw: Record<string, unknown>,
  mapping: TenantConfigValidado["casinoMapping"] | undefined,
): CargaExterna {
  // Si hay mapping declarativo con paths dot-notation, lo respetamos.
  // Si no, leemos nombres canónicos (lo que devuelve el casino mock).
  const get = (path: string): unknown => {
    if (!mapping) return raw[path];
    const parts = path.split(".");
    let cur: unknown = raw;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return cur;
  };
  return {
    externalRef: String(get(mapping?.externalRefPath ?? "externalRef") ?? raw.id ?? ""),
    playerRef: String(get(mapping?.playerRefPath ?? "playerRef") ?? ""),
    montoCents: Number(get(mapping?.montoPath ?? "montoCents") ?? 0),
    moneda: String(get("moneda") ?? "ARS"),
    metodo: String(get("metodo") ?? "transferencia"),
    timestamp: get(mapping?.timestampPath ?? "timestamp")
      ? new Date(String(get(mapping?.timestampPath ?? "timestamp")))
      : new Date(),
    comprobanteUrl: get("comprobanteUrl")
      ? String(get("comprobanteUrl"))
      : undefined,
  };
}

/** Implementación completa del CasinoAdapter port (factory). */
export function crearConfigurableHttpAdapter(): CasinoAdapter {
  return {
    async health(tid) {
      // Health check contra el endpoint mock. Hoy: 200 si responde, false si no.
      try {
        const r = await fetch(`/api/casino-mock/${tid as string}`, {
          cache: "no-store",
        });
        return r.ok;
      } catch {
        return false;
      }
    },
    async fetchCargas(tid, desde, hasta) {
      // El mock no necesita config porque hardcodea la URL.
      const r = await fetchCargasDeCasino(null, {
        desde,
        hasta,
        baseUrlOverride: `/api/casino-mock/${tid as string}`,
      });
      return r.ok ? r.cargas : [];
    },
    async fetchRetiros(_tid): Promise<RetiroExterno[]> {
      // Phase 3.
      return [];
    },
    async notificarCargaAcreditada() {
      /* Phase 5 */
    },
    async notificarPagoRealizado() {
      /* Phase 3 */
    },
  };
}