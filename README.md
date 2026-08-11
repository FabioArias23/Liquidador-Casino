# Liquidador de Casino

Backoffice multi-tenant para liquidación diaria de casinos online. Pensado para
operadores, supervisores y admins de un casino que necesitan registrar, validar,
aprobar y pagar **cargas** (depósitos de jugadores) y **retiros** (pagos a jugadores)
con auditoría completa y control de **cuatro-ojos** (ningún pago sale si no lo
aprueba una persona distinta de quien lo validó).

> **Estado del proyecto:** prototipo demo (Phase 3). Funciona end-to-end con
> datos sintéticos — un banner "DEMO" persistente en la UI lo recuerda.

---

## Stack

| Capa            | Tecnología                                                   |
| --------------- | ------------------------------------------------------------ |
| Framework       | Next.js 16 (App Router, server actions)                      |
| Lenguaje        | TypeScript estricto (sin `any`)                              |
| Estilos         | Tailwind CSS v4 + shadcn/ui                                  |
| Iconos          | lucide-react                                                 |
| Toasts          | sonner                                                       |
| Validación      | Zod                                                          |
| Tests           | Vitest (unit) — sin tests e2e todavía                        |
| Persistencia    | Mock in-memory (Maps) + snapshot JSON en `.data/`            |
| DB real (futuro)| Drizzle ORM + Postgres (schemas listos, no implementados)   |

---

## Arquitectura

Hexagonal estricta. Las capas se importan **hacia adentro** y nunca al revés.

```
src/
├── domain/         ← PURO. Sin frameworks, sin IO. Types + lógica + state machines.
│   ├── retiros.ts       (state machine de Retiro: 8 estados, 8 acciones)
│   ├── cargas.ts        (state machine de Carga: 5 estados, 4 acciones)
│   ├── cbu.ts           (validación checksum oficial BCRA)
│   ├── ledger.ts        (partida doble: Σ débitos = Σ créditos)
│   ├── money.ts         (centavos SIEMPRE, formateo, parseo)
│   ├── roles.ts         (operador, supervisor, tenant_admin, superadmin)
│   └── ...
│
├── application/    ← Casos de uso. Orquestan domain + ports. Sin frameworks UI.
│   ├── retiros/         (solicitar, validar, aprobar, pagar, rechazar, listar)
│   ├── cargas/          (registrar, validar, rechazar, asentar, listar, traer del casino)
│   ├── audit/           (listar audit log)
│   ├── tenants/         (listar, crear)
│   └── ports/           (interfaces de repositorios)
│
├── infrastructure/ ← Implementaciones de los ports.
│   ├── repositories/
│   │   ├── mock/        (in-memory + snapshot JSON — lo que corre hoy)
│   │   └── index.ts     (factory: DATA_SOURCE=mock|drizzle)
│   ├── auth/            (selector de usuarios para demo)
│   ├── casino/          (adapter HTTP configurable del casino)
│   └── db/              (schemas Drizzle — listos para cuando haya Supabase)
│
├── app/            ← Next.js App Router. Pages + server actions.
│   ├── backoffice/[slug]/  (Cargas, Retiros, Miembros, CBU, Casino, Historial)
│   ├── superadmin/         (gestión de tenants)
│   └── actions/            (server actions que llaman use cases)
│
├── components/     ← UI compartido. Server + client components.
└── lib/            ← Helpers server-only + format.
```

**Regla de oro:** `domain/` NUNCA importa de `application/`, `infrastructure/` ni `app/`.
Si lo hace, rompiste hexagonal.

---

## Cómo se arma

### Requisitos
- Node.js 22+ (usa `crypto.randomUUID()` nativo)
- npm 10+

### Instalación

```bash
npm install
```

### Scripts

| Comando              | Para qué sirve                                              |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Levanta el server en `localhost:3000` con hot reload       |
| `npm test`           | Corre los 190 tests con Vitest (modo single-run)            |
| `npm run test:watch` | Vitest en modo watch (re-corre al guardar)                 |
| `npm run lint`       | ESLint (config de Next 16)                                  |
| `npm run typecheck`  | TypeScript sin emit (chequea tipos sin compilar)            |
| `npm run mock:reset` | Borra el snapshot `.data/mock.json` (fuerza re-seed al boot) |

### Antes de commitear, los 3 verdes

```bash
npm test && npm run lint && npm run typecheck
```

Si alguno falla, **NO** commitear.

---

## Cómo se usa

### 1. Login y selector de usuario

La app no tiene auth real todavía — usa un **selector de usuario** en el header.
Al entrar, elegís uno de los perfiles sembrados:

| Email                              | Rol          | Puede…                                         |
| ---------------------------------- | ------------ | ---------------------------------------------- |
| `superadmin@liquidador.local`      | superadmin   | Ver todos los tenants                          |
| `admin@casinodemo.local`           | tenant_admin | Todo dentro del tenant (incluye configuración) |
| `supervisor@casinodemo.local`      | supervisor   | Validar, aprobar, pagar                        |
| `operador@casinodemo.local`        | operador     | Registrar y validar (no aprobar)               |

### 2. Navegación

Una vez en el tenant `casino-demo` (el único sembrado), la sidebar muestra:

- **Operación:** Cargas, Retiros, Historial
- **Administración** (solo `tenant_admin`): Miembros, CBU, Casino

### 3. El flujo end-to-end (con cuatro-ojos)

#### Cargas (depósito del jugador → casino)

```
pending  →  validating  →  validated  →  settled
                  ↘                 ↘
                    rejected        rejected
```

1. **Registrar** (operador o supervisor): se crea la carga en `pending`.
2. **Validar** (operador o supervisor): pide comprobante. Pasa a `validating` → `validated`.
3. **Asentar** (operador o supervisor): si la carga está `validated` y tiene comprobante,
   genera el asiento de partida doble (banco:carga débito, casino:ingresos crédito) y
   pasa a `settled`. **Append-only**: una vez `settled`, no se toca.

#### Retiros (pago del casino → jugador)

```
pending  →  validated  →  awaiting_approval  →  approved  →  paying  →  paid
              ↘                ↘                                  ↘
                rejected        rejected                          failed
```

- Si el monto **supera el umbral** ($10.000 ARS por default, configurable en
  `domain/schemas/tenant-config.ts`), la validación salta a `awaiting_approval`.
- **Cuatro-ojos (defensa en código):** el actor que aprueba NO puede ser el mismo
  que validó, y el actor que paga NO puede ser el mismo que aprobó. La UI muestra
  un banner verde cuando esto bloquea tu acción; el server action también lo
  valida como segunda línea de defensa.
- **Idempotencia en el pago:** si pagás dos veces con la misma `idempotencyKey`,
  el sistema devuelve el mismo resultado sin error (útil para reintentos de red).

### 4. Datos sembrados

El primer boot crea un set narrativo en el tenant demo:

- 9 cargas en estados variados (4 `settled`, 2 `validating`, 1 `validated`, 1 `pending`, 1 `rejected` con motivo)
- 3 retiros: 1 `pending`, 1 `awaiting_approval`, 1 `paid` con cuatro-ojos completo
- 8 ledger entries (1 asiento débito + crédito por cada carga `settled`)
- audit log con todas las transiciones

Si querés resetear desde cero:

```bash
npm run mock:reset
```

---

## Reglas de oro

1. **Dinero siempre en centavos (entero).** La función `centavos(n)` en
   `domain/money.ts` valida esto. Nunca `float`, nunca `decimal` en código.
2. **`Result<T, ErrorNegocio>` en casos de uso.** No se usa `throw` para errores
   esperables. `throw` solo para bugs (programmer error).
3. **Cuatro-ojos en el use case, no en el state machine.** El state machine
   valida transiciones puras; el cuatro-ojos valida actores (state machine no
   conoce al actor anterior). Defensa en BD viene con Drizzle (CHECK
   `aprobado_por <> validada_por`).
4. **Mock-first.** Hasta que el usuario confirme que está listo, NO se monta
   Supabase ni Docker. `DATA_SOURCE=mock` es el default. La app corre end-to-end
   con mocks.
5. **TDD en lógica de negocio.** Test junto al código (`*.test.ts`).
   Cubre cada transición del state machine.
6. **Sin emojis en UI** (usar lucide). Sin gradientes ni glass. Mono para
   montos, IDs, CBUs y timestamps con `tabular-nums`. `StatusPill` para todo
   estado de operación.
7. **Conventional Commits.** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
   `test:`. Sin Co-Authored-By.

---

## Tests

```bash
npm test
```

Cobertura actual (190 tests):

- Domain state machines (cargas, retiros)
- Use cases de Cargas (registrar, validar, rechazar, asentar, listar)
- Use cases de Retiros (solicitar, validar, aprobar, pagar, rechazar, listar)
- Seed narrativo (estructura, conteos, cuatro-ojos del happy path)

---

## Roadmap

- **Phase 4 — Adapter real del casino + webhooks** (configurable_http ya está
  en código, falta la integración con la API real del primer casino)
- **Phase 5 — Supabase + Drizzle** (schemas ya escritos, falta el switch
  `DATA_SOURCE=drizzle` y la migración)
- **Phase 6 — Realtime** (notificaciones de cambios a otros operadores viendo
  la misma carga)
- **Phase 7 — 2FA + pasarela real de pago** (los pagos manuales con comprobante
  se reemplazan por integración con la pasarela)

---

## Documentos de referencia

- `PRODUCT.md` — verdad de producto (usuarios, jobs, posicionamiento, principles)
- `DESIGN.md` — sistema visual (tokens, paleta, semáforo, do's & don'ts)
- `PLAN-TECNICO.md` — decisiones de arquitectura fuente
- `AGENTS.md` — reglas operativas para AI agents que trabajen en el repo
- [`docs/demo-runbook.md`](docs/demo-runbook.md) — paso a paso de los 4
  escenarios de la demo (idempotencia, cuatro-ojos, rechazo, cierre diario).
  Pensado para que el operador del casino pueda ejecutarlo solo en ~20 min.
