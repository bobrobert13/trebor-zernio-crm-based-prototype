/**
 * @file settings.js — Configuración del workspace: branding, integración
 * Zernio (modo demo/live + API key + test de conexión), estado del canal
 * WhatsApp, exportación de datos y zona de peligro (reset/eliminar).
 * Orquestador por bounded context: la lógica vive en src/settings-composables.js
 * y la presentación en src/components/settings/*. 1:1 con el comportamiento
 * previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, ACCENTS, REFERRERS, WHATSAPP_MODALITIES, canEdit, api, asArray, fmtD, fmtT, swapInPlace } = ZernioCrm;

  const components = {};

  components['settings-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);

      // Composición por bounded context (ver src/settings-composables.js)
      const shell = ZernioCrm.makeSettingsShell({ store, WHATSAPP_MODALITIES, REFERRERS });
      const branding = ZernioCrm.makeSettingsBranding({ workspace, applyAccent, toast, makeLogoUpload: (o) => ZernioCrm.makeLogoUpload(o) });
      const apiConn = ZernioCrm.makeSettingsApiConnection({ store, toast, testConnectionApi: () => ZernioCrm.api.testConnection() });
      const data = ZernioCrm.makeSettingsData({ store, workspace, canEdit, toast });
      const channel = ZernioCrm.makeSettingsChannel({ store, workspace, canEdit, toast, channelApi: (id) => ZernioCrm.api.getAccountHealth(id) });
      const webhooks = ZernioCrm.makeSettingsWebhooks({
        store, workspace, canEdit, toast,
        webhookApi: ZernioCrm.api,
        locationContext: location,
        fetchTunnel: () => fetch('/api/tunnel', { cache: 'no-store' }),
        pushWebhookEvent: (e) => ZernioCrm.pushWebhookEvent(e),
      });
      const tags = ZernioCrm.makeSettingsTags({ workspace, toast, swapInPlace });
      const fields = ZernioCrm.makeSettingsCustomFields({ workspace, toast, swapInPlace });
      const subkeys = ZernioCrm.makeSettingsSubKeys({ store, workspace, api, asArray, toast });

      Vue.onMounted(webhooks.loadWebhooks);

      return {
        ...shell,     // workspace, modality, referrer, settingsTab, settingsTabs, advancedOpen, isAdvanced
        ...branding,  // saveBranding, uploadLogo, removeLogo
        ...apiConn,   // apiKeyInput, testing, testResult, saveApiKey, testConnection
        ...data,      // confirmReset, confirmDelete, exportData, resetDemo, deleteWorkspace
        ...channel,   // health, healthBusy, reconnectOpen, disconnectWhatsApp, reconnectWhatsApp, checkHealth, disconnectLive, onLiveConnected
        ...webhooks,  // EVENTS, whForm, whExists, whSaving, whLogs, whLogsOpen, tunnelUrl, tunnelBusy, buildWebhookUrl, loadWebhooks, saveWebhooks, deleteWebhooks, testWebhook, openLogs, simulateWebhook, toggleWhEvent, fetchTunnelUrl
        ...tags,      // leadTags, contactTags, leadInput, contactInput, addTag, addLeadTag, addContactTag, removeTag, moveTag, renameTag
        ...fields,    // customFields, fieldInput, fieldTypeOptions, addField, removeField, moveField, renameField, updateFieldType, updateFieldOptions
        ...subkeys,   // subKey, subKeyBusy, maskKey, rotateSubKey, revokeSubKey
        ACCENTS, store, canEdit, fmtD, fmtT,
      };
    },

    template: `
      <div class="grid items-start gap-6 lg:grid-cols-[230px_1fr]">


      <div class="grid items-start gap-6 lg:grid-cols-[230px_1fr]">
        <header class="lg:col-span-2">
          <h2 class="text-2xl font-bold">Configuración</h2>
          <p class="mt-1 text-sm text-neutral-500">Branding, canales y datos del espacio de trabajo. Las opciones avanzadas las gestiona tu proveedor.</p>
        </header>

        <!-- Subsidebar: secciones de configuración -->
        <aside class="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
          <button v-for="t in settingsTabs" :key="t.id" @click="settingsTab = t.id"
            class="flex shrink-0 items-center gap-2 border-2 px-3 py-2.5 text-sm font-medium transition"
            :class="settingsTab === t.id ? 'border-neutral-900 bg-[var(--accent)] text-white shadow-brutal-sm' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-900'">
            <ui-icon :name="t.icon" class="h-4 w-4"></ui-icon>
            <span class="whitespace-nowrap">{{ t.label }}</span>
          </button>
        </aside>

        <!-- Branding -->
        <settings-branding-panel
          :workspace="workspace" :referrer="referrer" :accents="ACCENTS"
          :upload-logo="uploadLogo" :remove-logo="removeLogo" :save-branding="saveBranding"></settings-branding-panel>

        <settings-tags-panel
          :lead-tags="leadTags" :contact-tags="contactTags"
          :lead-input="leadInput" :contact-input="contactInput"
          :add-lead-tag="addLeadTag" :add-contact-tag="addContactTag"
          :remove-tag="removeTag" :move-tag="moveTag" :rename-tag="renameTag"></settings-tags-panel>

        <settings-fields-panel
          :custom-fields="customFields" :field-input="fieldInput" :field-type-options="fieldTypeOptions"
          :add-field="addField" :remove-field="removeField" :move-field="moveField"
          :rename-field="renameField" :update-field-type="updateFieldType"
          :update-field-options="updateFieldOptions"></settings-fields-panel>

        <section v-if="settingsTab === 'avanzado'" class="border-2 border-neutral-900 bg-white lg:col-start-2">
          <button @click="advancedOpen = !advancedOpen" class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                <ui-icon name="settings" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">Opciones avanzadas</p>
                <p class="text-xs text-neutral-500">Webhooks, credenciales e integración técnica.</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <ui-badge v-if="isAdvanced" variant="success" dot>Habilitadas</ui-badge>
              <ui-icon name="chevron-down" class="h-4 w-4 text-neutral-400" :class="advancedOpen ? 'rotate-180 transition-transform' : ''"></ui-icon>
            </div>
          </button>
          <div v-if="advancedOpen" class="border-t-2 border-neutral-900 p-5">
            <p class="mb-4 text-xs text-neutral-500">
              Modo administración: puedes gestionar la integración técnica del negocio.
              La clave del centro se provee automáticamente; este espacio opera con su sub-key.
            </p>
          </div>
        </section>
        <section v-if="settingsTab === 'avanzado' && advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Integración de canales</h3>
          <div v-if="store.corsBlocked" class="mb-4 flex items-start gap-3 border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-900">
            <ui-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0"></ui-icon>
            <p>El navegador no puede alcanzar el API de la plataforma (CORS). El prototipo opera en modo demo; para producción usa el servidor local (node server.mjs).</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="Sub-key del negocio" hint="Operativa del espacio (aislada a su perfil). Se guarda en localStorage — solo para prototipo.">
              <input v-model.trim="apiKeyInput" type="password" placeholder="sk_…" autocomplete="off"
                class="w-full border-2 border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900" />
            </ui-field>
            <div class="flex items-end gap-2">
              <button @click="saveApiKey" class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Guardar
              </button>
              <button @click="testConnection" :disabled="!apiKeyInput.trim() || testing"
                class="flex flex-1 items-center justify-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="testing" size="h-4 w-4"></ui-spinner>
                {{ testing ? 'Probando…' : 'Probar conexión' }}
              </button>
            </div>
          </div>
          <p v-if="testResult" class="mt-3 text-sm font-medium" :class="testResult.ok ? 'text-emerald-700' : 'text-red-700'">
            {{ testResult.text }}
          </p>
          <div class="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-4">
            <span class="font-mono text-[11px] uppercase tracking-widest text-neutral-500">Modo actual:</span>
            <ui-badge :variant="store.mode === 'live' ? 'warn' : 'success'" dot>
              {{ store.mode === 'live' ? 'Live (API real)' : 'Demo (datos simulados)' }}
            </ui-badge>
          </div>
        </section>
        <section v-if="settingsTab === 'canal'" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
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
              <button v-if="workspace.zernio && canEdit('settings')" @click="reconnectOpen = true"
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
        <section v-if="settingsTab === 'avanzado' && advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Credenciales del centro</h3>
          <p class="text-sm text-neutral-600">
            Este negocio opera con una sub-key de acceso limitada a su perfil (expiración 90 días).
            Si un cliente abusa o deja de pagar, revocas solo su acceso sin afectar a los demás.
          </p>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-neutral-500">Sub-key activa</span>
            <span class="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span v-if="subKey">{{ maskKey(subKey) }} · expira en ~90 días</span>
              <span v-else class="text-neutral-400">Sin sub-key (operando con la key directa)</span>
              <ui-badge v-if="subKey" variant="success" dot>Aislada al perfil</ui-badge>
            </span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button v-if="subKey && canEdit('settings')" @click="rotateSubKey" :disabled="subKeyBusy"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="subKeyBusy" size="h-3.5 w-3.5"></ui-spinner>
              Rotar sub-key
            </button>
            <button v-if="subKey && canEdit('settings')" @click="revokeSubKey" :disabled="subKeyBusy"
              class="border-2 border-red-800 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 transition hover:shadow-brutal-sm">
              Revocar acceso
            </button>
          </div>
          <p class="mt-3 text-xs text-neutral-400">
            Rotar crea una sub-key nueva y revoca la anterior al instante. Revocar deja el negocio sin conexión.
          </p>
        </section>
        <ui-modal :open="reconnectOpen" title="Conectar con la plataforma" @close="reconnectOpen = false">
          <live-connect :business-name="workspace.name" @connected="onLiveConnected"></live-connect>
        </ui-modal>

        <!-- Webhooks -->
        <section v-if="settingsTab === 'avanzado' && advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Webhooks (eventos en tiempo real)</h3>
            <div class="flex items-center gap-2">
              <ui-badge v-if="store.serverMode" variant="success" dot>Servidor local activo</ui-badge>
        <!-- Webhooks -->
        <section v-if="settingsTab === 'avanzado' && advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
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
        </section>
        <settings-data-panel :workspace="workspace"
          :confirm-reset="confirmReset" :confirm-delete="confirmDelete"
          :export-data="exportData" :reset-demo="resetDemo" :delete-workspace="deleteWorkspace"
          @update:confirmReset="confirmReset = $event" @update:confirmDelete="confirmDelete = $event"></settings-data-panel>

      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
