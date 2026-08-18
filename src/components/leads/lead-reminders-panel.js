/**
 * @file lead-reminders-panel.js — BC Reminders del tablero de leads.
 * Drawer global de recordatorios próximos (todas las leads). Presentacional:
 * recibe listado + handlers por props. Verbatim de leads-view.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['lead-reminders-panel'] = {
    props: {
      open: Boolean, upcoming: { type: Array, default: () => [] },
      fmtDT: Function, openDetail: Function, setOpen: Function,
    },
    template: `
      <ui-drawer :open="open" title="Recordatorios próximos" width="max-w-md" @close="setOpen(false)">
        <div class="space-y-2">
          <div v-for="r in upcoming" :key="r.id">
            <button v-if="r.contact" @click="setOpen(false); openDetail(r.contact)"
              class="w-full border border-neutral-200 p-3 text-left transition hover:border-neutral-900 hover:bg-stone-50"
              :class="r.dueAt && Date.parse(r.dueAt) < Date.now() ? 'border-red-700 bg-red-50' : ''">
              <div class="flex items-center justify-between gap-2">
                <span class="truncate text-sm font-semibold">{{ r.contact ? r.contact.name : 'Contacto' }}</span>
                <span v-if="r.dueAt" class="shrink-0 font-mono text-[9px] uppercase"
                  :class="Date.parse(r.dueAt) < Date.now() ? 'text-red-700' : 'text-neutral-400'">
                  {{ fmtDT(r.dueAt) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-neutral-600">{{ r.text }}</p>
            </button>
          </div>
          <p v-if="upcoming.length === 0" class="py-8 text-center text-sm text-neutral-400">Sin recordatorios pendientes.</p>
        </div>
      </ui-drawer>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();