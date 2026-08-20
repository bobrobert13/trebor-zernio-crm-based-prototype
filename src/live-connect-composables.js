/**
 * @file live-connect-composables.js — Composables por bounded context de la
 * conexión real de canales (reutilizable). Extraen la lógica del setup de
 * live-connect (estado compartido, sub-keys, perfiles, selección, OAuth
 * genérico y WhatsApp/WABA, y ciclo de vida) a factories `Z.makeXxx`;
 * sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC State: refs compartidos del flujo, derivados de plataforma y nombre
   * del negocio (la master key se provee por detrás, nunca se pide).
   */
  function makeLiveConnectState({ props, store }) {
    /** Paso actual del sub-flujo (arranca cargando; nunca pide la key). */
    const step = Vue.ref('boot');
    const busy = Vue.ref(false);

    const profiles = Vue.ref([]);
    const selectedProfileId = Vue.ref(null);
    /** boot() falló con la sub-key restaurada: ofrecer reintento con la master. */
    const retryWithMaster = Vue.ref(false);
    const accounts = Vue.ref([]);
    const phones = Vue.ref([]);
    const selectedAccountId = Vue.ref(null);
    const selectedPhoneId = Vue.ref(null);

    const creds = Vue.reactive({ wabaId: '', phoneNumberId: '', token: '', pin: '' });
    const showCreds = Vue.ref(false);

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

    /** Nombre del negocio para el perfil/sub-key de Zernio (prop del padre). */
    function resolveBusinessName() {
      return props.businessName || (store.workspace && store.workspace.name) || 'Mi negocio';
    }

    return {
      step, busy, profiles, selectedProfileId, retryWithMaster, accounts, phones,
      selectedAccountId, selectedPhoneId, creds, showCreds, createdSubKey,
      waOAuthStarted, waPhoneNumbers, waTempToken, waSelectBusy, result, oauthUrl,
      platform: props.platform, isWhatsApp, platformAccounts, resolveBusinessName,
    };
  }

  /**
   * BC SubKeys: cache de sub-keys del flujo + sesión (onboarding) y creación/
   * reutilización de la sub-key scoped al perfil.
   */
  function makeLiveConnectSubKeys({ store, toast, api, state }) {
    /** Sub-keys creadas/reutilizadas en este flujo (una por perfil: evita duplicados). */
    const subKeyCache = {};

    /** Sub-keys creadas durante onboarding (workspace aún inexistente): se guardan en
     * sesión para que un remonte de live-connect (volver/avanzar de paso o callback
     * del túnel) reutilice la misma sub-key en lugar de crear otra. Se limpian al
     * salir del workspace (clearSession/resetAll) para no compartir key entre espacios. */
    const SUBKEYS_SESSION_KEY = 'tzcrm.subkeys';
    function loadSubKeySession() {
      try {
        return JSON.parse(sessionStorage.getItem(SUBKEYS_SESSION_KEY) || '{}');
      } catch {
        return {};
      }
    }
    function saveSubKeySession(map) {
      try {
        sessionStorage.setItem(SUBKEYS_SESSION_KEY, JSON.stringify(map));
      } catch { /* sesión no disponible: sin persistencia, sin duplicar igualmente */ }
    }
    if (!store.workspace) Object.assign(subKeyCache, loadSubKeySession());

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
        state.createdSubKey.value = subKeyCache[profileId];
        return subKeyCache[profileId];
      }
      // (2) Sub-key persistida en el workspace: solo si pertenece a este perfil
      const z = store.workspace && store.workspace.zernio;
      if (z && z.subKey && (!z.subKeyProfileId || z.subKeyProfileId === profileId)) {
        subKeyCache[profileId] = z.subKey;
        state.createdSubKey.value = z.subKey;
        if (store.apiKey !== z.subKey) store.apiKey = z.subKey;
        return z.subKey;
      }
      try {
        const data = await api.createApiKey({
          name: `negocio-${state.resolveBusinessName().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
          profileIds: [profileId],
        });
        const subKey = (data.apiKey && data.apiKey.key) || data.key;
        if (!subKey) throw new Error('el API no devolvió la sub-key');
        subKeyCache[profileId] = subKey;
        state.createdSubKey.value = subKey;
        if (store.workspace) {
          store.workspace.zernio = store.workspace.zernio || {};
          store.workspace.zernio.subKey = subKey;
          store.workspace.zernio.subKeyProfileId = profileId;
        } else {
          // Onboarding: el workspace se crea en finish(); la key viaja por sesión
          // hasta que el padre la persista en workspace.zernio
          const map = loadSubKeySession();
          map[profileId] = subKey;
          saveSubKeySession(map);
        }
        store.apiKey = subKey;
        toast('Sub-key del negocio creada (aislamiento por perfil)', 'success');
        return subKey;
      } catch (err) {
        toast(`No se pudo crear la sub-key con la clave del centro (${err.message}). Se continúa con la key actual.`, 'error', 6000);
        return null;
      }
    }

    /** Adjunta la sub-key activa del flujo al resultado antes de emitir. */
    function attachKey(result) {
      result.subKey = state.createdSubKey.value || '';
      // El perfil del resultado manda (en el callback del túnel puede no estar seleccionado aún)
      result.subKeyProfileId = result.profileId || state.selectedProfileId.value || '';
      return result;
    }

    return { ensureSubKey, attachKey };
  }

  /**
   * BC Profiles: arranque, reintento admin, creación de perfil y carga de
   * cuentas/números del perfil elegido.
   */
  function makeLiveConnectProfiles({ store, api, toast, asArray, state, ensureSubKey, connectWithAccount }) {
    /**
     * Arranca el flujo sin pedir la API key: lista los perfiles y deja
     * elegir/crear el perfil del negocio. Lista con la sub-key del espacio
     * si ya existe (solo sus perfiles); si no (onboarding) con la master
     * del centro, que es una constante del MVP y nunca se pide al usuario.
     */
    async function boot() {
      if (state.busy.value) return;
      state.busy.value = true;
      state.retryWithMaster.value = false;
      try {
        const data = await api.getProfiles(!store.apiKey);
        state.profiles.value = asArray(data);
        if (state.profiles.value.length === 0) {
          await createProfile();
        } else if (store.workspace && state.profiles.value.length === 1) {
          // Reconexión: el perfil del espacio ya está vinculado — ir directo al canal
          await loadChannelOptions(state.profiles.value[0].id || state.profiles.value[0]._id);
        } else {
          state.step.value = 'profile';
          toast(`${state.profiles.value.length} perfil(es) encontrado(s)`, 'success');
        }
      } catch (err) {
        // Si falló con la sub-key restaurada (vencida/revocada), ofrecer
        // reintento con la master del centro; si no, la opción
        // "Crear perfil nuevo" funciona como reintento
        state.retryWithMaster.value = Boolean(store.apiKey);
        state.step.value = 'profile';
        toast(err.message || 'No se pudieron cargar los perfiles', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    /**
     * Vuelve a arrancar con la master del centro (olvida la sub-key
     * restaurada que quedó vencida/revocada; la próxima elección de perfil
     * crea una sub-key nueva).
     */
    function retryAdmin() {
      store.apiKey = '';
      state.retryWithMaster.value = false;
      boot();
    }

    /** Crea un perfil de negocio con su sub-key. */
    async function createProfile() {
      state.busy.value = true;
      try {
        const data = await api.createProfile(state.resolveBusinessName());
        const profile = asArray(data)[0] || data.profile || data;
        state.profiles.value.unshift(profile);
        state.selectedProfileId.value = profile.id || profile._id;
        state.step.value = 'profile';
        toast('Perfil del negocio creado', 'success');
        await ensureSubKey(state.selectedProfileId.value);
        await loadChannelOptions(state.selectedProfileId.value);
      } catch (err) {
        toast(err.message || 'No se pudo crear el perfil', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    /** Carga cuentas y números provisionados del perfil elegido. */
    async function loadChannelOptions(profileId) {
      const id = profileId || state.selectedProfileId.value;
      if (!id) return;
      state.selectedProfileId.value = id;
      state.busy.value = true;
      try {
        await ensureSubKey(id); // activa la sub-key del negocio antes de operar
        const [accData, phoneData] = await Promise.all([
          api.getAccounts(id),
          state.isWhatsApp.value ? api.listPhoneNumbers(id) : Promise.resolve([]),
        ]);
        state.accounts.value = asArray(accData);
        state.phones.value = asArray(phoneData);
        state.step.value = 'account';
        if (state.isWhatsApp.value && state.platformAccounts.value.length === 1 && state.phones.value.length === 0) {
          await connectWithAccount(state.platformAccounts.value[0]);
        }
      } catch (err) {
        toast(err.message || 'No se pudieron cargar las cuentas', 'error');
        // Reconexión automática: salir del spinner sin salida hacia el picker
        if (state.step.value === 'boot') state.step.value = 'profile';
      } finally {
        state.busy.value = false;
      }
    }

    return { boot, retryAdmin, createProfile, loadChannelOptions };
  }

  /**
   * BC Selection: vinculación por cuenta existente, número disponible o
   * credenciales de Meta (alternativa headless).
   */
  function makeLiveConnectSelection({ api, toast, state, emit, attachKey }) {
    /** Vincula una cuenta existente (cualquier plataforma). */
    async function connectWithAccount(account) {
      const meta = account.metadata || {};
      const platform = state.platform;
      const phone = state.isWhatsApp.value
        ? meta.displayPhoneNumber || account.username || account.displayName || 'Número vinculado'
        : account.username || account.displayName || 'Cuenta conectada';
      state.result.value = attachKey({
        platform,
        profileId: state.selectedProfileId.value,
        accountId: account.id || account._id,
        phone,
        username: account.username || account.displayName || '',
      });
      state.step.value = 'done';
      toast(`${platform === 'whatsapp' ? 'Cuenta WhatsApp' : 'Cuenta ' + platform} vinculada`, 'success');
      emit('connected', state.result.value);
    }

    /** Vincula un número disponible de la plataforma. */
    async function connectWithPhone(phone) {
      const accountId = phone.accountId || phone.ownerAccountId || '';
      if (!accountId) {
        toast('El número no tiene cuenta vinculada: elige una cuenta existente o conéctalo por credenciales', 'error');
        return;
      }
      state.result.value = attachKey({
        profileId: state.selectedProfileId.value,
        accountId,
        phone: phone.phoneNumber || phone.displayName || 'Número de la plataforma',
      });
      state.step.value = 'done';
      toast('Número seleccionado', 'success');
      emit('connected', state.result.value);
    }

    /** Conexión por credenciales de Meta (alternativa headless). */
    async function connectCredentials() {
      if (!state.creds.wabaId.trim() || !state.creds.phoneNumberId.trim() || !state.creds.token.trim() || state.busy.value) return;
      state.busy.value = true;
      try {
        const account = await api.connectWhatsAppCredentials(state.selectedProfileId.value, {
          wabaId: state.creds.wabaId.trim(),
          phoneNumberId: state.creds.phoneNumberId.trim(),
          accessToken: state.creds.token.trim(),
          ...(state.creds.pin.trim() ? { pin: state.creds.pin.trim() } : {}),
        });
        state.result.value = attachKey({
          profileId: state.selectedProfileId.value,
          accountId: account.id || account._id,
          phone: account.displayName || account.username || 'Número vinculado',
        });
        state.step.value = 'done';
        toast('WhatsApp conectado por credenciales', 'success');
        emit('connected', state.result.value);
      } catch (err) {
        toast(err.message || 'No se pudieron validar las credenciales', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    return { connectWithAccount, connectWithPhone, connectCredentials };
  }

  /**
   * BC OAuth: OAuth genérico de plataformas (Instagram/TikTok) y verificación.
   */
  function makeLiveConnectOAuth({ api, toast, asArray, state, connectWithAccount }) {
    /** Inicia el flujo OAuth de la plataforma (Instagram/TikTok). */
    async function startOAuth() {
      const profileId = state.selectedProfileId.value;
      if (!profileId || state.busy.value) return;
      state.busy.value = true;
      try {
        const data = await api.getConnectUrl(state.platform, profileId);
        const url = data.url || data.authUrl;
        if (url) {
          state.oauthUrl.value = url;
          window.open(url, '_blank');
          toast('Autoriza en la ventana abierta y luego pulsa "Verificar conexión"', 'info', 6000);
        } else {
          toast('El API no devolvió URL de autorización', 'error');
        }
      } catch (err) {
        toast(err.message || 'No se pudo iniciar la autorización', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    /** Verifica si la cuenta ya apareció conectada en el perfil. */
    async function verifyOAuth() {
      const profileId = state.selectedProfileId.value;
      if (!profileId || state.busy.value) return;
      state.busy.value = true;
      try {
        const data = await api.getAccounts(profileId);
        state.accounts.value = asArray(data);
        if (state.platformAccounts.value.length === 1) {
          await connectWithAccount(state.platformAccounts.value[0]);
        } else if (state.platformAccounts.value.length > 1) {
          state.step.value = 'account';
        } else {
          toast('La cuenta aún no aparece: completa la autorización en la ventana de la plataforma', 'info', 6000);
        }
      } catch (err) {
        toast(err.message || 'No se pudo verificar la conexión', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    return { startOAuth, verifyOAuth };
  }

  /**
   * BC WhatsAppOAuth: Embedded Signup de Meta (multi-número), consumo del
   * callback del túnel y selección final del número de la WABA.
   */
  function makeLiveConnectWhatsAppOAuth({ store, api, toast, asArray, state, emit, ensureSubKey, attachKey }) {
    /**
     * Inicia el flujo guiado de Meta (Embedded Signup) para conectar el
     * número del cliente SIN datos técnicos. Si hay túnel activo, el sistema
     * devuelve el resultado al MVP (callback automático); si no, el cliente
     * vuelve y pulsa "Ya autoricé, verificar".
     */
    async function startWhatsAppOAuth() {
      const profileId = state.selectedProfileId.value;
      if (!profileId || state.busy.value) return;
      state.busy.value = true;
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
          state.oauthUrl.value = url;
          state.waOAuthStarted.value = true;
          window.open(url, '_blank');
          toast('Meta te guiará: autoriza con tu cuenta y verifica tu número con el código SMS', 'info', 8000);
        } else {
          toast('El API no devolvió URL de autorización', 'error');
        }
      } catch (err) {
        toast(err.message || 'No se pudo iniciar la autorización de Meta', 'error');
      } finally {
        state.busy.value = false;
      }
    }

    /** Procesa el callback del túnel (redirect_url) al volver de Meta. */
    async function consumeCallback() {
      if (!state.isWhatsApp.value) return;
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
      const cbProfileId = params.profileId || state.selectedProfileId.value;
      if (cbProfileId) state.selectedProfileId.value = cbProfileId; // el callback puede llegar tras un reload (túnel)
      if (params.step === 'select_phone_number' || params.tempToken) {
        state.waTempToken.value = params.tempToken || '';
        await ensureSubKey(cbProfileId); // sub-key activa antes de operar con el número
        await loadWaPhoneNumbers(cbProfileId);
        return;
      }
      // Conexión directa: accountId viene en el callback
      if (params.accountId) {
        await ensureSubKey(cbProfileId);
        state.result.value = attachKey({
          platform: 'whatsapp',
          profileId: cbProfileId,
          accountId: params.accountId,
          phone: params.username || params.displayName || 'Número vinculado',
          username: params.username || '',
        });
        state.step.value = 'done';
        toast('WhatsApp conectado desde Meta', 'success');
        emit('connected', state.result.value);
      }
    }

    /** Lista los números de la WABA multi-número para elegir. */
    async function loadWaPhoneNumbers(profileId) {
      const id = profileId || state.selectedProfileId.value;
      if (!id || !state.waTempToken.value || state.waSelectBusy.value) return;
      state.waSelectBusy.value = true;
      try {
        const data = await api.listConnectPhoneNumbers(id, state.waTempToken.value);
        state.waPhoneNumbers.value = asArray(data.phoneNumbers || data);
        if (state.waPhoneNumbers.value.length === 1) {
          await selectWaPhone(state.waPhoneNumbers.value[0]);
        } else if (state.waPhoneNumbers.value.length === 0) {
          toast('No se encontraron números en la cuenta de Meta. Revisa en Meta que el número esté registrado.', 'error', 6000);
        } else {
          state.step.value = 'wa-select';
          toast('Elige el número de WhatsApp de tu negocio', 'info');
        }
      } catch (err) {
        toast(err.message || 'No se pudo listar los números de la WABA', 'error');
      } finally {
        state.waSelectBusy.value = false;
      }
    }

    /** Vincula el número elegido de la WABA al perfil. */
    async function selectWaPhone(phone) {
      if (!phone || state.waSelectBusy.value) return;
      state.waSelectBusy.value = true;
      try {
        const account = await api.selectConnectPhoneNumber({
          profileId: state.selectedProfileId.value,
          tempToken: state.waTempToken.value,
          phoneNumberId: phone.id || phone.phoneNumberId || '',
        });
        state.result.value = attachKey({
          platform: 'whatsapp',
          profileId: state.selectedProfileId.value,
          accountId: account.id || account._id || account.accountId || '',
          phone: phone.display_phone_number || phone.displayPhoneNumber || account.username || 'Número vinculado',
          username: phone.display_phone_number || '',
        });
        state.step.value = 'done';
        toast(`Número ${state.result.value.phone} conectado`, 'success');
        emit('connected', state.result.value);
      } catch (err) {
        toast(err.message || 'No se pudo vincular el número', 'error');
      } finally {
        state.waSelectBusy.value = false;
      }
    }

    return { startWhatsAppOAuth, consumeCallback, loadWaPhoneNumbers, selectWaPhone };
  }

  /**
   * BC Lifecycle: montaje (boot + consume callback del túnel) y reset del flujo.
   */
  function makeLiveConnectLifecycle({ state, boot, consumeCallback }) {
    Vue.onMounted(() => {
      // boot primero (carga perfiles); el callback del túnel ajusta el paso después
      boot().then(consumeCallback);
    });

    /** Reinicia el flujo para probar con otro perfil. */
    function reset() {
      state.step.value = 'boot';
      state.result.value = null;
      state.profiles.value = [];
      state.accounts.value = [];
      state.phones.value = [];
      state.selectedProfileId.value = null;
      state.selectedAccountId.value = null;
      state.selectedPhoneId.value = null;
      boot();
    }

    return { reset };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeLiveConnectState, makeLiveConnectSubKeys, makeLiveConnectProfiles,
    makeLiveConnectSelection, makeLiveConnectOAuth, makeLiveConnectWhatsAppOAuth,
    makeLiveConnectLifecycle,
  });
})();