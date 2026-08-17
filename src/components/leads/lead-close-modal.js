/**
 * @file lead-close-modal.js — BC CloseModal del tablero de leads.
 * Modal de cierre de lead. Presentacional: consume el slice de
 * shared.makeCloseLead vía props (form/target/productQuery/results) y emite
 * update:productQuery para el buscador. Verbatim de leads-view.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['lead-close-modal'] = {
    props: {
      open: Boolean, target: { type: Object, default: null },
      form: { type: Object, default: null },
      productQuery: { type: String, default: '' },
      productResults: { type: Array, default: () => [] },
      workspaceProducts: { type: Array, default: () => [] },
      stageLabel: Function, metricsOf: Function, fmtD: Function, productName: Function,
      toggleCloseProduct: Function, confirmClose: Function, closeReasons: { type: Array, default: () => [] },
    },
    emits: ['update:productQuery', 'close'],
    setup(props, { emit }) {
      const q = Vue.computed({
        get: () => props.productQuery,
        set: (v) => emit('update:productQuery', v),
      });
      return { q };
    },
    template: `
      <ui-modal :open="open" :title="'Cerrar lead · ' + (target ? target.name : '')" width="max-w-md" @close="$emit('close')">
        <div class="space-y-4">
          <p class="text-sm text-neutral-500">
            Da por terminado el seguimiento de este lead. Puedes reabrirlo cuando quieras.
          </p>

          <!-- Resumen del lead -->
          <div v-if="target" class="flex items-center gap-3 border border-neutral-200 bg-stone-50 p-3">
            <ui-avatar :name="target.name" size="h-10 w-10 text-sm"></ui-avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ target.name }}</p>
              <p class="truncate font-mono text-[11px] text-neutral-500">
                Etapa: {{ stageLabel(target.leadTag) }}
                <span v-if="target.createdAt"> · Cliente desde {{ fmtD(target.createdAt) }}</span>
              </p>
            </div>
            <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ metricsOf(target).days }} días</span>
          </div>

          <ui-field label="¿Se concretó?">
            <div class="flex gap-1.5">
              <button @click="form.outcome = 'ganada'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="form.outcome === 'ganada' ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-neutral-300'">
                Sí, se concretó
              </button>
              <button @click="form.outcome = 'perdida'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="form.outcome === 'perdida' ? 'border-red-800 bg-red-50 text-red-900' : 'border-neutral-300'">
                No se concretó
              </button>
            </div>
          </ui-field>

          <!-- Productos/servicios vinculados al cierre (preselección desde menciones) -->
          <div v-if="workspaceProducts.length">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">¿Qué productos/servicios se cerraron?</p>
            <div v-if="form.products.length" class="mb-2 flex flex-wrap gap-1.5">
              <button v-for="id in form.products" :key="id" @click="toggleCloseProduct(id)"
                class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition border-[var(--accent)] bg-[var(--accent)] text-white">
                {{ productName(id) }} ✕
              </button>
            </div>
            <input v-model.trim="q" type="search" placeholder="Buscar y agregar producto…"
              class="w-full border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            <div v-if="q" class="mt-1.5 flex flex-wrap gap-1.5">
              <button v-for="p in productResults" :key="p.id" @click="toggleCloseProduct(p.id)"
                class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                :class="form.products.includes(p.id) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                {{ p.name }}
              </button>
            </div>
          </div>

          <ui-field label="Motivo (opcional)">
            <div class="flex flex-wrap gap-1.5">
              <button v-for="r in closeReasons" :key="r" @click="form.reason = form.reason === r ? '' : r"
                class="border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                :class="form.reason === r ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                {{ r }}
              </button>
            </div>
          </ui-field>

          <ui-field label="Nota (opcional)">
            <textarea v-model.trim="form.note" rows="3" placeholder="Cuéntanos cómo fue el cierre…"
              class="w-full resize-none border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"></textarea>
          </ui-field>
          <button @click="confirmClose"
            class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Confirmar cierre
          </button>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();