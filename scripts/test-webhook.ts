/**
 * Test E2E del webhook receiver del casino.
 *
 * Importa el route handler directamente (sin Next.js corriendo) y le pasa
 * Requests mockeados. Verifica los 7 escenarios criticos de defensa:
 *
 *   1. Firma valida + body valido + nonce nuevo → 200, carga creada.
 *   2. Firma invalida → 401 FIRMA_INVALIDA.
 *   3. Timestamp viejo (>5 min) → 401 TIMESTAMP_VENCIDO.
 *   4. Nonce duplicado → 401 NONCE_DUPLICADO.
 *   5. Body JSON invalido → 400 BODY_JSON_INVALIDO.
 *   6. Tenant inexistente → 404 TENANT_NO_ENCONTRADO.
 *   7. Misma externalRef 2 veces → 200 idempotente (mismo cargaId).
 *
 * Uso:  npm run test:webhook
 */

import { existsSync, rmSync } from "node:fs";

import { POST as webhookPOST } from "@/app/api/webhooks/casino/[tenantSlug]/route";
import { calcularFirma } from "@/lib/hmac";
import { _resetNonceStoreParaTests } from "@/lib/nonce-store";
import {
  _resetRepositoriosParaTests,
  obtenerRepositorios,
} from "@/infrastructure/repositories";

const TENANT_SLUG = "casino-demo";
const SECRET = "dev-webhook-secret-32chars-min-aaaa";

let failures = 0;

function check(label: string, ok: boolean, details = ""): void {
  const mark = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  console.log(`  ${mark} ${label}${details ? ` (${details})` : ""}`);
  if (!ok) failures += 1;
}

interface MockRequestInit {
  body: string;
  signature?: string;
  timestamp?: string;
  nonce?: string;
  omitHeaders?: boolean;
}

async function enviarWebhook({
  body,
  signature,
  timestamp,
  nonce,
  omitHeaders,
}: MockRequestInit): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (!omitHeaders) {
    headers["x-casino-signature"] =
      signature ?? calcularFirma(SECRET, body, timestamp ?? "", nonce ?? "");
    if (timestamp !== undefined) headers["x-casino-timestamp"] = timestamp;
    if (nonce !== undefined) headers["x-casino-nonce"] = nonce;
  }
  const req = new Request(`http://localhost/api/webhooks/casino/${TENANT_SLUG}`, {
    method: "POST",
    headers,
    body,
  });
  return webhookPOST(req, { params: Promise.resolve({ tenantSlug: TENANT_SLUG }) });
}

async function armarPayloadValido(externalRef: string): Promise<string> {
  return JSON.stringify({
    externalRef,
    playerRef: "jugador-a3f9",
    montoCents: 50_000,
    moneda: "ARS",
    metodo: "transferencia",
    timestamp: new Date().toISOString(),
    comprobanteUrl: "https://casino.com/comp.jpg",
  });
}

async function main(): Promise<void> {
  // Reset state para que cada corrida arranque limpia.
  if (existsSync(".data/mock.json")) rmSync(".data/mock.json", { force: true });
  _resetRepositoriosParaTests();
  _resetNonceStoreParaTests();
  await obtenerRepositorios();

  const nowSeg = Math.floor(Date.now() / 1000).toString();
  const tsViejo = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min atras

  console.log("\n\x1b[36mWebhook E2E - 7 escenarios de defensa\x1b[0m\n");

  // ── 1. Happy path ──────────────────────────────────────────────────────
  {
    const externalRef = `webhook-test-${Date.now()}-1`;
    const body = await armarPayloadValido(externalRef);
    const nonce = `nonce-1-${Date.now()}`;
    const r = await enviarWebhook({ body, timestamp: nowSeg, nonce });
    const data = await r.json();
    check(
      "happy path: 200 con carga creada",
      r.status === 200 && data.ok === true && typeof data.cargaId === "string",
      `status=${r.status} cargaId=${data.cargaId?.slice(0, 12) ?? "—"}…`,
    );
    check(
      "happy path: externalRef coincide",
      data.externalRef === externalRef,
    );
  }

  // ── 2. Firma invalida ──────────────────────────────────────────────────
  {
    const body = await armarPayloadValido(`webhook-test-${Date.now()}-2`);
    const r = await enviarWebhook({
      body,
      timestamp: nowSeg,
      nonce: `nonce-2-${Date.now()}`,
      signature: "firma-totalmente-invalida-de-64-chars-aaaaaaaaaaaaaaaaaaaaaaaa",
    });
    const data = await r.json();
    check(
      "firma invalida: 401 FIRMA_INVALIDA",
      r.status === 401 && data.codigo === "FIRMA_INVALIDA",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 3. Timestamp viejo ─────────────────────────────────────────────────
  {
    const body = await armarPayloadValido(`webhook-test-${Date.now()}-3`);
    const r = await enviarWebhook({
      body,
      timestamp: tsViejo,
      nonce: `nonce-3-${Date.now()}`,
    });
    const data = await r.json();
    check(
      "timestamp viejo (>5 min): 401 TIMESTAMP_VENCIDO",
      r.status === 401 && data.codigo === "TIMESTAMP_VENCIDO",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 4. Nonce duplicado ─────────────────────────────────────────────────
  {
    const externalRef = `webhook-test-${Date.now()}-4`;
    const body = await armarPayloadValido(externalRef);
    const nonceCompartido = `nonce-4-${Date.now()}`;
    const r1 = await enviarWebhook({ body, timestamp: nowSeg, nonce: nonceCompartido });
    const r2 = await enviarWebhook({ body, timestamp: nowSeg, nonce: nonceCompartido });
    const data2 = await r2.json();
    check(
      "nonce duplicado (mismo nonce 2 veces): 401 NONCE_DUPLICADO en 2da llamada",
      r1.status === 200 && r2.status === 401 && data2.codigo === "NONCE_DUPLICADO",
      `r1=${r1.status} r2=${r2.status}`,
    );
  }

  // ── 5. Body JSON invalido ──────────────────────────────────────────────
  {
    const body = "esto no es JSON {{{";
    const r = await enviarWebhook({ body, timestamp: nowSeg, nonce: `nonce-5-${Date.now()}` });
    const data = await r.json();
    check(
      "body no es JSON: 400 BODY_JSON_INVALIDO",
      r.status === 400 && data.codigo === "BODY_JSON_INVALIDO",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 6. Tenant inexistente ──────────────────────────────────────────────
  {
    const req = new Request("http://localhost/api/webhooks/casino/no-existe", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-casino-signature": "firma",
        "x-casino-timestamp": nowSeg,
        "x-casino-nonce": `nonce-6-${Date.now()}`,
      },
      body: "{}",
    });
    const r = await webhookPOST(req, {
      params: Promise.resolve({ tenantSlug: "no-existe" }),
    });
    const data = await r.json();
    check(
      "tenant inexistente: 404 TENANT_NO_ENCONTRADO",
      r.status === 404 && data.codigo === "TENANT_NO_ENCONTRADO",
      `status=${r.status} codigo=${data.codigo}`,
    );
  }

  // ── 7. Idempotencia por externalRef ────────────────────────────────────
  {
    const externalRef = `webhook-test-${Date.now()}-7`;
    const body = await armarPayloadValido(externalRef);
    const r1 = await enviarWebhook({
      body,
      timestamp: nowSeg,
      nonce: `nonce-7a-${Date.now()}`,
    });
    const d1 = await r1.json();
    const r2 = await enviarWebhook({
      body,
      timestamp: nowSeg,
      nonce: `nonce-7b-${Date.now()}`,
    });
    const d2 = await r2.json();
    check(
      "idempotencia: misma externalRef = mismo cargaId",
      r1.status === 200 &&
        r2.status === 200 &&
        d1.cargaId === d2.cargaId,
      `cargaId1=${d1.cargaId?.slice(0, 12)}… cargaId2=${d2.cargaId?.slice(0, 12)}…`,
    );
  }

  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m✅ Webhook E2E OK\x1b[0m\n");
    process.exit(0);
  } else {
    console.log(`\x1b[31m❌ Webhook E2E FAIL (${failures} checks fallaron)\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\x1b[31m❌ Webhook E2E ERROR:\x1b[0m", err);
  process.exit(1);
});
