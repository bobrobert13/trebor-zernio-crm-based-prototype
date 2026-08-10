/**
 * @file channels.js — Módulo de Canales: estado de las plataformas conectadas
 * (WhatsApp, Instagram, TikTok) con conexión/reconexión por plataforma vía
 * live-connect (OAuth real para IG/TikTok), health check y desconexión.
 * TikTok se conecta para verificación (Zernio no expone su mensajería).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray, PLATFORMS, getPlatform, canEdit } = ZernioCrm;

  const components = {};

  /** Color de acento por plataforma (clases Tailwind fijas). */
  const PLATFORM_TONES = {
    whatsapp: 'bg-emerald-100 text-emerald-800',
    instagram: 'bg-pink-100 text-pink-700',
    tiktok: 'bg-neutral-100 text-neutral-900',
  };

  components['channels-view'] = {
    setup() {
      const connectPlatform = Vue.ref(null);
      const healthMap = Vue.reactive({});
      const busyMap = Vue.reactive({});

      const workspace = Vue.computed(() => store.workspace);
      const isLive = Vue.computed(() => store.mode === 'live');

      /** Garantiza workspace.channels y deriva WhatsApp desde zernio (compatibilidad). */
      function ensureChannels() {
        const ws = workspace.value;
        if (!ws) return;
        if (!ws.channels) ws.channels = [];
        if (ws.zernio && !ws.channels.find((c) => c.platform === 'whatsapp')) {
          ws.channels.unshift({
            platform: 'whatsapp',
            accountId: ws.zernio.accountId || '',
            username: ws.zernio.phone || '',
            connected: true,
            since: ws.zernio.since || Date.now(),
          });
        }
      }
      ensureChannels();

      const channels = Vue.computed(() => workspace.value.channels || []);

      /** @param {string} platform — id de plataforma. @returns {object|null} */
      function channelOf(platform) {
        return channels.value.find((c) => c.platform === platform) || null;
      }

      /** Recibe la conexión de live-connect y actualiza el canal. */
      function onConnected(result) {
        const ws = workspace.value;
        const platform = result.platform || 'whatsapp';
        const entry = {
          platform,
          accountId: result.accountId || '',
          username: result.username || result.phone || '',
          connected: true,
          since: Date.now(),
        };
        const existing = ws.channels.find((c) => c.platform === platform);
        if (existing) Object.assign(existing, entry);
        else ws.channels.push(entry);

        // WhatsApp primario: mantiene workspace.zernio sincronizado
        if (platform === 'whatsapp') {
          ws.zernio = {
            profileId: result.profileId,
            accountId: result.accountId,
            phone: result.phone || entry.username,
          };
          ws.whatsapp = {
            connected: true,
            modality: 'live',
            phone: result.phone || entry.username,
            status: 'connected',
            since: Date.now(),
            about: 'Conexión real con Zernio',
            accountId: result.accountId,
          };
          store.mode = 'live';
        }
        connectPlatform.value = null;
        const nombre = (getPlatform(platform) || {}).nombre || platform;
        toast(`${nombre} conectado`, 'success');
      }

      /** Health check de un canal conectado. */
      async function checkHealth(channel) {
        const accountId = channel.accountId;
        if (!accountId || busyMap[channel.platform]) return;
        busyMap[channel.platform] = true;
        healthMap[channel.platform] = null;
        try {
          healthMap[channel.platform] = await api.getAccountHealth(accountId);
          toast('Health check OK', 'success');
        } catch (err) {
          healthMap[channel.platform] = { error: err.message || 'Cuenta en mal estado' };
          toast(err.message || 'Cuenta en mal estado', 'error');
        } finally {
          busyMap[channel.platform] = false;
        }
      }

      /** Desconecta un canal (no-whatsapp; WhatsApp se gestiona en Settings). */
      async function disconnect(channel) {
        if (channel.platform === 'whatsapp') {
          toast('WhatsApp se gestiona en Configuración → Canal WhatsApp', 'info');
          return;
        }
        try {
          if (isLive.value && channel.accountId) await api.deleteAccount(channel.accountId);
          workspace.value.channels = workspace.value.channels.filter((c) => c.platform !== channel.platform);
          toast(`${(getPlatform(channel.platform) || {}).nombre || channel.platform} desconectado`, 'info');
        } catch (err) {
          toast(err.message || 'No se pudo desconectar', 'error');
        }
      }

      return {
        connectPlatform, healthMap, busyMap, workspace, isLive, channels,
        PLATFORMS, PLATFORM_TONES, channelOf, onConnected, checkHealth, disconnect,
        canEdit,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Canales</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Plataformas conectadas a {{ workspace.name }}.
              <span class="font-semibold">{{ isLive ? '· conectado a Zernio' : '· modo demo' }}</span>
            </p>
          </div>
          <ui-badge variant="accent">{{ channels.filter(c => c.connected).length }}/{{ PLATFORMS.length }} conectados</ui-badge>
        </header>

        <!-- Tarjetas por plataforma -->
        <div class="grid gap-5 lg:grid-cols-3">
          <article v-for="p in PLATFORMS" :key="p.id" class="flex flex-col border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-start justify-between gap-3">
              <span class="flex h-12 w-12 items-center justify-center rounded-full" :class="PLATFORM_TONES[p.id]">
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

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <ui-badge v-if="p.inbox" variant="success">Mensajería</ui-badge>
              <ui-badge v-else variant="warn">Sin bandeja</ui-badge>
            </div>
            <p v-if="p.nota" class="mt-2 text-xs text-neutral-400">{{ p.nota }}</p>

            <!-- Health -->
            <div v-if="healthMap[p.id]" class="mt-3 border-2 p-2.5 font-mono text-[11px]"
              :class="healthMap[p.id].error ? 'border-red-800 bg-red-50 text-red-800' : 'border-emerald-800 bg-emerald-50 text-emerald-800'">
              {{ healthMap[p.id].error || 'Tokens válidos' }}
            </div>

            <div class="mt-auto flex flex-wrap gap-2 pt-4">
              <template v-if="channelOf(p.id) && channelOf(p.id).connected">
                <button v-if="canEdit('channels')" @click="connectPlatform = p.id"
                  class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  Reconectar
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
                <button v-else-if="p.id === 'whatsapp'" @click="ZernioCrm.navigate('settings')"
                  class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  Gestionar
                </button>
              </template>
              <button v-else-if="canEdit('channels')" @click="connectPlatform = p.id"
                class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="plus" class="h-3.5 w-3.5"></ui-icon>
                Conectar {{ p.nombre }}
              </button>
            </div>
          </article>
        </div>

        <!-- Modal: conexión por plataforma -->
        <ui-modal :open="Boolean(connectPlatform)" :title="'Conectar ' + ((PLATFORMS.find(p => p.id === connectPlatform) || {}).nombre || '')"
          @close="connectPlatform = null">
          <live-connect v-if="connectPlatform" :platform="connectPlatform" @connected="onConnected"></live-connect>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
