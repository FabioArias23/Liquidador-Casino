/**
 * Seed base para Supabase: tenant demo + 4 perfiles + 3 miembros + 2 CBUs
 * + 1 casino_credentials. Idempotente (ON CONFLICT DO NOTHING).
 *
 * Uso:  npm run db:seed
 */

import postgres from "postgres";

let failures = 0;
function check(label: string, ok: boolean = true, details = ""): void {
  const mark = ok ? "\x1b[32m✅\x1b[0m" : "\x1b[31m❌\x1b[0m";
  console.log(`  ${mark} ${label}${details ? ` (${details})` : ""}`);
  if (!ok) failures += 1;
}

const STATEMENTS: Array<{ label: string; sql: string }> = [
  {
    label: "tenants: casino-demo",
    sql: `INSERT INTO tenants (id, nombre, slug, estado, created_at, updated_at)
          VALUES ('00000000-0000-4000-8000-000000000010', 'Casino Demo', 'casino-demo', 'activo', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
  },
  {
    label: "profiles: 4 perfiles seed",
    sql: `INSERT INTO profiles (id, email, is_superadmin, created_at, updated_at)
          VALUES
            ('00000000-0000-4000-8000-000000000001', 'superadmin@liquidador.local', TRUE,  NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000002', 'operador@casinodemo.local',   FALSE, NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000003', 'supervisor@casinodemo.local', FALSE, NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000004', 'admin@casinodemo.local',      FALSE, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
  },
  {
    label: "tenant_members: 3 miembros del casino-demo",
    sql: `INSERT INTO tenant_members (id, tenant_id, user_id, rol, estado, created_at, updated_at)
          VALUES
            ('00000000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000002', 'operador',     'activo', NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000021', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000003', 'supervisor',   'activo', NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000004', 'tenant_admin', 'activo', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
  },
  {
    label: "cbu_accounts: 2 CBUs (checksum BCRA valido)",
    sql: `INSERT INTO cbu_accounts (id, tenant_id, cbu, alias, titular, moneda, activa, created_at, updated_at)
          VALUES
            ('00000000-0000-4000-8000-000000000030', '00000000-0000-4000-8000-000000000010', '0000000100000000000000012', 'casino.demo.cbu1', 'Casino Demo SA', 'ARS', TRUE, NOW(), NOW()),
            ('00000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000010', '0000000100000000000000023', 'casino.demo.cbu2', 'Casino Demo SA', 'ARS', TRUE, NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
  },
  {
    label: "casino_credentials: adapter HTTP configurable",
    sql: `INSERT INTO casino_credentials (id, tenant_id, adapter_type, base_url, api_key_ciphertext, webhook_secret, created_at, updated_at)
          VALUES ('00000000-0000-4000-8000-000000000040', '00000000-0000-4000-8000-000000000010', 'configurable_http', 'http://localhost:3000/api/casino-mock/casino-demo', NULL, 'dev-webhook-secret-32chars-min-aaaa', NOW(), NOW())
          ON CONFLICT (id) DO NOTHING`,
  },
];

const COUNT_QUERIES = [
  { tabla: "tenants", sql: "SELECT COUNT(*) as c FROM tenants" },
  { tabla: "profiles", sql: "SELECT COUNT(*) as c FROM profiles" },
  { tabla: "tenant_members", sql: "SELECT COUNT(*) as c FROM tenant_members" },
  { tabla: "cbu_accounts", sql: "SELECT COUNT(*) as c FROM cbu_accounts" },
  { tabla: "casino_credentials", sql: "SELECT COUNT(*) as c FROM casino_credentials" },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("\x1b[31m❌ DATABASE_URL no definida.\x1b[0m");
    process.exit(1);
  }

  console.log("\n\x1b[36mSeed base Supabase (tenant + profiles + members + CBUs + casinoCreds)\x1b[0m\n");

  const sqlClient = postgres(url, {
    max: 1,
    onnotice: () => {},
    ssl: "require",
    connect_timeout: 15,
    idle_timeout: 30,
  });

  try {
    for (const { label, sql } of STATEMENTS) {
      try {
        await sqlClient.unsafe(sql);
        check(label);
      } catch (err) {
        check(label, false, err instanceof Error ? err.message.slice(0, 100) : String(err));
      }
    }

    console.log("\n  Conteos actuales en Supabase:");
    for (const { tabla, sql } of COUNT_QUERIES) {
      try {
        const r = await sqlClient.unsafe<Array<{ c: string }>>(sql);
        console.log(`    · ${tabla.padEnd(22)} ${r[0]?.c ?? "?"}`);
      } catch (err) {
        console.log(`    · ${tabla.padEnd(22)} ERROR: ${err instanceof Error ? err.message.slice(0, 50) : "?"}`);
      }
    }

    console.log("");
    if (failures === 0) {
      console.log("\x1b[32m✅ Seed base Supabase OK\x1b[0m\n");
      process.exit(0);
    } else {
      console.log(`\x1b[31m❌ Seed base Supabase FAIL (${failures} statements fallaron)\x1b[0m\n`);
      process.exit(1);
    }
  } finally {
    await sqlClient.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("\x1b[31m� Error fatal:\x1b[0m", err);
  process.exit(1);
});
