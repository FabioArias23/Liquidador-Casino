/**
 * Factory de auth: mock por ahora, Supabase real después.
 * La interface `AuthProvider` no cambia.
 */

import type { AuthProvider } from "@/application/ports/auth";
import { crearAuthMock } from "./mock";

let cache: AuthProvider | null = null;

export function obtenerAuth(): AuthProvider {
  if (cache) return cache;
  const fuente = (process.env.DATA_SOURCE ?? "mock").toLowerCase();
  if (fuente === "drizzle") {
    throw new Error(
      "Auth real (Supabase) aún no implementado. Estamos en mock.",
    );
  }
  cache = crearAuthMock();
  return cache;
}
