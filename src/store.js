/**
 * @file store.js — Estado global reactivo de la aplicación.
 * Único lugar con estado compartido entre componentes; la persistencia
 * automática se engancha en src/data/storage.js (initPersistence).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * Estado global reactivo.
   * @type {object}
   * @property {object|null} workspace — workspace activo (con contactos, conversaciones, usuarios…).
   * @property {object|null} currentUser — usuario de sesión (controla RBAC).
   * @property {'demo'|'live'} mode — capa de datos activa.
   * @property {string} apiKey — API key de Zernio (modo live, prototipo).
   * @property {boolean} corsBlocked — true si Zernio rechazó peticiones por CORS.
   * @property {string} route — ruta actual del hash (sin '#/').
   * @property {Array<{id:number,message:string,type:string}>} toasts — notificaciones.
   */
  const store = Vue.reactive({
    workspace: null,
    currentUser: null,
    mode: 'demo',
    apiKey: '',
    corsBlocked: false,
    serverMode: false,
    route: 'dashboard',
    toasts: [],
    webhookEvents: [],
  });

  /**
   * Encola un evento de webhook recibido (cola acotada a 50).
   * @param {object} event — evento { event, timestamp, ... }.
   */
  function pushWebhookEvent(event) {
    store.webhookEvents.unshift({ receivedAt: Date.now(), event });
    if (store.webhookEvents.length > 50) store.webhookEvents.length = 50;
    if (event && event.event === 'message.received') {
      toast('Nuevo mensaje recibido (webhook)', 'success');
    }
  }

  /**
   * Refleja un mensaje entrante (webhook message.received) en la bandeja:
   * crea/actualiza la conversación del workspace y agrega el mensaje.
   * @param {object} event — payload del webhook (shape defensivo).
   */
  function reflectIncomingMessage(event) {
    const ws = store.workspace;
    if (!ws || !event || event.event !== 'message.received') return;
    const msg = event.message || {};
    const text = msg.text || '';
    if (!text) return;
    const platform = msg.platform || 'whatsapp';
    const conversationId = msg.conversationId || event.conversationId || null;
    const sender = msg.sender || {};
    const channel = (ws.channels || []).find((c) => c.platform === platform);
    const accountId = channel ? channel.accountId : platform === 'whatsapp' ? (ws.zernio && ws.zernio.accountId) || '' : '';

    let conv = conversationId ? ws.conversations.find((c) => c.id === conversationId) : null;
    if (!conv) {
      const digits = String(sender.identifier || '').replace(/\D/g, '');
      let contact = ws.contacts.find((c) => String(c.phone || '').replace(/\D/g, '') === digits);
      if (!contact) {
        contact = {
          id: ZernioCrm.uid('ct'),
          name: sender.name || sender.username || 'Cliente nuevo',
          phone: sender.identifier || '',
          platform,
          tags: ['cliente'],
          customFields: {},
          createdAt: Date.now(),
        };
        ws.contacts.unshift(contact);
      }
      conv = {
        id: conversationId || ZernioCrm.uid('conv'),
        contactId: contact.id,
        platform,
        status: 'active',
        unread: 0,
        tags: contact.tags.slice(0, 1),
        messages: [],
        lastTs: Date.now(),
        accountId,
      };
      ws.conversations.unshift(conv);
    }

    conv.messages.push({
      id: msg.id || ZernioCrm.uid('msg'),
      from: 'in',
      text,
      ts: Date.parse(msg.timestamp || event.timestamp) || Date.now(),
      status: 'delivered',
    });
    conv.lastTs = Date.now();
    if (store.route !== 'inbox') conv.unread += 1;
  }

  /**
   * Detecta el servidor local (server.mjs): si responde /api/health,
   * el modo live usa el proxy local en vez de llamadas directas a Zernio.
   * @returns {Promise<boolean>} true si el servidor está disponible.
   */
  async function detectServer() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      store.serverMode = res.ok;
    } catch {
      store.serverMode = false;
    }
    return store.serverMode;
  }

  /**
   * Muestra una notificación transitoria.
   * @param {string} message — texto de la notificación.
   * @param {'info'|'success'|'error'} [type='info'] — variante visual.
   * @param {number} [timeout=3500] — duración en ms.
   */
  function toast(message, type = 'info', timeout = 3500) {
    const id = Date.now() + Math.random();
    store.toasts.push({ id, message, type });
    setTimeout(() => {
      const index = store.toasts.findIndex((t) => t.id === id);
      if (index >= 0) store.toasts.splice(index, 1);
    }, timeout);
  }

  /**
   * Aplica el color de acento del workspace a las variables CSS del tema.
   * @param {object|null} workspace — workspace activo (usa accentId).
   */
  function applyAccent(workspace) {
    const accent =
      ZernioCrm.ACCENTS.find((a) => a.id === (workspace && workspace.accentId)) || ZernioCrm.ACCENTS[0];
    const root = document.documentElement;
    root.style.setProperty('--accent', accent.value);
    root.style.setProperty('--accent-soft', accent.soft);
  }

  /**
   * Navegación por hash con validación RBAC del módulo destino.
   * @param {string} route — id de ruta (dashboard, inbox, …).
   */
  function navigate(route) {
    const module = ZernioCrm.MODULES.find((m) => m.id === route);
    const allowed = !module || ZernioCrm.can(store.currentUser?.role, module.id);
    location.hash = allowed ? `#/${route}` : '#/dashboard';
  }

  /** Marca la app como degradada a demo por CORS y notifica una vez. */
  function flagCorsBlocked() {
    if (store.corsBlocked) return;
    store.corsBlocked = true;
    store.mode = 'demo';
    toast('Zernio bloqueó la petición (CORS). Cambiaste a modo demo.', 'error', 6000);
  }

  /**
   * ¿Puede el usuario de sesión editar un módulo? (RBAC, helper central).
   * @param {string} module — id del módulo.
   * @returns {boolean}
   */
  function canEdit(module) {
    return ZernioCrm.can(store.currentUser && store.currentUser.role, module, 'edit');
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, { store, toast, applyAccent, navigate, flagCorsBlocked, canEdit, detectServer, pushWebhookEvent, reflectIncomingMessage });
})();
