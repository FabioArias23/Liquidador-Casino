/**
 * Test de conexion a Supabase Postgres.
 *
 * Lee DATABASE_URL del env (cargando .env.local), abre una conexion con
 * postgres-js + drizzle, hace SELECT 1 y lista las tablas existentes.
 *
 * Es el primer paso de Phase 5: confirma que las credenciales son validas
 * ANTES de empezar a implementar repos Drizzle / migrar el seed.
 *
 * Uso:  npm run test:db
 */

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

let failures = 0;

function check(label: string, ok: boolean, details = ""): void {
  const mark = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  console.log(`  ${mark} ${label}${details ? ` (${details})` : ""}`);
  if (!ok) failures += 1;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("\x1b[31m❌ DATABASE_URL no definida. Pegala en .env.local.\x1b[0m");
    process.exit(1);
  }

  console.log("\n\x1b[36mTest conexion a Supabase Postgres\x1b[0m\n");
  console.log(`  URL: ${url.replace(/:[^:@]+@/, ":***@")}  (password oculta)\n`);

  const sqlClient = postgres(url, {
    max: 1,
    onnotice: () => {},
    ssl: "require",
    connection: { statement_timeout: 10_000 },
  });

  try {
    const db = drizzle(sqlClient);

    // ── 1. SELECT basico ─────────────────────────────────────────────────
    const resultado = await db.execute<{ ok: number }>(sql`SELECT 1 as ok`);
    check(
      "SELECT 1 OK (credenciales validas)",
      resultado.length > 0 && resultado[0]?.ok === 1,
    );

    // ── 2. Version del server ────────────────────────────────────────────
    const versionRows = await db.execute<{ version: string }>(
      sql`SELECT version() as version`,
    );
    const version = versionRows[0]?.version ?? "";
    check(
      "Conectado a Postgres",
      version.toLowerCase().includes("postgres"),
      version.split(" on ")[0] ?? "",
    );

    // ── 3. Listar tablas existentes ─────────────────────────────────────
    const tablas = await db.execute<{ table_name: string }>(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\n  Tablas en schema 'public' (${tablas.length}):`);
    if (tablas.length === 0) {
      console.log("    (ninguna - todavia no se corrieron las migraciones Drizzle)");
    } else {
      for (const t of tablas) console.log(`    · ${t.table_name}`);
    }
    check("informacion de tablas accesible", true);

    // ── 4. Permisos basicos: CREATE TEMP TABLE ──────────────────────────
    // Ojo: el transaction pooler de Supabase limita CREATE TEMP. Es
    // esperado y no bloquea migraciones Drizzle (que usan CREATE TABLE
    // permanente via conexion directa, no TEMP).
    try {
      await db.execute(sql`CREATE TEMP TABLE _test_permisos (id int)`);
      console.log(`  \x1b[32mℹ\x1b[0m  CREATE TEMP TABLE OK (permisos elevados)`);
    } catch {
      console.log(
        `  \x1b[33mℹ\x1b[0m  CREATE TEMP TABLE bloqueado (esperado en transaction pooler - no es problema)`,
      );
    }
  } catch (err) {
    console.log(
      `\n\x1b[31m❌ Error de conexion:\x1b[0m\n  ${
        err instanceof Error ? err.message : String(err)
      }\n`,
    );
    if (err instanceof Error && err.stack) {
      console.log("\nStack:");
      console.log(err.stack);
    }
    process.exit(1);
  } finally {
    await sqlClient.end({ timeout: 5 });
  }

  console.log("");
  if (failures === 0) {
    console.log("\x1b[32m✅ Conexion a Supabase OK\x1b[0m\n");
    process.exit(0);
  } else {
    console.log(`\x1b[31m❌ Conexion a Supabase FAIL (${failures} checks fallaron)\x1b[0m\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\x1b[31m❌ Error fatal:\x1b[0m", err);
  process.exit(1);
});
