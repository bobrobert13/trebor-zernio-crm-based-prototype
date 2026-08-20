/**
 * @file settings-composables.js — Composables por bounded context de la
 * Configuración del workspace. Extraen la lógica del setup de settings-view
 * (shell, branding, conexión API, datos, canal, webhooks, etiquetas, campos
 * y sub-keys) a factories `Z.makeXxx`; sin template. 1:1 con el previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC Shell: estado de navegación por pestañas, derivados del workspace
   * (modalidad, referidor) y opciones avanzadas (siempre habilitadas).
   */
  function makeSettingsShell({ store, WHATSAPP_MODALITIES, REFERRERS }) {
    const workspace = Vue.computed(() => store.workspace);
    const modality = Vue.computed(() =>
      WHATSAPP_MODALITIES.find((m) => m.id === workspace.value.whatsapp.modality) || {}
    );
    const referrer = Vue.computed(() => REFERRERS.find((r) => r.id === workspace.value.referrer) || {});

    // ── Subsidebar: secciones de configuración ─────────────────────────────
    const settingsTab = Vue.ref('marca');
    const settingsTabs = [
      { id: 'marca', label: 'Marca', icon: 'settings' },
      { id: 'pipeline', label: 'Leads y etiquetas', icon: 'tag' },
      { id: 'campos', label: 'Campos del negocio', icon: 'edit' },
      { id: 'canal', label: 'Canal WhatsApp', icon: 'whatsapp' },
      { id: 'avanzado', label: 'Avanzado', icon: 'key' },
      { id: 'datos', label: 'Datos', icon: 'download' },
    ];

    const advancedOpen = Vue.ref(false);

    /**
     * Opciones avanzadas: siempre habilitadas (MVP de centro único). La
     * master del centro es una constante interna del cliente API (nunca se
     * pide al usuario); el espacio opera con su sub-key, que sí se puede
     * rotar/revocar desde esta sección.
     */
    const isAdvanced = Vue.computed(() => true);

    return { workspace, modality, referrer, settingsTab, settingsTabs, advancedOpen, isAdvanced };
  }

  /**
   * BC Branding: guardado de marca con refresh del acento y logo compartido.
   */
  function makeSettingsBranding({ workspace, applyAccent, toast, makeLogoUpload }) {
    /** Guarda branding y refresca el acento del tema. */
    function saveBranding() {
      if (!workspace.value.name.trim()) return;
      applyAccent(workspace.value);
      toast('Branding actualizado', 'success');
    }

    // Upload/eliminado del logo: lógica compartida en shared.js (makeLogoUpload).
    const { uploadLogo, removeLogo } = makeLogoUpload({
      toast,
      onLogo: (dataURL) => { workspace.value.logo = dataURL; },
      onRemove: () => { delete workspace.value.logo; },
      successMsg: 'Logo actualizado',
      removeMsg: 'Logo eliminado',
    });

    return { saveBranding, uploadLogo, removeLogo };
  }

  /**
   * BC ApiConnection: input de la sub-key directa, modo demo/live y prueba
   * de conexión contra el API de Zernio.
   */
  function makeSettingsApiConnection({ store, toast, testConnectionApi }) {
    const apiKeyInput = Vue.ref(store.apiKey);
    const testing = Vue.ref(false);
    const testResult = Vue.ref(null);

    /** Guarda la API key y cambia a modo live (si aplica). */
    function saveApiKey() {
      store.apiKey = apiKeyInput.value.trim();
      if (store.apiKey) {
        store.mode = 'live';
        store.corsBlocked = false;
        toast('API key guardada · modo live activado', 'success');
      } else {
        store.mode = 'demo';
        toast('Modo demo restablecido', 'info');
      }
    }

    /** Prueba la conexión contra el API de Zernio. */
    async function testConnection() {
      if (!apiKeyInput.value.trim()) return;
      testing.value = true;
      testResult.value = null;
      try {
        store.apiKey = apiKeyInput.value.trim();
        const profiles = await testConnectionApi();
        testResult.value = { ok: true, text: `API válida · ${Array.isArray(profiles) ? profiles.length : 0} perfiles disponibles` };
      } catch (err) {
        testResult.value = { ok: false, text: err.message || 'No se pudo conectar' };
      } finally {
        testing.value = false;
      }
    }

    return { apiKeyInput, testing, testResult, saveApiKey, testConnection };
  }

  /**
   * BC DataLifecycle: exportación, reset total, eliminación y confirmaciones.
   */
  function makeSettingsData({ store, workspace, canEdit, toast }) {
    const confirmReset = Vue.ref(false);
    const confirmDelete = Vue.ref(false);

    /** Exporta el workspace como JSON descargable. */
    function exportData() {
      ZernioCrm.downloadText(
        `${workspace.value.name.replace(/\s+/g, '-').toLowerCase()}-workspace.json`,
        JSON.stringify(workspace.value, null, 2),
        'application/json'
      );
      toast('Workspace exportado', 'success');
    }

    /** Reset total de los datos del prototipo (solo owner). */
    function resetDemo() {
      if (!canEdit('settings')) return;
      ZernioCrm.storage.resetAll();
      location.hash = '#/onboarding';
      location.reload();
    }

    /** Elimina el workspace activo y vuelve al onboarding (solo owner). */
    function deleteWorkspace() {
      if (!canEdit('settings')) return;
      ZernioCrm.storage.deleteWorkspace(store.workspace.id);
      ZernioCrm.storage.clearSession();
      location.hash = '#/onboarding';
      location.reload();
    }

    return { confirmReset, confirmDelete, exportData, resetDemo, deleteWorkspace };
  }

  /**
   * BC Channel: estado de salud y conexión del canal WhatsApp, desconexiones
   * demo/live y merge de reconexión (conserva subKey/health persistidos).
   */
  function makeSettingsChannel({ store, workspace, canEdit, toast, channelApi }) {
    const health = Vue.ref(null);
    const healthBusy = Vue.ref(false);
    const reconnectOpen = Vue.ref(false);

    /** Desconecta el canal WhatsApp (demo). Solo owner/admin con edición. */
    function disconnectWhatsApp() {
      if (!canEdit('settings')) return;
      workspace.value.whatsapp.connected = false;
      toast('Número WhatsApp desconectado', 'info');
    }

    /** Re-conecta el canal en modo demo. */
    function reconnectWhatsApp() {
      workspace.value.whatsapp.connected = true;
      toast('Número WhatsApp reconectado (demo)', 'success');
    }

    /** Health check de la cuenta WhatsApp vinculada a Zernio. */
    async function checkHealth() {
      const accountId = workspace.value.zernio && workspace.value.zernio.accountId;
      if (!accountId || healthBusy.value) return;
      healthBusy.value = true;
      health.value = null;
      try {
        health.value = await channelApi(accountId);
        toast('Health check OK', 'success');
      } catch (err) {
        health.value = { error: err.message || 'Cuenta en mal estado' };
        toast(err.message || 'Cuenta en mal estado', 'error');
      } finally {
        healthBusy.value = false;
      }
    }

    /** Desconecta la cuenta de Zernio (DELETE /accounts/{id}). */
    async function disconnectLive() {
      const accountId = workspace.value.zernio && workspace.value.zernio.accountId;
      try {
        if (accountId && store.mode === 'live') await ZernioCrm.api.deleteAccount(accountId);
        workspace.value.zernio = null;
        workspace.value.whatsapp.connected = false;
        toast('Cuenta desconectada de la plataforma', 'info');
      } catch (err) {
        toast(err.message || 'No se pudo desconectar', 'error');
      }
    }

    /** Recibe la reconexión de live-connect y actualiza el canal. */
    function onLiveConnected(result) {
      // Merge: conserva subKey/health persistidos en zernio (nunca borrar).
      // Si el perfil cambió, la sub-key anterior (scoped al perfil viejo) se
      // descarta: llega una nueva en result.subKey o se regenera al conectar.
      const z = workspace.value.zernio || {};
      const profileChanged = z.profileId && result.profileId && z.profileId !== result.profileId;
      const subKey = result.subKey
        || (!profileChanged && (!z.subKeyProfileId || z.subKeyProfileId === result.profileId) ? z.subKey : '');
      workspace.value.zernio = Object.assign({}, z, {
        profileId: result.profileId,
        accountId: result.accountId,
        phone: result.phone || '',
        health: null,
        subKey,
        subKeyProfileId: result.profileId || z.subKeyProfileId || '',
      });
      workspace.value.whatsapp = {
        connected: true,
        modality: 'live',
        phone: result.phone || '',
        status: 'connected',
        since: Date.now(),
        about: 'Conexión real',
        accountId: result.accountId,
      };
      store.mode = 'live';
      reconnectOpen.value = false;
      toast('Reconectado con la plataforma', 'success');
    }

    return {
      health, healthBusy, reconnectOpen,
      disconnectWhatsApp, reconnectWhatsApp, checkHealth, disconnectLive, onLiveConnected,
    };
  }

  /**
   * BC Webhooks: formulario, secret/HMAC, carga, CRUD, prueba, logs,
   * simulación, túnel y montaje (loadWebhooks).
   */
  function makeSettingsWebhooks({
    store, workspace, canEdit, toast,
    webhookApi, locationContext, fetchTunnel, pushWebhookEvent,
  }) {
    /** Eventos disponibles para suscripción de webhooks. */
    const EVENTS = ['message.received', 'post.published', 'post.failed', 'post.partial', 'account.connected', 'account.disconnected'];
    const whForm = Vue.reactive({ name: 'CRM MVP Webhook', url: '', secret: '', events: ['message.received'] });
    const whExists = Vue.ref(false);
    const whSaving = Vue.ref(false);
    const whLogs = Vue.ref([]);
    const whLogsOpen = Vue.ref(false);
    const tunnelUrl = Vue.ref(null);
    const tunnelBusy = Vue.ref(false);

    /** Genera un secret aleatorio para la firma HMAC. */
    function randomSecret() {
      const arr = new Uint8Array(18);
      crypto.getRandomValues(arr);
      return [...arr].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
    }

    /** URL local del receptor de webhooks (server.mjs) con el secret. */
    function buildWebhookUrl() {
      if (!whForm.secret) whForm.secret = randomSecret();
      return `${locationContext.origin}/webhooks/zernio?secret=${encodeURIComponent(whForm.secret)}`;
    }

    /** HMAC-SHA256 para firmar el body (verificación del server local). */
    async function hmacSha256(message, secret) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    /** Carga la configuración real de webhooks (live) o simula (demo). */
    async function loadWebhooks() {
      if (store.mode !== 'live') {
        whForm.url = buildWebhookUrl();
        return;
      }
      try {
        const config = await webhookApi.getWebhookSettings();
        if (config && (config.url || config.name)) {
          whForm.name = config.name || whForm.name;
          whForm.url = config.url || buildWebhookUrl();
          whForm.events = config.events || ['message.received'];
          whExists.value = true;
        }
      } catch {
        whExists.value = false;
        whForm.url = buildWebhookUrl();
      }
    }

    /** Guarda la configuración (POST o PUT según exista). */
    async function saveWebhooks() {
      if (!canEdit('settings') || whSaving.value) return;
      whSaving.value = true;
      const payload = {
        name: whForm.name.trim() || 'CRM MVP Webhook',
        isActive: true,
        url: whForm.url.trim() || buildWebhookUrl(),
        secret: whForm.secret || randomSecret(),
        events: whForm.events,
      };
      try {
        if (store.mode === 'live') {
          if (whExists.value) await webhookApi.updateWebhookSettings(payload);
          else await webhookApi.createWebhookSettings(payload);
          whExists.value = true;
        }
        toast('Webhook guardado · suscripción activa', 'success');
      } catch (err) {
        toast(err.message || 'No se pudo guardar el webhook', 'error');
      } finally {
        whSaving.value = false;
      }
    }

    /** Elimina la suscripción de webhooks. */
    async function deleteWebhooks() {
      if (!canEdit('settings')) return;
      try {
        if (store.mode === 'live') await webhookApi.deleteWebhookSettings();
        whExists.value = false;
        whForm.events = ['message.received'];
        toast('Suscripción de webhook eliminada', 'info');
      } catch (err) {
        toast(err.message || 'No se pudo eliminar el webhook', 'error');
      }
    }

    /** Envía un webhook de prueba. */
    async function testWebhook() {
      if (!canEdit('settings')) return;
      try {
        if (store.mode === 'live') await webhookApi.testWebhook();
        toast('Webhook de prueba enviado', 'success');
      } catch (err) {
        toast(err.message || 'Falló el webhook de prueba', 'error');
      }
    }

    /** Abre los logs de entrega (live) o el feed local (demo). */
    async function openLogs() {
      try {
        if (store.mode === 'live') {
          const data = await webhookApi.getWebhookLogs();
          whLogs.value = Array.isArray(data) ? data : (data && (data.logs || data.items)) || [];
        } else {
          whLogs.value = store.webhookEvents.slice(0, 20).map((e) => ({ event: e.event && e.event.event, createdAt: new Date(e.receivedAt).toISOString(), url: e.event && e.event.message ? 'local' : '—' }));
        }
        whLogsOpen.value = true;
      } catch (err) {
        toast(err.message || 'No se pudieron cargar los logs', 'error');
      }
    }

    /** Simula un evento message.received firmado hacia el server local. */
    async function simulateWebhook() {
      const firstConv = (workspace.value.conversations || [])[0];
      const payload = {
        event: 'message.received',
        timestamp: new Date().toISOString(),
        message: {
          id: `demo_${Date.now()}`,
          text: 'Hola, ¿tienen disponibilidad?',
          platform: 'whatsapp',
          conversationId: firstConv ? firstConv.id : null,
          sender: { identifier: '+58 412 000 0101', name: 'Cliente demo' },
        },
      };
      try {
        if (store.serverMode && crypto.subtle) {
          const secret = whForm.secret || randomSecret();
          const body = JSON.stringify(payload);
          const signature = await hmacSha256(body, secret);
          await fetch(buildWebhookUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-zernio-signature': signature },
            body,
          });
          toast('Evento firmado enviado al servidor local', 'success');
        } else {
          pushWebhookEvent(payload);
          toast('Evento simulado localmente', 'success');
        }
      } catch {
        pushWebhookEvent(payload);
        toast('Evento simulado localmente', 'info');
      }
    }

    function toggleWhEvent(event) {
      const i = whForm.events.indexOf(event);
      if (i >= 0) whForm.events.splice(i, 1);
      else whForm.events.push(event);
    }

    /**
     * Obtiene la URL pública del túnel (server.mjs /api/tunnel → cloudflared/ngrok)
     * y la aplica a la URL del receptor con el secret actual.
     */
    async function fetchTunnelUrl() {
      if (tunnelBusy.value) return;
      tunnelBusy.value = true;
      try {
        const res = await fetchTunnel();
        const data = await res.json();
        if (data && data.url) {
          tunnelUrl.value = data.url;
          if (!whForm.secret) whForm.secret = randomSecret();
          whForm.url = `${data.url}/webhooks/zernio?secret=${encodeURIComponent(whForm.secret)}`;
          toast('URL pública aplicada — guarda para suscribir webhooks', 'success');
        } else {
          toast('No hay túnel activo. Ejecuta: node tunnel.mjs', 'error', 6000);
        }
      } catch {
        toast('Servidor local no disponible (node server.mjs)', 'error');
      } finally {
        tunnelBusy.value = false;
      }
    }

    return {
      EVENTS, whForm, whExists, whSaving, whLogs, whLogsOpen, tunnelUrl, tunnelBusy,
      buildWebhookUrl, loadWebhooks, saveWebhooks, deleteWebhooks, testWebhook,
      openLogs, simulateWebhook, toggleWhEvent, fetchTunnelUrl,
    };
  }

  /**
   * BC Tags: etiquetas de leads (pipeline) y de contacto, con propagación
   * del renombrado a contactos y conversaciones.
   */
  function makeSettingsTags({ workspace, toast, swapInPlace }) {
    const leadTags = Vue.computed(() => workspace.value.leadTags || []);
    const contactTags = Vue.computed(() => workspace.value.contactTags || []);
    const leadInput = Vue.ref('');
    const contactInput = Vue.ref('');

    /** Editor genérico de etiquetas sobre workspace[listKey]. */
    function addTag(listKey, inputRef) {
      const tag = inputRef.value.trim().toLowerCase().replace(/\s+/g, '_');
      const list = workspace.value[listKey] || [];
      if (!tag || list.includes(tag)) return;
      workspace.value[listKey] = [...list, tag];
      inputRef.value = '';
      toast('Etiqueta agregada', 'success');
    }
    // Wrappers para el template: Vue auto-desenvuelve los refs en expresiones,
    // así que el template NO puede pasar la ref (llega el string ya desenvuelto)
    const addLeadTag = () => addTag('leadTags', leadInput);
    const addContactTag = () => addTag('contactTags', contactInput);

    function removeTag(listKey, index) {
      workspace.value[listKey] = (workspace.value[listKey] || []).filter((_, i) => i !== index);
      toast('Etiqueta eliminada', 'info');
    }

    function moveTag(listKey, index, dir) {
      const list = [...(workspace.value[listKey] || [])];
      if (!swapInPlace(list, index, dir)) return;
      workspace.value[listKey] = list;
    }

    /** Renombra una etiqueta; en contactTags propaga a los contactos asociados. */
    function renameTag(listKey, index, value) {
      const list = workspace.value[listKey] || [];
      const old = list[index];
      const tag = value.trim().toLowerCase().replace(/\s+/g, '_');
      if (!tag || tag === old) {
        workspace.value[listKey] = [...list]; // fuerza re-render
        return;
      }
      const next = [...list];
      next[index] = tag;
      workspace.value[listKey] = next;
      if (listKey === 'leadTags') {
        // Propaga el renombrado a los contactos (etapa del pipeline) y conversaciones
        (workspace.value.contacts || []).forEach((c) => {
          if (c.leadTag === old) c.leadTag = tag;
        });
        (workspace.value.conversations || []).forEach((c) => {
          if (c.tags && c.tags.includes(old)) c.tags = c.tags.map((t) => (t === old ? tag : t));
        });
      } else {
        (workspace.value.contacts || []).forEach((c) => {
          if (c.tags && c.tags.includes(old)) c.tags = c.tags.map((t) => (t === old ? tag : t));
          if (c.leadTag === old) c.leadTag = tag;
        });
      }
      toast('Etiqueta renombrada', 'success');
    }

    return { leadTags, contactTags, leadInput, contactInput, addTag, addLeadTag, addContactTag, removeTag, moveTag, renameTag };
  }

  /**
   * BC CustomFields: campos del negocio (agg/remove/move/rename/type/options)
   * con slug único derivado del nombre.
   */
  function makeSettingsCustomFields({ workspace, toast, swapInPlace }) {
    const customFields = Vue.computed(() => workspace.value.customFields || []);
    const fieldInput = Vue.reactive({ name: '', type: 'text', options: '' });
    const fieldTypeOptions = ['text', 'number', 'date', 'select'];

    /** Genera un slug único a partir del nombre. */
    function slugify(name) {
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo';
      let slug = base;
      let n = 2;
      while (customFields.value.some((f) => f.slug === slug)) slug = `${base}_${n++}`;
      return slug;
    }

    function addField() {
      const name = fieldInput.name.trim();
      if (!name) return;
      const field = {
        slug: slugify(name),
        name,
        type: fieldInput.type,
        ...(fieldInput.type === 'select'
          ? { options: fieldInput.options.split(',').map((o) => o.trim()).filter(Boolean) }
          : {}),
      };
      workspace.value.customFields = [...customFields.value, field];
      Object.assign(fieldInput, { name: '', type: 'text', options: '' });
      toast('Campo del negocio agregado', 'success');
    }

    function removeField(index) {
      workspace.value.customFields = customFields.value.filter((_, i) => i !== index);
      toast('Campo eliminado', 'info');
    }

    function moveField(index, dir) {
      const list = [...customFields.value];
      if (!swapInPlace(list, index, dir)) return;
      workspace.value.customFields = list;
    }

    /** Renombra el campo sin tocar el slug (los datos de contactos se conservan). */
    function renameField(index, value) {
      const list = [...customFields.value];
      const name = value.trim();
      if (!name || name === list[index].name) {
        workspace.value.customFields = list; // fuerza re-render
        return;
      }
      list[index] = { ...list[index], name };
      workspace.value.customFields = list;
      toast('Campo renombrado', 'success');
    }

    function updateFieldType(index, type) {
      const list = [...customFields.value];
      const field = { ...list[index], type };
      if (type !== 'select') delete field.options;
      list[index] = field;
      workspace.value.customFields = list;
    }

    function updateFieldOptions(index, optionsText) {
      const list = [...customFields.value];
      list[index] = {
        ...list[index],
        options: optionsText.split(',').map((o) => o.trim()).filter(Boolean),
      };
      workspace.value.customFields = list;
    }

    return {
      customFields, fieldInput, fieldTypeOptions,
      addField, removeField, moveField, renameField, updateFieldType, updateFieldOptions,
    };
  }

  /**
   * BC SubKeys: sub-key del negocio (persistida en workspace.zernio) con
   * máscara, rotación atómica y revocación de acceso.
   */
  function makeSettingsSubKeys({ store, workspace, api, asArray, toast }) {
    /** Sub-key activa del negocio (persistida en workspace.zernio). */
    const subKey = Vue.computed(() => (workspace.value.zernio && workspace.value.zernio.subKey) || '');
    const subKeyBusy = Vue.ref(false);

    /** Máscara de una clave para mostrar (sk_1234…abcd). */
    function maskKey(key) {
      if (!key) return '';
      return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '••••••••';
    }

    /** Resuelve el id de una sub-key por el sufijo de su preview (para revocarla). */
    async function findKeyId(subKeyValue) {
      try {
        const data = await api.listApiKeys();
        const keys = asArray(data) || [];
        const suffix = String(subKeyValue).slice(-6);
        const found = keys.find((k) => {
          const preview = k.keyPreview || k.preview || '';
          return preview.endsWith(suffix) || String(k.id || '').endsWith(suffix);
        });
        return found ? found.id || found._id : null;
      } catch {
        return null;
      }
    }

    /**
     * Rota la sub-key de forma atómica: crea la nueva, revoca la anterior y
     * solo entonces conmuta el estado. Si la revocación falla, revoca la
     * nueva y no toca la activa.
     */
    async function rotateSubKey() {
      const z = workspace.value.zernio;
      if (!z || !z.subKey || !z.profileId || subKeyBusy.value) return;
      subKeyBusy.value = true;
      try {
        const data = await api.createApiKey({
          name: `negocio-${workspace.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
          profileIds: [z.profileId],
        });
        const newKey = (data.apiKey && data.apiKey.key) || data.key;
        if (!newKey) throw new Error('El API no devolvió la sub-key');
        const newKeyId = (data.apiKey && (data.apiKey.id || data.apiKey._id)) || '';
        const oldKeyId = await findKeyId(z.subKey);
        if (!oldKeyId) {
          // No se pudo identificar la anterior: abortar y revocar la recién creada
          if (newKeyId) await api.revokeApiKey(newKeyId).catch(() => {});
          throw new Error('No se pudo localizar la sub-key anterior para revocarla. La rotación se canceló.');
        }
        await api.revokeApiKey(oldKeyId); // falla aquí → no conmuta y la nueva queda pendiente de limpiar
        z.subKey = newKey;
        store.apiKey = newKey;
        toast('Sub-key rotada: la anterior quedó revocada', 'success');
      } catch (err) {
        toast(err.message || 'No se pudo rotar la sub-key', 'error', 6000);
      } finally {
        subKeyBusy.value = false;
      }
    }

    /** Revoca el acceso del negocio: sub-key revocada y conexión limpiada. */
    async function revokeSubKey() {
      const z = workspace.value.zernio;
      if (!z || !z.subKey || subKeyBusy.value) return;
      subKeyBusy.value = true;
      try {
        const keyId = await findKeyId(z.subKey);
        if (!keyId) throw new Error('No se pudo localizar la sub-key para revocar');
        await api.revokeApiKey(keyId);
        z.subKey = '';
        z.accountId = '';
        z.phone = '';
        z.health = 'revoked';
        workspace.value.whatsapp.connected = false;
        store.apiKey = ''; // sin key operativa: el negocio queda en demo hasta reconectar
        store.mode = 'demo';
        toast('Acceso revocado: el negocio quedó desconectado (401 en la próxima llamada)', 'info', 6000);
      } catch (err) {
        toast(err.message || 'No se pudo revocar el acceso', 'error');
      } finally {
        subKeyBusy.value = false;
      }
    }

    return { subKey, subKeyBusy, maskKey, rotateSubKey, revokeSubKey };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeSettingsShell, makeSettingsBranding, makeSettingsApiConnection, makeSettingsData,
    makeSettingsChannel, makeSettingsWebhooks, makeSettingsTags, makeSettingsCustomFields,
    makeSettingsSubKeys,
  });
})();