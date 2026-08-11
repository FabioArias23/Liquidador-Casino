# Variables de entorno — referencia

> Este doc reemplaza al `.env.example` que **ya no se commitea** (ver
> commit `chore(security): ignore .env.example` y la nota en `.gitignore`).
>
> El motivo: una vez casi se commitea un `SUPABASE_SECRET_KEY` real en ese
> archivo. Aunque `.env.example` se supone "vacío", un copy-paste rápido
> lo llena y queda público. Más seguro ignorar y mantener la referencia acá.

---

## Cómo se usa

1. **Copiá la sección que necesites** a tu `.env.local` (NO se commitea, ya está en `.gitignore`).
2. **Completá los valores** siguiendo los links de cada sección.
3. **Verificá** con `npm run check-env` (script auxiliar) qué vars tenés seteadas.

---

## [DATA SOURCE]

```bash
DATA_SOURCE=mock
```

| Valor | Significado |
|---|---|
| `mock` | In-memory con snapshot en `.data/mock.json` (default, ideal para dev). |
| `drizzle` | Postgres real via Drizzle ORM (Phase 5+). |

---

## [DATABASE] — Phase 5+

```bash
DATABASE_URL=
```

Requerido SOLO si `DATA_SOURCE=drizzle`. Sacalo de:
**Supabase → Project Settings → Database → Connection string → Transaction pooler**
(ese es el que sirve para serverless; el "Direct" también funciona pero gasta conexiones).

Formato: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

---

## [SUPABASE] — Phase 5+

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
```

Sacalo de **Supabase → Project Settings → API**.

- `NEXT_PUBLIC_*` se exponen al cliente (publishable, no son secretos).
- `SUPABASE_SERVICE_ROLE_KEY` es **SERVER-ONLY** — NUNCA la marques `NEXT_PUBLIC_`. Bypasea RLS para operaciones admin del backoffice.
- `SUPABASE_PROJECT_REF` lo sacás de **Project Settings → General → Reference ID** (para el CLI).

---

## [SEGURIDAD] — cifrado de credenciales

```bash
ENCRYPTION_KEY=
```

Key AES-GCM de 32 bytes (64 hex chars) usada para cifrar las API keys del casino
en `casino_credentials.api_key_ciphertext` (ver PLAN-TECNICO §8).

**Generar una:** `openssl rand -hex 32`

**NO commitear.** Si la perdés, todas las credenciales del casino dejan de poder
descifrarse — hay que re-ingresarlas.

---

## [CASINO WEBHOOKS] — Phase 4

```bash
CASINO_WEBHOOK_SECRET_DEV=
```

Secret default para validar HMAC de webhooks entrantes del casino durante dev.
En producción cada tenant tiene su propio secret en
`casino_credentials.webhook_secret` (configurado vía UI en
`/backoffice/[slug]/casino`).

**Generar una:** `openssl rand -hex 32`

---

## [MOCK] — opcional

```bash
# MOCK_PERSIST=true
```

- `false` → NO persiste `.data/mock.json` al disco (útil para tests herméticos).
- default / `true` → persiste (cambios sobreviven reinicios del dev server).

---

## [DEBUG] — opcional

```bash
# DEBUG_CARGAS=
```

Si está seteada, loggea info adicional cuando falla el optimistic lock en
`asentar-carga` (útil para debug de race conditions).

---

## [APP] — Next.js estándar

```bash
# APP_URL=http://localhost:3000
# NODE_ENV=development
```

- `APP_URL`: URL pública de la app. La usan los webhooks del casino para
  construir URLs de retorno y los emails transaccionales (futuro).
- `NODE_ENV`: estándar Next.js. Lo setea automáticamente `next dev` / `next start`.

---

## Verificar

```bash
npm run check-env
```

Dice qué vars críticas están seteadas y cuáles faltan (sin mostrar los valores).

---

## Generar keys seguras

```bash
openssl rand -hex 32   # ENCRYPTION_KEY, CASINO_WEBHOOK_SECRET_DEV
```

---

## Historial

- **Antes:** `.env.example` se commiteaba con valores vacíos.
- **Incidente:** casi se commitea un `SUPABASE_SECRET_KEY` real en `.env.example`
  (working tree only, NO llegó al remoto).
- **Después:** `.env.example` se ignora en `.gitignore`. Esta doc es la referencia
  para el equipo.
