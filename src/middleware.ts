/**
 * Middleware: detecta cuando la URL está adentro de un tenant y forward
 * el slug al sidebar (server component) via header.
 *
 * - Matchea `/backoffice/:slug/*` y setea `x-tenant-slug: <slug>`.
 * - El resto de las rutas no se tocan.
 *
 * Esto permite que el sidebar (server component) decida si mostrar
 * los módulos del tenant activo o la lista de tenants, sin necesidad
 * de un client component ni de una cookie mutable.
 */

import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const slug = req.nextUrl.pathname.match(
    /^\/backoffice\/([^/]+)/,
  )?.[1];

  const requestHeaders = new Headers(req.headers);
  if (slug) {
    requestHeaders.set("x-tenant-slug", slug);
  } else {
    requestHeaders.delete("x-tenant-slug");
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/backoffice/:path*"],
};
