# Instrucciones post-implementación — CRM MVP (Trebor Zernio)

## Cómo abrir el prototipo

No requiere build ni servidor: abre `index.html` directamente en el navegador (file://).
Los scripts clásicos y el localStorage funcionan sin servidor. Opcionalmente puedes servirlo
con `python3 -m http.server` o `npx serve` desde la raíz del repositorio.

Flujo inicial:

1. `index.html` → onboarding en 8 pasos (nicho → foco → branding → referencia → roadmap → WhatsApp → equipo).
2. Al finalizar se crea un workspace demo sembrado por el nicho elegido (contactos, conversaciones, usuarios, plantillas).
3. Desde la sidebar puedes cambiar de usuario de sesión (demo de RBAC: propietario, admin, agente, vendedor)
   y validar que cada rol solo ve lo que puede operar.

## Modo demo vs modo live

- **Demo (default):** todo funciona con datos simulados en localStorage. El envío de mensajes en la
  bandeja genera respuestas entrantes simuladas y estados delivery/leído.
- **Live:** en `Configuración → Integración Zernio` pega tu API key (`sk_…`, de zernio.com/dashboard/api-keys)
  y guarda. El prototipo intentará llamadas reales a `https://zernio.com/api/v1`.
  Si el navegador no puede alcanzar el API por CORS, degrada automáticamente a demo con banner de aviso.

**Importante (CORS):** un API diseñado para servidores puede no permitir peticiones desde el navegador.
Para producción real se debe exponer un backend proxy (ej. Express/Cloudflare Worker) que guarde la key
y reenvíe al API, evitando además exponer la key en el cliente.

## Seguridad (solo prototipo)

- La API key se guarda en localStorage en texto plano. Nunca hagas esto en producción.
- No hay autenticación real: el switch de sesión simula distintos roles localmente.

## Conexión real de WhatsApp (Zernio)

El onboarding simula las 3 modalidades. En producción:

1. **Cloud API (OAuth / Embedded Signup):** `GET /v1/connect/whatsapp?profileId=&headless=true` devuelve
   `authUrl`; tras autorizar, si la WABA tiene 2+ números usa
   `GET/POST /v1/connect/whatsapp/select-phone-number` para vincular uno.
2. **Credenciales Meta:** `POST /v1/connect/whatsapp/credentials` con `wabaId`, `phoneNumberId` y `token`
   (obtenidos en Meta Business Suite). Es la alternativa headless sin navegador.
3. **Número Zernio (Telnyx):** `GET/POST /v1/whatsapp/phone-numbers` con pago vía Stripe Checkout;
   Zernio aprovisiona y pre-verifica el número automáticamente.

Luego: `GET /v1/accounts?profileId=` para obtener el `accountId` de la cuenta WhatsApp y usarlo en
`/v1/inbox/conversations/{id}/messages` (envío) y `/v1/whatsapp/templates` (plantillas).

## Limitaciones conocidas del API relevantes al MVP

- **Inbox add-on:** los endpoints `/v1/inbox/*` devuelven `403 Inbox addon required` sin el add-on
  contratado en Zernio.
- **Ventana de 24h:** fuera de ella solo se pueden enviar plantillas aprobadas por Meta
  (categoría UTILITY/MARKETING); las plantillas personalizadas pasan por revisión (hasta 24h).
- **Recepción de mensajes:** en producción se recomienda suscribir webhooks (`message.received`,
  `conversation.updated`) — requieren una URL pública. Sin webhooks, la bandeja depende de polling
  de `GET /v1/inbox/conversations`.
- **Broadcasts y secuencias:** el MVP lista y simula; los endpoints reales son `POST /v1/broadcasts`
  y `/v1/sequences` (drip + comment-to-DM).

## Arquitectura del código

```
index.html                 → shell + CDNs (Vue 3 global, Tailwind Play) + orden de scripts
src/constants.js           → nichos (7 + genérico), matriz RBAC, roadmap engine, iconos
src/store.js               → estado reactivo global (workspace, sesión, modo, toasts)
src/data/storage.js        → localStorage namespaced + persistencia automática del store
src/data/demo-data.js      → generador de workspace demo por nicho
src/services/zernio-api.js → cliente del API v1 (endpoints usados + detección CORS)
src/components/ui.js       → primitivas (modal, toast, spinner, badge, avatar, stepper…)
src/components/*.js        → vistas: onboarding, dashboard, inbox, contacts, team, broadcasts, settings
src/app.js                 → bootstrap, routing por hash, guards RBAC, shell
```

Reglas aplicadas: componentes como objetos `{ template, setup }` registrados en `window.ZernioCrm.components`,
sin ES modules (compatibilidad file://), JSDoc en ficheros nuevos, guard clauses, temporizadores de
simulaciones con cleanup en `onUnmounted`, persistencia automática vía watchers.

## Roadmap de evolución sugerido

1. Backend proxy + autenticación real (Clerk/Supabase) y migración de la capa de datos a `fetch`.
2. Conexión WhatsApp real con las 3 modalidades y estado verificado vía `GET /v1/accounts`.
3. Webhooks de Zernio para mensajes entrantes en tiempo real.
4. Plantillas de WhatsApp desde `/v1/whatsapp/templates` con estado de aprobación real.
5. Broadcasts y secuencias reales; flujos de WhatsApp (Forms) para captura de leads por nicho.
6. Multi-canal (Instagram, Telegram) reutilizando la bandeja unificada.
7. Analítica por nicho con `/v1/analytics` y exportación de datos.

## Datos demo

Los datos viven en localStorage (`tzcrm.workspaces`, `tzcrm.session`). Reset total desde
`Configuración → Datos → Reset de datos demo`; exportación JSON disponible en el mismo apartado.
