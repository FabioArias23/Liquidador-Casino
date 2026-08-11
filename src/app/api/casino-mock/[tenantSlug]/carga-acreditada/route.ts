/**
 * POST /api/casino-mock/[tenantSlug]/carga-acreditada
 *
 * Endpoint mock del casino que recibe la notificacion de carga acreditada.
 * Simula el comportamiento del casino real: valida la firma HMAC y
 * registra la notificacion (aca solo logueamos).
 *
 * En produccion, este endpoint vive en el casino. Nuestro adapter le manda
 * POST cuando validamos una carga que vino del casino.
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

  const payload = JSON.parse(body) as { externalRef?: string; estado?: string };
  console.log(
    `[casino-mock] carga-acreditada recibida: tenant=${tenantSlug} externalRef=${payload.externalRef ?? "?"} estado=${payload.estado ?? "?"}`,
  );

  return NextResponse.json({ ok: true });
}
