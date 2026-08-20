/**
 * @file analytics-kpis.js — KPIs resumen del periodo con tendencia semántica.
 * Recibe los KPIs por props. Verbatim del bloque original de analytics-view.
 */
(function () {
  'use strict';

  const components = {};

  components['analytics-kpis'] = {
    props: {
      summary: Array,
    },

    template: `
          <!-- KPIs resumen -->
          <section class="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <div v-for="k in summary" :key="k.id"
              class="flex h-28 flex-col justify-between border-2 border-neutral-900 bg-white p-5">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">{{ k.label }}</span>
                <ui-icon :name="k.icon" class="h-4 w-4 text-neutral-300"></ui-icon>
              </div>
              <div class="flex items-end justify-between gap-2">
                <p class="text-3xl font-bold tabular-nums">
                  {{ k.value }}<span v-if="k.unit" class="ml-1 text-base font-medium text-neutral-400">{{ k.unit }}</span>
                </p>
                <!-- Indicativo semántico de tendencia (para 'resp' bajar es mejorar) -->
                <span class="flex items-center gap-0.5 font-mono text-[10px] tabular-nums"
                  :class="(k.positiveUp ? k.trend.dir === 'up' : k.trend.dir === 'down') ? 'text-emerald-700' : k.trend.dir === 'flat' ? 'text-neutral-400' : 'text-red-700'">
                  <ui-icon :name="k.trend.dir === 'flat' ? 'minus' : 'arrow-right'"
                    class="h-3 w-3" :class="k.positiveUp ? (k.trend.dir === 'down' ? 'rotate-90' : k.trend.dir === 'up' ? '-rotate-90' : '') : (k.trend.dir === 'up' ? 'rotate-90' : k.trend.dir === 'down' ? '-rotate-90' : '')"></ui-icon>
                  {{ k.trend.dir === 'flat' ? 'estable' : k.trend.pct + '%' }}
                </span>
              </div>
            </div>
          </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
