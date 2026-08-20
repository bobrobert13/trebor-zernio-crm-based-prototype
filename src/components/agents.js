/**
 * @file agents.js — Módulo Agente: agentes de IA externos conectables (Mary y
 * otros). Configuración de conexión tipo webhooks (URL + key del servicio),
 * definición del JSON de respuesta del servicio + mapeo campo a campo a la
 * acción canónica del CRM (con prueba de adaptación), flujos de venta que
 * atiende cada agente (atención, clasificación, leads, personalización,
 * campañas), autonomía (auto-respuesta y cierre de ventas) y log de
 * interacciones. Orquestador por bounded context: la lógica vive en
 * src/agents-composables.js y la presentación en src/components/agents/*.
 * 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, uid, canEdit } = ZernioCrm;
  const { AGENT_FLOWS, CANONICAL_FIELDS, MARY_MAPPING, MARY_EXAMPLE, CRM_TOOLS, TOOL_PIPELINES, fmtT } = ZernioCrm;

  const components = {};

  components['agents-view'] = {
    setup() {
      // Composición por bounded context (ver src/agents-composables.js)
      const shell = ZernioCrm.makeAgentsShell({ store, AGENT_FLOWS, CRM_TOOLS });
      let diagnostics = null;
      const editor = ZernioCrm.makeAgentEditor({
        workspace: shell.workspace, agents: shell.agents, toast, uid, canEdit,
        MARY_EXAMPLE, MARY_MAPPING,
        onResetForms: () => {
          if (diagnostics) {
            diagnostics.adaptPreview.value = '';
            diagnostics.adaptError.value = '';
          }
        },
      });
      diagnostics = ZernioCrm.makeAgentDiagnostics({
        form: editor.form,
        toast,
        testAgent: (a) => ZernioCrm.testAgent(a),
        adapt: (ctx, raw) => ZernioCrm.adapt(ctx, raw),
      });
      const logs = ZernioCrm.makeAgentLogs();

      return {
        ...shell,       // workspace, isLive, agents, flowLabel, toolName
        ...editor,      // editorOpen, editingId, showKey, saving, toolsOpen, form, resetForm, openEditor, saveAgent, removeAgent
        ...diagnostics, // testing, adaptPreview, adaptError, testConnection, testAdaptation
        ...logs,        // logsOpen, logsAgent, openLogs
        canEdit, AGENT_FLOWS, CANONICAL_FIELDS, CRM_TOOLS, TOOL_PIPELINES, fmtT,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Agente</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Agentes de IA externos (Mary y otros) que atienden tus flujos de venta: atención, clasificación, leads, personalización y campañas.
              <span class="font-semibold">{{ isLive ? '· conectado a Zernio' : '· modo demo' }}</span>
            </p>
          </div>
          <button v-if="canEdit('agents')" @click="openEditor(null)"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo agente
          </button>
        </header>

        <!-- Cómo funciona -->
        <div class="flex items-start gap-3 border-2 border-neutral-900 bg-white p-4 text-sm">
          <ui-icon name="sparkles" class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"></ui-icon>
          <p class="text-neutral-600">
            Conecta un agente con la <strong>key que te da el servicio</strong>. Define el <strong>JSON de respuesta</strong> del servicio y mapea sus campos a las acciones del CRM.
            Si activas <strong>auto-respuesta</strong> y <strong>cierre de ventas</strong>, el agente opera con total libertad usando inventario, leads, cliente e históricos.
          </p>
        </div>

        <!-- Lista de agentes -->
        <agent-list
          :agents="agents" :is-live="isLive" :flows="AGENT_FLOWS" :testing="testing"
          :can-edit="canEdit" :open-editor="openEditor" :test-connection="testConnection"
          :open-logs="openLogs" :remove-agent="removeAgent"></agent-list>

        <!-- Editor de agente -->
        <agent-editor
          :open="editorOpen" :editing-id="editingId" :form="form" :show-key="showKey"
          :saving="saving" :tools-open="toolsOpen" :adapt-error="adaptError" :adapt-preview="adaptPreview"
          :flows="AGENT_FLOWS" :canonical-fields="CANONICAL_FIELDS" :tools="CRM_TOOLS" :pipelines="TOOL_PIPELINES"
          :tool-name="toolName" :test-adaptation="testAdaptation" :save-agent="saveAgent"
          @close="editorOpen = false" @update:show-key="showKey = $event" @update:tools-open="toolsOpen = $event"></agent-editor>

        <!-- Log de interacciones -->
        <agent-logs :open="logsOpen" :agent="logsAgent" :fmt-t="fmtT" @close="logsOpen = false"></agent-logs>
      </div>`,
};

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = window.ZernioCrm.components || {};
  Object.assign(window.ZernioCrm.components, components);
})();
