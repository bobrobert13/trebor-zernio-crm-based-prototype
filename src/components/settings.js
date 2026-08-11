/**
 * @file settings.js — Configuración del workspace: branding, integración
 * Zernio (modo demo/live + API key + test de conexión), estado del canal
 * WhatsApp, exportación de datos y zona de peligro (reset/eliminar).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, ACCENTS, REFERRERS, WHATSAPP_MODALITIES, canEdit, api, asArray } = ZernioCrm;

  const components = {};

  components['settings-view'] = {
    setup() {
      const apiKeyInput = Vue.ref(store.apiKey);
      const testing = Vue.ref(false);
      const testResult = Vue.ref(null);
      const confirmReset = Vue.ref(false);
      const confirmDelete = Vue.ref(false);

      /** Eventos disponibles para suscripción de webhooks. */
      const EVENTS = ['message.received', 'post.published', 'post.failed', 'post.partial', 'account.connected', 'account.disconnected'];
      const whForm = Vue.reactive({ name: 'CRM MVP Webhook', url: '', secret: '', events: ['message.received'] });
      const whExists = Vue.ref(false);
      const whSaving = Vue.ref(false);
      const whLogs = Vue.ref([]);
      const whLogsOpen = Vue.ref(false);
      const tunnelUrl = Vue.ref(null);
      const tunnelBusy = Vue.ref(false);
      const health = Vue.ref(null);
      const healthBusy = Vue.ref(false);
      const reconnectOpen = Vue.ref(false);

      const workspace = Vue.computed(() => store.workspace);
      const modality = Vue.computed(() =>
        WHATSAPP_MODALITIES.find((m) => m.id === workspace.value.whatsapp.modality) || {}
      );
      const referrer = Vue.computed(() => REFERRERS.find((r) => r.id === workspace.value.referrer) || {});

      // ── Opciones avanzadas (superadministrador) ────────────────────────────
      const advancedOpen = Vue.ref(false);
      const adminKeyInput = Vue.ref('');
      const adminKeyBusy = Vue.ref(false);

      /** ¿Hay clave de administración en sesión? (el centro la deja al configurar). */
      const isAdvanced = Vue.computed(() => {
        try {
          return Boolean(sessionStorage.getItem('tzcrm.masterKey')) || Boolean(store.masterKey);
        } catch {
          return false;
        }
      });

      /** Valida la clave de administración (probe admin) y la guarda en sesión. */
      async function validateAdminKey() {
        const key = adminKeyInput.value.trim();
        if (!key || adminKeyBusy.value) return;
        adminKeyBusy.value = true;
        // Nunca tocar store.apiKey (key operativa del negocio): solo masterKey
        const prev = store.masterKey;
        store.masterKey = key;
        try {
          await api.listApiKeys(); // solo la master puede listar/crear sub-keys
          sessionStorage.setItem('tzcrm.masterKey', key);
          adminKeyInput.value = '';
          toast('Clave de administración válida: opciones avanzadas habilitadas', 'success');
        } catch (err) {
          store.masterKey = prev; // revertir: la key operativa nunca se contamina
          toast(err.message || 'La clave no es válida para administración', 'error');
        } finally {
          adminKeyBusy.value = false;
        }
      }

      /** Guarda branding y refresca el acento del tema. */
      function saveBranding() {
        if (!workspace.value.name.trim()) return;
        applyAccent(workspace.value);
        toast('Branding actualizado', 'success');
      }

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
          const profiles = await ZernioCrm.api.testConnection();
          testResult.value = { ok: true, text: `API válida · ${Array.isArray(profiles) ? profiles.length : 0} perfiles disponibles` };
        } catch (err) {
          testResult.value = { ok: false, text: err.message || 'No se pudo conectar' };
        } finally {
          testing.value = false;
        }
      }

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

      /** Exporta el workspace como JSON descargable. */
      function exportData() {
        const blob = new Blob([JSON.stringify(workspace.value, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspace.value.name.replace(/\s+/g, '-').toLowerCase()}-workspace.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
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

      // ── Webhooks ───────────────────────────────────────────────────────────

      /** Genera un secret aleatorio para la firma HMAC. */
      function randomSecret() {
        const arr = new Uint8Array(18);
        crypto.getRandomValues(arr);
        return [...arr].map((b) => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
      }

      /** URL local del receptor de webhooks (server.mjs) con el secret. */
      function buildWebhookUrl() {
        if (!whForm.secret) whForm.secret = randomSecret();
        return `${location.origin}/webhooks/zernio?secret=${encodeURIComponent(whForm.secret)}`;
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
          const config = await ZernioCrm.api.getWebhookSettings();
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
            if (whExists.value) await ZernioCrm.api.updateWebhookSettings(payload);
            else await ZernioCrm.api.createWebhookSettings(payload);
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
          if (store.mode === 'live') await ZernioCrm.api.deleteWebhookSettings();
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
          if (store.mode === 'live') await ZernioCrm.api.testWebhook();
          toast('Webhook de prueba enviado', 'success');
        } catch (err) {
          toast(err.message || 'Falló el webhook de prueba', 'error');
        }
      }

      /** Abre los logs de entrega (live) o el feed local (demo). */
      async function openLogs() {
        try {
          if (store.mode === 'live') {
            const data = await ZernioCrm.api.getWebhookLogs();
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
            ZernioCrm.pushWebhookEvent(payload);
            toast('Evento simulado localmente', 'success');
          }
        } catch {
          ZernioCrm.pushWebhookEvent(payload);
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
          const res = await fetch('/api/tunnel', { cache: 'no-store' });
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

      /** Health check de la cuenta WhatsApp vinculada a Zernio. */
      async function checkHealth() {
        const accountId = workspace.value.zernio && workspace.value.zernio.accountId;
        if (!accountId || healthBusy.value) return;
        healthBusy.value = true;
        health.value = null;
        try {
          health.value = await ZernioCrm.api.getAccountHealth(accountId);
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
        // Merge: conserva subKey/health persistidos en zernio (nunca borrar)
        workspace.value.zernio = Object.assign(workspace.value.zernio || {}, {
          profileId: result.profileId,
          accountId: result.accountId,
          phone: result.phone || '',
          health: null,
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

      // ── Gestión de etiquetas (leads y contacto) ────────────────────────────
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
        const next = index + dir;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
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

      Vue.onMounted(loadWebhooks);

      // ── Campos del negocio (personalizables) ───────────────────────────────
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
        const next = index + dir;
        if (next < 0 || next >= list.length) return;
        [list[index], list[next]] = [list[next], list[index]];
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

      // ── Credenciales del centro (sub-key por negocio) ──────────────────────

      /** Máscara de una clave para mostrar (sk_1234…abcd). */
      function maskKey(key) {
        if (!key) return '';
        return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '••••••••';
      }

      /** Sub-key activa del negocio (persistida en workspace.zernio). */
      const subKey = Vue.computed(() => (workspace.value.zernio && workspace.value.zernio.subKey) || '');
      const subKeyBusy = Vue.ref(false);

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

      return {
        apiKeyInput, testing, testResult, confirmReset, confirmDelete,
        workspace, modality, referrer, ACCENTS, store,
        EVENTS, whForm, whExists, whSaving, whLogs, whLogsOpen,
        health, healthBusy, reconnectOpen, tunnelUrl, tunnelBusy,
        subKey, subKeyBusy, maskKey, rotateSubKey, revokeSubKey,
        advancedOpen, isAdvanced, adminKeyInput, adminKeyBusy, validateAdminKey,
        leadTags, contactTags, leadInput, contactInput,
        addTag, addLeadTag, addContactTag, removeTag, moveTag, renameTag,
        customFields, fieldInput, fieldTypeOptions,
        addField, removeField, moveField, renameField, updateFieldType, updateFieldOptions,
        canEdit, saveBranding, saveApiKey, testConnection,
        disconnectWhatsApp, reconnectWhatsApp, exportData, resetDemo, deleteWorkspace,
        saveWebhooks, deleteWebhooks, testWebhook, openLogs, simulateWebhook, toggleWhEvent,
        buildWebhookUrl, fetchTunnelUrl, checkHealth, disconnectLive, onLiveConnected,
      };
    },

    template: `
      <div class="grid items-start gap-6 xl:grid-cols-2">
        <header class="xl:col-span-2">
          <h2 class="text-2xl font-bold">Configuración</h2>
          <p class="mt-1 text-sm text-neutral-500">Branding, canales y datos del espacio de trabajo. Las opciones avanzadas las gestiona tu proveedor.</p>
        </header>

        <!-- Branding -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Branding</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="Nombre del negocio">
              <input v-model.trim="workspace.name" type="text"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Slogan">
              <input v-model.trim="workspace.slogan" type="text" placeholder="Sin slogan"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
          </div>
          <div class="mt-4">
            <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Color de marca</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="a in ACCENTS" :key="a.id" @click="workspace.accentId = a.id"
                class="flex items-center gap-2 border-2 px-2.5 py-1.5 transition"
                :class="workspace.accentId === a.id ? 'border-neutral-900 shadow-brutal-sm' : 'border-neutral-200'">
                <span class="h-4 w-4 border border-black/10" :style="{ background: a.value }"></span>
                <span class="text-xs">{{ a.nombre }}</span>
              </button>
            </div>
          </div>
          <p class="mt-4 text-xs text-neutral-400">Nos recomendó: <span class="font-medium text-neutral-700">{{ referrer.nombre || '—' }}</span>
            <span v-if="workspace.referrerDetail"> ({{ workspace.referrerDetail }})</span>
          </p>
          <button @click="saveBranding" class="mt-4 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Guardar branding
          </button>
        </section>

        <!-- Gestión de leads (etiquetas de la bandeja y pipeline del kanban) -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Gestión de leads</h3>
          <p class="text-sm text-neutral-600">
            Define las etapas de tu pipeline de clientes: se usan como pestañas en la bandeja y como columnas del tablero de Leads.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(tag, i) in leadTags" :key="tag + i" class="flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <input :value="tag" @change="renameTag('leadTags', i, $event.target.value)"
                class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 font-mono text-xs outline-none focus:border-neutral-900 focus:bg-white" />
              <div class="flex shrink-0 items-center gap-1">
                <button @click="moveTag('leadTags', i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Subir">
                  <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="moveTag('leadTags', i, 1)" :disabled="i === leadTags.length - 1" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar">
                  <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="removeTag('leadTags', i)" class="p-1 text-red-600 transition hover:text-red-800" aria-label="Eliminar etiqueta">
                  <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                </button>
              </div>
            </div>
            <div v-if="leadTags.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin etapas: agrega la primera abajo.
            </div>
          </div>
          <div class="mt-3 flex max-w-md items-end gap-2">
            <input v-model.trim="leadInput" type="text" placeholder="Nueva etapa (ej: cotizacion)" @keydown.enter="addLeadTag"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            <button @click="addLeadTag" :disabled="!leadInput.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar
            </button>
          </div>
        </section>

        <!-- Etiquetas de contacto (clasificación general, separadas de las leads) -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Etiquetas de contacto</h3>
          <p class="text-sm text-neutral-600">
            Clasificación general de tus clientes (vip, frecuente, pedido…). Es independiente del pipeline de leads.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(tag, i) in contactTags" :key="tag + i" class="flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <input :value="tag" @change="renameTag('contactTags', i, $event.target.value)"
                class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 font-mono text-xs outline-none focus:border-neutral-900 focus:bg-white" />
              <div class="flex shrink-0 items-center gap-1">
                <button @click="moveTag('contactTags', i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Subir">
                  <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="moveTag('contactTags', i, 1)" :disabled="i === contactTags.length - 1" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar">
                  <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="removeTag('contactTags', i)" class="p-1 text-red-600 transition hover:text-red-800" aria-label="Eliminar etiqueta">
                  <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                </button>
              </div>
            </div>
            <div v-if="contactTags.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin etiquetas: agrega la primera abajo.
            </div>
          </div>
          <div class="mt-3 flex max-w-md items-end gap-2">
            <input v-model.trim="contactInput" type="text" placeholder="Nueva etiqueta (ej: vip)" @keydown.enter="addContactTag"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            <button @click="addContactTag" :disabled="!contactInput.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar
            </button>
          </div>
        </section>

        <!-- Campos del negocio (personalizables) -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Campos del negocio</h3>
          <p class="text-sm text-neutral-600">
            Información que registras de cada cliente (además del nombre y teléfono).
            Cada negocio inicia con los campos de su modelo y puede adaptarlos.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(f, i) in customFields" :key="f.slug" class="border border-neutral-200 bg-stone-50 px-3 py-2">
              <div class="flex items-center gap-2">
                <input :value="f.name" @change="renameField(i, $event.target.value)"
                  class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 text-sm font-medium outline-none focus:border-neutral-900 focus:bg-white" />
                <select :value="f.type" @change="updateFieldType(i, $event.target.value)"
                  class="border border-neutral-300 bg-white px-1.5 py-1 font-mono text-[10px] uppercase outline-none focus:border-neutral-900">
                  <option v-for="t in fieldTypeOptions" :key="t" :value="t">{{ t }}</option>
                </select>
                <div class="flex shrink-0 items-center gap-1">
                  <button @click="moveField(i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Subir campo">
                    <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="moveField(i, 1)" :disabled="i === customFields.length - 1" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar campo">
                    <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="removeField(i)" class="p-1 text-red-600 hover:text-red-800" aria-label="Eliminar campo">
                    <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                  </button>
                </div>
              </div>
              <input v-if="f.type === 'select'" :value="(f.options || []).join(', ')" @change="updateFieldOptions(i, $event.target.value)"
                placeholder="Opciones separadas por coma (ej: Local, Para llevar, Delivery)"
                class="mt-1.5 w-full border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-900" />
            </div>
            <div v-if="customFields.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin campos: agrega el primero abajo.
            </div>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <input v-model.trim="fieldInput.name" type="text" placeholder="Nuevo campo (ej: Talla)" @keydown.enter="addField"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900" />
            <select v-model="fieldInput.type" class="border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900">
              <option v-for="t in fieldTypeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <button @click="addField" :disabled="!fieldInput.name.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar campo
            </button>
          </div>
          <input v-if="fieldInput.type === 'select'" v-model.trim="fieldInput.options" type="text" placeholder="Opciones separadas por coma (ej: Local, Para llevar, Delivery)"
            class="mt-2 w-full border-2 border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900" />
          <p class="mt-3 text-xs text-neutral-400">
            Renombrar no pierde los datos ya registrados. Los campos aparecen en la ficha del cliente y en Contactos.
          </p>
        </section>

        <!-- Opciones avanzadas (superadministrador) -->
        <section class="border-2 border-neutral-900 bg-white xl:col-span-2">
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
            <!-- Sin clave de administración: aviso + campo discreto -->
            <template v-if="!isAdvanced">
              <p class="text-sm text-neutral-600">
                Estas opciones las gestiona tu proveedor. Ingresa la clave de administración si la tienes.
              </p>
              <div class="mt-3 flex max-w-xl items-end gap-2">
                <input v-model.trim="adminKeyInput" type="password" placeholder="sk_…" autocomplete="off"
                  class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
                <button @click="validateAdminKey" :disabled="adminKeyBusy || !adminKeyInput.trim()"
                  class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  <ui-spinner v-if="adminKeyBusy" size="h-4 w-4"></ui-spinner>
                  Validar
                </button>
              </div>
            </template>
            <!-- Con clave: las secciones técnicas quedan dentro del grid original -->
            <template v-else>
              <p class="mb-4 text-xs text-neutral-500">Modo administración: puedes gestionar la integración técnica del negocio.</p>
            </template>
          </div>
        </section>

        <!-- Integración de canales -->
        <section v-if="advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Integración de canales</h3>
          <div v-if="store.corsBlocked" class="mb-4 flex items-start gap-3 border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-900">
            <ui-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0"></ui-icon>
            <p>El navegador no puede alcanzar el API de la plataforma (CORS). El prototipo opera en modo demo; para producción usa el servidor local (node server.mjs).</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="API key" hint="Se guarda en localStorage — solo para prototipo.">
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

        <!-- Canal WhatsApp -->
        <section class="border-2 border-neutral-900 bg-white p-5">
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
                  {{ new Date(workspace.whatsapp.since).toLocaleDateString('es-VE') }}
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

        <!-- Credenciales del centro (multi-negocio) -->
        <section v-if="advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5">
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

        <!-- Modal: reconexión con Zernio -->
        <ui-modal :open="reconnectOpen" title="Conectar con Zernio" @close="reconnectOpen = false">
          <live-connect @connected="onLiveConnected"></live-connect>
        </ui-modal>

        <!-- Webhooks -->
        <section v-if="advancedOpen && isAdvanced" class="border-2 border-neutral-900 bg-white p-5 xl:col-span-2">
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
                    <span class="font-mono text-[10px] text-neutral-400">{{ new Date(entry.receivedAt).toLocaleTimeString('es-VE') }}</span>
                  </div>
                  <p v-if="entry.event.message" class="mt-0.5 truncate text-xs text-neutral-500">
                    {{ entry.event.message.text || JSON.stringify(entry.event.message).slice(0, 80) }}
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <!-- Datos -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Datos</h3>
          <div class="flex flex-wrap gap-2">
            <button @click="exportData"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar workspace (JSON)
            </button>
            <button v-if="canEdit('settings')" @click="confirmReset = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Reset de datos demo
            </button>
            <button v-if="canEdit('settings')" @click="confirmDelete = true"
              class="flex items-center gap-2 border-2 border-red-800 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="trash" class="h-4 w-4"></ui-icon> Eliminar workspace
            </button>
          </div>
        </section>

        <!-- Confirmaciones -->
        <ui-modal :open="confirmReset" title="Reset de datos demo" width="max-w-md" @close="confirmReset = false">
          <p class="text-sm text-neutral-600">Se borrarán todos los workspaces y la sesión local. Volverás al onboarding.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmReset = false" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="resetDemo" class="border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Resetear</button>
          </div>
        </ui-modal>

        <ui-modal :open="confirmDelete" title="Eliminar workspace" width="max-w-md" @close="confirmDelete = false">
          <p class="text-sm text-neutral-600">Se eliminará <span class="font-semibold">{{ workspace.name }}</span> y todos sus datos. Esta acción no se puede deshacer.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmDelete = false" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="deleteWorkspace" class="border-2 border-neutral-900 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
