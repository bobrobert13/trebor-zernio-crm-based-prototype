/**
 * @file flow-tab.js — BC Flows (parte presentacional tab) del módulo de
 * campañas. Panel del tab Flows (grid de formularios de WhatsApp). Presentacional:
 * recibe props y handlers; sin estado propio. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Panel del tab Flows. */
  components['flows-tab'] = {
    props: {
      flows: { type: Array, default: () => [] },
      canEdit: Function,
      openFlows: Function, openPreview: Function, openSend: Function,
    },
    template: `
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <p class="text-sm text-neutral-500">
            Formularios nativos de WhatsApp (captura de leads por nicho). Publicados son inmutables: para editar se clona.
          </p>
          <button v-if="canEdit('broadcasts')" @click="openFlows"
            class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo flow
          </button>
        </div>
        <div v-if="flows.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
          <ui-empty icon="edit" title="Sin flows" desc="Crea tu primer formulario de captura de leads."></ui-empty>
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="f in flows" :key="f.id || f._id" class="border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-start justify-between gap-2">
              <h4 class="break-all font-mono text-sm font-semibold">{{ f.name }}</h4>
              <ui-badge :variant="f.status === 'PUBLISHED' ? 'success' : f.status === 'DEPRECATED' ? 'warn' : 'neutral'" dot>{{ f.status }}</ui-badge>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <ui-badge variant="neutral">{{ f.category }}</ui-badge>
              <span v-if="f.previewUrl" class="truncate font-mono text-[10px] text-neutral-400">{{ f.previewUrl }}</span>
            </div>
            <div class="mt-4 flex gap-2">
              <button @click="openPreview(f)"
                class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-semibold transition hover:shadow-brutal-sm">
                Vista previa
              </button>
              <button v-if="f.status === 'PUBLISHED'" @click="openSend(f)"
                class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Enviar flow
              </button>
            </div>
          </article>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();