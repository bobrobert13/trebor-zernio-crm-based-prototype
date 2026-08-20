/**
 * @file live-connect-whatsapp.js — Paso presentacional de conexión de WhatsApp:
 * guía de Meta (Embedded Signup), WABA multi-número, cuenta existente/números
 * y fallback por credenciales. Emite update:* de waOAuthStarted/showCreds.
 * Verbatim del bloque original de live-connect.
 */
(function () {
  'use strict';

  const components = {};

  components['live-connect-whatsapp'] = {
    props: {
      waOAuthStarted: Boolean,
      busy: Boolean,
      step: String,
      waPhoneNumbers: Array,
      waSelectBusy: Boolean,
      waAccounts: Array,
      selectedAccountId: String,
      phones: Array,
      showCreds: Boolean,
      creds: Object,
      startWhatsAppOAuth: Function,
      verifyOAuth: Function,
      selectWaPhone: Function,
      connectWithAccount: Function,
      connectWithPhone: Function,
      connectCredentials: Function,
    },

    emits: ['update:waOAuthStarted', 'update:showCreds'],

    template: `
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
                    <button @click="$emit('update:waOAuthStarted', false)" class="text-xs font-medium text-neutral-500 underline">Reiniciar</button>
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
              <button @click="$emit('update:showCreds', !showCreds)" class="text-sm font-medium text-[var(--accent)]">
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
            </template>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
