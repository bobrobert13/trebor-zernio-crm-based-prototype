/**
 * @file channels.js — Módulo de Canales: estado de las plataformas conectadas
 * (WhatsApp, Instagram, TikTok) con conexión/reconexión por plataforma vía
 * live-connect (OAuth real para IG/TikTok), health check y desconexión.
 * TikTok se conecta para verificación (Zernio no expone su mensajería).
 * Orquestador por bounded context: la lógica vive en src/channels-composables.js
 * y la presentación en src/components/channels/*. 1:1 con el comportamiento
 * previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray, PLATFORMS, getPlatform, canEdit } = ZernioCrm;

  const components = {};

  components['channels-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const isLive = Vue.computed(() => store.mode === 'live');

      // Composición por bounded context (ver src/channels-composables.js)
      const registry = ZernioCrm.makeChannelRegistry({ workspace });
      const connection = ZernioCrm.makeChannelConnection({
        workspace, isLive, channelOf: registry.channelOf, api, toast, store, getPlatform,
      });
      const health = ZernioCrm.makeChannelHealth({
        workspace, isLive, api, toast, channels: registry.channels, getPlatform,
      });

      return {
        ...registry,    // channels, noChannel, channelOf
        ...connection,  // connectPlatform, whatsappReplace, onConnected, openConnect
        ...health,      // healthMap, busyMap, checkHealth, disconnect
        workspace, isLive, PLATFORMS, canEdit,
      };
    },

    template: `
      <div class="space-y-6">
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

        <channel-empty-banner :no-channel="noChannel" :open-connect="openConnect"></channel-empty-banner>

        <channel-grid
          :platforms="PLATFORMS" :channel-of="channelOf" :health-map="healthMap" :busy-map="busyMap"
          :can-edit="canEdit" :open-connect="openConnect" :check-health="checkHealth"
          :disconnect="disconnect" :navigate="(r) => ZernioCrm.navigate(r)"></channel-grid>

        <channel-connect-modals
          :connect-platform="connectPlatform" :whatsapp-replace="whatsappReplace"
          :platforms="PLATFORMS" :workspace="workspace" :on-connected="onConnected"
          @update:connectPlatform="connectPlatform = $event"
          @update:whatsappReplace="whatsappReplace = $event"></channel-connect-modals>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
