/**
 * @file channel-connect-modals.js — Modales presentacionales de conexión
 * (live-connect) y de confirmación de reemplazo del número de WhatsApp.
 * Emite update:* para sincronizar estado con el orquestador.
 * Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['channel-connect-modals'] = {
    props: {
      connectPlatform: String,
      whatsappReplace: Boolean,
      platforms: Array,
      workspace: Object,
      onConnected: Function,
    },

    emits: ['update:connectPlatform', 'update:whatsappReplace'],

    template: `
        <ui-modal :open="Boolean(connectPlatform)" :title="'Conectar ' + ((platforms.find(p => p.id === connectPlatform) || {}).nombre || '')"
          @close="$emit('update:connectPlatform', null)">
          <live-connect v-if="connectPlatform" :platform="connectPlatform" :business-name="workspace.name" @connected="onConnected"></live-connect>
        </ui-modal>

        <!-- Modal: reemplazo del número WhatsApp (límite 1 por negocio) -->
        <ui-modal :open="whatsappReplace" title="Reemplazar número de WhatsApp" width="max-w-md" @close="$emit('update:whatsappReplace', false)">
          <p class="text-sm text-neutral-600">
            Cada negocio tiene <span class="font-semibold">1 número vinculado</span>. Al conectar otro número,
            el actual se desconectará automáticamente.
          </p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="$emit('update:whatsappReplace', false)" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="$emit('update:whatsappReplace', false); $emit('update:connectPlatform', 'whatsapp')"
              class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Reemplazar número
            </button>
          </div>
        </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
