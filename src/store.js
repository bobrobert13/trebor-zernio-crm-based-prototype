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
   *   Es la sub-key operativa del espacio; la master del centro es una
   *   constante del cliente API (nunca vive en el store ni se persiste).
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
    pendingConversationId: null, // conversación a abrir al montar la bandeja (drawers de otros módulos)
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
    // Sin canal conectado: no reflejar (quedaría una conversación huérfana sin respuesta)
    if (!accountId) return;

    let contact = null;
    let conv = conversationId ? ws.conversations.find((c) => c.id === conversationId) : null;
    if (!conv) {
      const digits = String(sender.identifier || '').replace(/\D/g, '');
      contact = ws.contacts.find((c) => String(c.phone || '').replace(/\D/g, '') === digits);
      if (!contact) {
        contact = {
          id: ZernioCrm.uid('ct'),
          // Nombre anti-colisión: si el participante trae el nombre de OTRO
          // contacto ya existente, se usa el fallback numérico
          name: resolveContactName(sender.name || sender.username, sender.identifier, ws.contacts),
          phone: sender.identifier || '',
          platform,
          tags: ['cliente'],
          leadTag: null,
          customFields: {},
          createdAt: Date.now(),
          leadHistory: [{ tag: null, at: Date.now() }],
          nameSource: 'auto',
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
    } else if (!contact) {
      // Conversación existente por id: resolver su contacto para menciones/hooks
      contact = ws.contacts.find((c) => c.id === conv.contactId) || null;
    }

    // Auto-corrección de nombre: si el nombre vino del participante (auto, no
    // editado a mano) y Zernio trae un nombre mejor sin colisión → actualizar
    if (contact && contact.nameSource !== 'manual') {
      const improved = resolveContactName(sender.name || sender.username, contact.phone, ws.contacts);
      if (improved !== contact.name && !improved.startsWith('Cliente ')) contact.name = improved;
    }

    // Dedupe por id de mensaje (entrega at-least-once + recargas de página)
    const msgId = msg.id || null;
    if (msgId && conv.messages.some((m) => m.id === msgId)) return;
    const pushed = {
      id: msgId || ZernioCrm.uid('msg'),
      from: 'in',
      text,
      ts: Date.parse(msg.timestamp || event.timestamp) || Date.now(),
      status: 'delivered',
    };
    conv.messages.push(pushed);
    conv.lastTs = Date.now();
    if (store.route !== 'inbox') conv.unread += 1;
    // Detección de productos del catálogo en el mensaje entrante (live)
    recordProductMentions(contact, conv, pushed, text);
    // Hooks de mensajes entrantes (ej. auto-respuesta del agente IA)
    incomingHooks.forEach((fn) => {
      try { fn(contact, conv, pushed); } catch { /* el hook no debe romper el reflejo */ }
    });
  }

  /** Hooks registrados para mensajes entrantes (auto-respuesta de agentes IA). */
  const incomingHooks = [];

  /** Registra un callback (contact, conv, msg) para cada mensaje entrante reflejado. */
  function onIncomingMessage(fn) {
    if (typeof fn === 'function') incomingHooks.push(fn);
  }

  /**
   * Nombre seguro para un contacto nuevo desde un participante externo:
   * si el nombre ya pertenece a OTRO contacto (número distinto) no se reusa
   * (evita "soy Robert y me apareció como Valeria Rios") y se cae al fallback
   * numérico. Los contactos editados a mano llevan nameSource 'manual'.
   */
  function resolveContactName(name, phone, existing) {
    const clean = String(name || '').trim();
    const d = String(phone || '').replace(/\D/g, '');
    const collides = Boolean(clean) && (existing || []).some(
      (c) => String(c.name || '').trim() === clean && String(c.phone || '').replace(/\D/g, '') !== d
    );
    if (clean && !collides) return clean;
    return d ? `Cliente ${d.slice(-6)}` : 'Cliente nuevo';
  }

  /**
   * Registra menciones de productos del catálogo en un mensaje entrante.
   * Cada candidato (top 3 de matchProducts) genera una mention con match
   * exacta/parcial y status 'pendiente' (el agente la confirma en la bandeja).
   * @param {object} contact — contacto de la conversación.
   * @param {object} conv — conversación.
   * @param {object} message — mensaje entrante ya insertado.
   * @param {string} text — texto del mensaje.
   */
  function recordProductMentions(contact, conv, message, text) {
    const ws = store.workspace;
    if (!ws || !contact || !conv || !message || !text) return;
    const catalog = ws.products || [];
    if (!catalog.length) return;
    const matches = ZernioCrm.matchProducts(text, catalog, ws.nicheId);
    if (!matches.length) return;
    matches.forEach((m) => {
      ws.productMentions.push({
        id: ZernioCrm.uid('men'),
        productId: m.product.id,
        messageId: message.id,
        contactId: contact.id,
        convId: conv.id,
        ts: message.ts || Date.now(),
        intent: m.intent,
        // Coincidencia clara (contención 0.85+) se auto-señala y se confirma;
        // parciales (overlap/edición) quedan pendientes del agente
        match: m.score >= 0.85 ? 'exacta' : 'parcial',
        status: m.score >= 0.85 ? 'confirmada' : 'pendiente',
        text: String(text).slice(0, 200),
      });
    });
    if (ws.productMentions.length > 2000) {
      ws.productMentions.splice(0, ws.productMentions.length - 2000);
    }
  }

  /** Confirma una mention pendiente (el agente eligió el producto exacto). */
  function confirmMention(id, productId) {
    const ws = store.workspace;
    const m = (ws.productMentions || []).find((x) => x.id === id);
    if (!m) return;
    m.productId = productId || m.productId;
    m.status = 'confirmada';
    m.match = 'exacta';
  }

  /** Descarta una mention pendiente (falso positivo). */
  function discardMention(id) {
    const ws = store.workspace;
    ws.productMentions = (ws.productMentions || []).filter((x) => x.id !== id);
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
    // Fallback a Analítica (el panel Resumen quedó oculto en la iteración 15)
    location.hash = allowed ? `#/${route}` : '#/analytics';
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

  /**
   * Cambia la etapa del lead de un contacto registrando el histórico automático.
   * Centraliza el cambio para que bandeja y kanban sean coherentes.
   * @param {object} contact — contacto del workspace.
   * @param {string|null} tag — nueva etapa (null = sin asignar).
   */
  function applyLeadTag(contact, tag) {
    if (!contact) return;
    const next = tag || null;
    if (contact.leadTag === next) return;
    contact.leadHistory = contact.leadHistory || [];
    // Si el lead estaba finalizado, el cambio de etapa lo reabre: se conserva
    // el registro de cierre en el historial antes de descartarlo.
    if (contact.leadClosed) {
      contact.leadHistory.push({ tag: 'reabierto', at: Date.now(), prev: contact.leadClosed });
    }
    contact.leadHistory.push({ tag: next, at: Date.now() });
    if (contact.leadHistory.length > 50) contact.leadHistory.shift();
    contact.leadTag = next;
    delete contact.leadClosed; // reabre el lead si estaba finalizado
  }

  // ── Recordatorios (locales al workspace, persistidos por el deep watch) ───

  /** @returns {Array<object>} Recordatorios de un contacto. */
  function remindersOf(contactId) {
    return (store.workspace && store.workspace.reminders || []).filter((r) => r.contactId === contactId);
  }

  /**
   * Crea un recordatorio para un contacto.
   * @param {string} contactId — contacto asociado.
   * @param {string} text — texto del recordatorio.
   * @param {string|null} dueAt — fecha ISO (opcional).
   */
  function addReminder(contactId, text, dueAt) {
    if (!store.workspace) return;
    store.workspace.reminders = store.workspace.reminders || [];
    store.workspace.reminders.push({
      id: ZernioCrm.uid('rem'),
      contactId,
      text,
      dueAt: dueAt || null,
      done: false,
      createdAt: Date.now(),
    });
  }

  /** @param {string} id — id del recordatorio. */
  function toggleReminder(id) {
    const r = (store.workspace && store.workspace.reminders || []).find((x) => x.id === id);
    if (r) r.done = !r.done;
  }

  /** @param {string} id — id del recordatorio. */
  function removeReminder(id) {
    if (store.workspace) {
      store.workspace.reminders = (store.workspace.reminders || []).filter((x) => x.id !== id);
    }
  }

  /**
   * Migración idempotente del workspace: completa estructuras que versiones
   * anteriores no tenían (etiquetas, campos, historial de etapas, catálogo,
   * preferencias del panel…). Se ejecuta al restaurar sesión (app.js) y al
   * crear un workspace nuevo desde el onboarding para que todo cargue a la
   * primera, sin depender de una recarga.
   * @param {object} workspace — workspace a migrar (se muta en su lugar).
   */
  function migrateWorkspace(workspace) {
    if (!workspace) return;
    const n = ZernioCrm.getNiche(workspace.nicheId);
    // Migración: etiquetas de leads personalizables (default del nicho)
    if (!workspace.leadTags) {
      workspace.leadTags = [...((n && n.tags) || ['cliente'])];
    }
    // Migración: etiquetas de contacto administrables (separadas de las leads)
    if (!workspace.contactTags) {
      workspace.contactTags = [...((n && n.tags) || []), 'cliente'];
    }
    // Migración: campos del negocio personalizables (default del nicho)
    if (!workspace.customFields) {
      workspace.customFields = ((n && n.customFields) || []).map((f) => ({ ...f }));
    }
    // Migración: historial de etapas de leads — backfill del momento 0 para
    // contactos existentes (idempotente: solo si no tienen leadHistory).
    // Incluye contactos sin leadTag (sync/webhooks previos) → "Sin asignar".
    (workspace.contacts || []).forEach((c) => {
      if (!c.leadHistory) {
        c.leadHistory = [{ tag: c.leadTag || null, at: c.createdAt || Date.now() }];
      }
    });
    // Migración: catálogo de productos y servicios (default del nicho)
    if (!workspace.products) workspace.products = ZernioCrm.getNicheCatalog(workspace.nicheId);
    if (!workspace.productMentions) workspace.productMentions = [];
    // Backfill por producto: ficha técnica, plantilla y stock con defaults
    const nicheFields = ZernioCrm.getNicheProductFields(workspace.nicheId);
    const cardDefaults = (ZernioCrm.PRODUCT_CARD_DEFAULTS || {})[workspace.nicheId] || (ZernioCrm.PRODUCT_CARD_DEFAULTS || {}).generic;
    (workspace.products || []).forEach((p) => {
      if (p.details === undefined) p.details = nicheFields.map((label) => ({ label, value: '' }));
      if (p.cardTemplate === undefined) p.cardTemplate = cardDefaults.template;
      if (p.stock === undefined) p.stock = true;
      if (p.description === undefined) p.description = '';
      if (p.active === undefined) p.active = true;
    });
    // Migración: preferencias del panel (secciones y KPIs visibles)
    if (!workspace.dashboardPrefs) {
      workspace.dashboardPrefs = {
        sections: { kpis: true, canal: true, acciones: true, roadmap: true, actividad: true },
        kpis: ((n && n.kpis) || []).map((k) => k.id),
      };
    }
    // Migración: plantillas WhatsApp sin cuerpo (workspaces creados antes de
    // que el seed incluyera body) — la preview y el envío del flujo de 24h
    // (conversación nueva / re-enganche) dependen del texto; idempotente.
    const tplSteps = ((n && n.roadmap) || []).filter((r) => r.type === 'templates');
    (workspace.templates || []).forEach((t) => {
      if (t.body || (t.components && t.components.length)) return;
      const step = tplSteps.find((s) => t.name.startsWith(s.id + '_'));
      const desc = (step && step.desc) || 'le escribimos para atender su solicitud';
      t.body = `Hola {{1}}, ${desc.charAt(0).toLowerCase()}${desc.slice(1)}`;
    });
    // Migración: agentes de IA conectables (nuevo módulo Agente)
    if (!workspace.agents) workspace.agents = [];
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    store, toast, applyAccent, navigate, flagCorsBlocked, canEdit, detectServer,
    pushWebhookEvent, reflectIncomingMessage, applyLeadTag,
    remindersOf, addReminder, toggleReminder, removeReminder,
    recordProductMentions, confirmMention, discardMention,
    onIncomingMessage, resolveContactName,
    migrateWorkspace,
  });
})();
