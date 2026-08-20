/**
 * @file agent-list.js — Listado presentacional de agentes conectados (empty
 * state + grid de tarjetas). Recibe datos, RBAC y handlers por props.
 * Verbatim del bloque original de agents-view.
 */
(function () {
  'use strict';

  const components = {};

  components['agent-list'] = {
    props: {
      agents: Array,
      isLive: Boolean,
      flows: Array,
      testing: Boolean,
      canEdit: Function,
      openEditor: Function,
      testConnection: Function,
      openLogs: Function,
      removeAgent: Function,
    },

    template: `
        <!-- Lista de agentes -->
        <ui-empty v-if="agents.length === 0" icon="sparkles" title="Sin agentes conectados"
          desc="Conecta tu primer agente para atender los flujos de venta con IA.">
          <button v-if="canEdit('agents')" @click="openEditor(null)"
            class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Conectar agente
          </button>
        </ui-empty>
        <div v-else class="grid gap-4 lg:grid-cols-2">
          <article v-for="a in agents" :key="a.id" class="border-2 border-neutral-900 bg-white p-4 shadow-brutal-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ui-icon name="sparkles" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <p class="font-semibold leading-tight">{{ a.name }}</p>
                  <p class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    {{ a.provider }} · {{ a.url || (isLive ? 'sin URL' : 'simulación local') }}
                  </p>
                </div>
              </div>
              <ui-badge :variant="a.active ? 'success' : 'neutral'" dot>{{ a.active ? 'Activo' : 'Pausado' }}</ui-badge>
            </div>

            <div class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="f in AGENT_FLOWS" :key="f.id" class="border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                :class="a.flows[f.id] ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-neutral-200 text-neutral-300 line-through'">
                {{ f.label }}
              </span>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <ui-badge v-if="a.autoReply" variant="accent" dot>Auto-respuesta</ui-badge>
              <ui-badge v-if="a.autoCloseSale" variant="warn" dot>Cierra ventas</ui-badge>
              <span class="font-mono text-[10px] text-neutral-400">{{ (a.logs || []).length }} interacciones</span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button v-if="canEdit('agents')" @click="openEditor(a)"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm">
                <ui-icon name="edit" class="h-3.5 w-3.5"></ui-icon> Editar
              </button>
              <button @click="testConnection(a)" :disabled="testing"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm disabled:opacity-40">
                <ui-spinner v-if="testing" size="h-3.5 w-3.5"></ui-spinner>
                <ui-icon v-else name="zap" class="h-3.5 w-3.5"></ui-icon> Probar conexión
              </button>
              <button @click="openLogs(a)"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm">
                <ui-icon name="activity" class="h-3.5 w-3.5"></ui-icon> Log
              </button>
              <button v-if="canEdit('agents')" @click="removeAgent(a)"
                class="ml-auto px-2 py-1.5 text-xs font-semibold text-red-700 underline">Eliminar</button>
            </div>
          </article>
        </div>
`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
