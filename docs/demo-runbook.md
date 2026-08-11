# Runbook de demo — Liquidador de Casino

> **Para quién es esto:** el operador o supervisor del casino que va a ver la
> demo. Cada escenario dura ~5 minutos. El flujo está pensado para mostrar el
> producto en orden de "valor creciente": idempotencia → cuatro-ojos → control
> de rechazos → cierre diario con auditoría descargable.

> **Recordá:** la app corre con datos **sintéticos**. Hay un banner "DEMO" en
> el header que lo recuerda. Si querés volver al estado inicial en cualquier
> momento: `npm run mock:reset` y refrescás `localhost:3000`.

---

## Antes de arrancar (30 segundos)

1. **Levantá la app** (en otra terminal):

   ```bash
   npm run dev
   ```

2. **Abrí el navegador** en `http://localhost:3000`.

3. **Elegí un usuario** del selector del header. Los que vas a usar:

   | Email                              | Rol          | Sirve para…                                |
   | ---------------------------------- | ------------ | ------------------------------------------ |
   | `operador@casinodemo.local`        | operador     | Registrar, validar, asentar (no aprobar)   |
   | `supervisor@casinodemo.local`      | supervisor   | Validar, aprobar, pagar                    |
   | `admin@casinodemo.local`           | tenant_admin | Todo dentro del tenant                     |
   | `superadmin@liquidador.local`      | superadmin   | Ver todos los tenants                      |

4. La sidebar del tenant `casino-demo` muestra:
   - **Operación:** Cargas, Retiros, Historial
   - **Administración** (solo `tenant_admin`): Miembros, CBU, Casino

---

## Escenario 1 — Carga idempotente (4 min)

**Qué demuestra:** el sistema no duplica la misma carga aunque el casino la
envíe dos veces (la segunda llamada no crea nada nuevo).

1. Asegurate de estar logueado como **`operador@casinodemo.local`** (no importa
   el rol para este escenario, pero operador sirve para el flujo completo).

2. En la sidebar, andá a **Cargas** → `/backoffice/casino-demo/cargas`.

3. Hacé clic en **"Traer del casino"** (botón arriba a la derecha). Esto simula
   una llamada al casino: aparecen 4 cargas nuevas en estado `pending`.

4. **Anotá los IDs** (o los montos) de las 4 cargas nuevas.

5. **Hacé clic en "Traer del casino" otra vez**, sin hacer nada más.

6. **Lo que vas a ver:** la lista **no cambió**. Las mismas 4 cargas siguen ahí,
   ninguna nueva. Esto es idempotencia: la integración con el casino usa
   `externalRef` como clave única, así que la segunda llamada con los mismos
   IDs externos no duplica nada.

7. Bonus: abrí **Historial** en la sidebar. Vas a ver las entradas de auditoría
   de las cargas importadas. Si hubieras duplicado, también se vería acá.

> **Frase para el cliente:** "Aunque el casino mande la misma notificación
> dos veces (red inestable, retry, lo que sea), nosotros no procesamos dos
> veces. El sistema sabe que ya las tenemos."

---

## Escenario 2 — Retiro con cuatro-ojos end-to-end (5 min)

**Qué demuestra:** ningún pago sale si no lo aprueban y pagan **dos personas
distintas** a quien lo registró. Es la defensa principal contra fraude
interno.

1. **Paso A — Registrar (operador).** Logueado como `operador@casinodemo.local`:
   - Sidebar → **Retiros** → botón **"Nuevo retiro"**.
   - Completá: jugador, monto **mayor a $10.000 ARS** (necesario para disparar
     `awaiting_approval`), CBU válido (cualquier CBU de la lista de seed sirve),
     titular, alias opcional.
   - Enviá. Queda en estado `pending`.

2. **Paso B — Validar (mismo operador).** Andá al detalle del retiro.
   - Hacé clic en **"Validar"**.
   - Pasa a `validated` → como el monto supera el umbral, **salta
     automáticamente** a `awaiting_approval`.
   - En el panel **"Cuatro-ojos"** (sidebar derecha) ya ves:
     `Registrado por → Validado por → vos mismo` (todavía falta aprobar y pagar).

3. **Paso C — Aprobar (otra persona).**
   - Cambiá al usuario **`supervisor@casinodemo.local`** desde el header.
   - Volvé al detalle del mismo retiro.
   - **Vas a ver un banner verde:** "Vos validaste este retiro. La aprobación
     la tiene que hacer otra persona (cuatro-ojos)." → el botón **"Aprobar
     (cuatro-ojos)" está deshabilitado** para vos, aunque seas supervisor.
   - **Pero acá viene la prueba:** si querés ver la defensa real, intentá
     aprobar igual con un cliente modificado (DevTools). El server action
     también valida el cuatro-ojos y rechaza la operación.
   - Volvé a **`operador@casinodemo.local`** y aprobá vos: tampoco podés,
     porque vos validaste.
   - Ahora logueate como **`admin@casinodemo.local`**: ese sí puede aprobar.
     Hacé clic en **"Aprobar (cuatro-ojos)"**.
   - Estado: `approved`.

4. **Paso D — Pagar (otra persona distinta del que aprobó).**
   - Como `admin@casinodemo.local` ya aprobó, no puede pagar (cuatro-ojos).
   - Logueate como **`operador@casinodemo.local`** y pagá vos: tampoco podés,
     porque ya validaste.
   - Logueate como **`supervisor@casinodemo.local`** y pagá él: SÍ puede,
     porque ni validó ni aprobó.
   - Hacé clic en **"Pagar premio"**, completá:
     - **URL del comprobante:** cualquier URL (ej. `https://banco.com/comp-1`).
     - **Clave de idempotencia:** cualquier string único
       (ej. `pago-demo-001`). Esto permite reintentar el pago sin duplicar.
   - Estado: `paying` → `paid`. Se acredita en el ledger (partida doble).

5. **Lo que hay que mirar al final:**
   - Panel **"Cuatro-ojos"** del detalle del retiro muestra 4 actores
     distintos en los 4 pasos (o donde corresponde, mismo operador en
     "Registrado" + "Validado" pero distinto en "Aprobado" + "Pagado").
   - **Historial** del tenant muestra toda la cadena con timestamps y
     motivos. Esto es lo que se presenta ante una auditoría externa.

> **Frase para el cliente:** "Aunque alguien robe la contraseña de un
> supervisor, no puede sacar plata solo. Necesita dos personas distintas
> en dos momentos distintos. Y todo queda en el log con quién, cuándo y por
> qué."

---

## Escenario 3 — Rechazo con motivo y CBU inválido (4 min)

**Qué demuestra:** el sistema te obliga a justificar un rechazo, y valida el
CBU contra el algoritmo oficial del BCRA.

### Parte A — Rechazo con motivo

1. Logueado como `operador@casinodemo.local`, andá a **Retiros** → elegí
   cualquier retiro en `pending` (los del seed sirven).
2. En el detalle, hacé clic en **"Rechazar"**.
3. Aparece un formulario que pide **motivo obligatorio** (mínimo 3 caracteres).
4. Probá enviar vacío → la UI no te deja.
5. Escribí un motivo real, por ejemplo: `CBU no coincide con titular del jugador`.
6. Confirmá. Estado: `rejected`. El motivo aparece en el detalle (recuadro rojo)
   y en el audit log.

### Parte B — CBU con checksum inválido

1. Andá a **Retiros** → **"Nuevo retiro"**.
2. En el campo CBU, pegá un CBU con el último dígito cambiado a propósito
   (cualquier CBU de la lista de seed + 1 al último dígito).
3. Enviá. El sistema rechaza con error específico:
   `CBU inválido: checksum no coincide con algoritmo BCRA`.
4. Esto es defensa contra typos: el último dígito del CBU es un checksum
   que valida que el resto esté bien. Sin eso, podríamos estar mandando plata
   a una cuenta inexistente.

> **Frase para el cliente:** "El sistema no te deja rechazar sin decir por
> qué. Y antes de aceptar un retiro, valida el CBU con el algoritmo del
> Banco Central — no confiamos en que el operador tipeó bien."

---

## Escenario 4 — Cierre diario + PDF + auditoría (5 min)

**Qué demuestra:** al final del día, el supervisor cierra, descarga el
comprobante en PDF, y todo lo que pasó está trazado.

1. **Generar movimiento del día.** Si el seed no tiene cargas `settled` ni
   retiros `paid` con `updatedAt` de hoy, el cierre va a salir vacío. Para
   forzar:
   - Andá a **Cargas**, elegí una carga `validated` → asentala.
   - Andá a **Retiros**, elegí uno en `approved` (o usá el del escenario 2
     si ya lo pagaste) → pagalo con cualquier comprobante y key.

2. **Ir al cierre.** Sidebar → **Cierre diario** (la ruta también es
   `/backoffice/casino-demo/cierre`).
   - Ves 4 KPIs: cargas liquidadas, total cargas, retiros pagados, total
     retiros.
   - Ves el **neto del día** en grande (verde si el casino recibió más de lo
     que pagó; rojo si pagó más).
   - Abajo, una tabla con todas las operaciones liquidadas hoy, con link al
     detalle de cada una.

3. **Descargar el PDF.** Arriba a la derecha, **"Descargar cierre PDF"**.
   Se baja un archivo `cierre-casino-demo-YYYY-MM-DD.pdf` con:
   - Header: tenant + fecha del periodo.
   - Resumen: total cargas, total retiros, neto.
   - Tabla: operaciones del día (tipo, estado, jugador, monto, hora, ID).

4. **Auditoría.** Sidebar → **Historial**.
   - Filtrá por actor (ej: `supervisor@casinodemo.local`) para ver todo lo
     que hizo hoy.
   - Filtrá por entidad (`retiro`) para ver la cadena completa de un retiro
     puntual.

> **Frase para el cliente:** "Esto es lo que mandás cuando te pide el
> ente de control o la auditoría interna. Un PDF con los números del día,
> más un log con cada acción, quién la hizo y por qué. No hay forma de
> 'se perdió en el sistema'."

---

## Después de la demo — Smoke test end-to-end

Si querés verificar que la app está sana antes de la demo, o si algo se
rompió durante el ensayo, corré:

```bash
npm test
npm run lint
npm run typecheck
```

Lo esperado: **190 tests verde**, lint limpio, typecheck limpio. Si algo
falla, **no commitees** y revisá.

Para volver al estado inicial de los datos:

```bash
npm run mock:reset
```

Refrescá `localhost:3000`. El seed se vuelve a cargar solo.

---

## Resumen de los 4 valores que llevamos a la demo

| Escenario | Valor para el cliente                                    | Defensa clave                 |
| --------- | -------------------------------------------------------- | ----------------------------- |
| 1         | "No procesamos de más aunque el casino mande dos veces"   | Idempotencia por `externalRef`|
| 2         | "Nadie puede sacar plata solo"                           | Cuatro-ojos en use case       |
| 3         | "No dejamos pasar un CBU mal escrito ni un rechazo sin razón" | Validación CBU BCRA + motivo obligatorio |
| 4         | "El cierre del día se descarga y se puede defender"     | PDF + audit log               |

Si la demo dura 20 minutos en total, va perfecta. Si dura menos, priorizá
los escenarios **2** (cuatro-ojos) y **4** (cierre + PDF) — esos son los que
más le importan al comité que aprueba una compra.
