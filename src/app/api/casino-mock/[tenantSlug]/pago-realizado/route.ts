/**
 * POST /api/casino-mock/[tenantSlug]/pago-realizado
 *
 * Endpoint mock del casino que recibe la notificacion de pago de retiro.
 * Simula el comportamiento del casino real: valida la firma HMAC y
 * registra la notificacion (aca solo logueamos).
 */

import { NextResponse } from "next/server";

import {
  FIRMA_HEADER,
  NONCE_HEADER,
  TIMESTAMP_HEADER,
  timestampFresco,
  verificarFirma,
} from "@/lib/hmac";

interface Params {
  params: Promise<{ tenantSlug: string }>;
}

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  const { tenantSlug } = await params;
  const secret = process.env.CASINO_WEBHOOK_SECRET_DEV;

  if (!secret) {
    return NextResponse.json(
      { ok: false, codigo: "SECRET_NO_CONFIGURADO", mensaje: "Mock sin secret." },
      { status: 503 },
    );
  }

  const firma = req.headers.get(FIRMA_HEADER) ?? "";
  const timestamp = req.headers.get(TIMESTAMP_HEADER) ?? "";
  const nonce = req.headers.get(NONCE_HEADER) ?? "";
  const body = await req.text();

  if (!timestampFresco(timestamp)) {
    return NextResponse.json(
      { ok: false, codigo: "TIMESTAMP_VENCIDO", mensaje: "Timestamp fuera de ventana." },
      { status: 401 },
    );
  }

  if (!verificarFirma(secret, body, firma, timestamp, nonce)) {
    return NextResponse.json(
      { ok: false, codigo: "FIRMA_INVALIDA", mensaje: "Firma HMAC invalida." },
      { status: 401 },
    );
  }

  const payload = JSON.parse(body) as {
    externalRef?: string;
    estado?: string;
    comprobanteUrl?: string;
  };
  console.log(
    `[casino-mock] pago-realizado recibido: tenant=${tenantSlug} externalRef=${payload.externalRef ?? "?"} estado=${payload.estado ?? "?"} comprobante=${payload.comprobanteUrl ? "si" : "no"}`,
  );

  return NextResponse.json({ ok: true });
}
