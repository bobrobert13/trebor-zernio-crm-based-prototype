/**
 * @file channel-grid.js — Grid presentacional de tarjetas por plataforma:
 * estado, capacidades, health y acciones. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['channel-grid'] = {
    props: {
      platforms: Array,
      channelOf: Function,
      healthMap: Object,
      busyMap: Object,
      canEdit: Function,
      openConnect: Function,
      checkHealth: Function,
      disconnect: Function,
      navigate: Function,
    },

    template: `
        <div class="grid gap-5 lg:grid-cols-3">
          <article v-for="p in platforms" :key="p.id" class="flex flex-col border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-start justify-between gap-3">
              <span class="flex h-12 w-12 items-center justify-center rounded-full" :class="p.tone">
                <ui-icon :name="p.icon" class="h-6 w-6"></ui-icon>
              </span>
              <ui-badge :variant="channelOf(p.id) && channelOf(p.id).connected ? 'success' : 'neutral'" dot>
                {{ channelOf(p.id) && channelOf(p.id).connected ? 'Conectado' : 'Desconectado' }}
              </ui-badge>
            </div>
            <h3 class="mt-4 text-lg font-bold">{{ p.nombre }}</h3>
            <p v-if="channelOf(p.id) && channelOf(p.id).connected" class="mt-1 truncate font-mono text-xs text-neutral-500">
              {{ channelOf(p.id).username || channelOf(p.id).accountId }}
            </p>
            <p v-else class="mt-1 text-sm text-neutral-400">Sin cuenta vinculada</p>
            <ui-badge v-if="channelOf(p.id) && channelOf(p.id).health === 'reconnect'" variant="danger" dot class="mt-2">
              Reconectar (token expirado)
            </ui-badge>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <ui-badge v-if="p.inbox" variant="success">Mensajería</ui-badge>
              <ui-badge v-else variant="warn">Sin bandeja</ui-badge>
              <ui-badge v-if="p.id === 'whatsapp'" variant="neutral">1/1 número</ui-badge>
            </div>

            <!-- Capacidades según la doc de Zernio (hace / no hace) -->
            <div v-if="p.caps" class="mt-3 border-t border-neutral-100 pt-3">
              <p class="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Capacidades</p>
              <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                <span v-for="c in p.caps" :key="c.cap" class="flex items-start gap-1.5 text-[11px] leading-snug"
                  :class="c.ok ? (c.scope === 'plan' ? 'text-emerald-800' : 'text-neutral-500') : 'text-red-700'"
                  :title="c.nota || ''">
                  <ui-icon :name="c.ok ? 'check' : 'x'" class="mt-0.5 h-3 w-3 shrink-0"
                    :class="c.ok ? (c.scope === 'plan' ? 'text-emerald-600' : 'text-neutral-300') : 'text-red-500'"></ui-icon>
                  <span>{{ c.cap }}</span>
                </span>
              </div>
              <p class="mt-2 flex items-center gap-3 font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                <span class="flex items-center gap-1"><ui-icon name="check" class="h-3 w-3 text-emerald-600"></ui-icon> en tu plan</span>
                <span class="flex items-center gap-1"><ui-icon name="check" class="h-3 w-3 text-neutral-300"></ui-icon> Disponible para ampliar</span>
                <span class="flex items-center gap-1"><ui-icon name="x" class="h-3 w-3 text-red-500"></ui-icon> no soportado</span>
              </p>
            </div>
            <p v-if="p.nota" class="mt-2 text-xs text-neutral-400">{{ p.nota }}</p>

            <!-- Health -->
            <div v-if="healthMap[p.id]" class="mt-3 border-2 p-2.5 font-mono text-[11px]"
              :class="healthMap[p.id].error ? 'border-red-800 bg-red-50 text-red-800' : 'border-emerald-800 bg-emerald-50 text-emerald-800'">
              {{ healthMap[p.id].error || 'Tokens válidos' }}
            </div>

            <div class="mt-auto flex flex-wrap gap-2 pt-4">
              <template v-if="channelOf(p.id) && channelOf(p.id).connected">
                <button v-if="canEdit('channels')" @click="openConnect(p)"
                  class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  {{ p.id === 'whatsapp' ? 'Reemplazar número' : 'Reconectar' }}
                </button>
                <button v-if="canEdit('channels')" @click="checkHealth(channelOf(p.id))" :disabled="busyMap[p.id]"
                  class="flex flex-1 items-center justify-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  <ui-spinner v-if="busyMap[p.id]" size="h-3 w-3"></ui-spinner>
                  Health
                </button>
                <button v-if="canEdit('channels') && p.id !== 'whatsapp'" @click="disconnect(channelOf(p.id))"
                  class="flex-1 border-2 border-red-800 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 transition hover:shadow-brutal-sm">
                  Desconectar
                </button>
                <button v-else-if="p.id === 'whatsapp'" @click="navigate('settings')"
                  class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  Gestionar
                </button>
              </template>
              <button v-else-if="canEdit('channels')" @click="openConnect(p)"
                class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="plus" class="h-3.5 w-3.5"></ui-icon>
                Conectar {{ p.nombre }}
              </button>
            </div>
          </article>
        </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
