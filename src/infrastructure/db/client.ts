import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Conexión directa a Postgres (rol postgres = superuser, RLS no aplica).
 * El scoping por tenant es OBLIGATORIO en repositorios y casos de uso:
 * el tenantId siempre sale de una membresía verificada en la sesión.
 * (Ver AGENTS.md §9 y PLAN-TECNICO.md §7.)
 */

let sql: ReturnType<typeof postgres> | null = null;

function conexion() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no configurado");
    sql = postgres(url, { max: 10, onnotice: () => {} });
  }
  return sql;
}

export const db = drizzle(conexion(), { schema });
export type Db = typeof db;
