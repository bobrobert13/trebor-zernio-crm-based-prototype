/**
 * @file analytics-composables.js — Composables por bounded context de la
 * analítica. Extraen la lógica del setup de analytics-view (serie diaria y
 * heatmap con carga live/demo, resumen de KPIs y exportación CSV) a objetos
 * `{ refs, computeds, helpers }`. Convención `Z.makeXxx`; sin template.
 * 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /** Días de la semana (heatmap). */
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  /** Bloques horarios del heatmap (4h cada uno). */
  const SLOTS = [
    { id: '0-4', label: '00–04' }, { id: '4-8', label: '04–08' }, { id: '8-12', label: '08–12' },
    { id: '12-16', label: '12–16' }, { id: '16-20', label: '16–20' }, { id: '20-24', label: '20–24' },
  ];

  /** Valor pseudo-determinista en [min, max] para (seed, día). */
  function pseudo(seed, salt, min, max) {
    return min + (ZernioCrm.hashSeed(seed + salt) % (max - min + 1));
  }

  /**
   * BC Series: serie diaria y heatmap, con carga live (tres endpoints) y
   * fallback demo determinista por workspace; estado de loading, add-on y
   * fuente. Limpia sus temporizadores al desmontar.
   */
  function makeAnalyticsSeries({ store, api, toast, getNiche }) {
    const workspace = Vue.computed(() => store.workspace);
    const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
    const profileId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.profileId);
    const isLive = Vue.computed(() => store.mode === 'live' && Boolean(profileId.value));

    const range = Vue.ref(14);
    const loading = Vue.ref(true);
    const addonError = Vue.ref(false);
    const source = Vue.ref('demo');

    /** Temporizadores activos (cleanup en onUnmounted). */
    const timers = [];
    Vue.onUnmounted(() => timers.forEach(clearTimeout));

    /** Serie diaria (conversaciones/día) — demo o live mapeada. */
    const daily = Vue.ref([]);

    /** Heatmap de mejores horarios (7 días × 6 bloques). */
    const heatmap = Vue.ref([]);

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
          const v = ZernioCrm.hashSeed(seed + day + slot.id) % 5;
          return { ...slot, value: v, intensity: v };
        }),
      }));
    }

    /** Mapea respuestas del API live a la serie (defensivo). */
    function mapLiveDaily(data) {
      const list = data.dailyData || data.dailyMetrics || data.metrics || data.items || data.data || [];
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
      const rows = WEEKDAYS.map((day, di) => ({
        day,
        slots: SLOTS.map((slot, si) => {
          const hit = grid.find((g) => String(g.day || g.weekday || g.dayOfWeek) === String(di + 1) && String(g.hour || g.slot) === slot.id);
          return { ...slot, value: hit ? Number(hit.value ?? hit.score ?? 1) : 0, intensity: hit ? Math.min(4, 1 + Math.round(Number(hit.score ?? hit.value ?? 1) / 2)) : 0 };
        }),
      }));
      // Si ningún campo coincide con el shape esperado, degrada a demo
      const totalIntensity = rows.reduce((acc, r) => acc + r.slots.reduce((a, s) => a + s.intensity, 0), 0);
      return totalIntensity === 0 ? null : rows;
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

    return {
      workspace, niche, profileId, isLive,
      range, loading, addonError, source, daily, heatmap, maxDaily,
      WEEKDAYS, SLOTS, load,
    };
  }

  /**
   * BC Summary: KPIs resumen del periodo con tendencia semántica
   * (vs. periodo anterior). Para "resp" bajar es MEJOR (color invertido).
   */
  function makeAnalyticsSummary({ workspace, range, daily }) {
    const summary = Vue.computed(() => {
      const total = daily.value.reduce((acc, d) => acc + d.value, 0);
      const avg = daily.value.length ? Math.round(total / daily.value.length) : 0;
      const seed = workspace.value.id;
      // Tendencia pseudo-determinista por KPI: up/down/flat + %
      // Para "resp" (minutos) bajar es MEJOR: el color se invierte en el template
      const trendOf = (id) => {
        const h = ZernioCrm.hashSeed(seed + id + range.value);
        const pct = 4 + (h % 18);
        return h % 3 === 0 ? { dir: 'flat', pct: 0 } : { dir: h % 2 === 0 ? 'up' : 'down', pct };
      };
      // true = la dirección es positiva para el negocio (subir es bueno)
      const positiveUp = (id) => id !== 'resp';
      return [
        { id: 'total', label: 'Conversaciones', value: total, unit: '', icon: 'message', trend: trendOf('total'), positiveUp: positiveUp('total') },
        { id: 'avg', label: 'Promedio diario', value: avg, unit: '', icon: 'chart', trend: trendOf('avg'), positiveUp: positiveUp('avg') },
        { id: 'resp', label: 'Respuesta promedio', value: pseudo(seed, 'resp', 3, 12), unit: 'min', icon: 'zap', trend: trendOf('resp'), positiveUp: positiveUp('resp') },
        { id: 'sat', label: 'Satisfacción', value: pseudo(seed, 'sat', 85, 99), unit: '%', icon: 'star', trend: trendOf('sat'), positiveUp: positiveUp('sat') },
      ];
    });

    return { summary };
  }

  /**
   * BC Export: descarga CSV de la serie diaria del periodo.
   */
  function makeAnalyticsExport({ workspace, daily, toast, downloadText }) {
    /** Exporta la serie diaria como CSV. */
    function exportCsv() {
      const rows = [['fecha', 'conversaciones'], ...daily.value.map((d) => [new Date(d.date).toISOString().slice(0, 10), d.value])];
      const csv = rows.map((r) => r.join(',')).join('\n');
      downloadText(`${workspace.value.name.replace(/\s+/g, '-').toLowerCase()}-analytics.csv`, csv, 'text/csv');
      toast('CSV exportado', 'success');
    }

    return { exportCsv };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeAnalyticsSeries, makeAnalyticsSummary, makeAnalyticsExport,
  });
})();