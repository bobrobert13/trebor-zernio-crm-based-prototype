/**
 * @file settings-webhooks-panel.js — Panel presentacional de Webhooks:
 * formulario (nombre/URL/eventos), túnel, prueba, logs, simulación y feed de
 * eventos recibidos. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-webhooks-panel'] = {
    props: {
      store: Object, canEdit: Function, events: Array, whForm: Object,
      whExists: Boolean, whSaving: Boolean, whLogs: Array,
      tunnelUrl: String, tunnelBusy: Boolean, fmtT: Function,
      buildWebhookUrl: Function, saveWebhooks: Function, deleteWebhooks: Function,
      testWebhook: Function, openLogs: Function, simulateWebhook: Function,
      toggleWhEvent: Function, fetchTunnelUrl: Function,
    },

    template: `
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Webhooks (eventos en tiempo real)</h3>
            <div class="flex items-center gap-2">
              <ui-badge v-if="store.serverMode" variant="success" dot>Servidor local activo</ui-badge>
              <ui-badge v-else variant="neutral">Sin server.mjs</ui-badge>
              <button v-if="canEdit('settings')" @click="simulateWebhook"
                class="border-2 border-neutral-900 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider shadow-brutal-sm transition hover:shadow-none">
                Simular mensaje
              </button>
              <button @click="openLogs"
                class="border-2 border-neutral-900 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider shadow-brutal-sm transition hover:shadow-none">
                Logs ({{ whLogs.length || store.webhookEvents.length }})
              </button>
            </div>
          </div>
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="space-y-4">
              <ui-field label="Nombre">
                <input v-model.trim="whForm.name" type="text"
                  class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="URL del receptor" hint="Local: node server.mjs · Producción: URL pública (túnel https) + secret en query.">
                <div class="flex items-center gap-2">
                  <input v-model.trim="whForm.url" type="text" readonly
                    class="w-full border-2 border-neutral-300 bg-stone-50 px-3 py-2.5 font-mono text-xs outline-none" />
                  <button @click="whForm.url = buildWebhookUrl()" class="shrink-0 border-2 border-neutral-900 bg-white px-2.5 py-2 text-xs font-medium transition hover:shadow-brutal-sm" aria-label="Regenerar URL">
                    <ui-icon name="refresh" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="fetchTunnelUrl" :disabled="tunnelBusy"
                    class="flex shrink-0 items-center gap-1.5 border-2 border-neutral-900 bg-white px-2.5 py-2 text-xs font-medium transition hover:shadow-brutal-sm disabled:opacity-40"
                    aria-label="Obtener URL pública">
                    <ui-spinner v-if="tunnelBusy" size="h-3.5 w-3.5"></ui-spinner>
                    <ui-icon v-else name="link" class="h-3.5 w-3.5"></ui-icon>
                    URL pública
                  </button>
                </div>
                <span v-if="tunnelUrl" class="mt-1 block font-mono text-[10px] text-emerald-700">Túnel activo: {{ tunnelUrl }}</span>
              </ui-field>
              <ui-field label="Eventos suscritos">
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="ev in EVENTS" :key="ev" @click="toggleWhEvent(ev)"
                    class="border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                    :class="whForm.events.includes(ev) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                    {{ ev }}
                  </button>
                </div>
              </ui-field>
              <div class="flex flex-wrap gap-2">
                <button v-if="canEdit('settings')" @click="saveWebhooks" :disabled="whSaving"
                  class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  <ui-spinner v-if="whSaving" size="h-4 w-4"></ui-spinner>
                  {{ whExists ? 'Actualizar suscripción' : 'Suscribir webhook' }}
                </button>
                <button v-if="canEdit('settings')" @click="testWebhook" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
                  Enviar prueba
                </button>
                <button v-if="whExists && canEdit('settings')" @click="deleteWebhooks"
                  class="border-2 border-red-800 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:shadow-brutal-sm">
                  Eliminar suscripción
                </button>
              </div>
            </div>

            <!-- Feed de eventos recibidos -->
            <div class="border-2 border-neutral-200">
              <div class="border-b-2 border-neutral-200 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Eventos recibidos (últimos 6)
              </div>
              <ul class="max-h-72 divide-y divide-neutral-100 overflow-y-auto">
                <li v-if="store.webhookEvents.length === 0" class="px-3 py-4 text-sm text-neutral-400">
                  Sin eventos todavía. Usa "Simular mensaje" o suscríbete para recibir los reales.
                </li>
                <li v-for="(entry, i) in store.webhookEvents.slice(0, 6)" :key="i" class="px-3 py-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-mono text-[11px] font-semibold text-[var(--accent)]">{{ entry.event.event }}</span>
                    <span class="font-mono text-[10px] text-neutral-400">{{ fmtT(entry.receivedAt) }}</span>
                  </div>
                  <p v-if="entry.event.message" class="mt-0.5 truncate text-xs text-neutral-500">
                    {{ entry.event.message.text || JSON.stringify(entry.event.message).slice(0, 80) }}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
