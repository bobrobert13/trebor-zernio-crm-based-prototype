/**
 * @file analytics.js — Vista de analítica full-width con gráficos CSS puros
 * (sin librerías): métricas diarias en barras, heatmap de mejores horarios
 * y KPIs del nicho. Demo: series sintéticas deterministas por workspace.
 * Live: /analytics/daily-metrics, /accounts/follower-stats, /analytics/best-time
 * (requiere add-on analytics; banner si 403). Exportación CSV del periodo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, getNiche } = ZernioCrm;

  const components = {};

  /** Días de la semana (heatmap). */
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /** Bloques horarios del heatmap (4h cada uno). */
  const SLOTS = [
    { id: '0-4', label: '00–04' }, { id: '4-8', label: '04–08' }, { id: '8-12', label: '08–12' },
    { id: '12-16', label: '12–16' }, { id: '16-20', label: '16–20' }, { id: '20-24', label: '20–24' },
  ];

  /** Hash determinista para series demo. */
  function hashSeed(str) {
    return [...str].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  }

  /** Valor pseudo-determinista en [min, max] para (seed, día). */
  function pseudo(seed, salt, min, max) {
    return min + (hashSeed(seed + salt) % (max - min + 1));
  }

  components['analytics-view'] = {
    setup() {
      const range = Vue.ref(14);
      const loading = Vue.ref(true);
      const addonError = Vue.ref(false);
      const source = Vue.ref('demo');

      /** Temporizadores activos (cleanup en onUnmounted). */
      const timers = [];
      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const profileId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.profileId);
      const isLive = Vue.computed(() => store.mode === 'live' && Boolean(profileId.value));

      /** Serie diaria (conversaciones/día) — demo o live mapeada. */
      const daily = Vue.ref([]);

      /** Heatmap de mejores horarios (7 días × 6 bloques). */
      const heatmap = Vue.ref([]);

      /** KPIs resumen del periodo. */
      const summary = Vue.computed(() => {
        const total = daily.value.reduce((acc, d) => acc + d.value, 0);
        const avg = daily.value.length ? Math.round(total / daily.value.length) : 0;
        const seed = workspace.value.id;
        return [
          { id: 'total', label: 'Conversaciones', value: total, unit: '', icon: 'message' },
          { id: 'avg', label: 'Promedio diario', value: avg, unit: '', icon: 'chart' },
          { id: 'resp', label: 'Respuesta promedio', value: pseudo(seed, 'resp', 3, 12), unit: 'min', icon: 'zap' },
          { id: 'sat', label: 'Satisfacción', value: pseudo(seed, 'sat', 85, 99), unit: '%', icon: 'star' },
        ];
      });

      const maxDaily = Vue.computed(() => Math.max(1, ...daily.value.map((d) => d.value)));

      /** Construye la serie demo (determinista por workspace y fecha). */
      function buildDemoSeries() {
        const seed = workspace.value.id;
        const days = [];
        for (let i = range.value - 1; i >= 0; i -= 1) {
          const ts = Date.now() - i * 864e5;
          const weekend = [0, 6].includes(new Date(ts).getDay());
          const base = weekend ? 6 : 14;
          days.push({
            date: ts,
            label: new Date(ts).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
            value: base + pseudo(seed, `d${i}`, 0, 18),
          });
        }
        return days;
      }

      /** Construye el heatmap demo (intensidad 0-4). */
      function buildDemoHeatmap() {
        const seed = workspace.value.id;
        return WEEKDAYS.map((day, di) => ({
          day,
          slots: SLOTS.map((slot, si) => {
            const v = hashSeed(seed + day + slot.id) % 5;
            return { ...slot, value: v, intensity: v };
          }),
        }));
      }

      /** Mapea respuestas del API live a la serie (defensivo). */
      function mapLiveDaily(data) {
        const list = data.dailyMetrics || data.metrics || data.items || data.data || [];
        if (!Array.isArray(list) || list.length === 0) return null;
        return list.slice(-range.value).map((d) => ({
          date: Date.parse(d.date || d.day || d.timestamp) || Date.now(),
          label: (d.date || d.day || '').slice(5) || '—',
          value: Number(d.engagement ?? d.impressions ?? d.messages ?? d.value ?? 0),
        }));
      }

      /** Mapea respuestas live del heatmap (defensivo). */
      function mapLiveHeatmap(data) {
        const grid = data.bestTimes || data.bestTime || data.items || data.data;
        if (!grid || !Array.isArray(grid) || grid.length === 0) return null;
        return WEEKDAYS.map((day, di) => ({
          day,
          slots: SLOTS.map((slot, si) => {
            const hit = grid.find((g) => String(g.day || g.weekday || g.dayOfWeek) === String(di + 1) && String(g.hour || g.slot) === slot.id);
            return { ...slot, value: hit ? Number(hit.value ?? hit.score ?? 1) : 0, intensity: hit ? Math.min(4, 1 + Math.round(Number(hit.score ?? hit.value ?? 1) / 2)) : 0 };
          }),
        }));
      }

      /** Carga datos: live real o demo sintética. */
      async function load() {
        loading.value = true;
        addonError.value = false;
        if (isLive.value) {
          try {
            const [metrics, stats, best] = await Promise.all([
              api.getDailyMetrics({ profileId: profileId.value, granularity: 'daily' }),
              api.getFollowerStats({ profileId: profileId.value, granularity: 'daily' }),
              api.getBestTime({ profileId: profileId.value }),
            ]);
            daily.value = mapLiveDaily(metrics) || buildDemoSeries();
            heatmap.value = mapLiveHeatmap(best) || buildDemoHeatmap();
            source.value = 'live';
          } catch (err) {
            if (err.type === 'permission_error' || String(err.code).includes('403')) {
              addonError.value = true;
            }
            toast(err.message || 'No se pudo cargar la analítica', 'error');
            daily.value = buildDemoSeries();
            heatmap.value = buildDemoHeatmap();
            source.value = 'demo';
          }
        } else {
          daily.value = buildDemoSeries();
          heatmap.value = buildDemoHeatmap();
          source.value = 'demo';
        }
        timers.push(setTimeout(() => { loading.value = false; }, 400));
      }

      Vue.onMounted(load);

      /** Exporta la serie diaria como CSV. */
      function exportCsv() {
        const rows = [['fecha', 'conversaciones'], ...daily.value.map((d) => [new Date(d.date).toISOString().slice(0, 10), d.value])];
        const csv = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspace.value.name.replace(/\s+/g, '-').toLowerCase()}-analytics.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('CSV exportado', 'success');
      }

      return {
        range, loading, addonError, source, daily, heatmap, summary, maxDaily,
        WEEKDAYS, SLOTS, niche, isLive,
        load, exportCsv,
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
              <p class="text-3xl font-bold tabular-nums">
                {{ k.value }}<span v-if="k.unit" class="ml-1 text-base font-medium text-neutral-400">{{ k.unit }}</span>
              </p>
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
