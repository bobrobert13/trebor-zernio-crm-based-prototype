'use strict';
/**
 * tests/flows-unit.test.js — Tests deterministas (sin navegador, sin red) de
 * la lógica pura del módulo Flujos: validación de pipelines, compilación de
 * política y guardrail de transiciones. Carga los IIFE del repo con stubs.
 *
 * Uso: node tests/flows-unit.test.js   (exit 0 = todo pasó)
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const assert = require('assert');

// ── Stubs para evaluar los IIFE fuera del navegador ────────────────────────
let uidN = 0;
global.window = global;
global.Vue = {};
global.ZernioCrm = {
  uid: (p) => `${p}_${++uidN}`,
  store: { workspace: null },
};

eval(fs.readFileSync(path.join(ROOT, 'src/flow-builder-composables.js'), 'utf8'));
global.fetch = () => { throw new Error('no se debe llamar a fetch en unit tests'); };
ZernioCrm.fetchWithTimeout = async () => { throw new Error('no red'); };
ZernioCrm.store = { mode: 'demo', workspace: { pipelines: [] } };
eval(fs.readFileSync(path.join(ROOT, 'src/services/agent-client.js'), 'utf8'));

// ── Fixtures ────────────────────────────────────────────────────────────────
const stages = ['nuevo', 'cotizacion', 'pedido'];
const mk = (id, type, data) => ({ id: `${type}${id}`, type, data, position: { x: 0, y: 0 } });
const t1 = mk('t1', 'trigger', { trigger: 'message.received', stage: 'nuevo' });
const c1 = mk('c1', 'condition', { condition: 'pide el precio de un producto' });
const a1 = mk('a1', 'action', { actionId: 'classify', stage: 'cotizacion' });

const pipe = (flow, extra) => Object.assign({
  id: 'pl1', name: 'Ventas', agentId: 'ag1', active: true, stages,
  flow: flow || { nodes: [t1, c1, a1], edges: [
    { id: 'e1', source: t1.id, target: c1.id },
    { id: 'e2', source: c1.id, target: a1.id },
  ] },
}, extra || {});

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  OK ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    process.exitCode = 1;
  }
}

// ── validatePipeline (escenarios S4 del spec) ──────────────────────────────
test('validatePipeline: cadena válida no genera issues', () => {
  const r = ZernioCrm.validatePipeline(pipe());
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.issues, []);
});

test('validatePipeline: condition sin salida → inválido con mensaje específico', () => {
  const r = ZernioCrm.validatePipeline(pipe({ nodes: [t1, c1, a1], edges: [{ id: 'e1', source: t1.id, target: c1.id }] }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('no tiene salida conectada')));
});

test('validatePipeline: arista a nodo inexistente y self-loop → inválido', () => {
  const r = ZernioCrm.validatePipeline(pipe({ nodes: [t1, c1, a1], edges: [
    { id: 'e1', source: 'fantasma', target: c1.id },
    { id: 'e2', source: c1.id, target: c1.id },
    { id: 'e3', source: c1.id, target: a1.id },
  ] }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('inexistente')));
  assert.ok(r.issues.some((i) => i.includes('a sí misma')));
});

test('validatePipeline: acción con etapa ajena al pipeline → inválido', () => {
  const bad = mk('a1', 'action', { actionId: 'classify', stage: 'luna' });
  const r = ZernioCrm.validatePipeline(pipe({ nodes: [t1, c1, bad], edges: [
    { id: 'e1', source: t1.id, target: c1.id },
    { id: 'e2', source: c1.id, target: bad.id },
  ] }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('inexistente en el pipeline')));
});

test('validatePipeline: condición vacía bloquea el publish', () => {
  const ce = mk('c1', 'condition', { condition: '   ' });
  const r = ZernioCrm.validatePipeline(pipe({ nodes: [t1, ce, a1], edges: [
    { id: 'e1', source: t1.id, target: ce.id },
    { id: 'e2', source: ce.id, target: a1.id },
  ] }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('está vacía')));
});

test('validatePipeline: sin agente asignado → inválido', () => {
  const r = ZernioCrm.validatePipeline(pipe(null, { agentId: '' }));
  assert.strictEqual(r.ok, false);
  assert.ok(r.issues.some((i) => i.includes('agente')));
});

// ── previewPolicy ──────────────────────────────────────────────────────────
test('previewPolicy: compila una regla por cadena trigger→condition→action', () => {
  const lines = ZernioCrm.previewPolicy(pipe());
  assert.strictEqual(lines.length, 1);
  assert.ok(lines[0].includes('nuevo'), lines[0]);
  assert.ok(lines[0].includes('cotizacion'), lines[0]);
  assert.ok(lines[0].includes('pide el precio'), lines[0]);
});

test('previewPolicy: cadena rota no produce reglas', () => {
  const lines = ZernioCrm.previewPolicy(pipe({ nodes: [t1, c1, a1], edges: [{ id: 'e1', source: t1.id, target: c1.id }] }));
  assert.strictEqual(lines.length, 0);
});

// ── buildFlowPolicy ────────────────────────────────────────────────────────
test('buildFlowPolicy: compila from/to/condition/action de la cadena', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  assert.ok(flow);
  assert.deepStrictEqual(flow.stages, stages);
  assert.strictEqual(flow.policy.length, 1);
  assert.deepStrictEqual(flow.policy[0], {
    trigger: 'message.received', from: 'nuevo', to: 'cotizacion',
    condition: 'pide el precio de un producto', action: 'classify',
  });
});

test('buildFlowPolicy: trigger sin etapa → from "*"', () => {
  const tWild = mk('t1', 'trigger', { trigger: 'message.received', stage: '' });
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe({ nodes: [tWild, c1, a1], edges: pipe().flow.edges })] }, { id: 'ag1' });
  assert.strictEqual(flow.policy[0].from, '*');
});

test('buildFlowPolicy: pipeline inactivo o ajeno al agente → null', () => {
  assert.strictEqual(ZernioCrm.buildFlowPolicy({ pipelines: [pipe(null, { active: false })] }, { id: 'ag1' }), null);
  assert.strictEqual(ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'otroAgente' }), null);
  assert.strictEqual(ZernioCrm.buildFlowPolicy({ pipelines: [] }, { id: 'ag1' }), null);
});

// ── allowsFlowTransition (S1/S3) ────────────────────────────────────────────
test('allowsFlowTransition: arista declarada nuevo→cotizacion permitida', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  assert.strictEqual(ZernioCrm.allowsFlowTransition(flow, 'nuevo', 'cotizacion'), true);
});

test('allowsFlowTransition: etapa fuera del pipeline siempre bloqueada', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  assert.strictEqual(ZernioCrm.allowsFlowTransition(flow, 'nuevo', 'luna'), false);
});

test('allowsFlowTransition: sin política (fallback previo) → true', () => {
  assert.strictEqual(ZernioCrm.allowsFlowTransition(null, 'cotizacion', 'pedido'), true);
});

// ── evaluateLeadTagTransition (guardrail puro = regla de la bandeja) ───────
test('evaluateLeadTagTransition: transición válida → ok sin reason', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  const v = ZernioCrm.evaluateLeadTagTransition(flow, stages, 'nuevo', 'cotizacion');
  assert.deepStrictEqual(v, { ok: true });
});

test('evaluateLeadTagTransition: S3 — etapa no vecina bloqueada con razón', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  const v = ZernioCrm.evaluateLeadTagTransition(flow, stages, 'cotizacion', 'pedido');
  assert.strictEqual(v.ok, false);
  assert.ok(v.reason.includes('sin arista válida'), v.reason);
});

test('evaluateLeadTagTransition: etapa inexistente bloqueada por membresía', () => {
  const flow = ZernioCrm.buildFlowPolicy({ pipelines: [pipe()] }, { id: 'ag1' });
  const v = ZernioCrm.evaluateLeadTagTransition(flow, stages, 'nuevo', 'fantasia');
  assert.strictEqual(v.ok, false);
  assert.ok(v.reason.includes('no existe en el negocio'), v.reason);
});

test('evaluateLeadTagTransition: sin leadTag propuesto → siempre ok', () => {
  const v = ZernioCrm.evaluateLeadTagTransition(null, stages, 'nuevo', null);
  assert.deepStrictEqual(v, { ok: true });
});

console.log(`\n${passed} tests unitarios pasaron`);
process.exit(process.exitCode || 0);