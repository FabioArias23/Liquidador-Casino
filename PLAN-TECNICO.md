# Plan técnico — Liquidador de Casino (multi-tenant)

Sistema back-office para liquidación de casinos online: valida cargas, valida transferencias/retiros, paga premios con doble aprobación, historial por operador, integración con API del casino y configuración de CBU y admins. Pensado como SaaS multi-tenant configurable.

**Decisiones confirmadas:**
- Multi-tenant SaaS (varios casinos en una sola app, aislamiento por tenant)
- Pagos manuales primero, adaptador listo para pasarela (Mercado Pago, etc.) después
- Doble aprobación (cuatro ojos) para operaciones sensibles
- Integración con casino genérica y adaptable (ports & adapters)

---

## 1. Stack recomendado

| Capa | Elección | Por qué |
|---|---|---|
| Framework | **Next.js 15 (App Router, TypeScript strict)** | Server Components + Server Actions + API routes para webhooks |
| BD | **PostgreSQL vía Supabase** | RLS, Auth, Realtime, backups/PITR incluidos |
| ORM | **Drizzle ORM + drizzle-kit** | SQL-first, tipos exactos, migraciones versionadas en el repo |
| Auth | **Supabase Auth** (email + TOTP opcional) + RBAC propio en BD | Usuarios globales, membresías por tenant con rol |
| UI | **Tailwind CSS + shadcn/ui + TanStack Table + TanStack Query** | Backoffice = muchas tablas y formularios; esto lo resuelve bien |
| Formularios | **React Hook Form + Zod** | Validación compartida cliente/servidor |
| Validación | **Zod** en todo límite de sistema (inputs, webhooks, config, respuestas de API externa) |
| Colas/jobs | **pgmq + pg_cron** (nativo de Postgres/Supabase) | Sin agregar Redis en la v1; migrable a BullMQ si crece |
| Observabilidad | **Sentry + pino (logs estructurados)** | Errores y auditoría de runtime |
| Testing | **Vitest + Testing Library + Playwright** | Unit de dominio + E2E del flujo completo |
| CI/CD | **GitHub Actions → Vercel** | Preview deploys; Supabase branching para staging |
| Infra | **Supabase CLI** (migraciones y config en el repo) | Entornos reproducibles |

**Manejo de dinero (regla de oro):** importes siempre como **enteros en centavos** (`bigint`), nunca floats. Moneda ISO 4217 (`ARS`, `USD`). Un solo helper `Money` para formatear/convertir.

---

## 2. Arquitectura: monolito modular hexagonal

Una sola app Next.js con capas estrictas. El dominio no importa nada de Next ni de Drizzle.

```
src/
  domain/            # Entidades, value objects, máquinas de estados, reglas (PURO, sin frameworks)
    cargas/ retiros/ pagos/ ledger/ tenants/
  application/       # Casos de uso: validarCarga, aprobarRetiro, pagarPremio... (orquestan, sin SQL ni HTTP)
  infrastructure/
    db/              # Schema Drizzle, repositorios (patrón Repository)
    casino/          # Puerto CasinoAdapter + adaptadores por proveedor
    payments/        # Puerto PaymentProvider + ManualProvider (+ futuro MercadoPagoProvider)
    webhooks/        # Verificación HMAC, handlers
    jobs/            # Sincronización polling (pgmq/pg_cron)
  app/               # App Router: páginas, layouts, server actions, rutas /api
  features/          # UI por feature: cargas/, retiros/, pagos/, historial/, admin/
  components/        # shadcn/ui y compartidos
```

**Regla de dependencia:** `app/features → application → domain`. `infrastructure → domain` (implementa puertos). Nada apunta hacia afuera del dominio.

---

## 3. Modelo de datos (tablas clave)

Multi-tenant: toda tabla operativa lleva `tenant_id` + índice compuesto. IDs en `uuid` (gen_random_uuid).

- **`tenants`** — id, nombre, slug, estado (activo/suspendido)
- **`tenant_configs`** — tenant_id (único), config JSONB validada con Zod: moneda, redondeo, políticas de aprobación (monto mínimo para doble aprobación), módulos habilitados, mapping del adaptador casino (endpoints + mapeo de campos), feature flags. **Acá vive la adaptabilidad por casino.**
- **`users`** (Supabase Auth, tabla `auth.users` de ellos) + **`tenant_members`** — user_id, tenant_id, rol (`tenant_admin` | `supervisor` | `operador`), estado. Aparte: flag `superadmin` para administrar tenants a nivel plataforma.
- **`cbu_accounts`** — tenant_id, cbu (validado con algoritmo CBU), alias, titular, moneda, activa. Configuración que hacen los admins.
- **`casino_credentials`** — tenant_id, adapter_type, base_url, api_key **cifrada (AES-GCM con key maestra en env, nunca en plaintext)**, webhook_secret.
- **`cargas`** — tenant_id, player_ref, monto_cents, moneda, método, estado, origen (`api_casino` | `manual`), comprobante_url, external_ref (unique por tenant para idempotencia), operador_id que procesó, timestamps de cada transición.
- **`retiros`** — tenant_id, player_ref, monto_cents, cbu_destino_id/alias, estado, external_ref.
- **`pagos`** — retiro_id, tenant_id, monto_cents, método (`manual` | futuro `pasarela`), provider_ref, comprobante_url, `validado_por`, `aprobado_por`, `pagado_por`, idempotency_key, **`CHECK (aprobado_por <> pagado_por)`** (cuatro ojos forzado en BD).
- **`ledger_entries`** — contabilidad por partida doble: cada movimiento de plata genera 2 entradas (débito/crédito) con cuenta, tenant_id, entidad origen (carga/retiro/pago), monto_cents, moneda. Inmutable. Es la base de la conciliación y del historial.
- **`audit_log`** — append-only (REVOKE de UPDATE/DELETE a nivel BD): actor, tenant_id, acción, entidad, before/after JSONB, IP, user-agent. **Todo cambio de estado pasa por acá → el historial del operador sale gratis de esta tabla.**
- **`sync_runs`** — log de cada corrida de sincronización con el casino (éxito/error, cantidades).

Índices: `(tenant_id, estado)` en cargas/retiros (colas de trabajo), `(tenant_id, created_at desc)` para historial.

---

## 4. Máquinas de estados (núcleo del dominio)

Implementadas como **tablas de transición + funciones puras** en `domain/` (testables sin BD):

```
Carga:   pending → validating → validated → settled
                            ↘ rejected
Retiro:  pending → validated → awaiting_approval → approved → paying → paid
                     ↘ rejected        ↘ rejected        ↘ failed
Pago:    created → executing → succeeded | failed
```

Reglas:
- Toda transición valida: estado actual permitido, rol permitido, y tenant correcto.
- Cada transición = 1 transacción de BD: update de estado + `ledger_entries` + `audit_log` (todo junto o nada).
- `canTransition(from, to)` y `assertTransition()` puros → unit tests exhaustivos.

---

## 5. Integración con la API del casino (ports & adapters)

**Puerto** en `domain/casino/`:

```ts
interface CasinoAdapter {
  health(): Promise<boolean>;
  fetchCargas(desde: Date, hasta: Date): Promise<CargaExterna[]>;
  fetchRetiros(desde: Date, hasta: Date): Promise<RetiroExterno[]>;
  notificarCargaAcreditada(ref: string): Promise<void>;
  notificarPagoRealizado(ref: string, comprobante?: string): Promise<void>;
  fetchJugador(ref: string): Promise<JugadorExterno | null>;
}
```

**Estrategia de adaptabilidad** (clave para el requisito "que se adapte a casinos online"):
1. **`ConfigurableHttpAdapter`** (default): lee de `tenant_configs` los endpoints y un **mapeo de campos declarativo** (JSON: qué campo de la respuesta del casino es `monto`, `player_ref`, etc.). Permite enchufar muchos casinos sin código.
2. **Adaptadores específicos** por proveedor cuando el mapping declarativo no alcance (clase que implementa el puerto). Registro por `adapter_type` en `casino_credentials`.

**Dos vías de sincronización:**
- **Polling (salida):** job pg_cron (cada N min) → encola en pgmq → worker llama `fetchCargas/fetchRetiros` → upsert idempotente por `(tenant_id, external_ref)`.
- **Webhooks (entrada):** `POST /api/webhooks/casino/[tenantSlug]` con **verificación de firma HMAC + timestamp + nonce anti-replay**, procesamiento idempotente.
- Todo lo que entra del casino se valida con Zod antes de tocar el dominio (nunca confiar en datos externos).

---

## 6. Pagos de premios (manual primero, pasarela después)

**Puerto** `PaymentProvider`:

```ts
interface PaymentProvider {
  pagar(pago: Pago): Promise<{ status: 'succeeded' | 'failed'; externalRef?: string }>;
}
```

- **`ManualPaymentProvider`** (v1): el operador/supervisor ejecuta la transferencia por home banking al CBU del jugador y registra en el sistema: fecha, comprobante (upload a Supabase Storage), referencia. El sistema pasa el estado a `paid` y notifica al casino.
- **Futuro:** `MercadoPagoProvider` / `ModoinProvider` implementan el mismo puerto; se elige por `tenant_configs`. Sin tocar el dominio.

**Flujo con doble aprobación:**
1. Operador valida el retiro (CBU válido, datos del jugador coinciden con casino, hay fondos/concilia) → `validated`.
2. Si supera el umbral configurado → `awaiting_approval`; un **supervisor distinto** lo aprueba → `approved`.
3. Ejecución del pago → `paid`, con `CHECK (aprobado_por <> pagado_por)` + validación repetida en aplicación.

**Idempotencia:** `idempotency_key` unique en `pagos` para que un doble clic o reintento nunca pague dos veces.

---

## 7. Seguridad (sistema que maneja plata)

- **RLS habilitado en TODAS las tablas operativas**, políticas por `tenant_id` derivado del JWT del usuario (función `current_tenant_ids()` que lee `tenant_members`). La conexión del server Next usa el **JWT del usuario logueado** (no la service key) para que RLS aplique; la service key solo para jobs sin usuario, siempre con scope explícito de tenant.
- **Roles (RBAC en BD, no en el frontend):** operador (valida), supervisor (aprueba + paga), tenant_admin (configura CBU/admins/usuarios), superadmin (gestiona tenants). Autorización chequeada en casos de uso, no en componentes.
- **API keys del casino cifradas** en reposo (AES-GCM, key maestra en env vars). Nunca en logs ni respuestas.
- **Webhooks:** HMAC + timestamp + nonce. **Rate limiting** en login y webhooks (Upstash o middleware).
- **Audit log inmutable** (append-only, REVOKE de UPDATE/DELETE). Es el historial del operador y la evidencia ante auditorías.
- **Ledger inmutable** — la conciliación se hace leyendo ledger, nunca mutando.
- **Secretos solo en env vars** (Vercel + Supabase). `.env` gitignoreado, `.env.example` en el repo.
- **Validación CBU:** checksum oficial del CBU argentino al guardar.
- **2FA (TOTP)** recomendado para roles con poder de pago.
- Compliance: según jurisdicción pueden aplicar normas UIF/anti-lavado para juegos de azar — el audit log + ledger + KYC refs dan la base técnica; confirmarlo con el cliente.

---

## 8. Patrones de código y convenciones

- **Patrón Repository** (Drizzle detrás de interfaces en `application/`): los casos de uso no escriben SQL.
- **Casos de uso como funciones** que reciben dependencias por parámetro (DI manual, sin framework): `validarCarga({ repo, audit, adapter }, input)`.
- **Result pattern** para errores de negocio: `{ ok: true, data } | { ok: false, error: DomainError }`. Server Actions devuelven Results serializables; nada de `throw` para errores de negocio esperables.
- **Zod schemas compartidos** (`domain/schemas`): el mismo schema valida el form (RHF), la server action y la respuesta del casino.
- **Server Actions** para mutaciones, **TanStack Query** para lecturas del panel operador, **Supabase Realtime** para que entren cargas/retiros nuevos en vivo sin refresh.
- **Feature folders** (`features/cargas`, `features/retiros`...): cada feature tiene sus componentes, hooks y server actions. Barrel exports mínimos.
- ESLint + Prettier + `tsc --noEmit` en CI. Commits convencionales. PRs chicos.
- Nombres del dominio en español del negocio (`Carga`, `Retiro`, `Premio`, `Liquidacion`) — lenguaje ubicuo con el cliente.

---

## 9. Fases de implementación

**Fase 0 — Fundaciones**
- Repo, Next.js 15 + TS strict + Tailwind + shadcn/ui, Supabase CLI (`supabase init/start`), Drizzle kit, CI básico (lint + typecheck + tests), estructura de carpetas por capas.

**Fase 1 — Multi-tenancy y administración**
- Auth Supabase + onboarding de tenants; CRUD de tenants (superadmin); membresías y roles; CRUD de CBU y admins por tenant; RLS en todas las tablas; layout backoffice con sidebar y selector de tenant.

**Fase 2 — Cargas**
- Máquina de estados de carga + ledger + audit log (la base de todo). Cola de validación de cargas manuales (subida de comprobante) + `ConfigurableHttpAdapter` con polling para cargas que llegan del casino.

**Fase 3 — Retiros y pagos**
- Máquina de retiros, validación de CBU/jugador, doble aprobación, `ManualPaymentProvider`, idempotencia, notificación de pago al casino.

**Fase 4 — Historial y operación**
- Historial del operador (filtro por usuario/fecha/acción sobre audit_log + ledger), dashboard de liquidación del día, conciliación simple, export CSV.

**Fase 5 — Tiempo real y hardening**
- Webhooks entrantes con HMAC, Supabase Realtime en el panel, Sentry + pino, rate limiting, E2E Playwright, docs de operación/runbook.

**Fase 6 — Evolución (fuera de v1)**
- Pasarelas de pago (`PaymentProvider` concretos), reportes por casino, multi-moneda real, app mobile para operadores.

---

## 10. Verificación

- **Unit (Vitest):** máquinas de estados (todas las transiciones válidas/inválidas), invariantes del ledger (Σ débitos = Σ créditos por operación), validadores de CBU y Money.
- **Integración:** casos de uso contra Supabase local (`supabase start`), verificando RLS con usuarios de distintos tenants/roles (un operador del tenant A no ve nada del tenant B).
- **E2E (Playwright):** flujo completo con 2 usuarios — carga entra por webhook → operador valida → retiro → supervisor aprueba → pago manual → historial registra todo.
- **Chaos básico:** webhook duplicado (idempotencia), pago con doble clic, webhook con firma inválida rechazado.
- Aceptación por fase: cada fase termina con su E2E verde y una demo al cliente.

---

## Supuestos

- El casino del cliente expone API HTTP (REST) autenticada por API key; si fuera otra cosa (SOAP, SFTP), el puerto `CasinoAdapter` lo absorbe igual.
- Los jugadores se referencian por un `player_ref` provisto por el casino (no manejamos cuentas de jugador propias).
- v1 opera en una sola moneda por tenant.
