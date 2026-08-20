/**
 * @file analytics.js — Vista de analítica full-width con gráficos CSS puros
 * (sin librerías): métricas diarias en barras, heatmap de mejores horarios
 * y KPIs del nicho. Demo: series sintéticas deterministas por workspace.
 * Live: /analytics/daily-metrics, /accounts/follower-stats, /analytics/best-time
 * (requiere add-on analytics; banner si 403). Exportación CSV del periodo.
 * Orquestador por bounded context: la lógica vive en src/analytics-composables.js
 * (1:1 con el comportamiento previo).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, getNiche } = ZernioCrm;

  const components = {};

  components['analytics-view'] = {
    setup() {
      // Composición por bounded context (ver src/analytics-composables.js)
      const series = ZernioCrm.makeAnalyticsSeries({ store, api, toast, getNiche });
      const sum = ZernioCrm.makeAnalyticsSummary({ workspace: series.workspace, range: series.range, daily: series.daily });
      const exp = ZernioCrm.makeAnalyticsExport({ workspace: series.workspace, daily: series.daily, toast, downloadText: (a, b, c) => ZernioCrm.downloadText(a, b, c) });

      const guideOpen = Vue.ref(false);

      Vue.onMounted(series.load);

      return {
        ...series,   // workspace, niche, profileId, isLive, range, loading, addonError, source, daily, heatmap, maxDaily, WEEKDAYS, SLOTS, load
        ...sum,      // summary
        ...exp,      // exportCsv
        guideOpen, ui: ZernioCrm,
      };
    },

    template: `

      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Analítica de {{ niche.nombre }}</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Fuente: <span class="font-semibold">{{ isLive ? 'Zernio (live)' : 'Demo simulada' }}</span>
              · últimas {{ range }} días
            </p>
          </div>
          <div class="flex items-center gap-2">
            <select v-model.number="range" @change="load"
              class="border-2 border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900">
              <option :value="7">7 días</option>
              <option :value="14">14 días</option>
              <option :value="30">30 días</option>
            </select>
            <button @click="load" class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Actualizar
            </button>
            <button @click="exportCsv" class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar CSV
            </button>
          </div>
        </header>

        <!-- Guía explicativa: qué significa cada métrica -->
        <section class="border-2 border-neutral-900 bg-white">
          <button @click="guideOpen = !guideOpen" class="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <ui-icon name="book" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">¿Qué significa cada métrica?</p>
                <p class="text-xs text-neutral-500">Guía rápida con códigos de color para leer esta vista sin confusiones.</p>
              </div>
            </div>
            <ui-icon name="chevron-down" class="h-4 w-4 shrink-0 text-neutral-400 transition-transform" :class="guideOpen ? 'rotate-180' : ''"></ui-icon>
          </button>
          <div v-if="guideOpen" class="border-t border-neutral-200 p-5">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article v-for="g in ui.ANALYTICS_GUIDE" :key="g.id" class="flex flex-col border p-4" :class="g.color">
                <div class="flex items-center justify-between">
                  <ui-icon :name="g.icon" class="h-5 w-5"></ui-icon>
                  <span class="font-mono text-[9px] uppercase tracking-widest opacity-70">código {{ g.color.includes('emerald') ? 'verde' : g.color.includes('amber') ? 'ámbar' : g.color.includes('sky') ? 'azul' : 'rojo' }}</span>
                </div>
                <h4 class="mt-2 font-semibold">{{ g.nombre }}</h4>
                <p class="mt-1 text-xs leading-relaxed opacity-90">{{ g.que }}</p>
                <p class="mt-2 font-mono text-[9px] uppercase tracking-widest opacity-70">Cómo se calcula</p>
                <p class="mt-0.5 text-xs opacity-80">{{ g.como }}</p>
                <p class="mt-2 font-mono text-[9px] uppercase tracking-widest opacity-70">Cuándo mirarla</p>
                <p class="mt-0.5 text-xs opacity-80">{{ g.cuando }}</p>
              </article>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2 border border-neutral-200 bg-stone-50 p-4 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <span class="flex items-center gap-1.5"><ui-icon name="activity" class="h-4 w-4"></ui-icon> Interacción</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="message" class="h-4 w-4"></ui-icon> Mensaje</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="users" class="h-4 w-4"></ui-icon> Conversación</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="zap" class="h-4 w-4"></ui-icon> Seguimiento</span>
              <span class="ml-auto normal-case">el flujo de datos de la plataforma a tu CRM</span>
            </div>
          </div>
        </section>

        <!-- Aviso de add-on -->
        <div v-if="addonError" class="flex items-start gap-3 border-2 border-amber-700 bg-amber-50 p-4 text-sm text-amber-900">
          <ui-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0"></ui-icon>
          <p>El plan de Zernio no incluye el add-on de Analytics (403). Se muestran datos de demostración; contrata el add-on para métricas reales.</p>
        </div>

        <!-- Carga -->
        <div v-if="loading" class="space-y-6">
          <div class="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <ui-skeleton v-for="i in 4" :key="i" h="h-28"></ui-skeleton>
          </div>
          <ui-skeleton h="h-80"></ui-skeleton>
        </div>

        <template v-else>
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
          </section>

          <div class="grid gap-6 xl:grid-cols-2">
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
            </section>

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
            </section>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
