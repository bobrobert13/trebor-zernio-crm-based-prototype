/**
 * @file analytics-heatmap.js — Heatmap presentacional de mejores horarios de
 * atención (7 días × 6 bloques) con leyenda. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['analytics-heatmap'] = {
    props: {
      heatmap: Array,
    },

    template: `
            <!-- Heatmap de horarios -->
            <section class="border-2 border-neutral-900 bg-white p-6">
              <h3 class="mb-6 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Mejores horarios de atención
              </h3>
              <div class="space-y-1.5">
                <div v-for="row in heatmap" :key="row.day" class="flex items-center gap-2">
                  <span class="w-9 shrink-0 font-mono text-[10px] uppercase text-neutral-400">{{ row.day }}</span>
                  <div class="grid flex-1 grid-cols-6 gap-1.5">
                    <div v-for="s in row.slots" :key="s.id" :title="row.day + ' ' + s.label"
                      class="h-9 border border-neutral-200 transition hover:border-neutral-900"
                      :class="[
                        s.intensity === 0 ? 'bg-neutral-50' :
                        s.intensity === 1 ? 'bg-[var(--accent-soft)]' :
                        s.intensity === 2 ? 'bg-[color-mix(in_srgb,var(--accent)_35%,white)]' :
                        s.intensity === 3 ? 'bg-[color-mix(in_srgb,var(--accent)_65%,white)]' :
                        'bg-[var(--accent)]'
                      ]"></div>
                  </div>
                </div>
              </div>
              <div class="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                <span>Menos actividad</span>
                <div class="h-3 w-3 border border-neutral-200 bg-neutral-50"></div>
                <div class="h-3 w-3 border border-neutral-200 bg-[var(--accent-soft)]"></div>
                <div class="h-3 w-3 border border-neutral-200 bg-[color-mix(in_srgb,var(--accent)_35%,white)]"></div>
                <div class="h-3 w-3 border border-neutral-200 bg-[color-mix(in_srgb,var(--accent)_65%,white)]"></div>
                <div class="h-3 w-3 border border-neutral-200 bg-[var(--accent)]"></div>
                <span>Más actividad</span>
              </div>
            </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
