<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas del proyecto Liquidador de Casino

Estas reglas son PROTECTORAS. Antes de tocar código, leélas. Si una regla entra en conflicto con lo que el usuario pide explícitamente, **preguntá antes de romper la regla**.

---

## 📚 Documentos de verdad (no pisar salvo acuerdo)

- **`PRODUCT.md`** — verdad de producto (usuarios, jobs, posicionamiento, principles). **Inmutable** salvo acuerdo explícito del usuario. Cualquier cambio se discute antes.
- **`DESIGN.md`** — sistema visual (tokens, paleta, semáforo, tipografía, do's & don'ts). Cambios al design system se discuten.
- **`PLAN-TECNICO.md`** — decisiones de arquitectura fuente. Si una decisión técnica entra en conflicto con esto, gana PLAN-TECNICO salvo acuerdo.
- **`AGENTS.md`** (este archivo) — reglas operativas. Editable pero cada cambio se justifica.

## 🏗️ Arquitectura hexagonal — respetar capas

```
src/
├── domain/       ← PURO. Sin Next.js, sin Drizzle, sin Supabase. Solo types + lógica.
├── application/  ← Casos de uso + ports. Depende de domain, no de infra.
├── infrastructure/ ← Implementaciones de ports (mock, drizzle, casino adapter).
├── app/          ← Next.js App Router. Server actions, pages, layout.
├── components/   ← UI compartido (shadcn + nuestros).
└── lib/          ← Helpers server-only + format.
```

**Reglas:**
- `domain/` NUNCA importa de `application/`, `infrastructure/`, `app/`. Si lo hacés, rompiste hexagonal.
- `application/` NUNCA importa de `infrastructure/` directamente. Siempre via ports.
- `infrastructure/` puede importar de `application/` (implementa ports) y `domain/` (mapea entidades).
- Server components y client components respetan el límite server→client: solo plain serializable data cruza. Iconos van por `iconKey: string` + map local (ver DESIGNS.md §Components).

## 🧪 Tests y verificación

- **TDD** cuando agregamos lógica de negocio: test → fail → impl → pass. Test junto al código (`*.test.ts`).
- **Comandos antes de commit:** `npm test` (vitest) + `npm run lint` + `npm run typecheck`. Los 3 deben pasar limpio. Si fallan, NO commitear.
- **No romper tests existentes.** Si un cambio rompe un test, el test es la spec — actualizarlo solo si la spec cambió.
- **Mocks son tests-friendly:** los repositorios mock reciben `MockStore` explícito (no singleton) para aislamiento.

## 🎯 Convenciones de código

- **Naming:**
  - `camelCase` para funciones/variables.
  - `PascalCase` para tipos, clases, componentes React.
  - `kebab-case` para archivos (`crear-tenant.ts`).
  - Branded types: `TenantId`, `CargaId`, etc. Construir con factories (`tenantId("uuid")`).
- **Errores:** siempre `Result<T, ErrorNegocio>` para casos de uso. **Nunca `throw`** para errores esperables. `throw` solo para bugs (programmer error).
- **Fechas:** `Date` en domain, ISO string en JSON (audit/metadata serializa con `toISOString()`).
- **Dinero:** SIEMPRE enteros en centavos. Función `centavos(n)` para validar. Ver `domain/money.ts`.
- **Imports:** absoluto via `@/...`. Orden: externos → internos. Sin barrel files innecesarios.
- **TypeScript:** `strict: true`. Evitar `any` (usar `unknown` + Zod parse si viene de fuente externa). Evitar `as` salvo en branded types (`as TenantId`).
- **No agregar deps** sin discusión. Si necesitás algo, justificar.

## 💬 Idioma y copy

- **Código:** nombres en español cuando son del dominio (`Tenant`, `Carga`, `Miembro`, `crearTenant`). Nombres técnicos en inglés cuando son del framework (`useState`, `redirect`, `cookies`).
- **Copy de UI:** español rioplatense. Sin anglicismos donde hay palabra natural ("registrar", no "register"). Mensajes de error específicos ("CBU no coincide con titular", no "Error en validación").
- **Comentarios en código:** español para explicar QUÉ/HACIA DÓNDE. Inglés solo para diffs contra docs externas (Next.js, Zod, etc.).

## 🔀 Git y commits

- **Conventional Commits:** `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`. Scope opcional (`feat(cargas):`, `fix(mock):`).
- **1 commit por feature/fase lógica.** No mezclar UI + DB + domain en el mismo commit. Si el cambio es chico y cohesivo, OK.
- **No Co-Authored-By ni atribución a AI** en commits. Conventional commits solo.
- **No crear branches** salvo acuerdo. Trabajamos en `main` directamente.
- **Antes de commitear:** `git diff --stat HEAD` para revisar qué se va a commitear. No commitear `.data/`, `.env*`, secrets.
- **Mensaje de commit con body** cuando hay decisiones: 1 párrafo de qué, bullets de por qué/decisiones, línea final con "Próximo:" si aplica.

## 📝 Memoria y documentación

- **Decisiones grandes → Engram `mem_save`** con formato `**What/Why/Where/Learned**`. Topic key estable para evolutivos (`liquidador-casino/project-state`).
- **Antes de empezar algo que podría haberse hecho antes:** `mem_search` o `mem_context`.
- **Al cerrar sesión:** `mem_session_summary` con Goal/Discoveries/Accomplished/Next Steps.
- **No duplicar PRODUCT.md/DESIGN.md en otros archivos.**

## 🎨 Diseño visual

- **DESIGN.md es ley.** Tokens, paleta, semáforo, do's & don'ts. Cambios se discuten.
- **Sin emojis en UI** (usar lucide icons).
- **Sin gradientes, glass, ni sombras decorativas.** Sombras solo en focus/drag/modal.
- **Mono para montos, IDs, CBUs, timestamps** con `tabular-nums`. Sans para prosa.
- **StatusPill para todo estado de operación** (5 colores del semáforo). No inventar variantes.
- **Empty states diseñados** (ícono + título + descripción + CTA). Nunca un card solo.

## 🧪 Mock-first

- **DB:** todavía no hay Supabase/Docker. Mantenemos `DATA_SOURCE=mock` como default. La app corre end-to-end con mocks.
- **Schemas Drizzle** existen como fuente de verdad para cuando se levante Supabase. La migración `drizzle/0001_*.sql` está lista.
- **No tomar dependencias de Docker/Supabase** hasta que el usuario confirme que está listo.

## ⚠️ Lo que NO hacer

- ❌ Sobreescribir `PRODUCT.md`, `DESIGN.md`, `PLAN-TECNICO.md`, `AGENTS.md` sin acuerdo.
- ❌ Tocar archivos de Phase cerrada (mock repos existentes, ports) salvo que la feature lo requiera — discutir primero.
- ❌ Cambiar convenciones sin avisar (camelCase, snake_case, naming de archivos).
- ❌ Romper tests existentes.
- ❌ Commitear con `any` introducido, lint warnings, o typecheck errors.
- ❌ Agregar deps sin justificar.
- ❌ "Mejorar" UI sin que el usuario lo pida (resistir el impulso de overengineering).
- ❌ Inventar datos ficticios para el cliente que se vean como reales (si mostrás una carga demo, marcala como sintética).
- ❌ Expandir scope del commit (commits chicos y cohesivos).