/**
 * @file live-connect.js — Conexión real de canales (reutilizable).
 * Flujo: perfiles del centro (la master key se provee por detrás) →
 * elegir/crear perfil del negocio → sub-key scoped → detectar cuenta
 * WhatsApp existente o números provisionados → vincular. Fallback por
 * credenciales de Meta (wabaId + phoneNumberId + token).
 * Orquestador por bounded context: la lógica vive en
 * src/live-connect-composables.js y la presentación en
 * src/components/live-connect/*. 1:1 con el comportamiento previo.
 * Emite 'connected' con { profileId, accountId, phone, subKey } para el padre.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray } = ZernioCrm;

  const components = {};

  components['live-connect'] = {
    props: {
      platform: { type: String, default: 'whatsapp' },
      /** Nombre del negocio (el padre lo conoce; el workspace puede no existir aún). */
      businessName: { type: String, default: '' },
    },
    emits: ['connected'],
    setup(props, { emit }) {
      // Composición por bounded context (ver src/live-connect-composables.js)
      const state = ZernioCrm.makeLiveConnectState({ props, store });
      const subKeys = ZernioCrm.makeLiveConnectSubKeys({ store, toast, api, state });
      const selection = ZernioCrm.makeLiveConnectSelection({ api, toast, state, emit, attachKey: subKeys.attachKey });
      const oauth = ZernioCrm.makeLiveConnectOAuth({ api, toast, asArray, state, connectWithAccount: selection.connectWithAccount });
      const whatsapp = ZernioCrm.makeLiveConnectWhatsAppOAuth({ store, api, toast, asArray, state, emit, ensureSubKey: subKeys.ensureSubKey, attachKey: subKeys.attachKey });
      const profiles = ZernioCrm.makeLiveConnectProfiles({ store, api, toast, asArray, state, ensureSubKey: subKeys.ensureSubKey, connectWithAccount: selection.connectWithAccount });
      const lifecycle = ZernioCrm.makeLiveConnectLifecycle({ state, boot: profiles.boot, consumeCallback: whatsapp.consumeCallback });

      return {
        ...state,       // step, busy, profiles, selectedProfileId, retryWithMaster, accounts, phones, selectedAccountId, selectedPhoneId, creds, showCreds, createdSubKey, wa*, result, oauthUrl, platform, isWhatsApp, platformAccounts, resolveBusinessName
        ...selection,   // connectWithAccount, connectWithPhone, connectCredentials
        ...oauth,       // startOAuth, verifyOAuth
        ...whatsapp,    // startWhatsAppOAuth, consumeCallback, loadWaPhoneNumbers, selectWaPhone
        ...profiles,    // boot, retryAdmin, createProfile, loadChannelOptions
        ...lifecycle,   // reset
        ensureSubKey: subKeys.ensureSubKey,
        waAccounts: state.platformAccounts,
      };
    },

    template: `
      <div class="space-y-4">
        <!-- Resultado conectado -->
        <div v-if="step === 'done' && result" class="flex items-center gap-3 border-2 border-emerald-800 bg-emerald-50 p-4">
          <ui-icon name="check-circle" class="h-6 w-6 shrink-0 text-emerald-700"></ui-icon>
          <div class="min-w-0">
            <p class="font-semibold text-emerald-900">Conectado</p>
            <p class="truncate font-mono text-xs text-emerald-800">{{ result.phone }} · perfil {{ result.profileId }}</p>
          </div>
          <button @click="reset" class="ml-auto shrink-0 border-2 border-emerald-900 bg-white px-2.5 py-1 text-xs font-medium transition hover:shadow-brutal-sm">Cambiar</button>
        </div>
        <template v-else-if="step === 'boot'">
          <!-- Paso 1 · Cargando: la master del centro se provee por detrás (nunca se pide) -->
          <div class="flex items-center gap-3 border-2 border-neutral-900 bg-white p-4">
            <ui-spinner size="h-5 w-5"></ui-spinner>
            <span class="text-sm font-medium">Preparando la conexión del espacio…</span>
          </div>
        </template>
        <template v-else>
          <live-connect-profile v-if="step === 'profile'"
            :profiles="profiles" :busy="busy" :retry-with-master="retryWithMaster"
            :load-channel-options="loadChannelOptions" :create-profile="createProfile"
            :retry-admin="retryAdmin"></live-connect-profile>

          <div v-if="step === 'account' || step === 'wa-select'" class="space-y-4">
            <live-connect-whatsapp v-if="isWhatsApp"
              :wa-o-auth-started="waOAuthStarted" :busy="busy" :step="step"
              :wa-phone-numbers="waPhoneNumbers" :wa-select-busy="waSelectBusy"
              :wa-accounts="waAccounts" :selected-account-id="selectedAccountId"
              :phones="phones" :show-creds="showCreds" :creds="creds"
              :start-whats-app-o-auth="startWhatsAppOAuth" :verify-o-auth="verifyOAuth"
              :select-wa-phone="selectWaPhone" :connect-with-account="connectWithAccount"
              :connect-with-phone="connectWithPhone" :connect-credentials="connectCredentials"
              @update:waOAuthStarted="waOAuthStarted = $event" @update:showCreds="showCreds = $event"></live-connect-whatsapp>

            <live-connect-social v-else
              :platform="platform" :busy="busy" :oauth-url="oauthUrl"
              :wa-accounts="waAccounts" :start-o-auth="startOAuth"
              :verify-o-auth="verifyOAuth" :connect-with-account="connectWithAccount"></live-connect-social>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
