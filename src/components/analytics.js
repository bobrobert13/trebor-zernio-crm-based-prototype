/**
 * @file analytics.js — Vista de analítica full-width con gráficos CSS puros
 * (sin librerías): métricas diarias en barras, heatmap de mejores horarios
 * y KPIs del nicho. Demo: series sintéticas deterministas por workspace.
 * Live: /analytics/daily-metrics, /accounts/follower-stats, /analytics/best-time
 * (requiere add-on analytics; banner si 403). Exportación CSV del periodo.
 * Orquestador por bounded context: la lógica vive en src/analytics-composables.js
 * y la presentación en src/components/analytics/*. 1:1 con el previo.
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

        <analytics-guide :open="guideOpen" :items="ui.ANALYTICS_GUIDE" @toggle="guideOpen = !guideOpen"></analytics-guide>

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
          <analytics-kpis :summary="summary"></analytics-kpis>
          <div class="grid gap-6 xl:grid-cols-2">
            <analytics-daily-chart :daily="daily" :max-daily="maxDaily" :source="source"></analytics-daily-chart>
            <analytics-heatmap :heatmap="heatmap"></analytics-heatmap>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
