/**
 * @file flows.js — Módulo Flujos: pipelines personalizados (etapas + flujo
 * visual trigger → condición → acción) que el agente evalua por conversación
 * para mover leads de etapa. Lista de flujos + editor de canvas (flow-builder).
 * Registrado en window.ZernioCrm.components como 'flows-view'.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, canEdit } = ZernioCrm;

  const components = {};

  components['flows-view'] = {
    setup() {
      const fb = ZernioCrm.makeFlowBuilder({ store, toast });
      const editingId = Vue.ref(null);
      const canEditFlows = Vue.computed(() => canEdit('flows'));
      const current = Vue.computed(
        () => fb.pipelines.value.find((p) => p.id === editingId.value) || null
      );

      function createFlow() {
        const p = fb.createPipeline();
        if (p) editingId.value = p.id;
      }

      function openFlow(p) {
        editingId.value = p.id;
      }

      function toggleActive(p) {
        if (p.active) { fb.setActive(p, false); return; }
        const r = fb.validatePipeline(p);
        if (!r.ok) {
          toast(`No se puede activar: ${r.issues[0]}`, 'error', 4500);
          editingId.value = p.id;
          return;
        }
        fb.setActive(p, true);
      }

      function confirmRemove(p) {
        if (window.confirm(`¿Eliminar el flujo "${p.name}"? Los leads conservan su etapa actual.`)) {
          fb.removePipeline(p.id);
          if (editingId.value === p.id) editingId.value = null;
        }
      }

      function agentName(id) {
        const a = fb.agents.value.find((x) => x.id === id);
        return a ? a.name : 'Sin agente';
      }

      function ruleCount(p) {
        return ZernioCrm.previewPolicy(p).length;
      }

      return {
        fb, editingId, current, canEditFlows,
        createFlow, openFlow, toggleActive, confirmRemove,
        agentName, ruleCount,
        ZernioCrm, toast,
      };
    },

    template: `
      <div class="space-y-6">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Flujos</h2>
            <p class="mt-1 max-w-2xl text-sm text-neutral-500">
              Arma el playbook de ventas de tu negocio: disparador → condición en lenguaje natural → acción.
              El agente mueve los leads de etapa según cómo se desenvuelve cada conversación.
            </p>
          </div>
          <div v-if="canEditFlows" class="flex items-center gap-2">
            <button @click="createFlow"
              class="flex items-center gap-1.5 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo flujo
            </button>
          </div>
        </header>

        <!-- Editor del flujo seleccionado -->
        <template v-if="current">
          <flow-builder :pipeline="current" :agents="fb.agents.value" :can-edit="canEditFlows"
            @back="editingId = null"></flow-builder>
        </template>

        <!-- Lista de flujos -->
        <template v-else>
          <p class="border border-neutral-200 bg-stone-50 px-4 py-2.5 text-xs text-neutral-500">
            Cada pipeline agrupa sus etapas y un flujo visual. Solo un flujo por agente activo al mismo tiempo:
            al activar uno, el agente pasa a ejecutar sus reglas en los mensajes entrantes.
          </p>

          <div v-if="fb.pipelines.value.length === 0" class="border-2 border-dashed border-neutral-300 p-10 text-center">
            <ui-icon name="workflow" class="mx-auto h-10 w-10 text-neutral-300"></ui-icon>
            <p class="mt-3 text-sm font-medium text-neutral-600">Todavía no hay flujos</p>
            <p class="mt-1 text-xs text-neutral-400">Crea el primero con la plantilla (disparador → condición → acción) y configúralo a tu estrategia de ventas.</p>
            <button v-if="canEditFlows" @click="createFlow"
              class="mt-4 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Crear flujo inicial
            </button>
          </div>

          <div v-else class="grid gap-4 lg:grid-cols-2">
            <div v-for="p in fb.pipelines.value" :key="p.id"
              class="flex flex-col border-2 border-neutral-900 bg-white shadow-brutal-sm">
              <div class="flex items-center gap-3 border-b-2 border-neutral-900 px-4 py-3">
                <ui-icon name="workflow" class="h-5 w-5 shrink-0" :class="p.active ? 'text-[var(--accent)]' : 'text-neutral-300'"></ui-icon>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-bold leading-tight">{{ p.name }}</h3>
                  <p class="truncate font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                    {{ agentName(p.agentId) }} · {{ (p.stages || []).length }} etapas · {{ ruleCount(p) }} regla(s)
                  </p>
                </div>
                <ui-badge v-if="p.active" variant="accent">Activo</ui-badge>
                <ui-badge v-else>Borrador</ui-badge>
              </div>

              <div class="flex flex-wrap gap-1.5 px-4 py-3">
                <span v-for="s in (p.stages || [])" :key="s" class="border border-neutral-200 bg-stone-50 px-2 py-0.5 font-mono text-[10px] text-neutral-500">{{ s }}</span>
                <span v-if="!p.stages || !p.stages.length" class="text-xs text-neutral-400">Sin etapas definidas</span>
              </div>

              <div class="mt-auto flex items-center gap-2 border-t-2 border-neutral-900 bg-stone-50 px-3 py-2.5">
                <button @click="openFlow(p)"
                  class="flex flex-1 items-center justify-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold shadow-brutal-sm transition hover:shadow-none">
                  <ui-icon name="edit" class="h-3.5 w-3.5"></ui-icon> Abrir editor
                </button>
                <button v-if="canEditFlows" @click="toggleActive(p)"
                  :disabled="!p.active && ruleCount(p) === 0"
                  class="border-2 px-3 py-1.5 text-xs font-semibold shadow-brutal-sm transition hover:shadow-none disabled:opacity-40"
                  :class="p.active ? 'border-neutral-900 bg-white' : 'border-neutral-900 bg-[var(--accent)] text-white'">
                  {{ p.active ? 'Desactivar' : 'Activar' }}
                </button>
                <button v-if="canEditFlows" @click="confirmRemove(p)" class="p-1.5 text-red-600 transition hover:text-red-800" aria-label="Eliminar flujo">
                  <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();