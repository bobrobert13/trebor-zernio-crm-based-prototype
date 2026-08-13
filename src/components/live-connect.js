/**
 * @file live-connect.js — Conexión real de canales (reutilizable).
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
    props: {
      platform: { type: String, default: 'whatsapp' },
      /** Nombre del negocio (el padre lo conoce; el workspace puede no existir aún). */
      businessName: { type: String, default: '' },
    },
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

      const creds = Vue.reactive({ wabaId: '', phoneNumberId: '', token: '', pin: '' });
      const showCreds = Vue.ref(false);

      /** Sub-keys creadas/reutilizadas en este flujo (una por perfil: evita duplicados). */
      const subKeyCache = {};
      /** Sub-key activa del flujo actual (viaja en el evento 'connected'). */
      const createdSubKey = Vue.ref('');

      /** OAuth amigable de WhatsApp (Embedded Signup de Meta). */
      const waOAuthStarted = Vue.ref(false);
      const waPhoneNumbers = Vue.ref([]); // WABA multi-número
      const waTempToken = Vue.ref('');
      const waSelectBusy = Vue.ref(false);

      const result = Vue.ref(null);
      const oauthUrl = Vue.ref(null);

      /** WhatsApp tiene flujo de cuentas/números/credenciales; el resto usa OAuth. */
      const isWhatsApp = Vue.computed(() => props.platform === 'whatsapp');

      /** Cuentas de la plataforma seleccionada en el perfil. */
      const platformAccounts = Vue.computed(() => accounts.value.filter((a) => a.platform === props.platform));

      /**
       * Valida la key listando perfiles. Solo promueve a master (centro) si la
       * key supera el probe admin (listApiKeys); de lo contrario se usa como
       * key operativa (sub-key del negocio).
       */
      async function validateKey() {
        const key = apiKey.value.trim();
        if (!key || busy.value) return;
        busy.value = true;
        try {
          store.apiKey = key;
          // Probe admin: si la key puede listar/crear sub-keys es la master del centro
          let isMaster = false;
          try {
            await api.listApiKeys();
            isMaster = true;
          } catch {
            isMaster = false;
          }
          if (isMaster) {
            store.masterKey = key;
            sessionStorage.setItem('tzcrm.masterKey', key); // solo sesión, nunca en workspace/export
          }
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

      /**
       * Crea la sub-key scoped al perfil (una por negocio) y la activa como
       * key operativa. Reutiliza: (1) la cache del flujo actual (una sola
       * creación por perfil) y (2) la sub-key persistida en el workspace si
       * pertenece a este perfil. Cuando el workspace aún no existe (onboarding)
       * la sub-key viaja en el evento 'connected' para que el padre la persista
       * al crear el espacio. La master key NUNCA se persiste (solo en sesión).
       * @param {string} profileId — id del perfil del negocio.
       * @returns {Promise<string|null>} Sub-key activa o null si no se pudo crear.
       */
      async function ensureSubKey(profileId) {
        if (!profileId) return null;
        // (1) Cache del flujo: evita duplicados al re-elegir perfil o al llamar
        // desde createProfile + loadChannelOptions en el mismo registro
        if (subKeyCache[profileId]) {
          store.apiKey = subKeyCache[profileId];
          createdSubKey.value = subKeyCache[profileId];
          return subKeyCache[profileId];
        }
        // (2) Sub-key persistida en el workspace: solo si pertenece a este perfil
        const z = store.workspace && store.workspace.zernio;
        if (z && z.subKey && (!z.subKeyProfileId || z.subKeyProfileId === profileId)) {
          subKeyCache[profileId] = z.subKey;
          createdSubKey.value = z.subKey;
          if (store.apiKey !== z.subKey) store.apiKey = z.subKey;
          return z.subKey;
        }
        try {
          const data = await api.createApiKey({
            name: `negocio-${resolveBusinessName().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
            profileIds: [profileId],
          });
          const subKey = (data.apiKey && data.apiKey.key) || data.key;
          if (!subKey) throw new Error('el API no devolvió la sub-key');
          subKeyCache[profileId] = subKey;
          createdSubKey.value = subKey;
          if (store.workspace) {
            store.workspace.zernio = store.workspace.zernio || {};
            store.workspace.zernio.subKey = subKey;
            store.workspace.zernio.subKeyProfileId = profileId;
          }
          store.apiKey = subKey;
          toast('Sub-key del negocio creada (aislamiento por perfil)', 'success');
          return subKey;
        } catch (err) {
          toast(`No se pudo crear la sub-key (${err.message}). Se continúa con la key actual.`, 'error', 6000);
          return null;
        }
      }

      /** Nombre del negocio para el perfil/sub-key de Zernio (prop del padre). */
      function resolveBusinessName() {
        return props.businessName || (store.workspace && store.workspace.name) || 'Mi negocio';
      }

      /** Adjunta la sub-key activa del flujo al resultado antes de emitir. */
      function attachKey(result) {
        result.subKey = createdSubKey.value || '';
        result.subKeyProfileId = selectedProfileId.value || '';
        return result;
      }

      /** Crea un perfil de negocio con su sub-key. */
      async function createProfile() {
        busy.value = true;
        try {
          const data = await api.createProfile(resolveBusinessName());
          const profile = asArray(data)[0] || data.profile || data;
          profiles.value.unshift(profile);
          selectedProfileId.value = profile.id || profile._id;
          step.value = 'profile';
          toast('Perfil del negocio creado', 'success');
          await ensureSubKey(selectedProfileId.value);
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
          await ensureSubKey(id); // activa la sub-key del negocio antes de operar
          const [accData, phoneData] = await Promise.all([
            api.getAccounts(id),
            isWhatsApp.value ? api.listPhoneNumbers(id) : Promise.resolve([]),
          ]);
          accounts.value = asArray(accData);
          phones.value = asArray(phoneData);
          step.value = 'account';
          if (isWhatsApp.value && platformAccounts.value.length === 1 && phones.value.length === 0) {
            await connectWithAccount(platformAccounts.value[0]);
          }
        } catch (err) {
          toast(err.message || 'No se pudieron cargar las cuentas', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Vincula una cuenta existente (cualquier plataforma). */
      async function connectWithAccount(account) {
        const meta = account.metadata || {};
        const phone = isWhatsApp.value
          ? meta.displayPhoneNumber || account.username || account.displayName || 'Número vinculado'
          : account.username || account.displayName || 'Cuenta conectada';
        result.value = attachKey({
          platform: props.platform,
          profileId: selectedProfileId.value,
          accountId: account.id || account._id,
          phone,
          username: account.username || account.displayName || '',
        });
        step.value = 'done';
        toast(`${props.platform === 'whatsapp' ? 'Cuenta WhatsApp' : 'Cuenta ' + props.platform} vinculada`, 'success');
        emit('connected', result.value);
      }

      /** Vincula un número disponible de la plataforma. */
      async function connectWithPhone(phone) {
        const accountId = phone.accountId || phone.ownerAccountId || '';
        if (!accountId) {
          toast('El número no tiene cuenta vinculada: elige una cuenta existente o conéctalo por credenciales', 'error');
          return;
        }
        result.value = attachKey({
          profileId: selectedProfileId.value,
          accountId,
          phone: phone.phoneNumber || phone.displayName || 'Número de la plataforma',
        });
        step.value = 'done';
        toast('Número seleccionado', 'success');
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
            accessToken: creds.token.trim(),
            ...(creds.pin.trim() ? { pin: creds.pin.trim() } : {}),
          });
          result.value = attachKey({
            profileId: selectedProfileId.value,
            accountId: account.id || account._id,
            phone: account.displayName || account.username || 'Número vinculado',
          });
          step.value = 'done';
          toast('WhatsApp conectado por credenciales', 'success');
          emit('connected', result.value);
        } catch (err) {
          toast(err.message || 'No se pudieron validar las credenciales', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Inicia el flujo OAuth de la plataforma (Instagram/TikTok). */
      async function startOAuth() {
        const profileId = selectedProfileId.value;
        if (!profileId || busy.value) return;
        busy.value = true;
        try {
          const data = await api.getConnectUrl(props.platform, profileId);
          const url = data.url || data.authUrl;
          if (url) {
            oauthUrl.value = url;
            window.open(url, '_blank');
            toast('Autoriza en la ventana abierta y luego pulsa "Verificar conexión"', 'info', 6000);
          } else {
            toast('El API no devolvió URL de autorización', 'error');
          }
        } catch (err) {
          toast(err.message || 'No se pudo iniciar la autorización', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Verifica si la cuenta ya apareció conectada en el perfil. */
      async function verifyOAuth() {
        const profileId = selectedProfileId.value;
        if (!profileId || busy.value) return;
        busy.value = true;
        try {
          const data = await api.getAccounts(profileId);
          accounts.value = asArray(data);
          if (platformAccounts.value.length === 1) {
            await connectWithAccount(platformAccounts.value[0]);
          } else if (platformAccounts.value.length > 1) {
            step.value = 'account';
          } else {
            toast('La cuenta aún no aparece: completa la autorización en la ventana de la plataforma', 'info', 6000);
          }
        } catch (err) {
          toast(err.message || 'No se pudo verificar la conexión', 'error');
        } finally {
          busy.value = false;
        }
      }

      /**
       * Inicia el flujo guiado de Meta (Embedded Signup) para conectar el
       * número del cliente SIN datos técnicos. Si hay túnel activo, el sistema
       * devuelve el resultado al MVP (callback automático); si no, el cliente
       * vuelve y pulsa "Ya autoricé, verificar".
       */
      async function startWhatsAppOAuth() {
        const profileId = selectedProfileId.value;
        if (!profileId || busy.value) return;
        busy.value = true;
        try {
          let redirectUrl = '';
          if (store.serverMode) {
            try {
              const res = await fetch('/api/tunnel', { cache: 'no-store' });
              const t = await res.json();
              if (t.url) redirectUrl = `${t.url}/index.html?cb=wa`;
            } catch {
              redirectUrl = '';
            }
          }
          const data = await api.getWhatsAppConnectUrl(profileId, redirectUrl || undefined);
          const url = data.authUrl || data.url;
          if (url) {
            oauthUrl.value = url;
            waOAuthStarted.value = true;
            window.open(url, '_blank');
            toast('Meta te guiará: autoriza con tu cuenta y verifica tu número con el código SMS', 'info', 8000);
          } else {
            toast('El API no devolvió URL de autorización', 'error');
          }
        } catch (err) {
          toast(err.message || 'No se pudo iniciar la autorización de Meta', 'error');
        } finally {
          busy.value = false;
        }
      }

      /** Procesa el callback del túnel (redirect_url) al volver de Meta. */
      async function consumeCallback() {
        if (!isWhatsApp.value) return;
        let raw = null;
        try {
          raw = sessionStorage.getItem('tzcrm.wa-callback');
        } catch {
          raw = null;
        }
        if (!raw) return;
        sessionStorage.removeItem('tzcrm.wa-callback');
        const params = JSON.parse(raw);
        if (!params || params.connected !== 'whatsapp') return;
        // WABA multi-número: pedir la selección amigable del número
        const cbProfileId = params.profileId || selectedProfileId.value;
        if (params.step === 'select_phone_number' || params.tempToken) {
          waTempToken.value = params.tempToken || '';
          await ensureSubKey(cbProfileId); // sub-key activa antes de operar con el número
          await loadWaPhoneNumbers(cbProfileId);
          return;
        }
        // Conexión directa: accountId viene en el callback
        if (params.accountId) {
          await ensureSubKey(cbProfileId);
          result.value = attachKey({
            platform: 'whatsapp',
            profileId: cbProfileId,
            accountId: params.accountId,
            phone: params.username || params.displayName || 'Número vinculado',
            username: params.username || '',
          });
          step.value = 'done';
          toast('WhatsApp conectado desde Meta', 'success');
          emit('connected', result.value);
        }
      }

      /** Lista los números de la WABA multi-número para elegir. */
      async function loadWaPhoneNumbers(profileId) {
        const id = profileId || selectedProfileId.value;
        if (!id || !waTempToken.value || waSelectBusy.value) return;
        waSelectBusy.value = true;
        try {
          const data = await api.listConnectPhoneNumbers(id, waTempToken.value);
          waPhoneNumbers.value = asArray(data.phoneNumbers || data);
          if (waPhoneNumbers.value.length === 1) {
            await selectWaPhone(waPhoneNumbers.value[0]);
          } else if (waPhoneNumbers.value.length === 0) {
            toast('No se encontraron números en la cuenta de Meta. Revisa en Meta que el número esté registrado.', 'error', 6000);
          } else {
            step.value = 'wa-select';
            toast('Elige el número de WhatsApp de tu negocio', 'info');
          }
        } catch (err) {
          toast(err.message || 'No se pudo listar los números de la WABA', 'error');
        } finally {
          waSelectBusy.value = false;
        }
      }

      /** Vincula el número elegido de la WABA al perfil. */
      async function selectWaPhone(phone) {
        if (!phone || waSelectBusy.value) return;
        waSelectBusy.value = true;
        try {
          const account = await api.selectConnectPhoneNumber({
            profileId: selectedProfileId.value,
            tempToken: waTempToken.value,
            phoneNumberId: phone.id || phone.phoneNumberId || '',
          });
          result.value = attachKey({
            platform: 'whatsapp',
            profileId: selectedProfileId.value,
            accountId: account.id || account._id || account.accountId || '',
            phone: phone.display_phone_number || phone.displayPhoneNumber || account.username || 'Número vinculado',
            username: phone.display_phone_number || '',
          });
          step.value = 'done';
          toast(`Número ${result.value.phone} conectado`, 'success');
          emit('connected', result.value);
        } catch (err) {
          toast(err.message || 'No se pudo vincular el número', 'error');
        } finally {
          waSelectBusy.value = false;
        }
      }

      Vue.onMounted(consumeCallback);

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
        selectedAccountId, selectedPhoneId, creds, showCreds, result, waAccounts: platformAccounts,
        isWhatsApp, oauthUrl,
        waOAuthStarted, waPhoneNumbers, waSelectBusy,
        validateKey, createProfile, ensureSubKey, loadChannelOptions, connectWithAccount,
        connectWithPhone, connectCredentials, startOAuth, verifyOAuth, reset,
        startWhatsAppOAuth, loadWaPhoneNumbers, selectWaPhone,
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

        <template v-else>
          <!-- Paso 1 · API key -->
          <ui-field label="Clave de acceso de la plataforma" hint="sk_… — la proporciona tu proveedor.">
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
