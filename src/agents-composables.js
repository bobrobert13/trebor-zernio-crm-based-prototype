/**
 * @file agents-composables.js — Composables por bounded context del módulo
 * Agent. Extraen la lógica del setup de agents-view (catálogo, editor del
 * agente, diagnósticos y log) a objetos `{ refs, computeds, helpers }`.
 * Convención `Z.makeXxx`; sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /** Flujos por defecto del formulario (atención, clasificación, leads…). */
  function defaultFlows() {
    return { inbox: true, classification: true, leads: true, personalization: false, campaigns: false };
  }

  /**
   * BC Shell: catálogo de agentes del workspace y etiquetas legibles de
   * flujos y herramientas MCP.
   */
  function makeAgentsShell({ store, AGENT_FLOWS, CRM_TOOLS }) {
    const workspace = Vue.computed(() => store.workspace);
    const isLive = Vue.computed(() => store.mode === 'live');
    const agents = Vue.computed(() => (workspace.value && workspace.value.agents) || []);

    function flowLabel(id) {
      const f = AGENT_FLOWS.find((x) => x.id === id);
      return f ? f.label : id;
    }

    /** Nombre legible de una herramienta MCP por id (pipelines). */
    function toolName(id) {
      const t = CRM_TOOLS.find((x) => x.id === id);
      return t ? t.name : id;
    }

    return { workspace, isLive, agents, flowLabel, toolName };
  }

  /**
   * BC Editor: estado y guardado del agente (crear/editar). El formulario
   * es una única instancia reactiva compartida con el BC de diagnósticos.
   */
  function makeAgentEditor({ workspace, agents, toast, uid, canEdit, MARY_EXAMPLE, MARY_MAPPING, onResetForms }) {
    const editorOpen = Vue.ref(false);
    const editingId = Vue.ref(null); // null = agente nuevo
    const showKey = Vue.ref(false);
    const saving = Vue.ref(false);
    const toolsOpen = Vue.ref(false); // capacidades MCP del CRM expuestas al agente

    /** Formulario del editor (flujos y mapeo como objetos editables). */
    const form = Vue.reactive({
      name: '',
      provider: 'Mary',
      url: '',
      apiKey: '',
      active: true,
      flows: defaultFlows(),
      autoReply: false,
      autoCloseSale: false,
      responseExample: MARY_EXAMPLE,
      mapping: {},
    });

    function resetForm() {
      editingId.value = null;
      Object.assign(form, {
        name: '', provider: 'Mary', url: '', apiKey: '', active: true,
        flows: defaultFlows(),
        autoReply: false, autoCloseSale: false,
        responseExample: MARY_EXAMPLE,
        mapping: Object.assign({}, MARY_MAPPING),
      });
      showKey.value = false;
      if (onResetForms) onResetForms();
    }

    /** Abre el editor (agente existente o nuevo). */
    function openEditor(agent) {
      resetForm();
      if (agent) {
        editingId.value = agent.id;
        Object.assign(form, {
          name: agent.name, provider: agent.provider || 'Mary', url: agent.url || '',
          apiKey: agent.apiKey || '', active: agent.active !== false,
          flows: Object.assign(defaultFlows(), agent.flows || {}),
          autoReply: Boolean(agent.autoReply), autoCloseSale: Boolean(agent.autoCloseSale),
          responseExample: agent.responseExample || MARY_EXAMPLE,
          mapping: Object.assign({}, MARY_MAPPING, agent.mapping || {}),
        });
      }
      editorOpen.value = true;
    }

    /** Guarda (crea o actualiza) el agente en workspace.agents (persistido). */
    function saveAgent() {
      if (saving.value) return;
      if (!form.name.trim()) {
        toast('Ponle un nombre al agente', 'error');
        return;
      }
      saving.value = true;
      const payload = {
        name: form.name.trim(),
        provider: form.provider || 'Mary',
        url: form.url.trim(),
        apiKey: form.apiKey.trim(),
        active: form.active,
        flows: Object.assign({}, form.flows),
        autoReply: Boolean(form.autoReply),
        autoCloseSale: Boolean(form.autoCloseSale),
        responseExample: form.responseExample,
        mapping: Object.assign({}, form.mapping),
      };
      if (editingId.value) {
        const agent = agents.value.find((a) => a.id === editingId.value);
        if (agent) Object.assign(agent, payload);
        toast(`Agente ${payload.name} actualizado`, 'success');
      } else {
        workspace.value.agents.unshift({ id: uid('ag'), logs: [], ...payload });
        toast(`Agente ${payload.name} conectado`, 'success');
      }
      saving.value = false;
      editorOpen.value = false;
    }

    function removeAgent(agent) {
      if (!canEdit('agents')) return;
      const i = agents.value.indexOf(agent);
      if (i >= 0) agents.value.splice(i, 1);
      toast('Agente eliminado', 'info');
    }

    return { editorOpen, editingId, showKey, saving, toolsOpen, form, resetForm, openEditor, saveAgent, removeAgent };
  }

  /**
   * BC Diagnósticos: prueba de conexión al servicio y prueba de adaptación
   * del JSON de ejemplo contra el mapeo de acciones canónicas.
   */
  function makeAgentDiagnostics({ form, toast, testAgent, adapt }) {
    const testing = Vue.ref(false);
    const adaptPreview = Vue.ref('');
    const adaptError = Vue.ref('');

    /** Prueba la conexión al servicio (live) o simula (demo). */
    async function testConnection(agent) {
      if (testing.value) return;
      testing.value = true;
      try {
        await testAgent(agent);
        toast('Conexión OK: el servicio respondió', 'success');
      } catch (err) {
        toast(err.message || 'No se pudo conectar con el servicio', 'error');
      } finally {
        testing.value = false;
      }
    }

    /** Corre el JSON de ejemplo por el mapeo y muestra la acción canónica. */
    function testAdaptation() {
      adaptError.value = '';
      adaptPreview.value = '';
      try {
        const raw = JSON.parse(form.responseExample);
        const action = adapt({ mapping: form.mapping }, raw);
        adaptPreview.value = JSON.stringify(action, null, 2);
      } catch (err) {
        adaptError.value = err.message || 'JSON inválido';
      }
    }

    return { testing, adaptPreview, adaptError, testConnection, testAdaptation };
  }

  /**
   * BC Logs: modal de interacciones del agente seleccionado.
   */
  function makeAgentLogs() {
    const logsOpen = Vue.ref(false);
    const logsAgent = Vue.ref(null);

    function openLogs(agent) {
      logsAgent.value = agent;
      logsOpen.value = true;
    }

    return { logsOpen, logsAgent, openLogs };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeAgentsShell, makeAgentEditor, makeAgentDiagnostics, makeAgentLogs,
  });
})();