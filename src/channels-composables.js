/**
 * @file channels-composables.js — Composables por bounded context del módulo
 * Canales. Extraen la lógica del setup de channels-view (registro de canales
 * con compatibilidad zernio→channels, conexión/reemplazo vía live-connect y
 * health/desconexión) a factories `Z.makeXxx`; sin template.
 * 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC Registry: garantiza workspace.channels y deriva WhatsApp desde zernio
   * (compatibilidad), expone el catálogo y la correspondencia por plataforma.
   */
  function makeChannelRegistry({ workspace }) {
    /** Garantiza workspace.channels y deriva WhatsApp desde zernio (compatibilidad). */
    function ensureChannels() {
      const ws = workspace.value;
      if (!ws) return;
      if (!ws.channels) ws.channels = [];
      if (ws.zernio && !ws.channels.find((c) => c.platform === 'whatsapp')) {
        ws.channels.unshift({
          platform: 'whatsapp',
          accountId: ws.zernio.accountId || '',
          username: ws.zernio.phone || '',
          connected: true,
          since: ws.zernio.since || Date.now(),
          health: ws.zernio.health || null, // hereda alerta de reconexión
        });
      }
    }
    ensureChannels();

    const channels = Vue.computed(() => workspace.value.channels || []);

    /** ¿No hay canal de mensajería conectado? (WhatsApp es el canal primario). */
    const noChannel = Vue.computed(() => {
      const ws = workspace.value;
      if (!ws) return false;
      const wa = ws.whatsapp && ws.whatsapp.connected;
      const waChannel = channels.value.some((c) => c.platform === 'whatsapp' && c.connected);
      return !wa && !waChannel;
    });

    /** @param {string} platform — id de plataforma. @returns {object|null} */
    function channelOf(platform) {
      return channels.value.find((c) => c.platform === platform) || null;
    }

    return { channels, noChannel, channelOf };
  }

  /**
   * BC Connection: apertura de conexión/reemplazo y aplicación del resultado
   * de live-connect (sincroniza channels, zernio, whatsapp y store.mode);
   * respeta el límite de 1 número por negocio.
   */
  function makeChannelConnection({ workspace, isLive, channelOf, api, toast, store, getPlatform }) {
    const connectPlatform = Vue.ref(null);
    const whatsappReplace = Vue.ref(false); // confirmación de reemplazo (1 número por negocio)

    /** Recibe la conexión de live-connect y actualiza el canal. */
    async function onConnected(result) {
      const ws = workspace.value;
      const platform = result.platform || 'whatsapp';
      // Límite: 1 número por negocio — desconecta el anterior antes de reemplazar
      if (platform === 'whatsapp' && isLive.value) {
        const prev = ws.zernio && ws.zernio.accountId;
        if (prev && prev !== result.accountId) {
          try {
            await api.deleteAccount(prev);
            toast('Número anterior desconectado (límite 1 por negocio)', 'info');
          } catch (err) {
            // No conmutar: el perfil quedaría con 2 números facturables
            toast('No se pudo desconectar el número anterior: ' + (err.message || '') + '. La conexión nueva se canceló.', 'error', 6000);
            return;
          }
        }
      }
      const entry = {
        platform,
        accountId: result.accountId || '',
        username: result.username || result.phone || '',
        connected: true,
        since: Date.now(),
        health: null,
      };
      const existing = ws.channels.find((c) => c.platform === platform);
      if (existing) Object.assign(existing, entry);
      else ws.channels.push(entry);

      // WhatsApp primario: mantiene workspace.zernio sincronizado SIN borrar subKey/health
      if (platform === 'whatsapp') {
        const z = ws.zernio || {};
        const profileChanged = z.profileId && result.profileId && z.profileId !== result.profileId;
        // Sub-key activa: llega con el resultado, o se conserva si pertenece
        // al mismo perfil; si el perfil cambió se descarta (scoped al anterior)
        const subKey = result.subKey
          || (!profileChanged && (!z.subKeyProfileId || z.subKeyProfileId === result.profileId) ? z.subKey : '');
        ws.zernio = Object.assign({}, z, {
          profileId: result.profileId,
          accountId: result.accountId,
          phone: result.phone || entry.username,
          health: null,
          subKey,
          subKeyProfileId: result.profileId || z.subKeyProfileId || '',
        });
        ws.whatsapp = {
          connected: true,
          modality: 'live',
          phone: result.phone || entry.username,
          status: 'connected',
          since: Date.now(),
          about: 'Conexión real con la plataforma',
          accountId: result.accountId,
        };
        store.mode = 'live';
      }
      connectPlatform.value = null;
      const nombre = (getPlatform(platform) || {}).nombre || platform;
      toast(`${nombre} conectado`, 'success');
    }

    /** Abre la conexión de WhatsApp respetando el límite de 1 número. */
    function openConnect(p) {
      if (p.id === 'whatsapp' && channelOf(p.id) && channelOf(p.id).connected) {
        whatsappReplace.value = true; // pedir confirmación antes de reemplazar
        return;
      }
      connectPlatform.value = p.id;
    }

    return { connectPlatform, whatsappReplace, onConnected, openConnect };
  }

  /**
   * BC Health: health check por canal (con guard de reentrada por plataforma)
   * y desconexión (no-whatsapp; WhatsApp se gestiona en Settings).
   */
  function makeChannelHealth({ workspace, isLive, api, toast, channels, getPlatform }) {
    const healthMap = Vue.reactive({});
    const busyMap = Vue.reactive({});

    /** Health check de un canal conectado. */
    async function checkHealth(channel) {
      const accountId = channel.accountId;
      if (!accountId || busyMap[channel.platform]) return;
      busyMap[channel.platform] = true;
      healthMap[channel.platform] = null;
      try {
        healthMap[channel.platform] = await api.getAccountHealth(accountId);
        toast('Health check OK', 'success');
      } catch (err) {
        healthMap[channel.platform] = { error: err.message || 'Cuenta en mal estado' };
        toast(err.message || 'Cuenta en mal estado', 'error');
      } finally {
        busyMap[channel.platform] = false;
      }
    }

    /** Desconecta un canal (no-whatsapp; WhatsApp se gestiona en Settings). */
    async function disconnect(channel) {
      if (channel.platform === 'whatsapp') {
        toast('WhatsApp se gestiona en Configuración → Canal WhatsApp', 'info');
        return;
      }
      try {
        if (isLive.value && channel.accountId) await api.deleteAccount(channel.accountId);
        workspace.value.channels = workspace.value.channels.filter((c) => c.platform !== channel.platform);
        toast(`${(getPlatform(channel.platform) || {}).nombre || channel.platform} desconectado`, 'info');
      } catch (err) {
        toast(err.message || 'No se pudo desconectar', 'error');
      }
    }

    return { healthMap, busyMap, checkHealth, disconnect };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeChannelRegistry, makeChannelConnection, makeChannelHealth,
  });
})();