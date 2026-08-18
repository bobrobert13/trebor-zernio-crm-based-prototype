/**
 * @file sequence-tab.js — BC Secuencias (parte presentacional tab) del módulo
 * de campañas. Panel del tab Secuencias (grid de drip multi-paso) y modal de
 * enrolar contactos. Presentacional: recibe props y handlers; emite cierre.
 * Verbatim de los bloques originales de broadcasts-view.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Panel del tab Secuencias. */
  components['sequences-tab'] = {
    props: {
      sequences: { type: Array, default: () => [] },
      canEdit: Function, seqStatusTone: Function,
      openSequences: Function, openPreview: Function,
      toggle: Function, openEnroll: Function,
    },
    template: `
      <div class="space-y-5">
        <div class="flex items-center justify-between">
          <p class="text-sm text-neutral-500">
            Drip multi-paso por WhatsApp. Los contactos enrolados salen al responder (exitOnReply).
          </p>
          <button v-if="canEdit('broadcasts')" @click="openSequences"
            class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nueva secuencia
          </button>
        </div>
        <div v-if="sequences.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
          <ui-empty icon="zap" title="Sin secuencias" desc="Crea un flujo de seguimiento automático."></ui-empty>
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="s in sequences" :key="s.id || s._id" class="border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-semibold">{{ s.name }}</h4>
              <ui-badge :variant="seqStatusTone(s.status)" dot>{{ s.status }}</ui-badge>
            </div>
            <p class="mt-2 font-mono text-[11px] tabular-nums text-neutral-500">
              {{ (s.steps || []).length }} pasos · {{ s.enrolled || s.enrollmentCount || 0 }} enrolados
            </p>
            <ul class="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
              <li v-for="st in (s.steps || []).slice(0, 3)" :key="st.order" class="flex items-center gap-2 text-xs text-neutral-600">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[10px] tabular-nums">{{ st.order }}</span>
                <span class="min-w-0 flex-1 truncate">{{ (st.message && st.message.text) || (st.template && st.template.name) || 'Mensaje' }}</span>
                <span class="shrink-0 font-mono text-[9px] uppercase text-neutral-400">{{ st.delayMinutes === 0 ? 'ahora' : Math.round((st.delayMinutes || 0) / 1440) + ' d' }}</span>
              </li>
            </ul>
            <div class="mt-4 grid grid-cols-3 gap-2">
              <button @click="openPreview(s)"
                class="border-2 border-neutral-900 bg-white px-2 py-1.5 text-xs font-medium transition hover:shadow-brutal-sm">
                Pipeline
              </button>
              <button @click="toggle(s)" class="border-2 border-neutral-900 bg-white px-2 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                {{ s.status === 'active' ? 'Pausar' : 'Activar' }}
              </button>
              <button @click="openEnroll(s)" class="border-2 border-neutral-900 bg-neutral-900 px-2 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Enrolar
              </button>
            </div>
          </article>
        </div>
      </div>`,
  };

  /** Modal: enrolar contactos en una secuencia. */
  components['enroll-modal'] = {
    props: {
      open: Boolean, sequence: { type: Object, default: null },
      count: { type: Number, default: 0 },
      enrolling: Boolean, enroll: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" title="Enrolar contactos" width="max-w-md" @close="$emit('close')">
        <p class="text-sm text-neutral-600">
          Se enrolarán <span class="font-semibold">{{ count }}</span> contactos en
          <span class="font-semibold">{{ sequence ? sequence.name : '' }}</span>.
          Los que ya estén enrolados se omiten.
        </p>
        <button @click="enroll" :disabled="enrolling"
          class="mt-4 flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
          <ui-spinner v-if="enrolling" size="h-4 w-4"></ui-spinner>
          {{ enrolling ? 'Enrolando…' : 'Enrolar contactos' }}
        </button>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();