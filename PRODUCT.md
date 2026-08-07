# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary user: Operador.** Trabaja solo en su turno, sentado frente a una pantalla
durante varias horas, validando cientos de cargas y retiros por día. Necesita velocidad
(atajos de teclado, acciones inline, sin pasos redundantes) y confianza (que cada
operación quede clara: monto, jugador, estado, qué falta para cerrarla). Un error se
nota rápido porque se duplica plata o se traba un retiro legítimo.

**Secondary users:**
- **Supervisor** — aprueba retiros por encima del umbral configurado y ejecuta pagos
  manuales. Pasa por la cola de pendientes varias veces al día. Necesita ver rápido
  "qué lleva más de X minutos esperando" y "qué aprobé yo que aún no se pagó".
- **Tenant admin** — configura CBU, miembros, credenciales del casino. Pasa por acá
  cada vez que se suma un operador o se rota una API key. Frecuencia baja, foco en
  no equivocarse (un CBU mal cargado impacta pagos).
- **Superadmin de plataforma** — gestiona tenants (crear, suspender). Frecuencia muy
  baja, foco en visibilidad global.

## Product Purpose

**Qué hace:** centraliza y automatiza la liquidación diaria de un casino online —
cargas (depósitos de jugadores), retiros (pagos a jugadores) y la conciliación entre
lo que reporta el casino y lo que se ejecutó.

**Por qué existe:** hoy la liquidación es manual, con planilla, capturas del casino
y home banking. Eso es lento, opaco ante auditorías y propenso a duplicar o perder
operaciones cuando hay volumen. El producto baja el tiempo por operación, deja
trazabilidad completa (quién hizo qué cuándo sobre qué monto) y permite escalar
varios casinos sin multiplicar el equipo.

**Éxito se mide por:** tiempo medio de validación de carga y de aprobación de retiro,
tasa de operaciones con error humano, y capacidad de responder una pregunta de
auditoría en menos de 5 minutos buscando por jugador/fecha/monto.

## Positioning

El producto no compite con un "ERP de casino" genérico ni con una pasarela de pagos.
Compite con la **planilla + home banking + memoria del operador**, que es lo que
realmente se usa hoy en la operación mediana. La diferencia está en ser:

- **Adaptable al casino**, no atado a uno: la integración se hace por mapping
  declarativo (JSON), no por código específico. Un casino nuevo se enchufa leyendo
  su API y declarando qué campo es monto, qué campo es jugador.
- **Defendible ante auditoría**: el ledger de partida doble y el audit log
  append-only son la fuente de verdad, no un afterthought.
- **Cuatro-ojos forzado en BD**: el sistema no deja aprobar y pagar el mismo
  retiro a la misma persona, ni siquiera por bug.
- **Operable sin internet del casino**: la carga manual con comprobante cubre
  cuando la API del casino cae. La operación nunca se frena.

## Operating Context

- **Una pantalla durante horas**, en oficina, con luz artificial. Modo claro por
  defecto; el modo oscuro es secundario.
- **Volumen mediano**: cientos de operaciones por día por tenant. La pantalla
  debe servir para una cola larga sin scroll eterno — filtros, búsqueda, atajos.
- **Decisión bajo presión**: si una carga es fraudulenta o un retiro a CBU ajeno,
  el operador necesita ver el dato completo en una vista (jugador, monto,
  historial, CBU destino, casino origen) sin saltar entre 4 pantallas.
- **Dos turnos típicos** (mañana/tarde) con handover. El audit log es el handover.
- **Rituales**: cierre diario (cuadrar cargas/retiros del día), apertura (revisar
  pendientes), auditoría externa (cuando piden).

## Capabilities and Constraints

**Capabilities confirmadas:**
- Multi-tenant (varios casinos en una sola app, aislados por tenant_id).
- Cargas manuales (operador sube comprobante) y desde casino (polling o webhook).
- Retiros con doble aprobación cuando superan umbral configurable.
- Pago manual primero (operador transfiere por home banking y carga comprobante);
  pasarela real queda como adapter detrás del mismo puerto.
- Integración con casino genérica y adaptable por mapping declarativo.
- Audit log inmutable y ledger de partida doble (fuente de conciliación).
- Configuración por tenant: CBU, miembros, roles, credenciales del casino, umbral
  de doble aprobación.

**Constraints técnicos:**
- Datos de dinero siempre como enteros en centavos (`bigint`), nunca floats.
- Moneda ISO 4217, una sola por tenant en v1.
- Mock-first en datos (Supabase real cuando esté disponible el proyecto del cliente).
- Idempotencia obligatoria en cargas desde casino (un duplicado del polling no
  duplica la operación).
- Optimistic locking en entidades con transiciones de estado para evitar que dos
  operadores validen lo mismo.

**Terminología del dominio (lenguaje ubicuo):**
Carga, Retiro, Premio, Liquidación, Jugador (`player_ref`, no se maneja cuenta
propia), Tenant (no "organización" ni "empresa"), Operador/Supervisor/Tenant Admin
(no "usuario"). Esto se respeta en UI, código y copy.

**Open / undecided:**
- Pasarela de pagos concreta (Mercado Pago, Modo, etc.) — queda como adapter.
- Multi-moneda real por tenant — fuera de v1.
- App mobile para operadores — fuera de v1.

## Brand Commitments

- **Nombre:** "Liquidador de Casino" — confirmado en UI y metadata actual.
- **Voz:** directa, operativa, en español rioplatense. Copy del producto (no de
  marketing): "Validar carga", "Aprobar retiro", "Pagar premio" — verbos en
  imperativo, sin eufemismos. Nada de "soluciones integrales" ni "plataformas de
  próxima generación".
- **Identidad visual:** en construcción. El brief visual se decide cuando
  empecemos UI; el sistema actual es shadcn/neutral, base sobre la que se
  construye la identidad, no la identidad misma.

## Evidence on Hand

- `PLAN-TECNICO.md` — decisiones de arquitectura, fases, criterios de aceptación
  por fase, modelo de datos. Es la fuente de verdad de qué se está construyendo.
- `AGENTS.md` — convenciones operativas del proyecto (Next.js 16, dominio puro,
  centavos, etc.).
- Seed de demo (`src/infrastructure/repositories/mock/seed.ts`) — 1 superadmin,
  1 tenant demo, 4 perfiles (operador/supervisor/admin/superadmin), 1 CBU, 1
  credencial casino. Suficiente para que la app abra con algo visible.
- 34 tests passing (Vitest) sobre dominio (Money, CBU, roles) y casos de uso de
  tenants. Base sólida para TDD en Phase 2.

**Lo que NO hay (no fabricar):** casino real integrando, datos de jugadores
reales, comprobantes reales, métricas de uso. Toda carga, retiro y comprobante
mostrado en demo es sintético y debe estar marcado como tal si se muestra a un
cliente real.

## Product Principles

1. **El dominio manda, el framework sirve.** El dinero, las transiciones de estado
   y las reglas de cuatro-ojos se prueban sin Next.js, sin Drizzle, sin Supabase.
   Si un test necesita levantar un servidor, el test está mal.
2. **Append-only por diseño.** Ledger y audit log no se editan ni se borran.
   Si necesitás "corregir" una operación, se genera una operación inversa, no
   se muta la original. Esto es la base de la auditoría.
3. **El sistema no deja pasar lo que la operatoria no quiere.** Cuatro-ojos se
   valida en BD con CHECK, no solo en UI. Idempotencia se valida con UNIQUE en
   BD, no solo en código.
4. **Una decisión por lugar.** Si el umbral de doble aprobación vive en
   `tenant_configs`, no se hardcodea en el caso de uso. Si la moneda vive en
   el tenant, no se adivina desde el operador.
5. **La operación nunca se frena.** Si el casino no responde, hay carga manual.
   Si el supervisor no está, la cola muestra "esperando aprobación" claro. Nada
   de pantallas en blanco que digan "intente más tarde".