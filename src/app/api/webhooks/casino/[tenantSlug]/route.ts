/**
 * POST /api/webhooks/casino/[tenantSlug]
 *
 * Endpoint receptor de webhooks del casino online. Defensa en 4 capas:
 *
 *   1. Tenant existe y tiene credenciales del casino configuradas.
 *   2. Timestamp fresco (±5 min) — anti-replay temporal.
 *   3. Firma HMAC-SHA256(body, timestamp, nonce, secret) — anti-tampering.
 *   4. Nonce único por (tenant, ventana TTL) — anti-replay por duplicación.
 *
 * Si pasa las 4 capas, parsea el body con Zod (defensa contra payload
 * mal formado del casino) y llama al use case `registrarCargaDesdeCasino`,
 * que es idempotente por `externalRef` (mismo ID externo = no duplica).
 *
 * Headers esperados del casino:
 *   X-Casino-Signature: <hex 64 chars>
 *   X-Casino-Timestamp: <unix seconds>
 *   X-Casino-Nonce:     <string único por envío>
 */

import { NextResponse } from "next/server";

import { registrarCargaDesdeCasino } from "@/application/cargas/registrar-carga-desde-casino";
import { tenantId as toTenantId } from "@/domain/ids";
import { webhookCargaPayloadSchema } from "@/domain/schemas/webhook-carga";
import {
  FIRMA_HEADER,
  NONCE_HEADER,
  TIMESTAMP_HEADER,
  timestampFresco,
  verificarFirma,
} from "@/lib/hmac";
import { obtenerNonceStore } from "@/lib/nonce-store";
import { repos } from "@/lib/server";

interface Params {
  params: Promise<{ tenantSlug: string }>;
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { tenantSlug } = await params;

  // ── 1. Body raw (necesario para HMAC antes de parsearlo) ─────────────
  let body: string;
  try {
    body = await req.text();
  } catch {
    return jsonError(400, "BODY_NO_LEGIBLE", "No se pudo leer el body del request.");
  }

  // ── 2. Headers ─────────────────────────────────────────────────────────
  const firma = req.headers.get(FIRMA_HEADER) ?? "";
  const timestamp = req.headers.get(TIMESTAMP_HEADER) ?? "";
  const nonce = req.headers.get(NONCE_HEADER) ?? "";

  if (!firma || !timestamp || !nonce) {
    return jsonError(
      401,
      "HEADERS_FALTANTES",
      `Faltan headers de firma. Requeridos: ${FIRMA_HEADER}, ${TIMESTAMP_HEADER}, ${NONCE_HEADER}.`,
    );
  }

  // ── 3. Tenant + credenciales ───────────────────────────────────────────
  const r = await repos();
  const tenant = await r.tenants.obtenerPorSlug(tenantSlug);
  if (!tenant) {
    return jsonError(404, "TENANT_NO_ENCONTRADO", `Tenant '${tenantSlug}' no existe.`);
  }

  const creds = await r.casinoCredentials.obtenerPorTenant(tenant.id);
  const secret = creds?.webhookSecret ?? process.env.CASINO_WEBHOOK_SECRET_DEV ?? null;
  if (!secret) {
    return jsonError(
      503,
      "CREDENCIALES_NO_CONFIGURADAS",
      "El tenant no tiene webhookSecret configurado y no hay CASINO_WEBHOOK_SECRET_DEV.",
    );
  }

  // ── 4. Timestamp fresco (anti-replay temporal) ─────────────────────────
  if (!timestampFresco(timestamp)) {
    return jsonError(
      401,
      "TIMESTAMP_VENCIDO",
      "El timestamp del webhook está fuera de la ventana permitida (±5 min).",
    );
  }

  // ── 5. Firma HMAC (anti-tampering) ─────────────────────────────────────
  if (!verificarFirma(secret, body, firma, timestamp, nonce)) {
    return jsonError(
      401,
      "FIRMA_INVALIDA",
      "La firma HMAC no coincide. Posible tampering o secret incorrecto.",
    );
  }

  // ── 6. Nonce único (anti-replay por duplicación) ───────────────────────
  if (!obtenerNonceStore().esNuevo(tenantSlug, nonce)) {
    return jsonError(
      401,
      "NONCE_DUPLICADO",
      "Este nonce ya fue usado dentro de la ventana TTL. Replay bloqueado.",
    );
  }

  // ── 7. Parsear body con Zod ────────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(body);
  } catch {
    return jsonError(400, "BODY_JSON_INVALIDO", "El body no es JSON válido.");
  }

  const parsed = webhookCargaPayloadSchema.safeParse(rawBody);
  if (!parsed.success) {
    const detalle = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return jsonError(400, "BODY_VALIDACION_FALLIDA", `Body inválido: ${detalle}`);
  }
  const payload = parsed.data;

  // ── 8. Llamar al use case (idempotente por externalRef) ────────────────
  const result = await registrarCargaDesdeCasino(r, toTenantId(tenant.id), {
    externalRef: payload.externalRef,
    playerRef: payload.playerRef,
    montoCents: payload.montoCents,
    moneda: payload.moneda,
    metodo: payload.metodo,
    timestamp: new Date(payload.timestamp),
    comprobanteUrl: payload.comprobanteUrl,
  });

  if (!result.ok) {
    return jsonError(400, result.error.codigo, result.error.mensaje);
  }

  return NextResponse.json(
    {
      ok: true,
      cargaId: result.data.id,
      externalRef: result.data.externalRef,
      estado: result.data.estado,
    },
    { status: 200 },
  );
}

function jsonError(
  status: number,
  codigo: string,
  mensaje: string,
): NextResponse {
  return NextResponse.json({ ok: false, codigo, mensaje }, { status });
}
