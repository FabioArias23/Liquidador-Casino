// ALTER TABLE: agrega updated_at a profiles y tenant_members (faltantes en la migracion original).
// Idempotente: solo agrega si no existe.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const sql = postgres(url, { max: 1, ssl: "require" });

const STATEMENTS = [
  {
    label: "profiles: agregar updated_at",
    sql: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT NOW()`,
  },
  {
    label: "tenant_members: agregar updated_at",
    sql: `ALTER TABLE tenant_members ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT NOW()`,
  },
];

try {
  console.log("\n\x1b[36mALTER TABLE: agrega columnas faltantes\x1b[0m\n");
  for (const { label, sql: stmt } of STATEMENTS) {
    try {
      await sql.unsafe(stmt);
      console.log(`  \x1b[32m✅\x1b[0m ${label}`);
    } catch (err) {
      console.log(`  \x1b[31m❌\x1b[0m ${label}: ${err.message.slice(0, 100)}`);
      process.exit(1);
    }
  }
  console.log("\n\x1b[32m✅ ALTER TABLE OK\x1b[0m\n");
} finally {
  await sql.end();
}
