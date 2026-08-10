/**
 * @file live-connect.js — Conexión real con Zernio (reutilizable).
 * Flujo: API key → validar perfiles → elegir/crear perfil → detectar cuenta
 * WhatsApp existente o números provisionados → vincular. Fallback por
 * credenciales de Meta (wabaId + phoneNumberId + token).
 * Emite 'connected' con { profileId, accountId, phone } para el padre.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray } = ZernioCrm;

  const components = {};

  components['live-connect'] = {
    emits: ['connected'],
    setup(props, { emit }) {
      /** Paso actual del sub-flujo. */
      const step = Vue.ref('key');
      const busy = Vue.ref(false);

      const apiKey = Vue.ref(store.apiKey || '');
      const profiles = Vue.ref([]);
      const selectedProfileId = Vue.ref(null);
      const accounts = Vue.ref([]);
      const phones = Vue.ref([]);
      const selectedAccountId = Vue.ref(null);
      const selectedPhoneId = Vue.ref(null);

      const creds = Vue.reactive({ wabaId: '', phoneNumberId: '', token: '' });
      const showCreds = Vue.ref(false);

      const result = Vue.ref(null);

      /** Cuentas WhatsApp disponibles en el perfil. */
      const waAccounts = Vue.computed(() => accounts.value.filter((a) => a.platform === 'whatsapp'));

      /** Valida la key listando perfiles. */
      async function validateKey() {
        const key = apiKey.value.trim();
        if (!key || busy.value) return;
        busy.value = true;
        try {
          store.apiKey = key;
          const data = await api.getProfiles();
          profiles.value = asArray(data);
          if (profiles.value.length === 0) {
            await createProfile();
          } else {
            step.value = 'profile';
            toast(`${profiles.value.length} perfil(es) encontrado(s)`, 'success');
          }
        } catch (err) {
          toast(err.message || 'API key inválida', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Crea un perfil en Zernio con el nombre del workspace. */
      async function createProfile() {
        busy.value = true;
        try {
          const data = await api.createProfile((store.workspace && store.workspace.name) || 'Mi negocio');
          const profile = asArray(data)[0] || data.profile || data;
          profiles.value.unshift(profile);
          selectedProfileId.value = profile.id || profile._id;
          step.value = 'profile';
          toast('Perfil creado en Zernio', 'success');
          await loadChannelOptions(selectedProfileId.value);
        } catch (err) {
          toast(err.message || 'No se pudo crear el perfil', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Carga cuentas y números provisionados del perfil elegido. */
      async function loadChannelOptions(profileId) {
        const id = profileId || selectedProfileId.value;
        if (!id) return;
        selectedProfileId.value = id;
        busy.value = true;
        try {
          const [accData, phoneData] = await Promise.all([
            api.getAccounts(id),
            api.listPhoneNumbers(id),
          ]);
          accounts.value = asArray(accData);
          phones.value = asArray(phoneData);
          step.value = 'account';
          if (waAccounts.value.length === 1 && phones.value.length === 0) {
            await connectWithAccount(waAccounts.value[0]);
          }
        } catch (err) {
          toast(err.message || 'No se pudieron cargar las cuentas', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Vincula una cuenta WhatsApp existente. */
      async function connectWithAccount(account) {
        const meta = account.metadata || {};
        result.value = {
          profileId: selectedProfileId.value,
          accountId: account.id || account._id,
          phone: meta.displayPhoneNumber || account.username || account.displayName || 'Número vinculado',
        };
        step.value = 'done';
        toast('Cuenta WhatsApp vinculada', 'success');
        emit('connected', result.value);
      }

      /** Vincula un número provisionado (Zernio/Telnyx). */
      async function connectWithPhone(phone) {
        const accountId = phone.accountId || phone.ownerAccountId || '';
        if (!accountId) {
          toast('El número no tiene cuenta vinculada: elige una cuenta existente o conéctalo por credenciales', 'error');
          return;
        }
        result.value = {
          profileId: selectedProfileId.value,
          accountId,
          phone: phone.phoneNumber || phone.displayName || 'Número Zernio',
        };
        step.value = 'done';
        toast('Número Zernio seleccionado', 'success');
        emit('connected', result.value);
      }

      /** Conexión por credenciales de Meta (alternativa headless). */
      async function connectCredentials() {
        if (!creds.wabaId.trim() || !creds.phoneNumberId.trim() || !creds.token.trim() || busy.value) return;
        busy.value = true;
        try {
          const account = await api.connectWhatsAppCredentials(selectedProfileId.value, {
            wabaId: creds.wabaId.trim(),
            phoneNumberId: creds.phoneNumberId.trim(),
            token: creds.token.trim(),
          });
          result.value = {
            profileId: selectedProfileId.value,
            accountId: account.id || account._id,
            phone: account.displayName || account.username || 'Número vinculado',
          };
          step.value = 'done';
          toast('WhatsApp conectado por credenciales', 'success');
          emit('connected', result.value);
        } catch (err) {
          toast(err.message || 'No se pudieron validar las credenciales', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Reinicia el flujo para probar con otra key. */
      function reset() {
        step.value = 'key';
        result.value = null;
        profiles.value = [];
        accounts.value = [];
        phones.value = [];
        selectedProfileId.value = null;
        selectedAccountId.value = null;
        selectedPhoneId.value = null;
      }

      return {
        step, busy, apiKey, profiles, selectedProfileId, accounts, phones,
        selectedAccountId, selectedPhoneId, creds, showCreds, result, waAccounts,
        validateKey, createProfile, loadChannelOptions, connectWithAccount,
        connectWithPhone, connectCredentials, reset,
      };
    },

    template: `
      <div class="space-y-4">
        <!-- Resultado conectado -->
        <div v-if="step === 'done' && result" class="flex items-center gap-3 border-2 border-emerald-800 bg-emerald-50 p-4">
          <ui-icon name="check-circle" class="h-6 w-6 shrink-0 text-emerald-700"></ui-icon>
          <div class="min-w-0">
            <p class="font-semibold text-emerald-900">Conectado con Zernio</p>
            <p class="truncate font-mono text-xs text-emerald-800">{{ result.phone }} · perfil {{ result.profileId }}</p>
          </div>
          <button @click="reset" class="ml-auto shrink-0 border-2 border-emerald-900 bg-white px-2.5 py-1 text-xs font-medium transition hover:shadow-brutal-sm">Cambiar</button>
        </div>

        <template v-else>
          <!-- Paso 1 · API key -->
          <ui-field label="API key de Zernio" hint="sk_… — se guarda en localStorage (prototipo).">
            <div class="flex items-end gap-2">
              <input v-model.trim="apiKey" type="password" placeholder="sk_…" autocomplete="off"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
              <button @click="validateKey" :disabled="!apiKey.trim() || busy"
                class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                {{ busy ? 'Validando…' : 'Validar' }}
              </button>
            </div>
          </ui-field>

          <!-- Paso 2 · Perfil -->
          <div v-if="step === 'profile'" class="border-2 border-neutral-900 bg-white">
            <div class="border-b-2 border-neutral-900 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              Perfil en Zernio (marca/proyecto)
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
            </div>
          </div>

          <!-- Paso 3 · Cuenta o número -->
          <div v-if="step === 'account'" class="space-y-4">
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
                Números Zernio provisionados ({{ phones.length }})
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
              No hay cuentas WhatsApp ni números provisionados en este perfil. Usa el acceso por credenciales de Meta o conecta un número desde Zernio.
            </div>

            <!-- Fallback: credenciales Meta -->
            <button @click="showCreds = !showCreds" class="text-sm font-medium text-[var(--accent)]">
              {{ showCreds ? '− Ocultar credenciales Meta' : '+ Conectar con credenciales de Meta (wabaId, phoneNumberId, token)' }}
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
              <button @click="connectCredentials" :disabled="busy || !creds.wabaId.trim() || !creds.phoneNumberId.trim() || !creds.token.trim()"
                class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-neutral-900 px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                Conectar WhatsApp
              </button>
            </div>
          </div>
        </template>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
