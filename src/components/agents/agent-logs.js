/**
 * @file agent-logs.js — Modal presentacional del log de interacciones de un
 * agente. Recibe agente y formateador por props; emite close.
 * Verbatim del bloque original de agents-view.
 */
(function () {
  'use strict';

  const components = {};

  components['agent-logs'] = {
    props: {
      open: Boolean,
      agent: Object,
      fmtT: Function,
    },

    emits: ['close'],

    template: `
        <!-- Log de interacciones -->
        <ui-modal :open="open" :title="agent ? 'Log · ' + agent.name : 'Log'" width="max-w-2xl" @close="$emit('close')">
          <ui-empty v-if="!agent || (agent.logs || []).length === 0" icon="activity" title="Sin interacciones todavía"
            desc="Las llamadas del agente (sugerencias, auto-respuestas, acciones) aparecerán aquí." class="my-4"></ui-empty>
          <ul v-else class="space-y-2">
            <li v-for="l in agent.logs" :key="l.id" class="border border-neutral-200 p-2.5 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono font-semibold">{{ l.event }}</span>
                <span class="font-mono text-[10px] text-neutral-400">{{ fmtT(l.at) }}</span>
              </div>
              <p class="mt-1">
                <ui-badge :variant="l.ok ? 'success' : 'danger'">{{ l.ok ? 'ok · ' + (l.action || '') : 'error' }}</ui-badge>
                <span v-if="l.contact" class="ml-1 text-neutral-500">{{ l.contact }}</span>
                <span v-if="l.error" class="ml-1 text-red-700">{{ l.error }}</span>
              </p>
            </li>
          </ul>
        </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
