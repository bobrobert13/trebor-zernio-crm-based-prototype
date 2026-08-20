/**
 * @file live-connect.js — Conexión real de canales (reutilizable).
 * Flujo: perfiles del centro (la master key se provee por detrás) →
 * elegir/crear perfil del negocio → sub-key scoped → detectar cuenta
 * WhatsApp existente o números provisionados → vincular. Fallback por
 * credenciales de Meta (wabaId + phoneNumberId + token).
 * Orquestador por bounded context: la lógica vive en
 * src/live-connect-composables.js (1:1 con el comportamiento previo).
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
          <!-- Paso 2 · Perfil -->
          <div v-if="step === 'profile'" class="border-2 border-neutral-900 bg-white">
            <div class="border-b-2 border-neutral-900 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              Perfil del negocio
            </div>
            <div class="divide-y divide-neutral-100">
              <button v-for="p in profiles" :key="p.id || p._id" @click="loadChannelOptions(p.id || p._id)"
                class="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-stone-50">
                <div class="min-w-0">
                  <p class="font-semibold">{{ p.name }}</p>
                  <p class="truncate font-mono text-[11px] text-neutral-400">{{ p.id || p._id }}</p>
                </div>
                <ui-icon name="chevron-right" class="h-4 w-4 text-neutral-300"></ui-icon>
              </button>
              <button v-if="!busy" @click="createProfile" class="w-full px-4 py-3 text-left text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">
                + Crear perfil nuevo con el nombre del negocio
              </button>
              <button v-if="retryWithMaster && !busy" @click="retryAdmin" class="w-full border-t-2 border-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-stone-50">
                La sub-key del espacio no responde — reintentar con la clave del centro
              </button>
            </div>
            <p class="border-t-2 border-neutral-900 px-4 py-2.5 text-xs text-neutral-500">
              Al elegir un perfil se crea y activa la sub-key del negocio (scope limitado a este perfil, expiración 90 días).
            </p>
          </div>

          <!-- Paso 3 · Cuenta o número -->
          <div v-if="step === 'account' || step === 'wa-select'" class="space-y-4">
            <template v-if="isWhatsApp">
              <!-- Conexión guiada con Meta (recomendado, sin datos técnicos) -->
              <div class="border-2 border-neutral-900 bg-white p-4">
                <p class="font-semibold">Conecta tu número con Meta (recomendado)</p>
                <p class="mt-1 text-xs text-neutral-500">
                  Entra con tu cuenta de Facebook, elige tu negocio y verifica tu número con el código SMS que Meta te envía.
                  Sin configuraciones técnicas.
                </p>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <button v-if="!waOAuthStarted" @click="startWhatsAppOAuth" :disabled="busy"
                    class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                    Conectar con mi cuenta de Meta
                  </button>
                  <template v-else>
                    <ui-badge variant="warn" dot>Autorización iniciada</ui-badge>
                    <button @click="verifyOAuth" :disabled="busy"
                      class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                      <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                      Ya autoricé, verificar
                    </button>
                    <button @click="waOAuthStarted = false" class="text-xs font-medium text-neutral-500 underline">Reiniciar</button>
                  </template>
                </div>
              </div>

              <!-- WABA multi-número: elegir el número del negocio -->
              <div v-if="step === 'wa-select'" class="border-2 border-neutral-900 bg-white p-4">
                <span class="block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Tu cuenta de Meta tiene varios números — elige el de tu negocio
                </span>
                <div class="mt-2 space-y-2">
                  <button v-for="ph in waPhoneNumbers" :key="ph.id || ph.phoneNumberId" @click="selectWaPhone(ph)" :disabled="waSelectBusy"
                    class="flex w-full items-center justify-between gap-3 border-2 border-neutral-900 bg-white p-3.5 text-left transition hover:bg-stone-50">
                    <div class="min-w-0">
                      <p class="font-semibold">{{ ph.display_phone_number || ph.displayPhoneNumber }}</p>
                      <p class="truncate font-mono text-[11px] text-neutral-400">
                        {{ ph.verified_name || '—' }}
                        <span v-if="ph.quality_rating" class="ml-1 border px-1 py-px font-mono text-[9px] uppercase"
                          :class="ph.quality_rating === 'GREEN' ? 'border-emerald-800 text-emerald-800' : ph.quality_rating === 'YELLOW' ? 'border-amber-700 text-amber-800' : 'border-red-800 text-red-800'">
                          {{ ph.quality_rating }}
                        </span>
                      </p>
                    </div>
                    <ui-badge variant="accent">Elegir</ui-badge>
                  </button>
                </div>
              </div>

              <div v-if="waAccounts.length > 0">
                <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Cuenta WhatsApp existente ({{ waAccounts.length }})
                </span>
                <button v-for="a in waAccounts" :key="a.id || a._id" @click="connectWithAccount(a)"
                  class="flex w-full items-center gap-3 border-2 border-neutral-900 bg-white p-4 text-left transition hover:bg-stone-50"
                  :class="selectedAccountId === (a.id || a._id) ? 'shadow-brutal-sm' : ''">
                  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                    <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ a.displayName || a.username || 'Cuenta WhatsApp' }}</p>
                    <p class="truncate font-mono text-[11px] text-neutral-400">{{ a.platformIdentifier || a.id || a._id }}</p>
                  </div>
                  <ui-icon name="chevron-right" class="h-4 w-4 text-neutral-300"></ui-icon>
                </button>
              </div>

              <div v-if="phones.length > 0">
                <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Números disponibles ({{ phones.length }})
                </span>
                <div class="grid gap-2 sm:grid-cols-2">
                  <button v-for="ph in phones" :key="ph.id || ph.phoneNumber" @click="connectWithPhone(ph)"
                    class="flex items-center justify-between border-2 border-neutral-900 bg-white px-4 py-3 text-left transition hover:bg-stone-50">
                    <div class="min-w-0">
                      <p class="font-semibold">{{ ph.phoneNumber || ph.displayName }}</p>
                      <p class="font-mono text-[10px] uppercase text-neutral-400">{{ ph.status || 'provisioned' }}</p>
                    </div>
                    <ui-badge variant="neutral">Usar</ui-badge>
                  </button>
                </div>
              </div>

              <div v-if="waAccounts.length === 0 && phones.length === 0" class="border-2 border-dashed border-neutral-300 bg-white p-4 text-sm text-neutral-500">
                No hay cuentas WhatsApp ni números provisionados en este perfil. Usa el acceso por credenciales de Meta o conecta un número.
              </div>

              <!-- Fallback: credenciales Meta (opción avanzada) -->
              <button @click="showCreds = !showCreds" class="text-sm font-medium text-[var(--accent)]">
                {{ showCreds ? '− Ocultar opción avanzada' : '+ Opción avanzada: tengo los datos técnicos (wabaId, phoneNumberId, token)' }}
              </button>
              <div v-if="showCreds" class="space-y-3 border-2 border-neutral-900 bg-white p-4">
                <ui-field label="WABA ID">
                  <input v-model.trim="creds.wabaId" type="text" placeholder="123456789012345"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Phone Number ID">
                  <input v-model.trim="creds.phoneNumberId" type="text" placeholder="123456789012345"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Token de acceso (Meta)">
                  <input v-model.trim="creds.token" type="password" placeholder="EAAG…" autocomplete="off"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="PIN de verificación en 2 pasos (opcional)" hint="6 dígitos — solo si tu número lo tiene activado">
                  <input v-model.trim="creds.pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••" autocomplete="off"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <button @click="connectCredentials" :disabled="busy || !creds.wabaId.trim() || !creds.phoneNumberId.trim() || !creds.token.trim()"
                  class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-neutral-900 px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                  Conectar WhatsApp
                </button>
              </div>
            </template>

            <!-- OAuth para Instagram/TikTok -->
            <div v-else class="space-y-4">
              <div class="border-2 border-neutral-900 bg-white p-4">
                <p class="text-sm text-neutral-600">
                  Se abre la autorización de {{ platform === 'instagram' ? 'Instagram' : 'TikTok' }}.
                  Autoriza en la ventana que se abre y vuelve a verificar.
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button @click="startOAuth" :disabled="busy || oauthUrl"
                    class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                    {{ oauthUrl ? 'Autorización iniciada' : 'Autorizar con ' + (platform === 'instagram' ? 'Instagram' : 'TikTok') }}
                  </button>
                  <button @click="verifyOAuth" :disabled="busy"
                    class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                    Verificar conexión
                  </button>
                </div>
              </div>
              <div v-if="waAccounts.length > 0">
                <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Cuenta detectada ({{ waAccounts.length }})
                </span>
                <button v-for="a in waAccounts" :key="a.id || a._id" @click="connectWithAccount(a)"
                  class="flex w-full items-center gap-3 border-2 border-neutral-900 bg-white p-4 text-left transition hover:bg-stone-50">
                  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <ui-icon :name="platform === 'instagram' ? 'instagram' : 'tiktok'" class="h-5 w-5"></ui-icon>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ a.displayName || a.username || 'Cuenta' }}</p>
                    <p class="truncate font-mono text-[11px] text-neutral-400">{{ a.username || a.id || a._id }}</p>
                  </div>
                  <ui-icon name="chevron-right" class="h-4 w-4 text-neutral-300"></ui-icon>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
