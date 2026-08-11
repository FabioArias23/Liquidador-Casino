# Mapa de rutas navegables

> Para `npm run dev` corriendo en `localhost:3000`. Pegá cualquier URL directo en
> el navegador. Si no hay sesión, la app te muestra el **selector de usuario** en
> el header — elegí uno y todo se habilita.

> **Tenant único sembrado:** `casino-demo`. Los IDs de ejemplo son estables (rango
> `00000000-0000-4000-8000-000000000XXX`) y vienen del seed narrativo.

---

## Tabla de contenidos

- [Antes de arrancar](#antes-de-arrancar)
- [Como operador](#como-operadoroperadorcasinodemolocal)
- [Como supervisor](#como-supervisorsupervisorcasinodemolocal)
- [Como admin del tenant](#como-admin-del-tenantadmincasinodemolocal)
- [Como superadmin](#como-superadminsuperadminliquidadorlocallocal)
- [Endpoints API](#endpoints-api)
- [Filtros útiles por URL](#filtros-utiles-por-url)
- [Lo que NO está (todavía)](#lo-que-no-está-todavía)

---

## Antes de arrancar

```text
http://localhost:3000/
```

- Sin sesión → empty state "Elegí un usuario para empezar".
- Con sesión: si hay 1 solo tenant, redirige a `/backoffice/<slug>`. Si hay más,
  lista cards de tenants.

**Perfiles sembrados** (selector del header):

| Email                              | Rol          | userId                                         |
| ---------------------------------- | ------------ | ---------------------------------------------- |
| `operador@casinodemo.local`        | operador     | `…000000000002`                                |
| `supervisor@casinodemo.local`      | supervisor   | `…000000000003`                                |
| `admin@casinodemo.local`           | tenant_admin | `…000000000004`                                |
| `superadmin@liquidador.local`      | superadmin   | `…000000000001`                                |

---

## Como `operador@casinodemo.local`

### Cargas

```text
http://localhost:3000/backoffice/casino-demo/cargas
http://localhost:3000/backoffice/casino-demo/cargas?estado=pending
http://localhost:3000/backoffice/casino-demo/cargas?estado=validating
http://localhost:3000/backoffice/casino-demo/cargas?estado=validated
http://localhost:3000/backoffice/casino-demo/cargas?estado=settled
http://localhost:3000/backoffice/casino-demo/cargas/nueva
```

### Detalles concretos del seed (uno por estado)

```text
http://localhost:3000/backoffice/casino-demo/cargas/00000000-0000-4000-8000-000000000100
# settled — A3F9 — $2.000 — transferencia — manual

http://localhost:3000/backoffice/casino-demo/cargas/00000000-0000-4000-8000-000000000104
# validated — A3F9 — $8.000 — tarjeta — manual (lista para asentar)

http://localhost:3000/backoffice/casino-demo/cargas/00000000-0000-4000-8000-000000000105
# validating — B7C2 — $2.500 — transferencia — manual

http://localhost:3000/backoffice/casino-demo/cargas/00000000-0000-4000-8000-000000000107
# pending — B7C2 — $3.500 — tarjeta — manual

http://localhost:3000/backoffice/casino-demo/cargas/00000000-0000-4000-8000-000000000108
# rejected — A3F9 — $15.000 — transferencia — api_casino
```

### Retiros (el detalle incluye el panel cuatro-ojos)

```text
http://localhost:3000/backoffice/casino-demo/retiros
http://localhost:3000/backoffice/casino-demo/retiros?estado=pending
http://localhost:3000/backoffice/casino-demo/retiros?estado=awaiting_approval
http://localhost:3000/backoffice/casino-demo/retiros/nuevo
```

### Detalles del seed (cada uno muestra un caso distinto)

```text
http://localhost:3000/backoffice/casino-demo/retiros/00000000-0000-4000-8000-000000000200
# pending — B7C2 — $500

http://localhost:3000/backoffice/casino-demo/retiros/00000000-0000-4000-8000-000000000201
# awaiting_approval — A3F9 — $15.000
# (validadaPor = registradaPor = operador → operador NO puede aprobar,
#  supervisor/admin SÍ pueden. Banner verde de cuatro-ojos visible.)

http://localhost:3000/backoffice/casino-demo/retiros/00000000-0000-4000-8000-000000000202
# paid — B7C2 — $3.000 — cuatro-ojos completo (4 usuarios distintos)
# idempotencyKey: pago-seed-b7c2-300k-001
```

### Cierre diario + auditoría

```text
http://localhost:3000/backoffice/casino-demo/cierre
# KPIs del día + tabla de operaciones liquidadas + botón "Descargar cierre PDF"

http://localhost:3000/backoffice/casino-demo/historial
http://localhost:3000/backoffice/casino-demo/historial?entidadTipo=carga
http://localhost:3000/backoffice/casino-demo/historial?entidadTipo=retiro
```

> Como operador, `/miembros`, `/cbu` y `/casino` devuelven página vacía (el
> permiso fino está en cada `page.tsx`).

---

## Como `supervisor@casinodemo.local`

Mismas rutas que operador. Cambios de comportamiento:

- **Cargas:** puede validar y rechazar (estado `validating`/`pending` →
  `validated`/`rejected`).
- **Retiros:** puede validar y rechazar. Si él mismo validó un retiro, **no
  puede aprobarlo** (banner verde de cuatro-ojos lo bloquea). Si él mismo
  aprobó, **no puede pagarlo**.
- Para probar el cuatro-ojos en acción: ir a
  `/backoffice/casino-demo/retiros/00000000-0000-4000-8000-000000000201` —
  como ese retiro fue validado por el operador, supervisor SÍ puede aprobar.

---

## Como `admin@casinodemo.local`

Todo lo anterior + sección **Administración**:

```text
http://localhost:3000/backoffice/casino-demo/miembros
# Listado + invitar / cambiar rol / desactivar (soft-delete)

http://localhost:3000/backoffice/casino-demo/cbu
# Cuentas bancarias donde se acreditan premios. Validación de checksum BCRA.

http://localhost:3000/backoffice/casino-demo/casino
# Config del adapter del casino (URL, API key, webhook secret)
# Botón "Probar conexión" llama a /api/casino-mock/<slug> via baseUrlOverride.
```

---

## Como `superadmin@liquidador.local`

```text
http://localhost:3000/superadmin/tenants
# Gestión de plataforma (única ruta exclusiva de superadmin).

http://localhost:3000/backoffice/casino-demo
# Y cualquier /backoffice/casino-demo/* sin restricción de membresía.
```

---

## Endpoints API

```text
GET  /api/casino-mock/health
# 200 OK con body "OK". Health check del mock del casino.

GET  /api/casino-mock/casino-demo
# Devuelve 4 cargas con externalRef determinístico
# (casino-casino-demo-<timestamp>-1..-4).
# PlayerRefs: jugor-casino-A1, jugor-casino-B2, jugor-casino-C3, jugor-casino-D4.
# La primera incluye comprobanteUrl.

GET  /api/cierre-pdf/casino-demo
# Requiere cookie de sesión activa (miembro del tenant o superadmin).
# Devuelve cierre-casino-demo-YYYY-MM-DD.pdf
# (Content-Type: application/pdf, Content-Disposition: attachment).
```

Curl rápido:

```bash
curl -i http://localhost:3000/api/casino-mock/health
curl -i http://localhost:3000/api/casino-mock/casino-demo

# Requiere cookie de sesión — logueate primero en el browser:
curl -i -o cierre.pdf http://localhost:3000/api/cierre-pdf/casino-demo
```

---

## Filtros útiles por URL

| URL                                                                          | Qué filtra                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| `/cargas?estado=pending`                                                     | Solo cargas pendientes                                |
| `/retiros?playerRef=jugador-a3f9`                                            | Retiros de Juan Perez                                 |
| `/historial?entidadTipo=carga`                                               | Audit log solo de cargas                              |
| `/historial?entidadTipo=retiro&actorId=00000000-0000-4000-8000-000000000003` | Audit de retiros hechos por supervisor                |
| `/historial?desde=2026-01-15&hasta=2026-01-20`                               | Audit por rango de fechas                             |

Entidades aceptadas por `?entidadTipo=`: `carga`, `retiro`, `tenant`, `member`,
`cbu`, `casino_credentials`.

---

## Lo que NO está (todavía)

- No hay auth real. La "sesión" es una cookie `mock-user-id` con el `userId`
  activo (seteada por el selector del header).
- No hay middleware de auth. `src/proxy.ts` solo forwardea el `x-tenant-slug`.
  El permiso fino se chequea en cada `page.tsx` y cada server action.
- No hay `/api/cargas`, `/api/retiros`, `/api/audit`, etc. Todo el acceso a
  datos va por **Server Components + Server Actions**, no por REST.
- No hay rutas dinámicas tipo `/cargas/page/[n]`. La "paginación" del
  historial es `?limit=200` (hardcoded en `listar-audit-log`).
- No hay `/backoffice/<slug>/miembros/<id>` ni `/backoffice/<slug>/cbu/<id>`.
  Las acciones sobre miembros y CBUs se hacen **inline** con `<form>` en la
  fila de la tabla.
- No hay `/api/casino-mock/webhook`. El flujo de webhooks no está implementado
  todavía.
