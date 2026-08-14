/**
 * @file agent-client.js — Cliente de agentes de IA externos (Mary y otros):
 * contexto del CRM (workspace, contacto, conversación, inventario, menciones,
 * ventana 24h) → POST al servicio → adaptación de la respuesta (mapeo campo a
 * campo desde el JSON de ejemplo del servicio) → acción canónica del CRM.
 * Demo: simula un agente local con la misma heurística del panel IA.
 */
(function () {
  'use strict';

  const { ZernioCrm } = window;

  /** Flujos de venta que puede atender un agente (toggles del módulo Agente). */
  const AGENT_FLOWS = [
    { id: 'inbox', label: 'Atención en bandeja' },
    { id: 'classification', label: 'Clasificación de leads' },
    { id: 'leads', label: 'Manejo de leads' },
    { id: 'personalization', label: 'Personalización agentica' },
    { id: 'campaigns', label: 'Atención de campañas' },
  ];

  /** Acción canónica del CRM que produce el mapeo de la respuesta del servicio. */
  const CANONICAL_FIELDS = [
    { key: 'action', label: 'Acción', placeholder: 'action' },
    { key: 'text', label: 'Texto de respuesta', placeholder: 'reply.text' },
    { key: 'leadTag', label: 'Etapa del lead', placeholder: 'data.leadTag' },
    { key: 'outcome', label: 'Resultado de venta', placeholder: 'data.outcome' },
    { key: 'note', label: 'Nota de cierre', placeholder: 'data.note' },
    { key: 'reason', label: 'Motivo', placeholder: 'data.reason' },
    { key: 'productId', label: 'Id de producto', placeholder: 'data.productId' },
    { key: 'reminderAt', label: 'Fecha de recordatorio', placeholder: 'data.reminderAt' },
  ];

  /** Tipos de acción válidos (whitelist): cualquier otra acción del servicio se ignora. */
  const VALID_ACTIONS = ['reply', 'classify', 'close_sale', 'attach_product', 'reminder', 'none'];

  /** Tope de tiempo de espera del servicio externo (ms): nunca bloquear el flujo del CRM. */
  const AGENT_TIMEOUT_MS = 8000;

  /** Tope de caracteres del texto que un agente puede insertar (guarda contra respuestas gigantes). */
  const MAX_ACTION_TEXT = 2000;

  /**
   * Herramientas (MCP) del CRM expuestas al agente: qué puede modificar, con qué
   * barreras y cuándo se disparan. Se muestran en la configuración del agente
   * para que el cliente sepa exactamente qué nutrimos y qué puede tocar.
   */
  const CRM_TOOLS = [
    {
      id: 'send_reply',
      action: 'reply',
      name: 'Responder mensaje',
      icon: 'message',
      desc: 'Escribe y envía un mensaje al cliente en su conversación de WhatsApp.',
      modifies: 'Agrega un mensaje saliente al hilo y lo envía por el canal conectado.',
      barrier: 'Política de 24h: fuera de ventana no se envían mensajes libres (se requiere plantilla aprobada). Una sola respuesta por mensaje entrante.',
      trigger: 'Al recibir un mensaje del cliente (con auto-respuesta activa) o bajo demanda desde el panel IA.',
    },
    {
      id: 'classify_lead',
      action: 'classify',
      name: 'Clasificar lead',
      icon: 'tag',
      desc: 'Asigna la etapa del pipeline al contacto (stock, cotización, pedido…).',
      modifies: 'Actualiza la etapa del lead y su historial de cambios.',
      barrier: 'Solo acepta etapas existentes del negocio; las demás se ignoran.',
      trigger: 'Automático con cada mensaje entrante o al pedir una sugerencia en el panel IA.',
    },
    {
      id: 'close_sale',
      action: 'close_sale',
      name: 'Cerrar venta',
      icon: 'check-circle',
      desc: 'Finaliza el lead como concretada o no concretada, con nota y motivo.',
      modifies: 'Marca el cierre en el contacto y lo registra en su historial de etapas.',
      barrier: 'Requiere «Cierre de ventas» activado por agente y un resultado válido (ganada/perdida).',
      trigger: 'Solo cuando el agente detecta el cierre de la negociación y tú activaste «Cierre de ventas».',
    },
    {
      id: 'attach_product',
      action: 'attach_product',
      name: 'Adjuntar ficha de producto',
      icon: 'box',
      desc: 'Adjunta la ficha formateada de un producto del catálogo a la conversación.',
      modifies: 'Inserta la tarjeta del producto (precio, stock, detalle) en el mensaje.',
      barrier: 'Solo productos existentes y activos del catálogo; cualquier otro se ignora.',
      trigger: 'Cuando el agente detecta interés por un producto (pedido, precio, reserva).',
    },
    {
      id: 'create_reminder',
      action: 'reminder',
      name: 'Crear recordatorio',
      icon: 'clock',
      desc: 'Programa un seguimiento del contacto para no perder la conversación.',
      modifies: 'Agrega un recordatorio de seguimiento al contacto.',
      barrier: 'Fecha opcional y validada; si llega inválida se crea sin fecha.',
      trigger: 'Cuando el agente propone seguimiento (cliente sin responder, pedido en curso).',
    },
  ];

  /**
   * Pipelines: secuencias de herramientas que el agente encadena para cumplir
   * objetivos completos de venta (varias cosas requeridas a la vez).
   */
  const TOOL_PIPELINES = [
    { id: 'bienvenida', name: 'Atención de primer contacto', tools: ['send_reply', 'classify_lead'], goal: 'Responder la consulta inicial y clasificar al lead en su etapa.' },
    { id: 'recomendacion', name: 'Recomendación de producto', tools: ['attach_product', 'send_reply'], goal: 'Detectar interés, adjuntar la ficha del producto y enviar la respuesta.' },
    { id: 'reenganche', name: 'Re-enganche fuera de ventana', tools: ['send_reply', 'create_reminder'], goal: 'Re-enganchar al cliente (el CRM exige plantilla aprobada fuera de 24h) y dejar seguimiento.' },
    { id: 'cierre', name: 'Cierre de venta completo', tools: ['classify_lead', 'attach_product', 'send_reply', 'create_reminder', 'close_sale'], goal: 'Clasificar, adjuntar ficha, responder, programar seguimiento y cerrar la venta.' },
  ];

  /** Preset de adaptación del proveedor Mary (personalizable campo a campo). */
  const MARY_MAPPING = {
    action: 'action',
    text: 'reply.text',
    leadTag: 'data.leadTag',
    outcome: 'data.outcome',
    note: 'data.note',
    reason: 'data.reason',
    productId: 'data.productId',
    reminderAt: 'data.reminderAt',
  };

  /** JSON de ejemplo de la respuesta del servicio Mary (documentación + prueba). */
  const MARY_EXAMPLE = JSON.stringify({
    action: 'reply',
    reply: { text: '¡Hola! Gracias por escribirnos. ¿En qué te ayudamos hoy?' },
    data: { leadTag: null, outcome: null, productId: null, note: null, reason: null, reminderAt: null },
  }, null, 2);

  /** Lee un path en dot-notation ('reply.text') de un objeto (tolerante a nulls). */
  function getPath(obj, path) {
    if (!path) return undefined;
    return String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }

  /** Agentes ACTIVOS del workspace (opcionalmente filtrados por flujo). */
  function activeAgents(flow) {
    const ws = ZernioCrm.store.workspace;
    const list = (ws && ws.agents) || [];
    return list.filter((a) => a.active && (!flow || (a.flows && a.flows[flow])));
  }

  /** Registra una interacción en el log del agente (visible en el módulo). */
  function logAgent(agent, entry) {
    agent.logs = agent.logs || [];
    agent.logs.unshift({ id: ZernioCrm.uid('aglog'), at: Date.now(), ...entry });
    agent.logs = agent.logs.slice(0, 30);
  }

  /**
   * Contexto completo que se envía al servicio: el agente decide con total
   * libertad (inventario, leads, cliente, históricos, ventana 24h…).
   * @param {string} event — 'message.received' | 'suggestion.requested' | 'campaign.draft' | 'connection_test'.
   * @param {{contact?:object, conversation?:object, extra?:string}} payload — datos del disparador.
   */
  function buildContext(event, payload) {
    const ws = ZernioCrm.store.workspace || {};
    const contact = payload.contact || null;
    const conv = payload.conversation || null;
    const mentions = ((ws.productMentions || [])).filter((m) => contact && m.contactId === contact.id);
    const lastTs = conv && conv.messages && conv.messages.length ? conv.messages[conv.messages.length - 1].ts : 0;
    return {
      event,
      // Clave de idempotencia: el servicio puede deduplicar entregas repetidas
      interactionId: ZernioCrm.uid('agi'),
      workspace: { id: ws.id, name: ws.name, nicheId: ws.nicheId },
      contact: contact ? {
        id: contact.id, name: contact.name, phone: contact.phone,
        tags: contact.tags || [], leadTag: contact.leadTag || null,
        leadClosed: contact.leadClosed || null, customFields: contact.customFields || {},
        leadHistory: contact.leadHistory || [],
      } : null,
      conversation: conv ? {
        id: conv.id, platform: conv.platform || 'whatsapp',
        messages: (conv.messages || []).map((m) => ({ from: m.from, text: m.text, ts: m.ts })),
      } : null,
      inventory: (ws.products || []).map((p) => ({
        id: p.id, name: p.name, price: p.price, stock: p.stock !== false,
        aliases: p.aliases || [], active: p.active !== false,
      })),
      mentions: mentions.map((m) => ({ productId: m.productId, intent: m.intent, status: m.status, ts: m.ts })),
      window24h: { outside: Boolean(conv) && Date.now() - lastTs > 24 * 3600 * 1000, platform: conv ? conv.platform || 'whatsapp' : 'whatsapp' },
      extra: payload.extra || null,
    };
  }

  /** Aplica el mapeo del agente al JSON crudo y devuelve la acción canónica saneada. */
  function adapt(agent, raw) {
    const mapping = Object.assign({}, MARY_MAPPING, agent.mapping || {});
    const action = {};
    Object.keys(mapping).forEach((k) => {
      const v = getPath(raw, mapping[k]);
      if (v !== undefined) action[k] = v;
    });
    action.action = action.action || 'none';
    // Guardrails: el servicio externo tiene libertad, pero la acción se valida
    // antes de tocar el CRM (whitelist + límites de texto)
    if (!VALID_ACTIONS.includes(action.action)) action.action = 'none';
    if (action.text != null) {
      action.text = String(action.text).slice(0, MAX_ACTION_TEXT);
    }
    if (action.leadTag != null) action.leadTag = String(action.leadTag).slice(0, 60);
    return action;
  }

  /** Simulación local del agente (demo): misma heurística del panel IA. */
  function demoRespond(context) {
    const textos = ((context.conversation && context.conversation.messages) || [])
      .filter((m) => m.from === 'in').map((m) => m.text || '');
    const hayTexto = (re) => textos.some((t) => re.test(t));
    const productos = context.inventory || [];
    const interes = (context.mentions || []).filter((m) => ['pedido', 'precio', 'reserva'].includes(m.intent));
    const agotados = (context.mentions || []).filter((m) => {
      const p = productos.find((x) => x.id === m.productId);
      return p && !p.stock;
    });
    // Borrador de campaña: nombre sugerido con el nicho del negocio
    if (context.event === 'campaign.draft') {
      return { action: 'reply', reply: { text: `Promoción ${context.extra || 'de temporada'} — ofertas de esta semana` } };
    }
    if (hayTexto(/pago|pagar|banco|transferencia|referencia/i)) {
      return { action: 'reply', reply: { text: '¿Ya pudiste hacer el pago? Con la referencia despachamos hoy mismo. 😊' }, data: { leadTag: 'pedido' } };
    }
    const p1 = interes[0] && productos.find((x) => x.id === interes[0].productId);
    if (p1) {
      return { action: 'reply', reply: { text: `Claro, te paso la ficha de ${p1.name} con todos los detalles.` }, data: { leadTag: interes[0].intent, productId: p1.id } };
    }
    if (agotados.length) {
      const p = productos.find((x) => x.id === agotados[0].productId);
      return { action: 'reply', reply: { text: `El ${p ? p.name : 'producto'} está agotado por ahora. ¿Te interesa una alternativa similar del catálogo?` } };
    }
    if (context.event === 'message.received') {
      return { action: 'reply', reply: { text: '¡Hola! 👋 Gracias por escribirnos. ¿En qué podemos ayudarte hoy?' } };
    }
    if (context.event === 'suggestion.requested') {
      return { action: 'reply', reply: { text: '¡Hola! ¿Quedó alguna duda sobre tu pedido? Estamos atentos para ayudarte.' } };
    }
    return { action: 'none', data: {} };
  }

  /**
   * Pregunta al agente: POST al servicio (live) o simulación local (demo).
   * @returns {Promise<{ok:boolean, action:object, context:object, raw:object, error?:string}>}
   */
  async function askAgent(agent, event, payload) {
    const context = buildContext(event, payload);
    let raw;
    if (ZernioCrm.store.mode === 'live' && agent.url) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
      try {
        const res = await window.fetch(agent.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agent.apiKey || ''}` },
          body: JSON.stringify(context),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        raw = await res.json();
      } catch (err) {
        const message = err && err.name === 'AbortError'
          ? `Tiempo de espera agotado (${AGENT_TIMEOUT_MS / 1000}s)`
          : err && err.message ? err.message : String(err);
        logAgent(agent, { event, ok: false, error: message });
        return { ok: false, error: message, action: { action: 'none' }, context };
      } finally {
        clearTimeout(timer);
      }
    } else {
      raw = demoRespond(context);
    }
    const action = adapt(agent, raw);
    logAgent(agent, { event, ok: true, action: action.action, contact: context.contact && context.contact.name });
    return { ok: true, action, context, raw };
  }

  /** Prueba de conexión al servicio (live) o simulacro (demo). */
  async function testAgent(agent) {
    if (ZernioCrm.store.mode !== 'live' || !agent.url) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return { ok: true, simulated: true };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);
    try {
      const res = await window.fetch(agent.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agent.apiKey || ''}` },
        body: JSON.stringify({ event: 'connection_test', workspace: { name: (ZernioCrm.store.workspace || {}).name } }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    } finally {
      clearTimeout(timer);
    }
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    AGENT_FLOWS, CANONICAL_FIELDS, MARY_MAPPING, MARY_EXAMPLE,
    CRM_TOOLS, TOOL_PIPELINES,
    activeAgents, askAgent, testAgent, adapt, buildContext, getPath,
  });
})();
