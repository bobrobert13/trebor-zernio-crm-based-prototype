/**
 * @file zernio-api.js — Cliente del API de Zernio (https://zernio.com/api/v1).
 * Envuelve los endpoints necesarios para el MVP (WhatsApp, inbox, contactos,
 * broadcasts) con detección de bloqueo CORS: si el navegador no puede llegar
 * al API, la app degrada a modo demo (ver ZernioCrm.flagCorsBlocked).
 */
(function () {
  'use strict';

  const { ZernioCrm } = window;

  /** Base del API v1 de Zernio. */
  const BASE_URL = 'https://zernio.com/api/v1';

  /**
   * Master key del centro (constante del MVP): siempre disponible por detrás
   * para las llamadas admin (perfiles, sub-keys, billing). Los espacios de
   * trabajo operan con su sub-key (aislada al perfil, revocable); la master
   * nunca se pide al usuario ni se persiste en el workspace.
   */
  const MASTER_API_KEY = 'sk_8e0a02f95e72dc385ac4855fc0394e0471dd5b7b724d3cd60c59d77af814f625';

  /** Error tipado del API: message, type (envelope de Zernio) y code. */
  class ApiError extends Error {
    /**
     * @param {string} message — mensaje humano.
     * @param {string} [type='api_error'] — clase de error (envelope Zernio).
     * @param {string} [code=''] — código estable.
     */
    constructor(message, type = 'api_error', code = '') {
      super(message);
      this.name = 'ApiError';
      this.type = type;
      this.code = code;
    }
  }

  /**
   * Elimina recursivamente propiedades con valor null/undefined de un body
   * (el API rechaza campos string que llegan como null).
   * @param {*} value — valor a sanitizar.
   * @returns {*} Valor sin null/undefined.
   */
  function sanitizeBody(value) {
    if (Array.isArray(value)) return value.map(sanitizeBody);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).filter(([, v]) => v != null).map(([k, v]) => [k, sanitizeBody(v)]));
    }
    return value;
  }

  /** Cliente HTTP del API de Zernio. */
  class ZernioApiClient {
    /**
     * @param {string} [baseUrl=BASE_URL] — URL base del API.
     */
    constructor(baseUrl = BASE_URL) {
      this.baseUrl = baseUrl;
    }

    /**
     * Ejecuta una petición autenticada al API.
     * En modo servidor (server.mjs) la key viaja en X-Zernio-Key hacia el
     * proxy local; en modo directo va en Authorization hacia zernio.com.
     * Por defecto usa la key operativa (sub-key del negocio); las llamadas
     * admin ({ admin: true }) usan la master key del centro (constante, nunca
     * se pide al usuario).
     * @param {string} path — ruta (ej. '/profiles').
     * @param {{method?:string, query?:object, body?:object, admin?:boolean}} [options={}] — opciones.
     * @returns {Promise<object>} Respuesta JSON.
     * @throws {ApiError} Error tipado (CORS_BLOCKED o SERVER_UNREACHABLE según modo).
     */
    async request(path, { method = 'GET', query, body, admin = false } = {}) {
      const serverMode = ZernioCrm.store.serverMode;
      // Admin: master del centro (constante). Operativo: sub-key del negocio
      const key = admin ? MASTER_API_KEY : ZernioCrm.store.apiKey;
      const url = new URL(serverMode ? `${location.origin}/zernio${path}` : `${this.baseUrl}${path}`);
      // Nunca mandar query params vacíos (el API los rechaza como formato inválido)
      if (query) Object.entries(query).forEach(([k, v]) => v != null && v !== '' && url.searchParams.set(k, v));

      const headers = serverMode
        ? { 'X-Zernio-Key': key }
        : { Authorization: `Bearer ${key}` };
      if (body) headers['Content-Type'] = 'application/json';

      let response;
      try {
        response = await fetch(url, { method, headers, body: body ? JSON.stringify(sanitizeBody(body)) : undefined });
        // Rate limit (política de Zernio): espera el reset del header y reintenta 1 vez
        if (response.status === 429) {
          const reset = response.headers.get('X-RateLimit-Reset');
          const waitMs = reset ? Number(reset) * 1000 - Date.now() : 1000;
          await new Promise((r) => setTimeout(r, Math.max(waitMs, 1000)));
          response = await fetch(url, { method, headers, body: body ? JSON.stringify(sanitizeBody(body)) : undefined });
        }
      } catch {
        if (serverMode) {
          throw new ApiError('No se pudo conectar con el servidor local. Ejecuta: node server.mjs', 'server_unreachable', 'SERVER_UNREACHABLE');
        }
        ZernioCrm.flagCorsBlocked();
        throw new ApiError('No se pudo conectar con Zernio (CORS o red). Cambiaste a modo demo.', 'cors_blocked', 'CORS_BLOCKED');
      }

      if (!response.ok) {
        const envelope = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new ApiError('Límite de peticiones alcanzado (rate limit del plan). Intenta en un minuto.', 'rate_limit_error', 'RATE_LIMITED');
        }
        throw new ApiError(envelope.error || `Error ${response.status}`, envelope.type || 'api_error', envelope.code || String(response.status));
      }
      try {
        return await response.json();
      } catch {
        throw new ApiError('El servidor devolvió una respuesta no válida', 'invalid_json');
      }
    }

    /** Valida la API key listando los perfiles. */
    testConnection() {
      return this.request('/profiles');
    }

    /**
     * Perfiles (marcas/proyectos) de Zernio.
     * @param {boolean} [admin=false] — true para listar con la master del centro
     *   (todos los perfiles; útil cuando aún no hay sub-key, ej. onboarding).
     *   Con la sub-key del espacio solo devuelve los perfiles del negocio.
     * @returns {Promise<Array<object>>} Perfiles.
     */
    getProfiles(admin = false) {
      return this.request('/profiles', { admin });
    }

    /**
     * Crea un perfil (marca) en Zernio. Solo la master key del centro puede
     * crear perfiles (cada negocio = un perfil aislado).
     * @param {string} name — nombre del perfil.
     * @returns {Promise<object>} Perfil creado.
     */
    createProfile(name) {
      return this.request('/profiles', { method: 'POST', admin: true, body: { name } });
    }

    /**
     * Cuentas sociales conectadas.
     * @param {string} profileId — id del perfil.
     * @returns {Promise<Array<object>>} Cuentas conectadas.
     */
    getAccounts(profileId) {
      return this.request('/accounts', { query: { profileId } });
    }

    /**
     * Inicia el flujo OAuth de WhatsApp (Embedded Signup de Meta, guiado y
     * sin configuración técnica para el cliente).
     * @param {string} profileId — id del perfil.
     * @param {string} [redirectUrl] — URL absoluta donde Zernio devuelve el
     *   resultado (connected=whatsapp&accountId=…) al completar.
     * @returns {Promise<{authUrl?:string, url?:string}>} URL de autorización.
     */
    getWhatsAppConnectUrl(profileId, redirectUrl) {
      return this.request('/connect/whatsapp', { query: { profileId, ...(redirectUrl ? { redirect_url: redirectUrl } : {}) } });
    }

    /**
     * Inicia el flujo OAuth de una plataforma (Instagram, TikTok, etc.).
     * @param {string} platform — id de plataforma (ruta /connect/{platform}).
     * @param {string} profileId — id del perfil.
     * @returns {Promise<{url?:string, authUrl?:string}>} URL de autorización.
     */
    getConnectUrl(platform, profileId) {
      return this.request(`/connect/${platform}`, { query: { profileId } });
    }

    /**
     * Conexión headless de WhatsApp con credenciales de Meta.
     * @param {string} profileId — id del perfil.
     * @param {{wabaId:string, phoneNumberId:string, token:string}} credentials — credenciales WABA.
     * @returns {Promise<object>} Cuenta social conectada.
     */
    connectWhatsAppCredentials(profileId, credentials) {
      return this.request('/connect/whatsapp/credentials', { method: 'POST', body: { profileId, ...credentials } });
    }

    /**
     * Números WhatsApp (Zernio/Telnyx) del workspace.
     * Grupo de recurso telephony (no admin): lo resuelve la sub-key del espacio.
     * @param {string} [profileId] — filtra por perfil (recomendado).
     * @returns {Promise<Array<object>>} Números provisionados.
     */
    listPhoneNumbers(profileId) {
      return this.request('/whatsapp/phone-numbers', { query: { profileId } });
    }

    /**
     * Números disponibles de una WABA multi-número (tras OAuth de WhatsApp).
     * Solo llega a este paso cuando el callback trae step=select_phone_number.
     * @param {string} profileId — id del perfil.
     * @param {string} tempToken — token temporal del callback headless.
     * @returns {Promise<Array<object>>} Números con display_phone_number, verified_name, quality_rating.
     */
    listConnectPhoneNumbers(profileId, tempToken) {
      return this.request('/connect/whatsapp/select-phone-number', { query: { profileId, tempToken } });
    }

    /**
     * Vincula un número elegido de la WABA al perfil de Zernio.
     * @param {{profileId:string, tempToken:string, phoneNumberId:string}} payload — selección.
     * @returns {Promise<object>} Cuenta social creada.
     */
    selectConnectPhoneNumber({ profileId, tempToken, phoneNumberId }) {
      return this.request('/connect/whatsapp/select-phone-number', { method: 'POST', body: { profileId, tempToken, phoneNumberId } });
    }

    // ── Admin: sub-keys por negocio (centro) ────────────────────────────────

    /** @returns {Promise<Array<object>>} Sub-keys creadas (solo previews). */
    listApiKeys() {
      return this.request('/api-keys', { admin: true });
    }

    /**
     * Crea una sub-key scoped a un perfil (aislamiento por negocio).
     * El valor completo se devuelve UNA sola vez (guardarlo inmediatamente).
     * @param {{name:string, profileIds:Array<string>, permission?:string, expiresIn?:number}} opts — opciones.
     * @returns {Promise<object>} Sub-key creada (apiKey.key único).
     */
    createApiKey({ name, profileIds = [], permission = 'read-write', expiresIn = 90 }) {
      return this.request('/api-keys', {
        method: 'POST',
        admin: true,
        body: { name, scope: 'profiles', profileIds, permission, expiresIn },
      });
    }

    /**
     * Revoca una sub-key de forma permanente (efecto inmediato).
     * @param {string} keyId — id de la sub-key.
     * @returns {Promise<object>} Confirmación.
     */
    revokeApiKey(keyId) {
      return this.request(`/api-keys/${keyId}`, { method: 'DELETE', admin: true });
    }

    // ── Billing y consumo (sub-key del negocio → solo su perfil) ─────────────
    // /usage y /billing son a nivel de cuenta (key): con la sub-key scoped del
    // workspace (scope: profiles) el consumo queda aislado al perfil del negocio.
    // Sin sub-key operativa se cae al master key del centro (demo/legacy).

    /**
     * Snapshot de plan, límites y gasto (endpoint moderno con rango).
     * @param {string} [range='30d'] — rango (ej. '7d', '30d').
     * @returns {Promise<object>} Plan, límites, uso por operación y spend.
     */
    getUsage(range = '30d') {
      return this.request('/usage', { query: { range }, admin: !ZernioCrm.store.apiKey });
    }

    /** @returns {Promise<object>} Statement de billing (balance, créditos, caps, estado de pago). */
    getBilling() {
      return this.request('/billing', { admin: !ZernioCrm.store.apiKey });
    }

    /** @returns {Promise<object>} Precios por operación (resuelve claves de xApiCallsByOperation). */
    getBillingPricing() {
      return this.request('/billing/x-pricing', { admin: !ZernioCrm.store.apiKey });
    }

    /** @returns {Promise<object>} Snapshot legado (deprecado; fallback de getUsage). */
    getUsageStatsLegacy() {
      return this.request('/usage-stats', { admin: !ZernioCrm.store.apiKey });
    }

    /** @returns {Promise<Array<object>>} Health de todas las cuentas del centro (master key; módulo Estados). */
    getAccountsHealth() {
      return this.request('/accounts/health', { admin: true });
    }

    /**
     * Conversaciones unificadas (requiere add-on Inbox; 403 sin él).
     * @param {{profileId?:string, platform?:string, status?:string, limit?:number}} [query={}] — filtros.
     * @returns {Promise<{items:Array<object>}>} Conversaciones.
     */
    listConversations(query = {}) {
      return this.request('/inbox/conversations', { query: { limit: 50, ...query } });
    }

    /**
     * Mensajes de una conversación.
     * @param {string} conversationId — id de la conversación.
     * @param {string} accountId — cuenta WhatsApp (REQUERIDA por el API como query).
     * @returns {Promise<Array<object>>} Mensajes.
     * @throws {ApiError} Si falta accountId (guard claro antes de llamar).
     */
    listMessages(conversationId, accountId) {
      if (!accountId) {
        throw new ApiError('No hay cuenta WhatsApp vinculada: reconecta en Configuración → Canal WhatsApp', 'missing_required_field', 'ACCOUNT_REQUIRED');
      }
      return this.request(`/inbox/conversations/${conversationId}/messages`, { query: { accountId } });
    }

    /**
     * Envía un mensaje por la bandeja unificada.
     * @param {string} conversationId — id de la conversación.
     * @param {{accountId:string, message:string, quickReplies?:Array<object>}} payload — contenido.
     * @returns {Promise<object>} Mensaje creado.
     */
    sendMessage(conversationId, payload) {
      return this.request(`/inbox/conversations/${conversationId}/messages`, { method: 'POST', body: payload });
    }

    /**
     * Envía una plantilla aprobada DENTRO de una conversación existente.
     * Es la única vía para re-enganchar un hilo de WhatsApp fuera de la
     * ventana de 24 h (payload `template.elements[]` del endpoint de mensajes).
     * Verificado en zernio-api-openapi.yaml (sendInboxMessage): el campo
     * `template` con `elements[]` transporta la plantilla de WhatsApp.
     * @param {string} conversationId — id de la conversación.
     * @param {{accountId:string, template:{elements:Array<object>}}} payload — plantilla.
     * @returns {Promise<object>} Mensaje creado.
     */
    sendTemplate(conversationId, payload) {
      return this.request(`/inbox/conversations/${conversationId}/messages`, { method: 'POST', body: payload });
    }

    /**
     * Abre una conversación NUEVA de WhatsApp con una plantilla aprobada
     * (WhatsApp no permite mensajes libres para iniciar un hilo).
     * Verificado en zernio-api-openapi.yaml (createInboxConversation): el
     * endpoint acepta templateName/templateLanguage/templateParams con el
     * teléfono en participantId; sin plantilla devuelve TEMPLATE_REQUIRED.
     * @param {{accountId:string, participantId:string, templateName:string, templateLanguage?:string, templateParams?:Array<string>}} payload — datos.
     * @returns {Promise<object>} Conversación creada.
     */
    createConversationWithTemplate(payload) {
      return this.request('/inbox/conversations', { method: 'POST', body: payload });
    }

    /**
     * Contactos con filtros.
     * @param {{profileId?:string, search?:string, tag?:string, limit?:number}} [query={}] — filtros.
     * @returns {Promise<Array<object>>} Contactos.
     */
    listContacts(query = {}) {
      return this.request('/contacts', { query: { limit: 200, ...query } });
    }

    /**
     * Crea un contacto (con canal opcional).
     * @param {object} payload — perfil del contacto (name, phone, tags, customFields…).
     * @returns {Promise<object>} Contacto creado.
     */
    createContact(payload) {
      return this.request('/contacts', { method: 'POST', body: payload });
    }

    /**
     * Definiciones de campos personalizados.
     * @param {string} [profileId] — filtra por perfil.
     * @returns {Promise<Array<object>>} Campos personalizados.
     */
    listCustomFields(profileId) {
      return this.request('/custom-fields', { query: { profileId } });
    }

    /**
     * Crea una definición de campo personalizado.
     * @param {object} payload — { profileId, name, type, options? }.
     * @returns {Promise<object>} Campo creado.
     */
    createCustomField(payload) {
      return this.request('/custom-fields', { method: 'POST', body: payload });
    }

    /**
     * Plantillas de mensaje de WhatsApp (vienen de Meta Cloud API).
     * @param {string} accountId — cuenta WhatsApp conectada.
     * @returns {Promise<Array<object>>} Plantillas.
     */
    listTemplates(accountId) {
      return this.request('/whatsapp/templates', { query: { accountId } });
    }

    /**
     * Crea una plantilla de WhatsApp (custom con componentes o desde el library de Meta).
     * @param {object} payload — { accountId, name, category, language, components? | library_template_name? }.
     * @returns {Promise<object>} Plantilla creada (estado PENDING/APPROVED).
     */
    createTemplate(payload) {
      return this.request('/whatsapp/templates', { method: 'POST', body: payload });
    }

    // ── Analytics ────────────────────────────────────────────────────────────

    /**
     * Métricas diarias agregadas (requiere add-on analytics).
     * @param {{profileId?:string, platform?:string, granularity?:string}} [query={}] — filtros.
     * @returns {Promise<object>} Serie diaria de engagement/impresiones.
     */
    getDailyMetrics(query = {}) {
      return this.request('/analytics/daily-metrics', { query });
    }

    /**
     * Historial de seguidores con crecimiento.
     * @param {{profileId?:string, fromDate?:string, toDate?:string, granularity?:string}} [query={}] — filtros.
     * @returns {Promise<object>} Serie de followers.
     */
    getFollowerStats(query = {}) {
      return this.request('/accounts/follower-stats', { query });
    }

    /**
     * Mejores horarios de publicación según historial.
     * @param {{profileId?:string, platform?:string}} [query={}] — filtros.
     * @returns {Promise<object>} Ranking de horarios.
     */
    getBestTime(query = {}) {
      return this.request('/analytics/best-time', { query });
    }

    // ── Webhooks ─────────────────────────────────────────────────────────────

    /**
     * La gestión de SUSCRIPCIONES de webhooks es admin-plane (como api-keys):
     * una sub-key de perfil no puede administrarlas (403 'A profile-scoped API
     * key cannot manage webhooks'). Estas llamadas usan la master del centro.
     */

    /** @returns {Promise<object>} Configuración actual de webhooks. */
    getWebhookSettings() {
      return this.request('/webhooks/settings', { admin: true });
    }

    /**
     * Crea la configuración de webhook (suscripción de eventos).
     * @param {object} payload — { name, isActive, url, secret, events[] }.
     * @returns {Promise<object>} Config creada.
     */
    createWebhookSettings(payload) {
      return this.request('/webhooks/settings', { method: 'POST', body: payload, admin: true });
    }

    /**
     * Actualiza la configuración de webhook.
     * @param {object} payload — campos a actualizar.
     * @returns {Promise<object>} Config actualizada.
     */
    updateWebhookSettings(payload) {
      return this.request('/webhooks/settings', { method: 'PUT', body: payload, admin: true });
    }

    /** Elimina la configuración de webhook. */
    deleteWebhookSettings() {
      return this.request('/webhooks/settings', { method: 'DELETE', admin: true });
    }

    /** Envía un webhook de prueba. */
    testWebhook() {
      return this.request('/webhooks/test', { method: 'POST', admin: true });
    }

    /** @returns {Promise<Array<object>>} Logs de entrega de webhooks (master del centro). */
    getWebhookLogs() {
      return this.request('/webhooks/logs', { admin: true });
    }

    // ── Broadcasts ───────────────────────────────────────────────────────────

    /**
     * @param {string} [profileId] — filtra por perfil.
     * @returns {Promise<Array<object>>} Broadcasts con stats de entrega.
     */
    listBroadcasts(profileId) {
      return this.request('/broadcasts', { query: { profileId } });
    }

    /**
     * Crea un broadcast en borrador.
     * @param {object} payload — { profileId, accountId, platform, name, message|template, segmentFilters? }.
     * @returns {Promise<object>} Broadcast draft.
     */
    createBroadcast(payload) {
      return this.request('/broadcasts', { method: 'POST', body: payload });
    }

    /**
     * @param {string} id — id del broadcast.
     * @returns {Promise<object>} Broadcast completo.
     */
    getBroadcast(id) {
      return this.request(`/broadcasts/${id}`);
    }

    /**
     * Agrega destinatarios (por contactIds, phones o segmento).
     * @param {string} id — id del broadcast.
     * @param {{contactIds?:Array<string>, phones?:Array<string>, useSegment?:boolean}} payload — destinatarios.
     * @returns {Promise<object>} Conteo added/skipped.
     */
    addBroadcastRecipients(id, payload) {
      return this.request(`/broadcasts/${id}/recipients`, { method: 'POST', body: payload });
    }

    /**
     * @param {string} id — id del broadcast.
     * @param {boolean} [useSegment=true] — poblar del segmento del broadcast.
     * @returns {Promise<object>} Envío iniciado.
     */
    sendBroadcast(id, useSegment = true) {
      return this.request(`/broadcasts/${id}/send`, { method: 'POST', body: { useSegment } });
    }

    /**
     * Programa el envío para una fecha futura.
     * @param {string} id — id del broadcast.
     * @param {string} scheduledAt — ISO 8601.
     * @returns {Promise<object>} Broadcast programado.
     */
    scheduleBroadcast(id, scheduledAt) {
      return this.request(`/broadcasts/${id}/schedule`, { method: 'POST', body: { scheduledAt } });
    }

    /**
     * @param {string} id — id del broadcast.
     * @returns {Promise<object>} Broadcast cancelado.
     */
    cancelBroadcast(id) {
      return this.request(`/broadcasts/${id}/cancel`, { method: 'POST' });
    }

    /**
     * Destinatarios con estado individual de entrega.
     * @param {string} id — id del broadcast.
     * @param {{status?:string, limit?:number}} [query={}] — filtros.
     * @returns {Promise<Array<object>>} Destinatarios.
     */
    listBroadcastRecipients(id, query = {}) {
      return this.request(`/broadcasts/${id}/recipients`, { query: { limit: 50, ...query } });
    }

    // ── Secuencias ───────────────────────────────────────────────────────────

    /**
     * @param {string} [profileId] — filtra por perfil.
     * @returns {Promise<Array<object>>} Secuencias con stats de enrolamiento.
     */
    listSequences(profileId) {
      return this.request('/sequences', { query: { profileId } });
    }

    /**
     * Crea una secuencia (drip multi-paso).
     * @param {object} payload — { profileId, accountId, platform, name, steps[], exitOnReply?, exitOnUnsubscribe? }.
     * @returns {Promise<object>} Secuencia creada.
     */
    createSequence(payload) {
      return this.request('/sequences', { method: 'POST', body: payload });
    }

    /**
     * @param {string} id — id de la secuencia.
     * @param {object} payload — campos a actualizar (incluye steps).
     * @returns {Promise<object>} Secuencia actualizada.
     */
    updateSequence(id, payload) {
      return this.request(`/sequences/${id}`, { method: 'PATCH', body: payload });
    }

    /** @param {string} id — id de la secuencia. */
    deleteSequence(id) {
      return this.request(`/sequences/${id}`, { method: 'DELETE' });
    }

    /** @param {string} id — id de la secuencia. */
    activateSequence(id) {
      return this.request(`/sequences/${id}/activate`, { method: 'POST' });
    }

    /** @param {string} id — id de la secuencia. */
    pauseSequence(id) {
      return this.request(`/sequences/${id}/pause`, { method: 'POST' });
    }

    /**
     * Enrola contactos en una secuencia.
     * @param {string} id — id de la secuencia.
     * @param {Array<string>} contactIds — contactos a enrolar.
     * @returns {Promise<object>} Conteo enrolled/skipped.
     */
    enrollSequence(id, contactIds) {
      return this.request(`/sequences/${id}/enroll`, { method: 'POST', body: { contactIds } });
    }

    /**
     * @param {string} id — id de la secuencia.
     * @param {{status?:string, limit?:number}} [query={}] — filtros.
     * @returns {Promise<Array<object>>} Enrolamientos con progreso.
     */
    listEnrollments(id, query = {}) {
      return this.request(`/sequences/${id}/enrollments`, { query: { limit: 50, ...query } });
    }

    // ── WhatsApp Flows ───────────────────────────────────────────────────────

    /**
     * @param {string} accountId — cuenta WhatsApp conectada.
     * @returns {Promise<Array<object>>} Flows (DRAFT/PUBLISHED/DEPRECATED…).
     */
    listFlows(accountId) {
      return this.request('/whatsapp/flows', { query: { accountId } });
    }

    /**
     * Crea un flow en borrador (opcionalmente clonando otro).
     * @param {object} payload — { accountId, name, categories[], cloneFlowId? }.
     * @returns {Promise<object>} Flow DRAFT.
     */
    createFlow(payload) {
      return this.request('/whatsapp/flows', { method: 'POST', body: payload });
    }

    /**
     * Sube el JSON de pantallas del flow.
     * @param {string} id — id del flow.
     * @param {object} flowJson — definición de pantallas (versión Meta).
     * @param {string} accountId — cuenta WhatsApp.
     * @returns {Promise<object>} Validación (validation_errors[] si hay).
     */
    uploadFlowJson(id, flowJson, accountId) {
      return this.request(`/whatsapp/flows/${id}/json`, { method: 'PUT', body: { accountId, flow_json: flowJson } });
    }

    /**
     * Publica un flow (irreversible; para editar hay que clonar).
     * @param {string} id — id del flow.
     * @param {string} accountId — cuenta WhatsApp.
     * @returns {Promise<object>} Flow publicado.
     */
    publishFlow(id, accountId) {
      return this.request(`/whatsapp/flows/${id}/publish`, { method: 'POST', body: { accountId } });
    }

    /**
     * Envía un flow publicado como mensaje interactivo.
     * @param {object} payload — { accountId, to, flow_id, flow_cta, body }.
     * @returns {Promise<object>} Mensaje enviado.
     */
    sendFlow(payload) {
      return this.request('/whatsapp/flows/send', { method: 'POST', body: payload });
    }

    // ── Cuentas y contactos ──────────────────────────────────────────────────

    /**
     * Health check de una cuenta conectada.
     * @param {string} accountId — id de la cuenta.
     * @returns {Promise<object>} Estado de salud del token.
     */
    getAccountHealth(accountId) {
      return this.request(`/accounts/${accountId}/health`);
    }

    /**
     * Desconecta una cuenta (borra el token en Zernio).
     * @param {string} accountId — id de la cuenta.
     * @returns {Promise<object>} Confirmación.
     */
    deleteAccount(accountId) {
      return this.request(`/accounts/${accountId}`, { method: 'DELETE' });
    }

    /**
     * Importa contactos en lote (hasta 1.000).
     * @param {object} payload — { profileId, accountId, platform, contacts[] }.
     * @returns {Promise<object>} Conteo created/skipped.
     */
    importContacts(payload) {
      return this.request('/contacts/bulk', { method: 'POST', body: payload });
    }
  }

  window.ZernioCrm = window.ZernioCrm || {};
  // La master NO se expone en window: es una constante interna del cliente
  // (el bundle igual la contiene, pero no hay acceso trivial desde consola).
  Object.assign(window.ZernioCrm, { api: new ZernioApiClient(), ApiError, BASE_URL });
})();
