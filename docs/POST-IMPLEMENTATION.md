# Instrucciones post-implementación — CRM MVP (Trebor Zernio) · v2

## Cómo abrir el prototipo

**Modo demo (sin servidor):** abre `index.html` directo por file://. Todo funciona con datos simulados en localStorage.

**Modo live (recomendado):** corre el servidor ligero incluido (sin dependencias):

```bash
node server.mjs            # sirve en http://localhost:8787 (PORT=8787, configurable con env PORT)
```

Abre `http://localhost:8787/index.html`. El servidor hace tres cosas:
1. Sirve los estáticos de la raíz.
2. **Proxy anti-CORS:** `/zernio/*` → `https://zernio.com/api/v1/*`, inyectando la key que envía el browser por el header `X-Zernio-Key`. Resuelve CORS y mantiene la key fuera del tránsito hacia internet.
3. **Receptor de webhooks:** `POST /webhooks/zernio?secret=...` con verificación HMAC-SHA256 (`x-zernio-signature`); los eventos quedan en memoria y el frontend hace polling de `GET /webhooks/events` cada 15 s.

El frontend detecta el servidor con `GET /api/health` y activa automáticamente el modo proxy.

## Flujo live completo

1. **Onboarding → paso WhatsApp → "¿Ya usas Zernio? Conecta tu API key"** (o Configuración → Canal WhatsApp → Reconectar):
   - Pega tu API key (`sk_…` de zernio.com/dashboard/api-keys) → `GET /profiles` valida.
   - Selecciona un perfil existente o crea uno con el nombre del negocio (`POST /profiles`).
   - Zernio detecta tu **cuenta WhatsApp existente** (`GET /accounts?profileId=`) y tus **números provisionados** (`GET /whatsapp/phone-numbers`) para que elijas.
   - Alternativa headless: conecta por credenciales de Meta (`POST /connect/whatsapp/credentials`: wabaId, phoneNumberId, token).
2. El workspace queda en modo live: `workspace.zernio = { profileId, accountId, phone }`.
3. **Verificación del canal:** Configuración → Canal WhatsApp → *Health check* (`GET /accounts/{id}/health`); desconexión real (`DELETE /accounts/{id}`).

## Seguridad (prototipo)

- La key vive en localStorage del browser y viaja al proxy local por header. En producción el proxy debe guardar la key del lado servidor (env/secret store) y el cliente no debe conocerla.
- El webhook usa un `secret` en la URL (`?secret=...`): aceptable en localhost; en producción usa HTTPS + túnel y no expongas el secret en logs.
- No hay autenticación real de usuarios: el switch de sesión simula roles (RBAC) localmente.

## Módulos y endpoints reales usados

| Módulo | Endpoints Zernio | Notas |
|---|---|---|
| Conexión | `GET /profiles`, `POST /profiles`, `GET /accounts`, `GET /whatsapp/phone-numbers`, `POST /connect/whatsapp/credentials` | OAuth Embedded Signup requiere callback público; credenciales es la vía headless |
| Bandeja | `GET /inbox/conversations`, `POST /inbox/conversations/{id}/messages` | Requiere add-on **Inbox** (403 sin él); en modo live usa el botón Sincronizar |
| Plantillas | `GET/POST /whatsapp/templates` | Custom (revisión de Meta, hasta 24h) o desde el library (`library_template_name`, pre-aprobada) |
| Broadcasts | `GET/POST /broadcasts`, `POST /{id}/recipients`, `/send`, `/schedule`, `GET /{id}/recipients` | WhatsApp exige plantilla aprobada fuera de la ventana de 24h |
| Secuencias | `GET/POST /sequences`, `POST /{id}/activate\|pause\|enroll`, `GET /{id}/enrollments` | exitOnReply/exitOnUnsubscribe por defecto |
| Flows | `GET/POST /whatsapp/flows`, `PUT /{id}/json`, `POST /{id}/publish`, `POST /whatsapp/flows/send` | Publicados son inmutables: clonar para editar (`cloneFlowId`) |
| Analítica | `GET /analytics/daily-metrics`, `GET /accounts/follower-stats`, `GET /analytics/best-time` | Requiere add-on **Analytics** (banner si 403) |
| Webhooks | `GET/POST/PUT/DELETE /webhooks/settings`, `POST /webhooks/test`, `GET /webhooks/logs` | Eventos: message.received, post.published/failed/partial, account.connected/disconnected |
| Equipo | `GET /users`, `POST /invite/tokens` | Roles owner/admin/member en Zernio; el RBAC del MVP es local |

## Webhooks en producción (entrega real)

Localmente la entrega se simula con polling del servidor. Para entrega real:

```bash
node tunnel.mjs        # túnel HTTPS público (cloudflared quick tunnel, sin cuenta)
```

1. `node tunnel.mjs` imprime y guarda la URL pública (`https://<rand>.trycloudflare.com`) en `.tunnel-url`.
2. En Configuración → Webhooks pulsa **"URL pública"** (obtiene la URL del túnel desde `/api/tunnel`) y **Suscribir** — el MVP actualiza la suscripción real en Zernio (`PUT /webhooks/settings`) con la URL https + secret.
3. Zernio firmará cada POST con `x-zernio-signature` (HMAC-SHA256 del body con el secret); el server rechaza firmas inválidas con 401 y **deduplica por `event.id`** (entrega at-least-once).
4. Cuando alguien te escribe, el evento `message.received` se refleja automáticamente en la bandeja (conversación creada/actualizada + mensaje entrante).

Instalación de cloudflared (1 línea): `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/.local/bin/cloudflared && chmod +x ~/.local/bin/cloudflared`.

## Canales multicanal (WhatsApp, Instagram, TikTok)

- **Módulo Canales** (`#/channels`): estado por plataforma, conexión/reconexión con `live-connect` por plataforma, health check y desconexión. RBAC: solo owner/admin.
- **WhatsApp**: se conecta en el onboarding (cuentas existentes, números Zernio o credenciales Meta).
- **Instagram**: mensajería real vía inbox de Zernio. Conexión por OAuth (`GET /connect/instagram?profileId=`) — abre la autorización y verifica con `GET /accounts`.
- **TikTok**: Zernio NO expone DM de TikTok (solo publicación). Se conecta para verificación y la bandeja muestra un estado explicativo con enlace externo; no se promete mensajería inexistente.
- La bandeja tiene pestañas por plataforma, distintivo de canal en cada conversación (icono+color), perfil de Instagram del participante (`isFollower`) y envío con el accountId de cada canal.

## Políticas y cumplimiento

Ver `docs/POLICIES.md`: rate limits por plan con retry 429, ventana de 24h (WhatsApp → plantillas; IG/FB → `HUMAN_AGENT`), consentimiento en broadcasts (`isSubscribed`), dedupe de webhooks por id, reglas de plantillas/Flows y cláusulas futuras (COPPA, TikTok UX compliance).

## Arquitectura del código (v3)

```
server.mjs                  → servidor ligero: estáticos + proxy /zernio/* + webhook receiver (0 deps)
tunnel.mjs                  → túnel HTTPS público (cloudflared/ngrok) para webhooks reales
index.html                  → shell + CDNs + orden de scripts
src/constants.js            → nichos, RBAC (incluye analytics y channels), PLATFORMS, iconos, helpers
src/store.js                → estado global + serverMode + detectServer() + webhookEvents + reflectIncomingMessage
src/data/storage.js         → localStorage namespaced + persistencia automática
src/data/demo-data.js       → generador de workspace demo por nicho (multicanal)
src/services/zernio-api.js  → cliente API v3: 40+ endpoints, serverMode/directo, retry 429, sanitizeBody
src/components/ui.js        → primitivas (modal, toast, spinner, badge, stepper, empty…)
src/components/live-connect.js → conexión por plataforma: key → perfiles → cuentas (OAuth IG/TikTok)
src/components/onboarding.js  → wizard 8 pasos + panel de conexión real con Zernio
src/components/dashboard.js   → resumen full-width
src/components/analytics.js   → métricas diarias, heatmap, export CSV
src/components/inbox.js       → bandeja multicanal (filtros por plataforma, badges, HUMAN_AGENT)
src/components/contacts.js    → directorio con campos del nicho
src/components/channels.js    → módulo de Canales (estado, conexión, health, desconexión)
src/components/team.js        → miembros + matriz de permisos
src/components/broadcasts.js  → tabs: broadcasts/secuencias/flows (plantillas aprobadas obligatorias)
src/components/settings.js    → branding, integración, canal, webhooks (URL pública), datos
src/app.js                  → bootstrap, routing + guards RBAC, detección de servidor, polling webhooks
docs/POLICIES.md            → políticas y cumplimiento de la documentación de Zernio
```

## Roadmap de evolución sugerido (siguiente iteración)

1. Backend real (NestJS/Express) reemplazando `server.mjs` — mismo contrato de rutas `/zernio/*` y `/webhooks/*` para migración casi directa.
2. Gestión de keys del lado servidor + autenticación real (Clerk/Supabase).
3. OAuth Embedded Signup completo de WhatsApp con callback público (headless ya soportado por credenciales).
4. Webhooks persistentes (SQLite/Redis en vez de cola en memoria) y retry con backoff.
5. Pago de números Zernio (Stripe Checkout de `/whatsapp/phone-numbers/purchase`) desde el onboarding.
6. Multi-canal (Instagram, Telegram) reutilizando la bandeja unificada.
7. Analítica avanzada por nicho (post-timeline, content-decay) y dashboards exportables.

## Datos demo

localStorage (`tzcrm.workspaces`, `tzcrm.session`). Reset desde Configuración → Datos; exportación JSON disponible. Los eventos de webhook viven solo en memoria del servidor (se pierden al reiniciarlo) — suficiente para el prototipo.

## Iteración 4 — Camino B multi-negocio: sub-keys, billing y estados

**Nuevo flujo de registro (live-connect):** pegas la master key del centro → se elige o crea el perfil del negocio (`POST /profiles`) → se crea y activa una sub-key scoped a ese perfil (`POST /api-keys`, expiración 90 días) → conexión WhatsApp por credenciales de Meta (Camino B, bring-your-own). La sub-key aísla el negocio: solo ve su perfil, y se puede revocar individualmente.

**Módulos nuevos:**
- `#/billing` (src/components/billing.js): snapshot de la cuenta Zernio con la master (plan, gasto del período vs límite, llamadas por operación con precios de `/billing/x-pricing`, statement de `/billing`) + medidor local por negocio (server.mjs cuenta cada request del proxy en `data/usage.json` por hash de key; gráfico de 30 días y tabla por endpoint).
- `#/system` (src/components/system.js): números WhatsApp del centro (comprados facturables vs bring-your-own sin facturar), salud de cuentas (`/accounts/health`) y logs de entrega de webhooks (`/webhooks/logs`).

**Seguridad anti-abuso:** límite de 1 número por negocio (modal de reemplazo que desconecta el anterior), rotación/revocación de sub-key en Configuración → Credenciales del centro, evento `account.disconnected` marca el canal "Reconectar", y la master key nunca se expone completa ni en demo-data.

**Servidor:** `GET /api/usage?ws=<hash>` devuelve el medidor del workspace; `GET /api/usage` (sin query) devuelve todos (centro). El medidor persiste con debounce de 2 s y se escribe en `data/usage.json` (ignorado por git).
