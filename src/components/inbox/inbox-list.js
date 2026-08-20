/**
 * @file inbox-list.js — BC List de la bandeja unificada: buscador, pestañas
 * por plataforma y etapa, y lista de conversaciones. Componente presentacional
 * puro: recibe estado por props y devuelve cambios por eventos.
 * Verbatim del bloque `<aside>` original (refs → props/emits).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['inbox-list'] = {
    props: {
      search: String, platformFilter: String, filter: String,
      presentPlatforms: Array, leadTags: Array, activeCount: Number, unreadTotal: Number,
      tiktokEmpty: Boolean, tiktokChannel: { type: Object, default: null },
      filtered: Array, selected: { type: Object, default: null }, selectedId: String, contacts: Array,
      getPlatform: Function, timeAgo: Function, lastMessage: Function,
    },
    emits: ['update:search', 'update:platformFilter', 'update:filter', 'select'],
    template: `
      <aside :class="['flex min-h-0 flex-col lg:border-r lg:border-neutral-200', selected ? 'hidden lg:flex' : 'flex']">
        <div class="shrink-0 border-b border-neutral-200 p-3">
          <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
            <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
            <input :value="search" type="search" placeholder="Buscar conversación…"
              @input="$emit('update:search', $event.target.value.trim())"
              class="w-full bg-transparent text-sm outline-none" />
          </div>
          <!-- Pestañas por plataforma -->
          <div class="mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button @click="$emit('update:platformFilter', 'all')"
              class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="platformFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              Todas
            </button>
            <button v-for="p in presentPlatforms" :key="p.id" @click="$emit('update:platformFilter', p.id)"
              class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="platformFilter === p.id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              <ui-icon :name="p.icon" class="h-3.5 w-3.5"></ui-icon>
              {{ p.nombre }}
            </button>
          </div>
          <div class="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button @click="$emit('update:filter', 'all')" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="filter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              Todas ({{ activeCount }})
            </button>
            <button @click="$emit('update:filter', 'unread')" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="filter === 'unread' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              No leídas ({{ unreadTotal }})
            </button>
            <button @click="$emit('update:filter', 'Sin asignar')" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="filter === 'Sin asignar' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              Sin asignar
            </button>
            <button v-for="t in leadTags" :key="t" @click="$emit('update:filter', t)"
              class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="filter === t ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
              {{ t }}
            </button>
          </div>
        </div>
        <ul class="min-h-0 flex-1 overflow-y-auto">
          <!-- TikTok no tiene mensajería en Zernio -->
          <ui-empty v-if="tiktokEmpty" icon="tiktok" title="TikTok no tiene mensajería en Zernio"
            desc="Zernio solo expone publicación para TikTok. Responde a tus DM desde la app de TikTok." class="m-4">
            <a v-if="tiktokChannel && tiktokChannel.username" :href="'https://www.tiktok.com/@' + tiktokChannel.username.replace('@', '')" target="_blank"
              class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Abrir perfil externo
            </a>
          </ui-empty>
          <ui-empty v-else-if="filtered.length === 0" icon="message" title="Sin conversaciones"
            desc="Prueba con otro filtro o inicia una conversación nueva." class="m-4"></ui-empty>
          <li v-for="conv in filtered" :key="conv.id">
            <button @click="$emit('select', conv)"
              class="flex w-full items-center gap-3 border-b border-l-2 border-neutral-100 px-4 py-3.5 text-left transition"
              :class="conv.id === selectedId
                ? 'border-l-[var(--accent)] bg-[var(--accent-soft)]'
                : 'border-l-transparent hover:bg-stone-100'">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                :class="(getPlatform(conv.platform || 'whatsapp') || {}).tone">
                <ui-icon :name="(getPlatform(conv.platform || 'whatsapp') || {}).icon" class="h-3 w-3"></ui-icon>
              </span>
              <ui-avatar :name="(contacts.find(c => c.id === conv.contactId) || {}).name" size="h-10 w-10 text-sm"></ui-avatar>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <p class="truncate text-sm font-semibold">{{ (contacts.find(c => c.id === conv.contactId) || {}).name }}</p>
                  <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ timeAgo(conv.lastTs) }}</span>
                </div>
                <p class="truncate text-sm text-neutral-500">{{ lastMessage(conv) }}</p>
              </div>
              <span v-if="conv.unread > 0" class="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[11px] font-bold text-white tabular-nums">
                {{ conv.unread }}
              </span>
            </button>
          </li>
        </ul>
      </aside>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();