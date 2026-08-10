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

      const quickActions = Vue.computed(() => {
        const actions = [];
        if (can(user.value && user.value.role, 'inbox', 'edit')) actions.push({ label: 'Nueva conversación', icon: 'message', route: 'inbox' });
        if (can(user.value && user.value.role, 'contacts', 'edit')) actions.push({ label: 'Ver contactos', icon: 'users', route: 'contacts' });
        if (can(user.value && user.value.role, 'broadcasts', 'edit')) actions.push({ label: 'Crear campaña', icon: 'megaphone', route: 'broadcasts' });
        if (can(user.value && user.value.role, 'team', 'edit')) actions.push({ label: 'Invitar equipo', icon: 'user', route: 'team' });
        return actions;
      });

      return { workspace, niche, focus, user, kpis, today, activity, roadmapDone, roadmapTotal, ACT_ICONS, quickActions, navigate, ROLES, timeAgo };
    },

    template: `
      <div v-if="workspace" class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 class="text-2xl font-bold capitalize">{{ today }}</h2>
            <p class="mt-1 text-neutral-500">
              Hola, <span class="font-semibold text-neutral-900">{{ user.name }}</span> — esto está pasando en
              <span class="font-semibold text-neutral-900">{{ workspace.name }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge variant="accent">{{ niche.nombre }} {{ niche.emoji }}</ui-badge>
            <ui-badge variant="neutral">{{ focus.nombre || 'Sin foco' }}</ui-badge>
          </div>
        </header>

        <!-- KPIs del nicho -->
        <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="k in kpis" :key="k.id" class="border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-center justify-between">
              <span class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">{{ k.label }}</span>
              <ui-icon :name="k.icon" class="h-4 w-4 text-neutral-300"></ui-icon>
            </div>
            <p class="mt-3 text-3xl font-bold tabular-nums">{{ k.value }}<span v-if="k.unit" class="ml-1 text-base font-medium text-neutral-400">{{ k.unit }}</span></p>
          </div>
        </section>

        <div class="grid gap-6 lg:grid-cols-3">
          <!-- Columna principal -->
          <div class="space-y-6 lg:col-span-2">
            <!-- Canal WhatsApp -->
            <section class="border-2 border-neutral-900 bg-white p-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <ui-icon name="whatsapp" class="h-6 w-6"></ui-icon>
                  </span>
                  <div>
                    <p class="font-semibold">{{ workspace.whatsapp.phone }}</p>
                    <p class="text-xs text-neutral-500">{{ workspace.whatsapp.about }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <ui-badge variant="success" dot>Conectado</ui-badge>
                  <button v-if="can(user.role, 'settings')" @click="navigate('settings')"
                    class="border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                    Gestionar
                  </button>
                </div>
              </div>
            </section>

            <!-- Acciones rápidas -->
            <section>
              <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Acciones rápidas</h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <button v-for="a in quickActions" :key="a.route" @click="navigate(a.route)"
                  class="flex items-center gap-3 border-2 border-neutral-900 bg-white p-4 text-left shadow-brutal-sm transition hover:-translate-y-0.5">
                  <span class="flex h-9 w-9 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon :name="a.icon" class="h-5 w-5"></ui-icon>
                  </span>
                  <span class="font-medium">{{ a.label }}</span>
                  <ui-icon name="arrow-right" class="ml-auto h-4 w-4 text-neutral-300"></ui-icon>
                </button>
              </div>
            </section>

            <!-- Estado del roadmap del nicho -->
            <section class="border-2 border-neutral-900 bg-white p-5">
              <div class="flex items-center justify-between">
                <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Roadmap del negocio</h3>
                <span class="font-mono text-xs tabular-nums text-neutral-500">{{ roadmapDone }}/{{ roadmapTotal }} configurados</span>
              </div>
              <div class="mt-3 h-2 border border-neutral-900 bg-neutral-100">
                <div class="h-full bg-[var(--accent)]" :style="{ width: (roadmapDone / roadmapTotal * 100) + '%' }"></div>
              </div>
              <p class="mt-3 text-xs text-neutral-500">
                {{ niche.roadmap.filter(r => !r.optional).map(r => r.title).join(' · ') }}
              </p>
            </section>
          </div>

          <!-- Actividad reciente -->
          <section class="border-2 border-neutral-900 bg-white p-5">
            <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Actividad reciente</h3>
            <ul class="space-y-4">
              <li v-for="act in activity" :key="act.id" class="flex items-start gap-3">
                <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <ui-icon :name="ACT_ICONS[act.type] || 'zap'" class="h-3.5 w-3.5"></ui-icon>
                </span>
                <div class="min-w-0">
                  <p class="text-sm leading-snug">{{ act.text }}</p>
                  <p class="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ timeAgo(act.ts) }}</p>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
