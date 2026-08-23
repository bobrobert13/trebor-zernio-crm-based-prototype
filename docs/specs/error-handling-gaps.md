# Spec+: Blindaje de Manejo de Errores (Error Handling Gaps)

> Resultado de una auditoría de "gaps" de manejo de errores sobre el código
> existente. No añade funcionalidad nueva: endurece puntos concretos en los que
> el código actual puede fallar en silencio, devolver status equivocados o
> rechazar promesas sin capturar. Cada hallazgo referencia su símbolo/archivo
> real y su severidad. Nada de lo marcado como PROPOSAL existe todavía.

## Phase 1: Strategic Vision

* **Vision:** Todos los flujos críticos (conexión WhatsApp, agente externo,
  receptor de webhooks y servidor estático) fallan con un estado, mensaje y
  registro explícitos, sin rechazos de promesa no capturados ni respuestas 500
  para errores que deberían ser 4xx.
* **OKR / Goal (proposal):** Reducir a 0 los rechazos de promesa no capturados
  (`unhandledrejection`) reproducibles en flujos críticos, y que 3 casos de
  error de cliente (URL malformada, body de webhook demasiado grande, callback
  OAuth corrupto) pasen de fallo silencioso/500 a respuestas 400/413 y toast
  informativo — verificado por una prueba manual por caso.

## Phase 2: Functional Spec (BDD)

* **User Story:** As a usuario del prototipo, quiero que cada fallo (servidor
  caído, callback corrupto, body inválido) se muestre o se registre de forma
  explícita, para no quedarme con un flujo silenciosamente roto.

### Acceptance Criteria

* **Scenario 1: Callback de OAuth de WhatsApp con JSON corrupto → no aborta el flujo**
  * **Given** que `boot()` ya ha corrido y hay un valor en `sessionStorage['tzcrm.wa-callback']` que es texto no-JSON (p. ej. `"{broken"`)
  * **When** `consumeCallback()` se ejecuta al resolver `boot().then(...)`
  * **Then** la app captura el error de parseo, limpia la clave de sesión, muestra un toast `'Datos de conexión corruptos: vuelve a autorizar Meta'` (level error) y NO se produce un rechazo de promesa no capturado; el resto de la app sigue operando

* **Scenario 2: Servicio del agente sin respuesta o con tiempo agotado → test, no throw crudo**
  * **Given** un agente live con `url` configurada y el servicio externo caído o que excede `AGENT_TIMEOUT_MS`
  * **When** el usuario pulsa "Probar conexión" en el módulo Agente
  * **Then** se registra una entrada en `agent.logs` con `ok:false` y un mensaje amigable (`'Tiempo de espera agotado (8s)'` para AbortError, `'HTTP <status>'` para respuestas no-OK), y el toast muestra ese mensaje en lugar de un `Error` crudo

* **Scenario 3: Webhook con body demasiado grande → respuesta 413, no socket muerto**
  * **Given** `server.mjs` corriendo y el receptor `POST /webhooks/zernio`
  * **When** un payload supera `MAX_BODY` (10 MB)
  * **Then** el servidor responde `413 Payload Too Large` con `{ error }` JSON y el cliente recibe una respuesta HTTP válida (no un reset de conexión), y el servidor no escribe 500 sobre un socket destruido

* **Scenario 4: URL con percent-encoding malformado → 400, no 500**
  * **Given** `server.mjs` corriendo
  * **When** se solicita un recurso con una ruta que `decodeURIComponent` no puede decodificar (p. ej. `GET /index%zz`)
  * **Then** el servidor responde `400 Bad Request` (JSON `{ error }`) y no retorna un 500 interno tras un `URIError`

* **Scenario 5: `/api/tunnel` sin responder → timeout, no busy infinito**
  * **Given** el servidor local accesible pero colgado (o red de gran latencia)
  * **When** `startWhatsAppOAuth()` o `fetchTunnelUrl()` consultan `/api/tunnel`
  * **Then** la petición aborta tras un timeout acotado (recomendado 5 s), el estado `busy`/`tunnelBusy` se libera y se muestra un toast de error en vez de quedar en espera indefinida

## Phase 3: Technical Contract & DoD

Las marcas **[PROPOSAL]** son nuevos contratos que aún no existen; el resto
refiere símbolos reales verificados.

* **Gap 1 — Callback OAuth (HIGH)** — [src/live-connect-composables.js](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/live-connect-composables.js) línea 433-434 (`JSON.parse(raw)`) y línea 519 (`boot().then(consumeCallback)` sin `.catch`).
  * Contrato: `consumeCallback()` captura `JSON.parse` con `try/catch`, borra `sessionStorage['tzcrm.wa-callback']` dentro de `finally`, y emite `toast(msg,'error')`. `boot().then(consumeCallback).catch((e)=>toast/console)`.
  * **Contract / DTO:** `raw: string` → `params?: { connected?:'whatsapp', profileId?:string, accountId?:string, step?:string, tempToken?:string } | null`.

* **Gap 2 — Agente `testAgent` (MEDIUM)** — [src/services/agent-client.js](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/services/agent-client.js) `testAgent()` líneas 274-286.
  * Contrato: reutiliza el patrón de `askAgent()` (líneas 258-264): detecta `AbortError` → `'Tiempo de espera agotado'`; llama `logAgent(agent, { event:'connection_test', ok:false, error })` antes de re-lanzar o retornar `{ ok:false, error }`.
  * **DTO de retorno:** `{ ok:boolean, simulated?:true, error?:string }`.

* **Gap 3 — Webhook body 413 (MEDIUM)** — [server.mjs](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/server.mjs) `readBody()` líneas 186-203 y `handleWebhook()`/routing.
  * Contrato: `readBody()` rechaza con un error tipado `PayloadTooLargeError` (no destruye el socket antes de responder); el handler traduce a `413` con `{ error:'Body demasiado grande' }` sin emitirl el 500 del catch general.
  * **DTO error:** `{ error: string }` con `status: 413`.

* **Gap 4 — `serveStatic` decode (LOW)** — [server.mjs](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/server.mjs) `serveStatic()` línea 300.
  * Contrato: envuelve `decodeURIComponent` en `try/catch` devolviendo `400` `{ error:'URL inválida' }`, coherente con el guard de `isAdminApiPath()` (líneas 222-227).
  * **DTO error:** `{ error: string }` con `status: 400`.

* **Gap 5 — Timeout `/api/tunnel` (LOW)** — [src/settings-composables.js](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/settings-composables.js) `fetchTunnel` (línea 408) y [src/live-connect-composables.js](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/live-connect-composables.js) línea 398.
  * Contrato: sustituir `fetch('/api/tunnel', …)` por `ZernioCrm.fetchWithTimeout('/api/tunnel', { cache:'no-store' }, 5000)`.
  * **DTO retorno:** `Response` con `{ url:string|null }` JSON.

* **Gap 6 — Handler global no capturado (LOW)** — [src/app.js](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/app.js).
  * Contrato [PROPOSAL]: en bootstrap (cerca de `detectServer()`), registrar `window.addEventListener('unhandledrejection', e => console.error('[unhandled]', e.reason))` y `window.addEventListener('error', …)` para visibilidad sin silenciar.

### Definition of Done (DoD)

- [x] Acceptance criteria covered by unit/integration tests (verificado por runtime)
- [x] Input/Output payload validation implemented
- [x] Pruebas manuales por caso ejecutadas y documentadas (ver "Verificación ejecutada")
- [x] Ningún `unhandledrejection` nuevo reproducido durante las pruebas
- [ ] Sin cambios de comportamiento en flujos happy-path (auto-respuesta, envío, polling intacto) — pendiente smoke test completo en live

### Verificación ejecutada (2026-08-20)

- **Gap 1 (runtime navegador):** patrón `boot().then(consumeCallback).catch(...)` con un `JSON.parse` corrupto dentro del `.then` → mensaje capturado y **0 `unhandledrejection`**.
- **Gap 2 (runtime navegador):** `ZernioCrm.testAgent()` live contra URL muerta (`127.0.0.1:1`) → escribe log `{event:'connection_test', ok:false, error}` en `agent.logs`, relanza error normalizado y **0 `unhandledrejection`**. Rama AbortError→mensaje amigable verificada por inspección (mismo patrón que `askAgent`).
- **Gap 3 (curl):** `POST /webhooks/zernio` con body >10 MB → **413** `{"error":"Body demasiado grande"}` (antes: reset de socket).
- **Gap 4 (curl):** `GET /index%zz` → **400**; `GET /index.html` → **200**.
- **Gap 5 (inspección + navegador):** ambos fetch a `/api/tunnel` usan `ZernioCrm.fetchWithTimeout(..., 5000)`; `fetchWithTimeout` confirmado expuesto en `ZernioCrm`.
- **Gap 6 (runtime navegador):** boot de la app limpio (sin errores en consola); handlers globales `unhandledrejection`/`error` registrados y activos.

## Phase 4: Risks & Open Questions

* **Risks:**
  1. *Tocar `readBody()` puede afectar el proxy* — el mismo `readBody` se podría reutilizar en `handleWebhook`; mitigación: no cambiar la firma (`Promise<Buffer>`), añadir solo un tipo de error más y capturarlo localmente en el receptor.
  2. *El catch global en app.js podría enmascarar bugs si solo loguea* — mitigación: solo `console.error`/registro, sin silenciar; mantener visibilidad en devtools.
  3. *`testAgent` re-levanta errores* — si se cambia para devolver `{ok:false}` en vez de lanzar, el caller existente (agents-composables `testConnection`, línea 147) depende del `throw` para mostrar el toast; mitigación: mantener el throw pero normalizado (mensaje amigable) para no romper la UI.

* **Open Questions / Decisions:**
  - ¿El handler global (`unhandledrejection`) debe además tostcar al usuario o solo registrar? Dueño: Robert/TreborJs · Fecha: próxima iteración.
  - Valor del timeout de `/api/tunnel` (5 s propuesto): confirmar si 5 s cubre el arranque de cloudflared. Dueño: Robert/TreborJs · Fecha: próxima iteración.

## Phase 5: Non-Functional Requirements

* **Performance:** **N/A** — los cambios añaden ≤2 `try/catch` y un timeout; sin impacto medible en latencia de los flujos existentes.
* **Security:** El manejador `unhandledrejection`/`error` NO debe loguear secretos (solo `e.reason`/`e.message`); no se exponen claves ni `MASTER_API_KEY`. Función `decodeURIComponent` ya protegida en rutas admin, se reutiliza el mismo criterio en `serveStatic`.
* **Reliability / Availability:** Timeout acotado de 5 s en `/api/tunnel` evita busy infinito; receptor webhook devuelve 413 explícito en vez de reset; retorno de estado de error JSON coherente (400/413). Medible: ninguna promesa no capturada en repro de cada caso.
* **Accessibility / Compatibility:** Los toasts de error ya usan el patrón existente del prototipo (nivel `'error'`); no introduce cambios visuales ni de navegación.