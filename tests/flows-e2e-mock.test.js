'use strict';
/**
 * tests/flows-e2e-mock.test.js — Integración determinista del recorrido
 * mensaje → agente → guardrail → transición, SIN navegador y SIN conexión al
 * modelo real: la llamada HTTP del agente se simula con un "LLM falso"
 * (fakeMary) que decide con la misma policy que el agente real recibiría en
 * context.flow. Cubre los escenarios S1/S2/S3/S5 del spec.
 *
 * Uso: node tests/flows-e2e-mock.test.js   (exit 0 = todo pasó)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const assert = require('assert');

// ── Fixtures (datos mock del workspace) ────────────────────────────────────
const STAGES = ['nuevo', 'cotizacion', 'pedido'];
const mk = (id, type, data) => ({ id, type, data, position: { x: 0, y: 0 } });
const TRIGGER = mk('n_trg', 'trigger', { trigger: 'message.received', stage: 'nuevo' });
const COND = mk('n_cond', 'condition', { condition: 'pide el precio de un producto' });
const ACTION = mk('n_act', 'action', { actionId: 'classify', stage: 'cotizacion' });

function buildWorkspace(pipelineExtra) {
  const pipeline = Object.assign({
    id: 'pl1', name: 'Ventas directas', active: true, agentId: 'ag1',
    stages: STAGES.slice(),
    flow: {
      nodes: [TRIGGER, COND, ACTION],
      edges: [
        { id: 'e1', source: TRIGGER.id, target: COND.id },
        { id: 'e2', source: COND.id, target: ACTION.id },
      ],
    },
  }, pipelineExtra || {});
  return {
    id: 'ws1', name: 'Repuesto Robert', nicheId: 'auto',
    leadTags: STAGES.slice(),
    products: [{ id: 'p1', name: 'Bomba de agua', price: 80, stock: true, aliases: ['bomba'], active: true }],
    productMentions: [],
    agents: [{ id: 'ag1', name: 'Mary', url: 'https://llm.mock/v1', apiKey: 'k', mapping: {}, active: true, autoReply: true, logs: [] }],
    pipelines: [pipeline],
  };
}

function buildContact(leadTag) {
  return {
    id: 'c1', name: 'Cliente Uno', phone: '5550001', tags: [],
    leadTag, leadClosed: null, customFields: {},
    leadHistory: [{ tag: leadTag, at: 1000 }],
  };
}

function buildConversation(text) {
  return {
    id: 'cv1', platform: 'whatsapp', unread: 0,
    messages: [{ id: 'm1', from: 'in', text, ts: 2000, status: 'delivered' }],
  };
}

// ── LLM falso determinista: "Mary" que sigue la policy inyectada ───────────
// Mapea cada condición en lenguaje natural a palabras clave de prueba.
const KEYWORDS = { 'pide el precio de un producto': /precio|cuánto|cuesta|cuanto/i, 'pide info del envío': /envío|envio|costo de entrega|delivery/i };

/** Decide la respuesta cruda (formato Mary) a partir del contexto enviado. */
function fakeMary(context, override) {
  if (override) return override(context);
  const policy = (context.flow && context.flow.policy) || [];
  const messages = (context.conversation && context.conversation.messages) || [];
  const lastIn = [...messages].reverse().find((m) => m.from === 'in');
  const text = lastIn ? lastIn.text : '';
  const hit = policy.find((e) => {
    const re = KEYWORDS[e.condition] || new RegExp(e.condition, 'i');
    return re.test(text);
  });
  if (!hit) return { action: 'none', reply: {}, data: { leadTag: null, outcome: null, productId: null, note: null, reason: null, reminderAt: null } };
  if (hit.action === 'classify') return { action: 'classify', reply: { text: '' }, data: { leadTag: hit.to, outcome: null, productId: null, note: null, reason: null, reminderAt: null } };
  if (hit.action === 'reply') return { action: 'reply', reply: { text: 'ok' }, data: { leadTag: null, outcome: null, productId: null, note: null, reason: null, reminderAt: null } };
  return { action: 'none', reply: {}, data: {} };
}

// ── Carga de los IIFE del repo con stubs ───────────────────────────────────
let uidN = 0;
const capturedBodies = [];
let decide = null; // decide(context) → raw Mary (sustituible por test)

global.window = global;
global.Vue = {};
global.ZernioCrm = {
  uid: (p) => `${p}_${++uidN}`,
  store: { mode: 'live', workspace: null },
  fetchWithTimeout: async (_url, opts) => {
    const body = JSON.parse(opts.body);
    capturedBodies.push(body);
    return { ok: true, json: async () => decide(body) };
  },
};
eval(fs.readFileSync(path.join(ROOT, 'src/flow-builder-composables.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'src/services/agent-client.js'), 'utf8'));

// Réplica mínima de store.applyLeadTag (misma semántica: leadHistory {tag, at}, máx 50).
function applyLeadTag(contact, tag) {
  const next = tag || null;
  if (contact.leadTag === next) return;
  contact.leadHistory = contact.leadHistory || [];
  if (contact.leadClosed) contact.leadHistory.push({ tag: 'reabierto', at: Date.now(), prev: contact.leadClosed });
  contact.leadHistory.push({ tag: next, at: Date.now() });
  if (contact.leadHistory.length > 50) contact.leadHistory.shift();
  contact.leadTag = next;
  delete contact.leadClosed;
}

/**
 * Simula el recorrido de la bandeja: askAgent (con la policy inyectada) +
 * guardrail de applyAgentActionToConv (vía evaluateLeadTagTransition).
 * @returns {{context:object, action:object, flow:object, blocked:boolean}}
 */
async function sendMessage(ws, agent, contact, conversation) {
  // Espejo de producción: buildFlowPolicy/askAgent leen store.workspace.
  ZernioCrm.store.workspace = ws;
  const payload = { contact, conversation };
  const res = await ZernioCrm.askAgent(agent, 'message.received', payload);
  const action = res.action;
  const flow = ZernioCrm.buildFlowPolicy(ws, agent);
  // mismo bloque del inbox-composables (applyAgentActionToConv)
  let blocked = false;
  if (action.leadTag && contact) {
    const v = ZernioCrm.evaluateLeadTagTransition(flow, ws.leadTags, contact.leadTag || null, action.leadTag);
    if (v.ok) {
      if (contact.leadTag !== action.leadTag) applyLeadTag(contact, action.leadTag);
    } else if (contact.leadTag !== action.leadTag) {
      blocked = true;
      ZernioCrm.logAgentDecision(agent, { event: 'flow.guardrail', ok: false, error: `Transición a "${action.leadTag}" bloqueada: ${v.reason}.` });
    }
  }
  return { context: res.context, action, flow, blocked };
}

let passed = 0;
// Harness async: los escenarios devuelven promesas; se encadenan en orden.
let chain = Promise.resolve();
function test(name, fn) {
  chain = chain.then(async () => {
    try {
      await fn();
      passed++;
      console.log(`  OK ${name}`);
    } catch (err) {
      console.error(`  FAIL ${name}`);
      console.error(`       ${err.message}`);
      process.exitCode = 1;
    }
  });
}

// ── Escenarios ─────────────────────────────────────────────────────────────
test('E1/S1: mensaje que cumple la condición → policy inyectada + transición', async () => {
  const ws = buildWorkspace();
  const agent = ws.agents[0];
  const contact = buildContact('nuevo');
  const conv = buildConversation('¿a cuánto la bomba de agua?');
  decide = (ctx) => fakeMary(ctx);

  const r = await sendMessage(ws, agent, contact, conv);

  // La política llegó al LLM (context.flow presente en el body capturado)
  const body = capturedBodies[capturedBodies.length - 1];
  assert.ok(body.flow, 'context.flow debe inyectarse');
  assert.strictEqual(body.flow.pipelineId, 'pl1');
  assert.strictEqual(body.flow.policy.length, 1);
  // El LLM falso devolvió la etapa de la arista
  assert.strictEqual(r.action.leadTag, 'cotizacion');
  // Guardrail aprobó y el contacto se movió con historial
  assert.strictEqual(r.blocked, false);
  assert.strictEqual(contact.leadTag, 'cotizacion');
  assert.strictEqual(contact.leadHistory[contact.leadHistory.length - 1].tag, 'cotizacion');
});

test('E2/S2: mensaje sin condición → sin transición ni historial nuevo', async () => {
  const ws = buildWorkspace();
  const agent = ws.agents[0];
  const contact = buildContact('nuevo');
  const conv = buildConversation('gracias, ya me voy');
  decide = (ctx) => fakeMary(ctx);

  const r = await sendMessage(ws, agent, contact, conv);

  assert.strictEqual(r.action.leadTag, null);
  assert.strictEqual(r.blocked, false);
  assert.strictEqual(contact.leadTag, 'nuevo');
  assert.strictEqual(contact.leadHistory.length, 1); // backfill inicial, sin movimientos
});

test('E3/S3: agente propone etapa no vecina → guardrail bloquea y logga', async () => {
  const ws = buildWorkspace();
  const agent = ws.agents[0];
  const contact = buildContact('cotizacion'); // la arista existe solo desde "nuevo"
  const conv = buildConversation('¿cuánto cuesta?');
  decide = (ctx) => fakeMary(ctx, () => ({
    action: 'classify', reply: { text: '' },
    data: { leadTag: 'pedido', outcome: null, productId: null, note: null, reason: null, reminderAt: null },
  }));

  const r = await sendMessage(ws, agent, contact, conv);

  assert.strictEqual(r.blocked, true, 'transición inválida debe bloquearse');
  assert.strictEqual(contact.leadTag, 'cotizacion', 'la etapa no debe cambiar');
  const guard = agent.logs.find((l) => l.event === 'flow.guardrail');
  assert.ok(guard, 'debe quedar registro de auditoría en el agente');
  assert.ok(guard.error.includes('sin arista válida'), guard.error);
});

test('E4/S5: pipeline inactivo → sin policy inyectada y fallback de membresía', async () => {
  const ws = buildWorkspace({ active: false });
  const agent = ws.agents[0];
  const contact = buildContact('nuevo');
  const conv = buildConversation('¿cuánto cuesta?');
  decide = (ctx) => fakeMary(ctx, () => ({
    action: 'classify', reply: { text: '' },
    data: { leadTag: 'cotizacion', outcome: null, productId: null, note: null, reason: null, reminderAt: null },
  }));

  const r = await sendMessage(ws, agent, contact, conv);

  const body = capturedBodies[capturedBodies.length - 1];
  assert.strictEqual(body.flow, undefined, 'sin flujo activo no se inyecta policy');
  assert.strictEqual(r.flow, null);
  assert.strictEqual(r.blocked, false);
  assert.strictEqual(contact.leadTag, 'cotizacion', 'fallback: membresía permite el movimiento');
});

test('E5: acción reply con condición cumplida → responde sin mover etapa', async () => {
  const replyAct = mk('n_act', 'action', { actionId: 'reply', stage: '', text: 'Te paso la ficha' });
  const ws = buildWorkspace({
    flow: {
      nodes: [TRIGGER, COND, replyAct],
      edges: [
        { id: 'e1', source: TRIGGER.id, target: COND.id },
        { id: 'e2', source: COND.id, target: replyAct.id },
      ],
    },
  });
  const agent = ws.agents[0];
  const contact = buildContact('nuevo');
  const conv = buildConversation('¿me pasas el precio?');
  decide = (ctx) => fakeMary(ctx);

  const r = await sendMessage(ws, agent, contact, conv);

  assert.strictEqual(r.action.action, 'reply');
  assert.strictEqual(r.action.leadTag, null);
  assert.strictEqual(contact.leadTag, 'nuevo');
});

chain.then(() => {
  console.log(`\n${passed} tests e2e (mock) pasaron`);
  process.exit(process.exitCode || 0);
});