/**
 * SERVER-ONLY helpers para usar en server components, layouts y server actions.
 * Inicializan el bootstrap (carga seed si hace falta) y exponen singletons
 * tipados para toda la app.
 *
 * ⚠️ NUNCA importar desde un Client Component.
 *    Si necesitás pasar datos al cliente, recibilos como props desde un
 *    Server Component padre y serializalos con cuidado.
 */

import type { AuthProvider } from "@/application/ports/auth";
import type { Repositorios } from "@/infrastructure/repositories";
import { obtenerAuth } from "@/infrastructure/auth";
import { obtenerRepositorios } from "@/infrastructure/repositories";

let reposCache: Promise<Repositorios> | null = null;
let authCache: AuthProvider | null = null;

export function repos(): Promise<Repositorios> {
  if (!reposCache) reposCache = obtenerRepositorios();
  return reposCache;
}

export function auth(): AuthProvider {
  if (!authCache) authCache = obtenerAuth();
  return authCache;
}
