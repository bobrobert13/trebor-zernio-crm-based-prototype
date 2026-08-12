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

  components['channels-view'] = {
    setup() {
      const connectPlatform = Vue.ref(null);
      const whatsappReplace = Vue.ref(false); // confirmación de reemplazo (1 número por negocio)
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
            health: ws.zernio.health || null, // hereda alerta de reconexión
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
      async function onConnected(result) {
        const ws = workspace.value;
        const platform = result.platform || 'whatsapp';
        // Límite: 1 número por negocio — desconecta el anterior antes de reemplazar
        if (platform === 'whatsapp' && isLive.value) {
          const prev = ws.zernio && ws.zernio.accountId;
          if (prev && prev !== result.accountId) {
            try {
              await api.deleteAccount(prev);
              toast('Número anterior desconectado (límite 1 por negocio)', 'info');
            } catch (err) {
              // No conmutar: el perfil quedaría con 2 números facturables
              toast('No se pudo desconectar el número anterior: ' + (err.message || '') + '. La conexión nueva se canceló.', 'error', 6000);
              return;
            }
          }
        }
        const entry = {
          platform,
          accountId: result.accountId || '',
          username: result.username || result.phone || '',
          connected: true,
          since: Date.now(),
          health: null,
        };
        const existing = ws.channels.find((c) => c.platform === platform);
        if (existing) Object.assign(existing, entry);
        else ws.channels.push(entry);

        // WhatsApp primario: mantiene workspace.zernio sincronizado SIN borrar subKey/health
        if (platform === 'whatsapp') {
          ws.zernio = Object.assign(ws.zernio || {}, {
            profileId: result.profileId,
            accountId: result.accountId,
            phone: result.phone || entry.username,
            health: null,
          });
          ws.whatsapp = {
            connected: true,
            modality: 'live',
            phone: result.phone || entry.username,
            status: 'connected',
            since: Date.now(),
            about: 'Conexión real con la plataforma',
            accountId: result.accountId,
          };
          store.mode = 'live';
        }
        connectPlatform.value = null;
        const nombre = (getPlatform(platform) || {}).nombre || platform;
        toast(`${nombre} conectado`, 'success');
      }

      /** Abre la conexión de WhatsApp respetando el límite de 1 número. */
      function openConnect(p) {
        if (p.id === 'whatsapp' && channelOf(p.id) && channelOf(p.id).connected) {
          whatsappReplace.value = true; // pedir confirmación antes de reemplazar
          return;
        }
        connectPlatform.value = p.id;
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
        connectPlatform, whatsappReplace, healthMap, busyMap, workspace, isLive, channels,
        PLATFORMS, channelOf, onConnected, openConnect, checkHealth, disconnect,
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
              <span class="font-semibold">{{ isLive ? '· conectado en vivo' : '· modo demo' }}</span>
            </p>
          </div>
          <ui-badge variant="accent">{{ channels.filter(c => c.connected).length }}/{{ PLATFORMS.length }} conectados</ui-badge>
        </header>

        <!-- Tarjetas por plataforma -->
        <div class="grid gap-5 lg:grid-cols-3">
          <article v-for="p in PLATFORMS" :key="p.id" class="flex flex-col border-2 border-neutral-900 bg-white p-5">
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
                <button v-else-if="p.id === 'whatsapp'" @click="ZernioCrm.navigate('settings')"
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
        </div>

        <!-- Modal: conexión por plataforma -->
        <ui-modal :open="Boolean(connectPlatform)" :title="'Conectar ' + ((PLATFORMS.find(p => p.id === connectPlatform) || {}).nombre || '')"
          @close="connectPlatform = null">
          <live-connect v-if="connectPlatform" :platform="connectPlatform" @connected="onConnected"></live-connect>
        </ui-modal>

        <!-- Modal: reemplazo del número WhatsApp (límite 1 por negocio) -->
        <ui-modal :open="whatsappReplace" title="Reemplazar número de WhatsApp" width="max-w-md" @close="whatsappReplace = false">
          <p class="text-sm text-neutral-600">
            Cada negocio tiene <span class="font-semibold">1 número vinculado</span>. Al conectar otro número,
            el actual se desconectará automáticamente.
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="whatsappReplace = false" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="whatsappReplace = false; connectPlatform = 'whatsapp'"
              class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Reemplazar número
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
