/**
 * @file dashboard.js — Resumen contextual por nicho: KPIs del negocio,
 * estado del canal WhatsApp, acciones rápidas (filtradas por RBAC)
 * y feed de actividad del workspace.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, navigate, can, timeAgo, getNiche, ROLES } = ZernioCrm;

  const components = {};

  /** Hash determinista para valores pseudo-aleatorios de KPIs demo. */
  function hashSeed(str) {
    return [...str].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  }

  /** Valor pseudo-determinista en [min, max] por workspace. */
  function pseudo(workspace, salt, min, max) {
    return min + (hashSeed(workspace.id + salt) % (max - min + 1));
  }

  /** Calcula el valor de un KPI del nicho a partir de datos del workspace. */
  function kpiValue(workspace, kpi) {
    switch (kpi.id) {
      case 't_respuesta': return pseudo(workspace, kpi.id, 3, 15);
      case 'satisfaccion': return pseudo(workspace, kpi.id, 85, 99);
      case 'clientes': return workspace.contacts.length + pseudo(workspace, kpi.id, 40, 160);
      case 'contactos': return workspace.contacts.length + pseudo(workspace, kpi.id, 20, 80);
      case 'conversaciones': return workspace.conversations.length + pseudo(workspace, kpi.id, 3, 12);
      default: return pseudo(workspace, kpi.id, 4, 32);
    }
  }

  components['dashboard-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(store.workspace && store.workspace.nicheId));
      const focus = Vue.computed(() => ZernioCrm.FOCUS_MODES.find((f) => f.id === workspace.value.focus) || {});
      const user = Vue.computed(() => store.currentUser);

      const kpis = Vue.computed(() =>
        niche.value.kpis.map((k) => ({ ...k, value: kpiValue(store.workspace, k) }))
      );

      const today = Vue.computed(() =>
        new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })
      );

      const activity = Vue.computed(() =>
        (store.workspace.activity || []).slice().sort((a, b) => b.ts - a.ts)
      );

      const roadmapDone = Vue.computed(() => niche.value.roadmap.filter((r) => !r.optional).length);
      const roadmapTotal = Vue.computed(() => niche.value.roadmap.length);

      const ACT_ICONS = { whatsapp: 'whatsapp', message: 'message', contact: 'user', broadcast: 'megaphone', system: 'zap' };

      // ── Personalización del panel ──────────────────────────────────────────
      const prefsOpen = Vue.ref(false);

      /** Preferencias del panel (secciones y KPIs), con migración por defecto. */
      const prefs = Vue.computed({
        get() {
          const ws = store.workspace;
          if (!ws) return { sections: {}, kpis: [] };
          if (!ws.dashboardPrefs) {
            ws.dashboardPrefs = {
              sections: { kpis: true, canal: true, acciones: true, roadmap: true, actividad: true },
              kpis: (niche.value.kpis || []).map((k) => k.id),
            };
          }
          return ws.dashboardPrefs;
        },
        set(v) {
          store.workspace.dashboardPrefs = v;
        },
      });

      /** Reasigna las preferencias (reactividad + persistencia del deep watch). */
      function commitPrefs(sections, kpis) {
        prefs.value = { sections: { ...sections }, kpis: [...kpis] };
      }

      function toggleSection(key) {
        commitPrefs({ ...prefs.value.sections, [key]: !prefs.value.sections[key] }, prefs.value.kpis);
      }

      function toggleKpi(id) {
        const list = prefs.value.kpis.includes(id)
          ? prefs.value.kpis.filter((x) => x !== id)
          : [...prefs.value.kpis, id];
        commitPrefs(prefs.value.sections, list);
      }

      function moveKpi(id, dir) {
        const list = [...prefs.value.kpis];
        const i = list.indexOf(id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        commitPrefs(prefs.value.sections, list);
      }

      /** KPIs visibles en el orden elegido por el negocio. */
      const visibleKpis = Vue.computed(() => {
        const order = prefs.value.kpis;
        return kpis.value
          .filter((k) => order.includes(k.id))
          .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      });

      /** Mini-tendencia pseudo-determinista (7 puntos) para cada KPI. */
      function kpiTrend(k) {
        const base = k.value;
        return Array.from({ length: 7 }, (_, i) => Math.max(1, Math.round(base * (0.6 + ((hashSeed(k.id + i) % 50) / 100)))));
      }

      const SECTION_LABELS = {
        kpis: 'Indicadores del negocio',
        canal: 'Estado del canal',
        acciones: 'Acciones rápidas',
        roadmap: 'Roadmap del negocio',
        actividad: 'Actividad reciente',
      };

      const quickActions = Vue.computed(() => {
        const actions = [];
        if (can(user.value && user.value.role, 'inbox', 'edit')) actions.push({ label: 'Nueva conversación', icon: 'message', route: 'inbox' });
        if (can(user.value && user.value.role, 'contacts', 'edit')) actions.push({ label: 'Ver contactos', icon: 'users', route: 'contacts' });
        if (can(user.value && user.value.role, 'broadcasts', 'edit')) actions.push({ label: 'Crear campaña', icon: 'megaphone', route: 'broadcasts' });
        if (can(user.value && user.value.role, 'team', 'edit')) actions.push({ label: 'Invitar equipo', icon: 'user', route: 'team' });
        return actions;
      });

      return { workspace, niche, focus, user, kpis, visibleKpis, kpiTrend, today, activity, roadmapDone, roadmapTotal, ACT_ICONS, quickActions, navigate, can, ROLES, timeAgo, prefs, prefsOpen, SECTION_LABELS, toggleSection, toggleKpi, moveKpi };
    },

    template: `
      <div v-if="workspace" class="space-y-8">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="text-3xl font-bold capitalize">{{ today }}</h2>
            <p class="mt-1.5 text-neutral-500">
              Hola, <span class="font-semibold text-neutral-900">{{ user.name }}</span> — esto está pasando en
              <span class="font-semibold text-neutral-900">{{ workspace.name }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge variant="accent">{{ niche.nombre }} {{ niche.emoji }}</ui-badge>
            <ui-badge variant="neutral">{{ focus.nombre || 'Sin foco' }}</ui-badge>
            <button @click="prefsOpen = true"
              class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="settings" class="h-3.5 w-3.5"></ui-icon>
              Personalizar panel
            </button>
          </div>
        </header>

        <!-- KPIs del nicho (banda completa, personalizables) -->
        <section v-if="prefs.sections.kpis" class="grid grid-cols-2 gap-5 lg:grid-cols-4">
          <div v-for="k in visibleKpis" :key="k.id"
            class="flex h-36 flex-col justify-between border-2 border-neutral-900 bg-white p-6">
            <div class="flex items-center justify-between">
              <span class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">{{ k.label }}</span>
              <ui-icon :name="k.icon" class="h-5 w-5 text-neutral-300"></ui-icon>
            </div>
            <div class="flex items-end justify-between gap-3">
              <p class="text-4xl font-bold tabular-nums">
                {{ k.value }}<span v-if="k.unit" class="ml-1.5 text-lg font-medium text-neutral-400">{{ k.unit }}</span>
              </p>
              <!-- Mini-tendencia (7 puntos) -->
              <div class="flex h-9 items-end gap-0.5">
                <div v-for="(v, i) in kpiTrend(k)" :key="i" class="w-1.5 bg-[var(--accent)] opacity-40"
                  :class="i === 6 ? 'opacity-100' : ''"
                  :style="{ height: Math.max(12, Math.round((v / Math.max(...kpiTrend(k))) * 100)) + '%' }"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- Strip del canal WhatsApp -->
        <section v-if="prefs.sections.canal" class="flex flex-wrap items-center justify-between gap-4 border-2 border-neutral-900 bg-white p-5">
          <div class="flex items-center gap-4">
            <span class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <ui-icon name="whatsapp" class="h-6 w-6"></ui-icon>
            </span>
            <div>
              <p class="text-lg font-semibold leading-tight">{{ workspace.whatsapp.phone }}</p>
              <p class="text-sm text-neutral-500">{{ workspace.whatsapp.about }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <ui-badge variant="success" dot>Conectado</ui-badge>
            <button v-if="can(user.role, 'settings')" @click="navigate('settings')"
              class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              Gestionar canal
            </button>
          </div>
        </section>

        <!-- Acciones rápidas (fila completa) -->
        <section v-if="prefs.sections.acciones">
          <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Acciones rápidas</h3>
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <button v-for="a in quickActions" :key="a.route" @click="navigate(a.route)"
              class="flex items-center gap-4 border-2 border-neutral-900 bg-white p-5 text-left shadow-brutal-sm transition hover:-translate-y-0.5">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                <ui-icon :name="a.icon" class="h-5 w-5"></ui-icon>
              </span>
              <span class="text-base font-medium">{{ a.label }}</span>
              <ui-icon name="arrow-right" class="ml-auto h-5 w-5 text-neutral-300"></ui-icon>
            </button>
          </div>
        </section>

        <div v-if="prefs.sections.roadmap || prefs.sections.actividad" class="grid gap-6 xl:grid-cols-12">
          <!-- Roadmap del nicho -->
          <section v-if="prefs.sections.roadmap" class="border-2 border-neutral-900 bg-white p-6 xl:col-span-7">
            <div class="flex items-center justify-between">
              <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Roadmap del negocio</h3>
              <span class="font-mono text-xs tabular-nums text-neutral-500">{{ roadmapDone }}/{{ roadmapTotal }} configurados</span>
            </div>
            <div class="mt-4 h-3 border-2 border-neutral-900 bg-neutral-100">
              <div class="h-full bg-[var(--accent)] transition-all" :style="{ width: (roadmapDone / roadmapTotal * 100) + '%' }"></div>
            </div>
            <div class="mt-5 grid gap-2.5 sm:grid-cols-2">
              <div v-for="r in niche.roadmap.filter(x => !x.optional)" :key="r.id" class="flex items-center gap-2.5 text-sm">
                <ui-icon name="check-circle" class="h-4 w-4 shrink-0 text-emerald-700"></ui-icon>
                <span class="truncate">{{ r.title }}</span>
              </div>
            </div>
          </section>

          <!-- Actividad reciente -->
          <section v-if="prefs.sections.actividad" class="border-2 border-neutral-900 bg-white p-6 xl:col-span-5">
            <h3 class="mb-5 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Actividad reciente</h3>
            <ul class="space-y-5">
              <li v-for="act in activity" :key="act.id" class="flex items-start gap-3.5">
                <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <ui-icon :name="ACT_ICONS[act.type] || 'zap'" class="h-4 w-4"></ui-icon>
                </span>
                <div class="min-w-0">
                  <p class="text-sm leading-snug">{{ act.text }}</p>
                  <p class="mt-1 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ timeAgo(act.ts) }}</p>
                </div>
              </li>
            </ul>
          </section>
        </div>

        <!-- Modal: personalizar panel -->
        <ui-modal :open="prefsOpen" title="Personalizar panel" width="max-w-lg" @close="prefsOpen = false">
          <div class="space-y-5">
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Secciones del resumen</p>
              <div class="space-y-1.5">
                <label v-for="(label, key) in SECTION_LABELS" :key="key" class="flex cursor-pointer items-center justify-between border border-neutral-200 px-3 py-2">
                  <span class="text-sm">{{ label }}</span>
                  <ui-toggle :model-value="prefs.sections[key]" @update:model-value="toggleSection(key)" :aria-label="label"></ui-toggle>
                </label>
              </div>
            </div>
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Indicadores (orden y visibilidad)</p>
              <div class="space-y-1.5">
                <div v-for="k in kpis" :key="k.id" class="flex items-center gap-2 border border-neutral-200 px-3 py-2">
                  <ui-icon :name="k.icon" class="h-4 w-4 text-neutral-400"></ui-icon>
                  <span class="min-w-0 flex-1 truncate text-sm">{{ k.label }}</span>
                  <button @click="moveKpi(k.id, -1)" :disabled="prefs.kpis.indexOf(k.id) <= 0" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Subir indicador">
                    <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="moveKpi(k.id, 1)" :disabled="prefs.kpis.indexOf(k.id) === -1 || prefs.kpis.indexOf(k.id) >= prefs.kpis.length - 1" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar indicador">
                    <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                  </button>
                  <ui-toggle :model-value="prefs.kpis.includes(k.id)" @update:model-value="toggleKpi(k.id)" :aria-label="'Mostrar ' + k.label"></ui-toggle>
                </div>
              </div>
            </div>
            <button @click="prefsOpen = false" class="w-full border-2 border-neutral-900 bg-neutral-900 px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Listo
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
