<!-- SEED: dirección visual elegida con el usuario antes de implementación. -->
<!-- Bancario profesional · compacto operativo · modo Operate. -->
<!-- Re-correr `/impeccable document` después de la primera implementación para extraer tokens reales. -->

---
name: Liquidador de Casino
description: Sistema de liquidación multi-tenant para casinos online · modo Operate
---

# Design System: Liquidador de Casino

## Overview

**Creative North Star: "La Mesa de Liquidación."**

Una mesa de operación profesional donde el operador se sienta cuatro horas a cuadrar cargas y retiros. No es un dashboard "lindo": es una herramienta de trabajo que debe transmitir confianza con cada monto y cada estado. El acento verde-azulado profundo es el ancla que dice "esto es plata real, esto cuenta"; los neutros cálidos (no grises puros) son el papel de la mesa; los acentos de estado son un semáforo discreto que el ojo aprende en cinco minutos y nunca más deja de leer.

La densidad es compacta — el operador ve más filas por pantalla, menos scroll, menos clicks. La tipografía mono (Geist Mono) está reservada para números: montos, IDs, CBUs. Donde hay plata hay mono. Donde hay prosa, hay Sans. Esa separación es la primera regla del sistema.

La identidad se construye sobre la base shadcn/neutral ya instalada (`radix-nova`); no se cambia el tema, se le suma capa. El acento reemplaza el gris-negro del primary; los neutros se entibian; los estados semánticos se agregan como tokens nuevos.

**Key Characteristics:**
- Acento único verde-azulado profundo (`banking-teal`), aparece en ≤8% de cualquier pantalla. Su rareza es el punto.
- Tipografía mono obligatoria para todo monto, ID, CBU y porcentaje. Sin excepciones.
- Estados de operación son un semáforo fijo: amber=pending, sky=validating, emerald=validated, slate=settled, rose=rejected. El operador los lee de un vistazo.
- Densidad compacta operativa: filas de tabla 36px, padding interno `px-3 py-2`, controles 32px de alto.
- Layout fijo de tres regiones: sidebar (240px), header (56px), main (resto). Sin drawers flotantes para tareas principales.
- Sombras solo como respuesta a estado (focus, drag, modal). En reposo todo es plano y tonal.

## Colors

Paleta principal: verde-azulado profundo (`banking-teal`) sobre neutros cálidos. Acentos secundarios reservados exclusivamente para los cinco estados de operación. Sin color de marketing, sin gradientes, sin decoración cromática.

### Primary
- **Banking Teal** (`oklch(0.45 0.12 195)`): color de marca y de acento funcional. Botones primarios, links activos, foco de teclado, números positivos en ledger, selección activa en sidebar.
- **Banking Teal Deep** (`oklch(0.38 0.11 195)`): hover/active del primary. Reservado para estados interactivos, no para decoración.

### Neutrals (tonos cálidos — no grises puros)
- **Warm Paper** (`oklch(0.985 0.005 80)`): fondo principal. Reemplaza el blanco puro. Sensación "papel de mesa".
- **Warm Surface** (`oklch(0.97 0.005 80)`): fondo de cards y sidebar.
- **Warm Ink 900** (`oklch(0.18 0.008 80)`): texto principal. Casi negro, apenas tibio.
- **Warm Ink 600** (`oklch(0.45 0.008 80)`): texto secundario, labels, placeholders.
- **Warm Ink 400** (`oklch(0.65 0.008 80)`): texto deshabilitado, hints.
- **Warm Border** (`oklch(0.90 0.008 80)`): bordes de cards, separadores, hairline.

### Estados de operación (semáforo fijo)
- **Pending Amber** (`oklch(0.78 0.16 75)`): carga/retiro en `pending`. Background `oklch(0.96 0.06 75)`, texto `oklch(0.40 0.14 75)`.
- **Validating Sky** (`oklch(0.65 0.14 235)`): en proceso de validación. Background `oklch(0.96 0.05 235)`, texto `oklch(0.38 0.13 235)`.
- **Validated Emerald** (`oklch(0.62 0.16 155)`): validada por operador. Background `oklch(0.96 0.05 155)`, texto `oklch(0.36 0.13 155)`.
- **Settled Slate** (`oklch(0.45 0.04 235)`): asentada, cerrada. Background `oklch(0.95 0.01 235)`, texto `oklch(0.30 0.04 235)`.
- **Rejected Rose** (`oklch(0.60 0.20 25)`): rechazada. Background `oklch(0.96 0.05 25)`, texto `oklch(0.42 0.18 25)`.
- **Destructive Rose** (`oklch(0.577 0.245 27.325)`): acciones destructivas (eliminar CBU, desactivar miembro). Más saturado que Rejected para diferenciar "estado" de "acción".

### Named Rules
**The One Voice Rule.** El acento `banking-teal` aparece en ≤8% de cualquier pantalla dada. Si una fila, un badge, un botón y un link son todos teal en la misma vista, ya sobró. Los estados de operación NO usan teal — usan su propio color del semáforo.

**The Semantic-Only Accent Rule.** Los cinco colores de estado están reservados exclusivamente para el dominio (cargas/retiros/pagos/miembros con su `estado`). No se usan para decoración, ni para destacar una métrica random del dashboard.

**The Warm Neutral Rule.** Cero grises puros en UI. Todo lo que iba a ser `gray-500` es `warm-ink-600`. La tibieza se siente, no se nombra.

## Typography

**Display Font:** Geist Sans (`--font-geist-sans`)
**Body Font:** Geist Sans (`--font-geist-sans`)
**Mono Font:** Geist Mono (`--font-geist-mono`) — reservada para números, IDs, CBUs, códigos de error.

**Character:** Sans geométrica moderna para texto de operación. Mono técnica para datos numéricos. La separación visual entre ambas es inmediata por la proporción de los caracteres: un monto `$ 1.234,56` en mono contrasta con "Carga #a3f9" en sans. La mono nunca se usa para emphasis de texto ("ESTO ES IMPORTANTE") — solo para datos.

### Hierarchy
- **Display** (`text-3xl font-semibold tracking-tight`, 30px, line-height 36px): títulos de superficie. Solo en el header de cada página principal. Máximo uno por pantalla.
- **Headline** (`text-xl font-semibold`, 20px, line-height 28px): títulos de sección, KPIs del dashboard.
- **Title** (`text-base font-medium`, 16px): títulos de cards, nombres de columnas.
- **Body** (`text-sm`, 14px, line-height 20px): texto de operación. Medida 65-75ch.
- **Label** (`text-xs uppercase tracking-wider font-medium`, 12px): labels de campos, headers de tabla, eyebrows. Color `warm-ink-600`.
- **Mono Data** (`font-mono text-sm tabular-nums`, 14px): montos, IDs, CBUs. Activar `tabular-nums` para alineación decimal en columnas.

### Named Rules
**The Mono-For-Money Rule.** Todo monto, porcentaje, ID (`Carga #a3f9...`), CBU, código de error y timestamp va en `font-mono` con `tabular-nums`. Sin excepciones. El operador distingue prosa de dato de un vistazo.

## Layout

Grid de tres regiones fijas: sidebar a la izquierda (240px), header arriba (56px), main en el resto. Sin drawers laterales, sin off-canvas. Tareas principales nunca se cortan por un panel flotante.

### Breakpoints
- `sm` (640px): colapsar sidebar a íconos (56px). Tablas pasan a scroll horizontal.
- `md` (768px): sidebar 200px.
- `lg` (1024px): sidebar 240px, layout completo.
- `xl` (1280px): container principal `max-w-7xl`.

### Containers
- **Sidebar** (`w-60 shrink-0`, `w-14` en sm): fondo `warm-surface`, hairline a la derecha. Navegación agrupada por sección (Navegación / Operación / Administración / Plataforma).
- **Header** (`h-14`): fondo `warm-paper`, hairline abajo. Tres zonas: logo + nombre del tenant activo (izquierda), breadcrumb o título (centro), selector de usuario + cerrar sesión (derecha).
- **Main** (`flex-1 overflow-auto p-6`): padding generoso alrededor de cards. Las cards internas usan `p-4`.

### Grid
- Dashboard de inicio: grid `md:grid-cols-2 xl:grid-cols-4` para KPIs; `xl:grid-cols-3` para actividad reciente.
- Listas (cargas, retiros, miembros): tabla full-width.
- Detalle de operación: dos columnas `lg:grid-cols-3`, principal (2) + sidebar de metadata (1).

### Spacing
- Escala: `4 / 8 / 12 / 16 / 24 / 32 / 48`. Sin valores intermedios.
- Entre cards hermanas: `gap-4`.
- Entre secciones: `space-y-6`.
- Padding interno de card: `p-4`. De tabla: `px-3 py-2` por fila.

## Elevation & Depth

Sistema plano por defecto. Las sombras existen solo como respuesta a estado (focus, drag, modal abierto), nunca como decoración de reposo. La jerarquía visual viene del **tono** (paper vs surface vs surface-sunken), no de la elevación.

### Tonal Layers
- **Paper** (`warm-paper`, `oklch(0.985 0.005 80)`): fondo de la página, header.
- **Surface** (`warm-surface`, `oklch(0.97 0.005 80)`): cards, sidebar, dropdowns.
- **Sunken** (`oklch(0.94 0.006 80)`): filas de tabla en hover, inputs deshabilitados, áreas de "cargando" skeleton.

### Shadows (solo para estado)
- **Focus Ring** (`box-shadow: 0 0 0 3px oklch(0.45 0.12 195 / 0.25)`): foco de teclado sobre cualquier control. Banco-teal translúcido, 3px de grosor, sin offset.
- **Modal Overlay** (`box-shadow: 0 24px 64px -16px oklch(0 0 0 / 0.18)`): modales y dropdowns elevados. Offset grande, blur grande, opacidad baja.
- **Drag** (`box-shadow: 0 8px 24px -4px oklch(0 0 0 / 0.12)`): elemento siendo arrastrado.

### Named Rules
**The Flat-By-Default Rule.** Todo reposa en tono, no en sombra. Una card no tiene sombra hasta que se selecciona, se abre un dropdown sobre ella, o se draggea.

## Shapes

Esquina consistente: `radius-md` (10px) para cards y controles primarios; `radius-sm` (6px) para badges, chips, tags; `radius-full` solo para avatares.

- **Cards / Modales / Dropdowns**: 10px (`--radius-md = 0.625rem`).
- **Botones / Inputs**: 8px (`--radius = 0.625rem`, ajustar a 0.5rem si el control es pequeño).
- **Badges / Chips / Status pills**: 6px (full en el caso de pills de estado, para sensación "etiqueta").
- **Avatares**: full.
- **Bordes**: hairline 1px `warm-border`. Sin `border-l` coloreado en cards.

## Components

### Buttons
- **Shape:** radius 8px, alto 32px (sm) o 40px (default).
- **Primary:** fondo `banking-teal`, texto blanco. Hover `banking-teal-deep`. Focus: ring teal translúcido.
- **Secondary / Outline:** fondo transparente, borde 1px `warm-border`, texto `warm-ink-900`. Hover: fondo `sunken`.
- **Ghost:** sin borde, hover `sunken`. Para acciones terciarias (cancelar, cerrar).
- **Destructive:** fondo `destructive-rose`, texto blanco. Solo para acciones destructivas irreversibles.
- **Disabled:** opacidad 50%, no pointer.

### Status Pills (componente signature)
- **Shape:** radius-full, padding `px-2.5 py-0.5`, texto `text-xs font-medium uppercase tracking-wider`.
- **Background:** color de estado al 8% (tono pastel del semáforo).
- **Text:** color de estado saturado al 100%.
- **Variantes:** `pending` (amber), `validating` (sky), `validated` (emerald), `settled` (slate), `rejected` (rose).
- **Uso obligatorio:** toda instancia de `Carga.estado`, `Retiro.estado`, `Pago.estado`, `Member.estado` se muestra con Status Pill. Sin excepción.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** `warm-surface`.
- **Border:** 1px `warm-border` (sin sombra).
- **Padding interno:** `p-4` (header `pb-3`, content `pt-0`).
- **Header:** `CardTitle` (`text-base font-medium`) + `CardDescription` (`text-xs text-warm-ink-600`).

### Inputs / Fields
- **Shape:** radius 8px, alto 36px.
- **Background:** `warm-paper`, borde 1px `warm-border`.
- **Focus:** borde `banking-teal` + ring translúcido.
- **Error:** borde `destructive-rose`, texto de error `text-xs text-destructive-rose` debajo.
- **Disabled:** fondo `sunken`, opacidad 60%.
- **Label arriba:** `text-xs font-medium uppercase tracking-wider text-warm-ink-600`.

### Tables
- **Shape:** card contenedor con radius 10px.
- **Header:** `bg-warm-surface`, texto `text-xs uppercase tracking-wider text-warm-ink-600`, padding `px-3 py-2`.
- **Rows:** padding `px-3 py-2`, hover `bg-sunken`, separadores hairline.
- **Densidad:** filas 36px de alto. `tabular-nums` en columnas numéricas.
- **Selection:** checkbox a la izquierda, fondo `banking-teal / 5%` cuando seleccionada.
- **Empty state:** dentro del card, ilustración mínima + título + CTA.

### Navigation (Sidebar)
- **Ancho:** 240px (lg+), 56px (sm).
- **Sections:** agrupadas con label `text-xs uppercase tracking-wider text-warm-ink-400` + items debajo.
- **Item default:** `text-sm`, padding `px-3 py-2`, hover `bg-sunken`.
- **Item activo:** fondo `banking-teal / 8%`, texto `banking-teal`, borde izquierdo 2px `banking-teal`.
- **Iconos:** lucide, 16px, stroke 1.75.

### Toasts (sonner)
- **Success:** borde izquierdo 2px `validated-emerald`.
- **Error:** borde izquierdo 2px `destructive-rose`.
- **Warning:** borde izquierdo 2px `pending-amber`.
- **Info:** borde izquierdo 2px `banking-teal`.

### Empty State (componente signature)
- **Estructura:** ícono lucide 48px (`text-warm-ink-400`) + título (`text-base font-medium`) + descripción (`text-sm text-warm-ink-600`) + CTA opcional (`Button variant="outline"`).
- **Posición:** centrada vertical y horizontal dentro del card contenedor.
- **Nunca:** un card solo con texto "No hay datos" sin diseño.

### KPI Card
- **Estructura:** label arriba (`text-xs uppercase tracking-wider text-warm-ink-600`) + valor (`text-3xl font-semibold tabular-nums font-mono`) + delta opcional (`text-xs` con color semántico).
- **Background:** `warm-surface`, border 1px `warm-border`, radius 10px, padding `p-4`.
- **Click:** toda la card es clickeable si hay detalle.

## Do's and Don'ts

### Do:
- **Do** usar `font-mono tabular-nums` en toda columna de monto, ID, CBU, timestamp o porcentaje.
- **Do** usar Status Pill con el color del semáforo correspondiente para todo estado de operación.
- **Do** agrupar navegación del sidebar por sección con label uppercase.
- **Do** diseñar empty states con ícono + título + descripción + CTA. Nunca un card vacío solo.
- **Do** usar `bg-sunken` para hover de filas y elementos interactivos en reposo.
- **Do** aplicar focus ring teal translúcido en todo control interactivo.
- **Do** mostrar toasts con borde izquierdo de color semántico después de cada server action.
- **Do** usar `max-w-7xl` para el container del dashboard, tablas full-width.
- **Do** tabular los números con `tabular-nums` para alineación decimal.
- **Do** mantener el sidebar con tres zonas (logo / nav / cuenta) sin drawers flotantes.

### Don't:
- **Don't** usar emojis en la UI. Solo íconos lucide.
- **Don't** usar gradientes, glass, ni efectos de blur con fines decorativos.
- **Don't** aplicar `banking-teal` a más del 8% de cualquier pantalla. Si teal está en todos lados, ya perdió su valor.
- **Don't** usar colores de estado para decoración (naranja en un icono random, verde en una métrica cualquiera).
- **Don't** usar `border-left` coloreado de 4px+ en cards, alerts o callouts. Solo los Status Pills y los items activos del sidebar pueden tener borde izquierdo.
- **Don't** usar mayúsculas tracking-wide como emphasis de texto. Solo para labels y eyebrows.
- **Don't** usar sombras en reposo. Solo en focus, drag y modal abierto.
- **Don't** usar grises puros (`gray-500`, `zinc-500`). Todo gris es warm.
- **Don't** mostrar cards de "Próximamente" en producción. Si una feature no está, no aparece en la navegación.
- **Don't** usar sparklines, progress rings ni rectangles redondeados como sustituto de contenido real.