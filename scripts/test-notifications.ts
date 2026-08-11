/**
 * Test E2E del circuito de notificaciones: adapter -> endpoint mock del casino.
 *
 * Verifica que cuando el adapter notifica una carga acreditada o un pago
 * realizado, el endpoint mock del casino:
 *   1. Recibe la firma HMAC valida -> 200 OK.
 *   2. Detecta firma invalida -> 401 FIRMA_INVALIDA.
 *   3. Detecta timestamp viejo -> 401 TIMESTAMP_VENCIDO.
 *
 * Esto cierra el loop end-to-end: carga entra por webhook -> se valida ->
 * adapter notifica al casino -> casino (mock) verifica HMAC -> responde OK.
 *
 * Uso:  npm run test:notifications
 */

import { POST as cargaAcreditadaPOST } from "@/app/api/casino-mock/[tenantSlug]/carga-acreditada/route";
import { POST as pagoRealizadoPOST } from "@/app/api/casino-mock/[tenantSlug]/pago-realizado/route";
import { crearConfigurableHttpAdapter } from "@/infrastructure/casino/configurable-http-adapter";
import { calcularFirma } from "@/lib/hmac";
import { tenantId as toTenantId } from "@/domain/ids";

const TENANT_SLUG = "casino-demo";
const TENANT_ID = toTenantId("00000000-0000-4000-8000-000000000010");
const SECRET = "test-notif-secret-32-chars-aaaaaaaa";

let failures = 0;

function check(label: string, ok: boolean, details = ""): void {
  const mark = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  console.log(`  ${mark} ${label}${details ? ` (${details})` : ""}`);
  if (!ok) failures += 1;
}

/**
 * Construye un Request con headers HMAC firmados para pasar al endpoint mock.
 */
function buildRequest(
  endpoint: string,
  body: Record<string, unknown>,
  opts: { secret?: string; timestampSeg?: number; nonce?: string } = {},
): Request {
  const secret = opts.secret ?? SECRET;
  const timestamp = (opts.timestampSeg ?? Math.floor(Date.now() / 1000)).toString();
  const nonce = opts.nonce ?? `nonce-${Math.random()}`;
  const bodyStr = JSON.stringify(body);
  const firma = calcularFirma(secret, bodyStr, timestamp, nonce);
  return new Request(`http://localhost/api/casino-mock/${TENANT_SLUG}${endpoint}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-casino-signature": firma,
      "x-casino-timestamp": timestamp,
      "x-casino-nonce": nonce,
    },
    body: bodyStr,
  });
}

async function main(): Promise<void> {
  process.env.CASINO_WEBHOOK_SECRET_DEV = SECRET;

  console.log("\n\x1b[36mNotificaciones E2E - adapter -> endpoint mock\x1b[0m\n");

  // ── 1. Endpoint mock: carga-acreditada con firma valida ────────────────
  {
    const req = buildRequest("/carga-acreditada", {
      externalRef: "ext-1",
      estado: "validated",
      tenantId: String(TENANT_ID),
      timestamp: new Date().toISOString(),
    });
    const r = await cargaAcreditadaPOST(req, {
      params: Promise.resolve({ tenantSlug: TENANT_SLUG }),
    });
    const data = await r.json();
    check(
      "endpoint carga-acreditada + firma valida: 200 OK",
      r.status === 200 && data.ok === true,
      `status=${r.status}`,
    );
  }

  // ── 2. Endpoint mock: firma invalida → 401 ─────────────────────────────
  {
    const req = buildRequest(
      "/carga-acreditada",
      { externalRef: "ext-2", estado: "validated" },
      { secret: "otro-secret-distinto-32-chars-bbbbbb" },
    );
    const r = await cargaAcreditadaPOST(req, {
      params: Promise.resolve({ tenantSlug: TENANT_SLUG }),
    });
    const data = await r.json();
    check(
      "endpoint carga-acreditada + firma invalida: 401 FIRMA_INVALIDA",
      r.status === 401 && data.codigo === "FIRMA_INVALIDA",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 3. Endpoint mock: timestamp viejo → 401 ────────────────────────────
  {
    const req = buildRequest(
      "/carga-acreditada",
      { externalRef: "ext-3" },
      { timestampSeg: Math.floor(Date.now() / 1000) - 600 },
    );
    const r = await cargaAcreditadaPOST(req, {
      params: Promise.resolve({ tenantSlug: TENANT_SLUG }),
    });
    const data = await r.json();
    check(
      "endpoint carga-acreditada + timestamp viejo: 401 TIMESTAMP_VENCIDO",
      r.status === 401 && data.codigo === "TIMESTAMP_VENCIDO",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 4. Endpoint mock: pago-realizado con firma valida ─────────────────
  {
    const req = buildRequest("/pago-realizado", {
      externalRef: "ext-pago-1",
      estado: "paid",
      comprobanteUrl: "https://banco.com/comp.jpg",
      tenantId: String(TENANT_ID),
      timestamp: new Date().toISOString(),
    });
    const r = await pagoRealizadoPOST(req, {
      params: Promise.resolve({ tenantSlug: TENANT_SLUG }),
    });
    const data = await r.json();
    check(
      "endpoint pago-realizado + firma valida: 200 OK",
      r.status === 200 && data.ok === true,
      `status=${r.status}`,
    );
  }

  // ── 5. Adapter notifica carga → fetch al endpoint ──────────────────────
  {
    let fetchCalled = false;
    let fetchUrl = "";
    let fetchInit: RequestInit | undefined;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: unknown, init: RequestInit) => {
      fetchCalled = true;
      fetchUrl = String(url);
      fetchInit = init;
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const adapter = crearConfigurableHttpAdapter();
      await adapter.notificarCargaAcreditada(TENANT_ID, "ext-notif-1");
      check("adapter notificarCargaAcreditada: hizo 1 fetch", fetchCalled);
      check(
        "adapter: el URL apunta al endpoint carga-acreditada",
        fetchUrl.includes("/carga-acreditada"),
        fetchUrl,
      );
      const headers = (fetchInit?.headers ?? {}) as Record<string, string>;
      check(
        "adapter: mando headers HMAC (signature + timestamp + nonce)",
        Boolean(headers["x-casino-signature"]) &&
          Boolean(headers["x-casino-timestamp"]) &&
          Boolean(headers["x-casino-nonce"]),
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // ── 6. Adapter notifica pago con comprobanteUrl ───────────────────────
  {
    let fetchCalled = false;
    let fetchBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
      fetchCalled = true;
      fetchBody = String(init.body);
      return new Response("OK", { status: 200 });
    }) as unknown as typeof fetch;

    try {
      const adapter = crearConfigurableHttpAdapter();
      await adapter.notificarPagoRealizado(
        TENANT_ID,
        "ext-pago-2",
        "https://banco.com/comp-2.jpg",
      );
      check("adapter notificarPagoRealizado: hizo 1 fetch", fetchCalled);
      const parsed = JSON.parse(fetchBody);
      check(
        "adapter pago: body incluye externalRef + estado=paid + comprobanteUrl",
        parsed.externalRef === "ext-pago-2" &&
          parsed.estado === "paid" &&
          parsed.comprobanteUrl === "https://banco.com/comp-2.jpg",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m✅ Notificaciones E2E OK\x1b[0m\n");
    process.exit(0);
  } else {
    console.log(`\x1b[31m❌ Notificaciones E2E FAIL (${failures} checks fallaron)\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\x1b[31m❌ Notificaciones E2E ERROR:\x1b[0m", err);
  process.exit(1);
});
