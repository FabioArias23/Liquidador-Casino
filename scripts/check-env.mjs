// Diagnóstico de variables de entorno (NO imprime valores, solo si están seteadas).
// Soporta AMBOS formatos de Supabase: viejo (ANON_KEY, SERVICE_ROLE_KEY) y
// nuevo 2025+ (PUBLISHABLE_KEY, SECRET_KEY). El primero que matchea gana.
// Uso: node scripts/check-env.mjs
const vars = [
  "DATA_SOURCE",
  "DATABASE_URL",
  // Supabase formato viejo
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  // Supabase formato nuevo 2025+
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_JWKS_URL",
  "SUPABASE_URL",
  // Otras
  "ENCRYPTION_KEY",
  "CASINO_WEBHOOK_SECRET_DEV",
  "APP_URL",
];

let okCount = 0;
for (const k of vars) {
  const v = process.env[k];
  const mark = v ? "[OK]" : "[--]";
  const detail = v ? `definida (${v.length} chars)` : "NO definida";
  console.log(`${mark} ${k.padEnd(40)} ${detail}`);
  if (v) okCount += 1;
}
console.log(`\n${okCount}/${vars.length} variables seteadas.`);

// Diagnóstico de Supabase: detecta qué formato tenés.
const hasLegacy = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const hasNew = Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SECRET_KEY);
if (hasLegacy && hasNew) {
  console.log("\n⚠️  Mezclaste formato viejo y nuevo de Supabase. Elegí uno.");
} else if (hasLegacy) {
  console.log("\n📦 Formato Supabase detectado: LEGACY (ANON_KEY + SERVICE_ROLE_KEY).");
} else if (hasNew) {
  console.log("\n📦 Formato Supabase detectado: NUEVO 2025+ (PUBLISHABLE_KEY + SECRET_KEY).");
}
