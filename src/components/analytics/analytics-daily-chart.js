/**
 * @file analytics-daily-chart.js — Barras diarias de conversaciones, escala por
 * el máximo del periodo. Recibe serie, escala y fuente por props. Verbatim.
 */
(function () {
  'use strict';

  const components = {};

  components['analytics-daily-chart'] = {
    props: {
      daily: Array,
      maxDaily: Number,
      source: String,
    },

    template: `
            <!-- Barras diarias -->
            <section class="border-2 border-neutral-900 bg-white p-6">
              <h3 class="mb-6 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                Conversaciones por día
              </h3>
              <div class="flex h-64 items-end gap-1.5">
                <div v-for="d in daily" :key="d.date" class="group flex flex-1 flex-col items-center gap-2" :title="d.label + ': ' + d.value">
                  <div class="w-full rounded-t border-2 border-b-0 border-neutral-900 bg-[var(--accent)] transition-all group-hover:opacity-80"
                    :style="{ height: Math.max(4, (d.value / maxDaily) * 100) + '%' }"></div>
                  <span class="rotate-0 font-mono text-[9px] text-neutral-400 lg:rotate-0">{{ d.label }}</span>
                </div>
              </div>
              <p class="mt-4 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                {{ source === 'live' ? 'Datos reales del API de Zernio' : 'Serie sintética del modo demo' }}
              </p>
            </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
