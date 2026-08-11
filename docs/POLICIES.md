# Políticas de cumplimiento — CRM MVP (Trebor Zernio)

Este documento consolida las políticas, criterios y cláusulas de la documentación
oficial de Zernio (`llms-full.txt`, `zernio-api-openapi.yaml`, rules del skill) que
aplica el MVP para mantener a los clientes seguros y dentro de los términos de las
plataformas de origen. Zernio actúa de intermediario: las reglas de Meta, TikTok,
Instagram y WhatsApp se aplican a través de su API.

## 1. Autenticación y seguridad de credenciales

- La API key se envía al servidor local por header `X-Zernio-Key` y se inyecta como
  `Authorization: Bearer` hacia Zernio. Nunca viaja al navegador del cliente final
  en producción (el proxy debe custodiar la key del lado servidor).
- Webhooks firmados con `X-Zernio-Signature` (HMAC-SHA256 del body crudo con el
  secret). El server rechaza firmas inválidas con 401.
- Invitaciones de equipo: tokens de un solo uso con expiración de 7 días
  (`POST /v1/invite/tokens`), igual que Zernio.
- CORS restringido a orígenes localhost en el servidor local; el feed de eventos
  de webhook no es legible desde sitios externos.

## 2. Rate limits y errores (errors.md)

| Plan | Peticiones/minuto |
|---|---|
| Free | 60 |
| Build | 120 |
| Accelerate | 600 |
| Unlimited | 1.200 |

- El cliente lee los headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` y
  `X-RateLimit-Reset`; ante `429` espera el reset y reintenta **una vez**; si
  persiste, muestra error tipado `RATE_LIMITED` sin volver a martillar el API.
- Errores tipados del envelope: `invalid_request_error`, `authentication_error`,
  `permission_error`, `not_found`, `rate_limit_error`, `platform_error`,
  `api_error` — la UI los muestra con mensaje accionable.
- Add-ons requeridos: **Inbox** (`403 Inbox addon required` sin él) y
  **Analytics** (banner si 403).

## 3. Mensajería y ventana de 24 horas (inbox.md / whatsapp.md)

- **WhatsApp:** fuera de la ventana de 24h solo se pueden enviar **plantillas
  aprobadas por Meta** (UTILITY/MARKETING/AUTHENTICATION). El MVP bloquea el
  envío libre fuera de ventana y lo deriva a Campañas con plantilla.
- **Instagram/Facebook:** fuera de la ventana de 24h se permite responder con
  `messagingType: "MESSAGE_TAG"` + `messageTag: "HUMAN_AGENT"`. La bandeja lo
  ofrece con un toggle explícito ("Enviar como agente humano").
- **TikTok:** Zernio no expone DM de TikTok (solo publicación). El canal se
  conecta para verificación y la bandeja muestra un estado explicativo con
  enlace de respuesta externa. No se promete mensajería inexistente.
- Límites de mensajería WhatsApp (TIER_250, quality rating, metaStatus) se
  exponen en el health check de la cuenta (`GET /accounts/{id}/health` y
  metadata del número).

## 4. Consentimiento y privacidad de contactos

- **Broadcasts:** solo a contactos **suscritos** (`segmentFilters.isSubscribed:
  true`). La UI lo indica explícitamente ("consentimiento") y permite filtrar por
  tag, nunca por lista completa no verificada.
- **Secuencias:** `exitOnReply` y `exitOnUnsubscribe` activos por defecto — un
  cliente que responde o se da de baja sale automáticamente del drip.
- **Instagram:** el perfil del participante (`isFollower`, `isFollowing`) solo se
  revela para personas que han escrito (regla de consentimiento de Meta); un
  valor ausente se trata como *desconocido*, nunca como "no te sigue".

## 5. Contenido y plantillas (whatsapp.md / posts.md)

- Plantillas personalizadas pasan revisión de Meta (hasta 24h) — el MVP muestra
  estado `PENDING/APPROVED/REJECTED` y solo permite campañas con plantillas
  APROBADAS.
- Nombre de plantillas: `^[a-z][a-z0-9_]*$`; el texto con variables `{{1}}` debe
  cumplir la relación longitud/variables de Meta (el API devuelve el error y la
  UI lo muestra).
- Flows publicados son inmutables: para editar se clona (`cloneFlowId`).

## 6. Webhooks (entrega at-least-once)

- Zernio entrega cada evento al menos una vez: el server y el frontend **deduplican
  por `event.id`** (o `message.id` para `message.received`).
- El receptor local verifica la firma HMAC con el secret (URL `?secret=...`);
  para entrega real se requiere URL pública HTTPS (túnel: `node tunnel.mjs`).
- Los eventos recibidos se reflejan en la bandeja (conversación creada/actualizada
  y mensaje entrante con su no-leído).

## 7. Retención y registro

- Logs de publicación retenidos 7 días por Zernio (`GET /v1/logs`).
- El prototipo no persiste datos de clientes fuera del navegador del propietario
  (localStorage) y del server local (cola de eventos en memoria, no persistente).

## 8. Cláusulas para futuras iteraciones (posting)

- COPPA: contenido dirigido a niños requiere `madeForKids: true` (YouTube) —
  no aplica al MVP actual (sin publicación).
- UX compliance de TikTok obligatorio antes de publicar (`GET
  /accounts/{id}/tiktok/creator-info`) — pendiente cuando se habilite posting.
- Políticas de contenido de cada plataforma aplican a publicaciones — fuera del
  alcance del MVP de mensajería.

## Modelo multi-tenant: centro de cuenta (Camino B)

- **Perfil por negocio:** cada negocio registrado crea su propio perfil en Zernio (`POST /profiles`) bajo la master key del centro. Un número = un perfil.
- **Sub-key scoped por negocio:** al elegir/crear el perfil, el MVP crea una sub-key con `scope: profiles` limitada a ese perfil, `permission: read-write` y `expiresIn: 90` días (`POST /api-keys`). Toda la operación diaria (bandeja, campañas, contactos) usa la sub-key; la master solo se usa para llamadas admin (crear perfiles/keys, `/usage`, `/billing`, `/phone-numbers`, `/accounts/health`, `/webhooks/logs`).
- **Revocación granular:** si un cliente abusa o deja de pagar, se revoca solo su sub-key (`DELETE /api-keys/{id}`, efecto inmediato) o se rota creando una nueva y revocando la anterior. El resto de negocios no se ve afectado.
- **Límite operativo: 1 número por negocio.** El MVP bloquea una segunda vinculación (modal de reemplazo) y desconecta el número anterior antes de conectar uno nuevo. La rotación/expiración de la sub-key se avisa en Configuración.
- **Detección de abuso:** medidor local en server.mjs (data/usage.json) que cuenta llamadas por key (hash, sin persistir secretos); el panel Billing cruza ese medidor con el snapshot oficial de Zernio (`GET /usage`, `GET /billing`). El snapshot de Zernio es la fuente oficial de facturación; el medidor es aproximado (1 request = 1 llamada).
- **Estados y salud:** `GET /whatsapp/phone-numbers` (comprados vs bring-your-own), `GET /accounts/health`, `GET /webhooks/logs` (retención 7 días) y el evento webhook `account.disconnected` marca el canal para reconectar.
- **Bring-your-own (Camino B):** el número es del cliente (WABA propia conectada con token de System User). No se factura el número al centro; solo el uso de la API según el plan. `registrationWarning` indica registro pendiente en Meta (no puede enviar mensajes hasta resolverlo).
- **Seguridad de claves:** la master key nunca se persiste en demo-data ni se muestra completa en la UI (enmascarada); la sub-key viaja solo por el proxy local o localStorage del origin del negocio.
