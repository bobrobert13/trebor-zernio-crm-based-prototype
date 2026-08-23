/**
 * @file flow-builder-composables.js — Lógica del módulo Flujos: pipelines
 * (etapas + flujo visual de nodos/aristas) que el agente evalua por mensaje
 * entrante. Validación de publicación, plantilla por defecto y preview de la
 * política compilada (mismas reglas que agent-client.buildFlowPolicy).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /** Metadatos de los 3 tipos de nodo permitidos (corte de alcance del spec). */
  const NODE_TYPES = {
    trigger: {
      label: 'Disparador', icon: 'zap', tone: 'border-neutral-900 bg-neutral-900 text-white',
      desc: 'Cuándo se evalúa (vd: mensaje recibido) y en qué etapa aplica.',
      defaults: { trigger: 'message.received', stage: '' },
    },
    condition: {
      label: 'Condición', icon: 'alert', tone: 'border-neutral-900 bg-amber-400 text-neutral-900',
      desc: 'Criterio en lenguaje natural: el agente decide si se cumple.',
      defaults: { condition: '' },
    },
    action: {
      label: 'Acción', icon: 'zap', tone: 'border-neutral-900 bg-[var(--accent)] text-white',
      desc: 'Qué hacer al cumplirse: mover etapa, responder, recordatorio…',
      defaults: { actionId: 'classify', stage: '', text: '' },
    },
  };

  const NODE_ORDER = ['trigger', 'condition', 'action'];

  /** Definición de acciones del nodo action (subconjunto de CRM_TOOLS). */
  const ACTION_OPTIONS = [
    { value: 'classify', label: 'Mover a etapa', needsStage: true },
    { value: 'reply', label: 'Responder mensaje', needsText: true },
    { value: 'reminder', label: 'Crear recordatorio', needsText: true },
  ];

  /** Nombre corto de un nodo para mensajes de validación. */
  function labelOf(n) {
    const t = NODE_TYPES[n.type];
    return t ? t.label : n.type;
  }

  /** Frase corta de la acción configurada. */
  function actionPhrase(data) {
    if (data.actionId === 'classify') return `mover a "${data.stage || '…'}"`;
    if (data.actionId === 'reply') return `responder: "${String(data.text || '').slice(0, 40)}"`;
    if (data.actionId === 'reminder') return 'crear recordatorio de seguimiento';
    return 'sin acción definida';
  }

  /**
   * Valida un pipeline antes de publicar/activar. Reglas = escenarios del
   * spec (S4): nombre, agente, etapas, cadena conectada, acción coherente.
   * Función pura (nivel de módulo) para testear sin instancia.
   * @param {object} p — pipeline.
   * @returns {{ok:boolean, issues:Array<string>}}
   */
  function validatePipeline(p) {
    const issues = [];
    if (!p) return { ok: false, issues: ['Sin pipeline'] };
    if (!String(p.name || '').trim()) issues.push('El flujo necesita un nombre.');
    if (!p.agentId) issues.push('Asigna un agente que ejecute el flujo.');
    if (!Array.isArray(p.stages) || p.stages.length < 2) issues.push('El pipeline necesita al menos 2 etapas.');
    const nodes = (p.flow && p.flow.nodes) || [];
    const edges = (p.flow && p.flow.edges) || [];
    const ids = new Set(nodes.map((n) => n.id));
    if (!nodes.some((n) => n.type === 'trigger')) issues.push('Falta un nodo Disparador.');
    if (!nodes.some((n) => n.type === 'condition')) issues.push('Falta un nodo Condición.');
    if (!nodes.some((n) => n.type === 'action')) issues.push('Falta un nodo Acción.');
    if (edges.length === 0) issues.push('Conecta al menos una arista entre nodos.');
    edges.forEach((e) => {
      if (!ids.has(e.source) || !ids.has(e.target)) issues.push('Hay una arista apuntando a un nodo inexistente.');
      if (e.source === e.target) issues.push('Una arista se conecta a sí misma.');
    });
    nodes.forEach((n) => {
      const out = edges.filter((e) => e.source === n.id).length;
      const inn = edges.filter((e) => e.target === n.id).length;
      if (n.type === 'trigger' && out === 0) issues.push(`El disparador "${labelOf(n)}" no tiene salida conectada.`);
      if (n.type === 'condition') {
        if (out === 0) issues.push(`La condición "${labelOf(n)}" no tiene salida conectada.`);
        if (inn === 0) issues.push(`La condición "${labelOf(n)}" no tiene entrada conectada.`);
        if (!String((n.data && n.data.condition) || '').trim()) issues.push(`La condición "${labelOf(n)}" está vacía: escribe el criterio en lenguaje natural.`);
      }
      if (n.type === 'action') {
        if (inn === 0) issues.push(`La acción "${labelOf(n)}" no tiene entrada conectada.`);
        const aId = n.data && n.data.actionId;
        if (!aId) issues.push(`La acción "${labelOf(n)}" no eligió qué hacer.`);
        if (aId === 'classify' && !(p.stages || []).includes(n.data.stage)) {
          issues.push(`La acción "${labelOf(n)}" apunta a una etapa inexistente en el pipeline.`);
        }
      }
    });
    return { ok: issues.length === 0, issues };
  }

  /**
   * Preview legible de la política compilada del flujo (misma lógica que
   * agent-client.buildFlowPolicy, sin ligar a agente). Función pura.
   * @param {object} p — pipeline.
   * @returns {Array<string>} frases una por regla.
   */
  function previewPolicy(p) {
    if (!p || !p.flow) return [];
    const { nodes, edges } = p.flow;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const outs = (id) => edges.filter((e) => e.source === id).map((e) => e.target);
    const lines = [];
    nodes.filter((n) => n.type === 'trigger').forEach((t) => {
      outs(t.id).forEach((condId) => {
        const c = byId.get(condId);
        if (!c || c.type !== 'condition') return;
        outs(condId).forEach((actId) => {
          const a = byId.get(actId);
          if (!a || a.type !== 'action' || !a.data) return;
          const from = (t.data && t.data.stage) || '';
          const fromLabel = from === ''
            ? 'cualquier etapa'
            : from === '__sin_asignar__' ? 'sin asignar' : `"${from}"`;
          const what = actionPhrase(a.data);
          lines.push(`Al recibir mensaje${from === '' ? '' : ` · lead en ${fromLabel}`} → si "${(c.data && c.data.condition) || '…'}" → ${what}`);
        });
      });
    });
    return lines;
  }

  /**
   * Fabrica la lógica del módulo Flujos.
   * @param {{store:object, toast:Function}} deps — store global + toast.
   */
  function makeFlowBuilder({ store, toast }) {
    const workspace = Vue.computed(() => store.workspace);
    const pipelines = Vue.computed(() => workspace.value && workspace.value.pipelines || []);
    const agents = Vue.computed(() => (workspace.value && workspace.value.agents) || []);

    /** @returns {string} id corto tipo pipeline. */
    function pipelineUid() {
      return ZernioCrm.uid('plp');
    }

    /** Crea un pipeline nuevo con flujo plantilla (trigger → condition → action). */
    function createPipeline() {
      const ws = workspace.value;
      if (!ws) return null;
      const steps = (ws.leadTags || []).slice(0, 2);
      const stage = steps[1] || (ws.leadTags || [])[0] || 'cotizacion';
      const [trg, cond, act] = [0, 1, 2].map(() => ZernioCrm.uid('nd'));
      const p = {
        id: pipelineUid(),
        name: 'Nuevo flujo',
        active: false,
        agentId: '',
        stages: (ws.leadTags || []).slice(),
        flow: {
          nodes: [
            { id: trg, type: 'trigger', data: Object.assign({}, NODE_TYPES.trigger.defaults), position: { x: 40, y: 80 } },
            { id: cond, type: 'condition', data: Object.assign({}, NODE_TYPES.condition.defaults), position: { x: 320, y: 80 } },
            { id: act, type: 'action', data: Object.assign({}, NODE_TYPES.action.defaults, { stage }), position: { x: 600, y: 80 } },
          ],
          // Cadena plantilla: trigger→condition→action
          edges: [
            { id: ZernioCrm.uid('ed'), source: trg, target: cond },
            { id: ZernioCrm.uid('ed'), source: cond, target: act },
          ],
        },
      };
      ws.pipelines.push(p);
      return p;
    }

    /** Elimina un pipeline (sin tocar contactos: sus leadTag quedan como están). */
    function removePipeline(id) {
      const ws = workspace.value;
      if (!ws) return;
      ws.pipelines = ws.pipelines.filter((p) => p.id !== id);
      toast('Flujo eliminado', 'info');
    }

    /** Cambia el estado activo/inactivo de un pipeline. */
    function setActive(p, active) {
      p.active = Boolean(active);
      toast(p.active ? `Flujo "${p.name}" activado` : `Flujo "${p.name}" desactivado`, 'info');
    }

    return {
      workspace, pipelines, agents,
      NODE_TYPES, NODE_ORDER, ACTION_OPTIONS,
      createPipeline, removePipeline, setActive, validatePipeline, previewPolicy,
    };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeFlowBuilder,
    validatePipeline, previewPolicy,
    FLOW_NODE_TYPES: NODE_TYPES,
    FLOW_NODE_ORDER: NODE_ORDER,
    FLOW_ACTION_OPTIONS: ACTION_OPTIONS,
  });
})();