// Diagnóstico de variables de entorno (NO imprime valores, solo si están seteadas).
// Uso: node scripts/check-env.mjs
const vars = [
  "DATA_SOURCE",
  "DATABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "ENCRYPTION_KEY",
  "CASINO_WEBHOOK_SECRET_DEV",
  "APP_URL",
];

let okCount = 0;
for (const k of vars) {
  const v = process.env[k];
  const mark = v ? "[OK]" : "[--]";
  const detail = v ? `definida (${v.length} chars)` : "NO definida";
  console.log(`${mark} ${k.padEnd(36)} ${detail}`);
  if (v) okCount += 1;
}
console.log(`\n${okCount}/${vars.length} variables seteadas.`);
