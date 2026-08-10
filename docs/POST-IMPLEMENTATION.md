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
1. `npx ngrok http 8787` → URL pública `https://xxxx.ngrok.io`.
2. En Configuración → Webhooks, usa la URL `https://xxxx.ngrok.io/webhooks/zernio?secret=<tu-secret>` y suscríbete a los eventos.
3. Zernio firmará cada POST con `x-zernio-signature` (HMAC-SHA256 del body con el secret); el server rechaza firmas inválidas con 401.

## Arquitectura del código (v2)

```
server.mjs                  → servidor ligero: estáticos + proxy /zernio/* + webhook receiver (0 deps)
index.html                  → shell + CDNs + orden de scripts (añade live-connect.js y analytics.js)
src/constants.js            → nichos, RBAC (incluye módulo analytics), iconos, helpers
src/store.js                → estado global + serverMode + detectServer() + webhookEvents
src/data/storage.js         → localStorage namespaced + persistencia automática
src/data/demo-data.js       → generador de workspace demo por nicho
src/services/zernio-api.js  → cliente API v2: 40+ endpoints, routing serverMode/directo, errores tipados
src/components/ui.js        → primitivas (modal, toast, spinner, badge, stepper, empty…)
src/components/live-connect.js → sub-flujo key → perfiles → cuentas/números (reutilizable)
src/components/onboarding.js  → wizard 8 pasos + panel de conexión real con Zernio
src/components/dashboard.js   → resumen full-width (KPIs, canal, acciones, roadmap, actividad)
src/components/analytics.js   → métricas diarias (barras), heatmap de horarios, export CSV
src/components/inbox.js       → bandeja full-viewport con sincronización live
src/components/contacts.js    → directorio con campos del nicho
src/components/team.js        → miembros + matriz de permisos (2 columnas)
src/components/broadcasts.js  → tabs: broadcasts (live/demo), secuencias, flows de WhatsApp
src/components/settings.js    → branding, integración (key/test), canal (health/reconexión), webhooks, datos
src/app.js                  → bootstrap, routing hash + guards RBAC, detección de servidor, polling webhooks
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
