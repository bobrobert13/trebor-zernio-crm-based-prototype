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
        <settings-branding-panel v-if="settingsTab === 'marca'"
          :workspace="workspace" :referrer="referrer" :accents="ACCENTS"
          :upload-logo="uploadLogo" :remove-logo="removeLogo" :save-branding="saveBranding"></settings-branding-panel>

        <!-- Gestión de leads + etiquetas de contacto -->
        <settings-tags-panel v-if="settingsTab === 'pipeline'"
          :lead-tags="leadTags" :contact-tags="contactTags"
          :lead-input="leadInput" :contact-input="contactInput"
          :add-lead-tag="addLeadTag" :add-contact-tag="addContactTag"
          :remove-tag="removeTag" :move-tag="moveTag" :rename-tag="renameTag"></settings-tags-panel>

        <!-- Campos del negocio -->
        <settings-fields-panel v-if="settingsTab === 'campos'"
          :custom-fields="customFields" :field-input="fieldInput" :field-type-options="fieldTypeOptions"
          :add-field="addField" :remove-field="removeField" :move-field="moveField"
          :rename-field="renameField" :update-field-type="updateFieldType"
          :update-field-options="updateFieldOptions"></settings-fields-panel>

        <!-- Avanzado (intro + integración + credenciales) -->
        <settings-advanced-panels v-if="settingsTab === 'avanzado'"
          :advanced-open="advancedOpen" :is-advanced="isAdvanced"
          :store="store" :api-key-input="apiKeyInput" :testing="testing" :test-result="testResult"
          :sub-key="subKey" :sub-key-busy="subKeyBusy" :mask-key="maskKey" :save-api-key="saveApiKey"
          :test-connection="testConnection" :rotate-sub-key="rotateSubKey"
          :revoke-sub-key="revokeSubKey" :can-edit="canEdit"
          @update:advancedOpen="advancedOpen = $event"></settings-advanced-panels>

        <!-- Canal WhatsApp + modal de reconexión -->
        <settings-channel-panel v-if="settingsTab === 'canal'"
          :workspace="workspace" :modality="modality" :can-edit="canEdit"
          :reconnect-open="reconnectOpen" :health-busy="healthBusy" :health="health"
          :fmt-d="fmtD" :check-health="checkHealth" :disconnect-live="disconnectLive"
          :disconnect-whats-app="disconnectWhatsApp" :reconnect-whats-app="reconnectWhatsApp"
          @update:reconnectOpen="reconnectOpen = $event" @connected="onLiveConnected"></settings-channel-panel>

        <!-- Webhooks -->
        <settings-webhooks-panel v-if="settingsTab === 'avanzado' && advancedOpen && isAdvanced"
          :store="store" :can-edit="canEdit" :events="EVENTS" :wh-form="whForm"
          :wh-exists="whExists" :wh-saving="whSaving" :wh-logs="whLogs"
          :tunnel-url="tunnelUrl" :tunnel-busy="tunnelBusy" :fmt-t="fmtT"
          :build-webhook-url="buildWebhookUrl" :save-webhooks="saveWebhooks"
          :delete-webhooks="deleteWebhooks" :test-webhook="testWebhook"
          :open-logs="openLogs" :simulate-webhook="simulateWebhook"
          :toggle-wh-event="toggleWhEvent" :fetch-tunnel-url="fetchTunnelUrl"></settings-webhooks-panel>

        <!-- Datos + confirmaciones -->
        <settings-data-panel v-if="settingsTab === 'datos'"
          :workspace="workspace" :can-edit="canEdit"
          :confirm-reset="confirmReset" :confirm-delete="confirmDelete"
          :export-data="exportData" :reset-demo="resetDemo" :delete-workspace="deleteWorkspace"
          @update:confirmReset="confirmReset = $event" @update:confirmDelete="confirmDelete = $event"></settings-data-panel>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
