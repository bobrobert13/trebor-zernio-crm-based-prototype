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
     * @param {string} path — ruta (ej. '/profiles').
     * @param {{method?:string, query?:object, body?:object}} [options={}] — opciones.
     * @returns {Promise<object>} Respuesta JSON.
     * @throws {ApiError} Error tipado (incluye CORS_BLOCKED si el navegador no pudo conectar).
     */
    async request(path, { method = 'GET', query, body } = {}) {
      const url = new URL(`${this.baseUrl}${path}`);
      if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

      const headers = { Authorization: `Bearer ${ZernioCrm.store.apiKey}` };
      if (body) headers['Content-Type'] = 'application/json';

      let response;
      try {
        response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      } catch {
        // TypeError de fetch == CORS bloqueado o sin red en file://
        ZernioCrm.flagCorsBlocked();
        throw new ApiError('No se pudo conectar con Zernio (CORS o red). Cambiaste a modo demo.', 'cors_blocked', 'CORS_BLOCKED');
      }

      if (!response.ok) {
        const envelope = await response.json().catch(() => ({}));
        throw new ApiError(envelope.error || `Error ${response.status}`, envelope.type || 'api_error', envelope.code || String(response.status));
      }
      return response.json();
    }

    /** Valida la API key listando los perfiles. */
    testConnection() {
      return this.request('/profiles');
    }

    /** @returns {Promise<Array<object>>} Perfiles (marcas/proyectos) del workspace de Zernio. */
    getProfiles() {
      return this.request('/profiles');
    }

    /**
     * Crea un perfil (marca) en Zernio.
     * @param {string} name — nombre del perfil.
     * @returns {Promise<object>} Perfil creado.
     */
    createProfile(name) {
      return this.request('/profiles', { method: 'POST', body: { name } });
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
     * Inicia el flujo OAuth de WhatsApp (Meta Cloud API / Embedded Signup).
     * @param {string} profileId — id del perfil.
     * @returns {Promise<{url:string}>} URL de autorización.
     */
    getWhatsAppConnectUrl(profileId) {
      return this.request('/connect/whatsapp', { query: { profileId, headless: true } });
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

    /** @returns {Promise<Array<object>>} Números WhatsApp (Zernio/Telnyx) del workspace. */
    listPhoneNumbers() {
      return this.request('/whatsapp/phone-numbers');
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
     * @param {string} accountId — cuenta WhatsApp (requerida por el API).
     * @returns {Promise<Array<object>>} Mensajes.
     */
    listMessages(conversationId, accountId) {
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
     * Broadcasts (mensajes masivos).
     * @param {string} [profileId] — filtra por perfil.
     * @returns {Promise<Array<object>>} Broadcasts.
     */
    listBroadcasts(profileId) {
      return this.request('/broadcasts', { query: { profileId } });
    }

    /**
     * Plantillas de mensaje de WhatsApp (vienen de Meta Cloud API).
     * @param {string} accountId — cuenta WhatsApp conectada.
     * @returns {Promise<Array<object>>} Plantillas.
     */
    listTemplates(accountId) {
      return this.request('/whatsapp/templates', { query: { accountId } });
    }
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, { api: new ZernioApiClient(), ApiError, BASE_URL });
})();
