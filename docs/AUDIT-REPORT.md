# Informe de Auditoría — CRM MVP Trebor Zernio

> **Fecha:** 2026-08-16
> **Alcance:** auditoría extensa de estructura, código y cumplimiento. **READ-ONLY** — no se modificó ningún archivo de `src/`, `server.mjs`, `tunnel.mjs` ni `index.html`.
> **Equipo:** Orquestador (síntesis) · Codificador (componentes) · Revisor de codigo (core/backend) · UI/UX Pro Max (UI/UX) · Beautiful Mermaid (diagramas).

---

## Resumen ejecutivo

La base arquitectónica es **sana**: frontend Vue (CDN global) organizado por vistas con primitivas UI reutilizables (`ui.js`), un namespace global `ZernioCrm`, estado en `store.js`, y un proxy ligero `server.mjs` (0 dependencias) que cumple en su mayoría con las políticas documentadas (dedupe por `event.id`, verificación HMAC, guardia path-traversal, timeout upstream).

Los problemas se concentran en **tres ejes**:

1. **Seguridad real (2 críticos):** una **API key master hardcodeada en el bundle del navegador** y un **secret de webhook que viaja por URL y se loguea**. Ambos contradicen las propias políticas del proyecto.
2. **Deuda estructural:** *god-files* grandes (`inbox.js`, `broadcasts.js`, `settings.js`, `constants.js`, `products.js`) + duplicación de lógica entre archivos + acoplamiento global sin imports.
3. **UX/accesibilidad:** alta consistencia visual general, pero fallos de contraste WCAG sobre acentos configurables y ARIA incompleto.

Ninguna propuesta implica reescribir componentes enteros; todas son incrementales y de bajo riesgo.

---

## 1. Hallazgos Críticos (🔴)

### C1 — MASTER API KEY expuesta en el bundle del navegador
- **Ubicación:** `src/services/zernio-api.js:21`
  ```js
  const MASTER_API_KEY = 'sk_8e0a...f625'   // ← key real de Zernio
  ```
- **Impacto:** la key se sirve íntegra al navegador (todo el bundle JS es leído por el cliente). Cualquier visitante puede extraerla del código fuente servido y hacer llamadas admin con privilegios de centro (crear perfiles, keys, billing, webhooks). Se usa en modo admin como `Authorization: Bearer` (línea 76) y viaja en `X-Zernio-Key`.
- **Contradice:** `POST-IMPLEMENTATION.md` (It4: "la master key nunca se expone ni completa") y su nota sobre custodia de la key del lado servidor.
- **Fix de bajo riesgo:** sustituir por placeholder vacío en el MVP local y mover la key real al lado servidor (`server.mjs`), leyéndola de `env`/secret store. Es el único hallazgo con riesgo real si el código se desplegara con clave válida.
- **Acción URGENTE recomendada:** rotar/revocar la key expuesta en Zernio dashboard lo antes posible.

### C2 — Secret de webhook en query string y en logs
- **Ubicación:** `server.mjs:290` (`url.searchParams.get('secret')`) + log en consola (línea ~435).
- **Impacto:** el secret que firma los webhooks (HMAC) se filtra en logs, historial del navegador y en la URL del túnel. Quien lo obtenga puede **forjar eventos válidos** e inyectar mensajes.
- **Fix de bajo riesgo:** leer el secret del header `X-Zernio-Secret` (el server ya lo admite en CORS, línea 178) en lugar de la URL, y no loguearlo.

---

## 2. Hallazgos Altos (🟠)

### Seguridad / backend
- **A1 — `GET /webhooks/events` sin autenticación** (`server.mjs:370-374`): expone el feed de eventos (mensajes, bodies) a cualquiera que alcance el server; a través del túnel público queda accesible desde Internet. → Limitar a loopback (reutilizar la guardia `isLoopback` de `/api/usage`).
- **A2 — Proxy confía en la `X-Zernio-Key` del cliente** (`server.mjs:382`): cualquiera puede usar el proxy como relay con cualquier key aportada. → Validar key contra las sub-keys emitidas del centro, o excluir `/zernio/*` del túnel público.

### Componentes frontend (god-files y duplicación)
- **A3 — `inbox.js` (~1.995 líneas):** un solo componente `inbox-view` mezcla bandeja, render de mensajes, detectar menciones, cierre de lead, template-picker, drawer de contacto, recordatorios, agente IA y onboarding de webhook. → Extraer la lógica de "cierre de lead" a helper compartido (ver A4) y mover bloques a composables **sin tocar templates**.
- **A4 — Flujo "cierre de lead" duplicado** (~80 líneas en `inbox.js:836-913` y `leads.js:87-161`): cómputo de `productMentions`, `openCloseModal`, `confirmClose`, etc. casi idéntico. → Extraer `makeCloseLead({ workspace, productMentions, store, toast })` y reutilizar en ambos. *(el de mayor impacto de la deuda)*
- **A5 — Upload/redimensionado de logo duplicado** (`settings.js:59-93` = `onboarding.js:88-121`). → Mover `uploadLogo`/`removeLogo` a utilidad compartida.
- **A6 — Formato de fechas inline duplicado (20+ sitios):** `new Date(x).toLocaleString('es-VE')` repetido en leads/inbox/billing/system/settings/analytics pese a que ya existen `ZernioCrm.formatTime/formatDate/timeAgo`. → Envolver `fmtDT()`/`fmtD()` y sustituir (cambio mecánico, sin alterar salida).

### UI/UX accesibilidad
- **A7 — Contraste sobre acento configurable:** botones `bg-[var(--accent)] text-white` y `text-[var(--accent)]` sobre `--accent-soft` incumplen WCAG con acentos claros. → Derivar color de primer plano por luma del token y centralizar el botón primario.
- **A8 — Nav/sidebar sin `aria-current="page"`** (`app.js`): screen readers no detectan sección activa.
- **A9 — Estados vacíos duplicados con contraste ~2.9:1** (products.js:900, live-connect:632, broadcasts:1220): usar `<ui-empty>` + `text-neutral-500/600`.
- **A10 — Vistas secundarias sin breadcrumb/volver perceptible** (conversación de inbox, detalle de producto, sub-tabs de settings).

---

## 3. Hallazgos Medios (🟡)

- **M1 — Persistencia completa en cada mutación** (`storage.js:99-116`): `Vue.watch(..., { deep: true })` serializa todo el workspace (incluida demo-data) en cada cambio → janky y riesgo de superar 5MB de localStorage. → Debounce 300-500ms o persistir solo campos de cabecera.
- **M2 — `constants.js` es god-file de datos + lógica + UI helpers** (932 líneas): mezcla catálogos (NICHES, ROADS, copy), RBAC y funciones puras. → Extraer catálogos a `src/data/catalog.js` y helpers a `src/utils.js`, reexportando el mismo namespace.
- **M3 — `store.js` singleton global acoplado** (417 líneas): dominio (reflectIncomingMessage, migrateWorkspace, productMentions) vive junto al estado. → Añadir capa fina de acciones tipadas sin migrar consumidores.
- **M4 — Fallbacks de API inline en componentes** (`billing.js:191`, `system.js:60-62` con `.catch(()=>null)`): centralizar en `zernio-api.js`.
- **M5 — Menciones de producto dispersas** en constants/inbox/leads/products con recomputo duplicado. → Exponer `productMentionsFor(workspace)` único.
- **M6 — Nombres mixtos es/en** (`saveApiKey` vs `guardar`, `col.nombre`): solo convenio documentado, no renombrar columnas (rompería persistencia).
- **M7 — Sub-tabs sin `role="tablist"`/`aria-selected`; modales sin Escape/focus-trap/aria-labelledby; toast sin `role="status"`/aria-live; toggle sin label; labels desasociadas en settings.**
- **B1 (bajo) — Retry 429 con semántica ambigua de `X-RateLimit-Reset`** (`zernio-api.js:90-95`): documentar formato del header.

---

## 4. Confirmado positivo ✅

- `ui.js` con buenas primitivas (modal/drawer con teleport + Escape, toast, empty, field).
- Dedupe por `event.id` y verificación HMAC-SHA256 implementados.
- Medidor de uso local con hash de key (`data/usage.json`) y snapshot solo localhost.
- Guardia de path-traversal y timeout upstream 15s en `serveStatic`.
- `ui-stepper` reutilizado en onboarding; responsive correcto en sub-sidebar de settings.
- Neo-brutalismo visual consistente (borders 2px, shadow-brutal, font-mono).

---

## 5. Priorización de acciones de bajo riesgo

| # | Acción | Tipo | Impacto |
|---|--------|------|---------|
| 1 | **Revocar la API key expuesta** (C1) | Seguridad | 🔴 urgente |
| 2 | Quitar `MASTER_API_KEY` del bundle → mover a server/env | Seguridad | 🔴 |
| 3 | Leer secret de webhook de header, no de URL, y no loguearlo | Seguridad | 🔴 |
| 4 | Limitar `/webhooks/events` y `/api/usage` a loopback | Seguridad | 🟠 |
| 5 | Validar keys en el proxy / excluir `/zernio/*` del túnel | Seguridad | 🟠 |
| 6 | Extraer `makeCloseLead()` compartido (inbox+leads) | Deuda | 🟠 ★ |
| 7 | Extraer `uploadLogo`/`removeLogo` compartido | Deuda | 🟠 |
| 8 | Consolidar formateo de fechas (`fmtDT`/`fmtD`) | Deuda | 🟠 |
| 9 | Debounce en `initPersistence` | Rendimiento | 🟡 |
| 10 | Centralizar fallbacks de API | Deuda | 🟡 |
| 11 | Fixes de contraste y ARIA | UX/Accesibilidad | 🟠/🟡 |

---

## 6. Archivos de documentación generados (por Beautiful Mermaid)

- `docs/architecture-audit.md` — 3 diagramas Mermaid (arquitectura, dependencias, flujo webhook).
- `docs/architecture-audit.svg`, `docs/architecture-dependencies.svg`, `docs/webhook-flow.svg`.

> Todas las propuestas preservan el comportamiento actual y no requieren reescritura de componentes completos.