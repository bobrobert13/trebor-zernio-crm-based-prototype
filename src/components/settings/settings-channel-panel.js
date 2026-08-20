/**
 * @file settings-channel-panel.js — Panel presentacional del Canal WhatsApp:
 * estado, health, reconexión/desconexión demo/live + modal de reconexión con
 * live-connect. Emite update:reconnectOpen y connected. Verbatim.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-channel-panel'] = {
    props: {
      workspace: Object, modality: Object, canEdit: Function,
      reconnectOpen: Boolean, healthBusy: Boolean, health: Object,
      fmtD: Function, checkHealth: Function, disconnectLive: Function,
      disconnectWhatsApp: Function, reconnectWhatsApp: Function,
    },

    emits: ['update:reconnectOpen', 'connected'],

    template: `
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Canal WhatsApp</h3>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-4">
              <span class="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <ui-icon name="whatsapp" class="h-6 w-6"></ui-icon>
              </span>
              <div class="min-w-0">
                <p class="font-semibold">{{ workspace.whatsapp.phone }}</p>
                <p class="text-sm text-neutral-500">
                  Modalidad: {{ modality.nombre || workspace.whatsapp.modality }} ·
                  {{ fmtD(workspace.whatsapp.since) }}
                </p>
                <p v-if="workspace.zernio" class="truncate font-mono text-[11px] text-neutral-400">
                  perfil {{ workspace.zernio.profileId }} · cuenta {{ workspace.zernio.accountId }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <ui-badge :variant="workspace.whatsapp.connected ? 'success' : 'danger'" dot>
                {{ workspace.whatsapp.connected ? 'Conectado' : 'Desconectado' }}
              </ui-badge>
              <button v-if="workspace.zernio && canEdit('settings')" @click="checkHealth" :disabled="healthBusy"
                class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="healthBusy" size="h-3.5 w-3.5"></ui-spinner>
                Health check
              </button>
              <button v-if="workspace.zernio && canEdit('settings')" @click="$emit('update:reconnectOpen', true)"
                class="border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Reconectar
              </button>
              <button v-if="workspace.zernio && canEdit('settings')" @click="disconnectLive"
                class="border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                Desconectar
              </button>
              <template v-if="!workspace.zernio">
                <button v-if="workspace.whatsapp.connected && canEdit('settings')" @click="disconnectWhatsApp"
                  class="border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  Desconectar (demo)
                </button>
                <button v-else-if="!workspace.whatsapp.connected && canEdit('settings')" @click="reconnectWhatsApp"
                  class="border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Reconectar (demo)
                </button>
              </template>
            </div>
          </div>
          <div v-if="health" class="mt-4 flex items-center gap-2 border-2 p-3 font-mono text-xs"
            :class="health.error ? 'border-red-800 bg-red-50 text-red-800' : 'border-emerald-800 bg-emerald-50 text-emerald-800'">
            <ui-icon :name="health.error ? 'alert' : 'check-circle'" class="h-4 w-4 shrink-0"></ui-icon>
            {{ health.error || JSON.stringify(health).slice(0, 140) }}
          </div>
        </section>
        <ui-modal :open="reconnectOpen" title="Conectar con la plataforma" @close="$emit('update:reconnectOpen', false)">
          <live-connect :business-name="workspace.name" @connected="$emit('connected', $event)"></live-connect>
        </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
