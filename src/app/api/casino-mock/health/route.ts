/**
 * Endpoint /api/casino-mock/health.
 *
 * Devuelve 200 OK si el mock está vivo. Sirve para que el adapter haga
 * un health check antes de pedir cargas.
 */

export async function GET() {
  return new Response("OK", { status: 200 });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}