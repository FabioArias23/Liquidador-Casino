/**
 * Endpoint mock que simula la respuesta del casino.
 *
 * Devuelve 3-5 cargas aleatorias con externalRefs determinísticas
 * (basadas en timestamp) para que se pueda ver el efecto de la
 * idempotencia si se llama varias veces.
 *
 * GET /api/casino-mock/[tenantSlug]?desde=...&hasta=...
 * GET /api/casino-mock/health → 200 OK
 */

import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ tenantSlug: string }>;
}

function generarCargas(tenantSlug: string): Array<Record<string, unknown>> {
  // IDs determinísticos pero variados por timestamp + counter.
  // Si el operador llama 2 veces en la misma ventana, ve el efecto
  // de la idempotencia (segunda llamada devuelve las mismas externalRefs).
  const ahora = Date.now();
  return [
    {
      externalRef: `casino-${tenantSlug}-${ahora}-1`,
      playerRef: "jugor-casino-A1",
      montoCents: 50_000,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date(ahora - 10 * 60_000).toISOString(),
      comprobanteUrl: `/uploads/casino-${ahora}-1.jpg`,
    },
    {
      externalRef: `casino-${tenantSlug}-${ahora}-2`,
      playerRef: "jugor-casino-B2",
      montoCents: 120_000,
      moneda: "ARS",
      metodo: "transferencia",
      timestamp: new Date(ahora - 25 * 60_000).toISOString(),
    },
    {
      externalRef: `casino-${tenantSlug}-${ahora}-3`,
      playerRef: "jugor-casino-C3",
      montoCents: 30_000,
      moneda: "ARS",
      metodo: "tarjeta",
      timestamp: new Date(ahora - 45 * 60_000).toISOString(),
      comprobanteUrl: `/uploads/casino-${ahora}-3.jpg`,
    },
    {
      externalRef: `casino-${tenantSlug}-${ahora}-4`,
      playerRef: "jugor-casino-D4",
      montoCents: 250_000,
      moneda: "ARS",
      metodo: "transferencia",
      timestamp: new Date(ahora - 90 * 60_000).toISOString(),
    },
  ];
}

export async function GET(_req: Request, { params }: Params) {
  const { tenantSlug } = await params;
  const cargas = generarCargas(tenantSlug);
  return NextResponse.json({ cargas });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}