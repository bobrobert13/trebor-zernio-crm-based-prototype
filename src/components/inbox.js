/**
 * @file inbox.js — Bandeja unificada de conversaciones WhatsApp a pantalla
 * completa: lista filtrable (380px) + panel de chat que llena el área.
 * Demo: envía con delivery/lectura y respuestas entrantes simuladas.
 * Live: sincroniza conversaciones reales desde /inbox/conversations (proxy).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, getNiche, timeAgo, formatTime, uid, canEdit, PLATFORMS, getPlatform } = ZernioCrm;

  const components = {};

  /** Respuestas entrantes simuladas para el modo demo. */
  const DEMO_REPLIES = [
    '¡Perfecto, gracias! 🙌',
    '¿Me puedes confirmar el precio?',
    'Ok, lo reviso y te escribo.',
    '¡Genial! ¿Cuándo me lo entregas?',
    'Muchas gracias por la atención 😊',
  ];

  /** Respuestas rápidas sugeridas en el composer. */
  const QUICK_REPLIES = ['Hola 👋', '¿Tienes disponibilidad?', 'Quiero hacer un pedido', 'Gracias'];

  components['inbox-view'] = {
    setup() {
      const search = Vue.ref('');
      const filter = Vue.ref('all');
      const platformFilter = Vue.ref('all');
      const selectedId = Vue.ref(null);
      const draft = Vue.ref('');
      const sending = Vue.ref(false);
      const loading = Vue.ref(true);
      const syncing = Vue.ref(false);
      const humanAgent = Vue.ref(false);
      const newConvOpen = Vue.ref(false);
      const newContactId = Vue.ref(null);

      /** Temporizadores activos (cleanup en onUnmounted). */
      const timers = [];
      function later(fn, ms) {
        const id = setTimeout(fn, ms);
        timers.push(id);
        return id;
      }
      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const contacts = Vue.computed(() => workspace.value.contacts || []);
      const conversations = Vue.computed(() => workspace.value.conversations || []);

      /** Etiquetas de leads del negocio (personalizables en Configuración). */
      const leadTags = Vue.computed(() => workspace.value.leadTags || niche.value.tags || []);

      /** Conversaciones filtradas por búsqueda, pestaña/tag y plataforma. */
      const filtered = Vue.computed(() => {
        const q = search.value.trim().toLowerCase();
        return conversations.value
          .slice()
          .sort((a, b) => b.lastTs - a.lastTs)
          .filter((c) => {
            const convPlatform = c.platform || 'whatsapp';
            if (platformFilter.value !== 'all' && convPlatform !== platformFilter.value) return false;
            const contact = contacts.value.find((ct) => ct.id === c.contactId);
            const haystack = `${contact ? contact.name : ''} ${c.messages.length ? c.messages[c.messages.length - 1].text : ''}`.toLowerCase();
            if (q && !haystack.includes(q)) return false;
            if (filter.value === 'unread') return c.unread > 0;
            if (filter.value !== 'all') return c.tags.includes(filter.value);
            return true;
          });
      });

      /** Plataformas presentes en la bandeja (conversaciones o canal conectado). */
      const presentPlatforms = Vue.computed(() => {
        const ids = new Set(conversations.value.map((c) => c.platform || 'whatsapp'));
        const tiktokConnected = (workspace.value.channels || []).some((c) => c.platform === 'tiktok' && c.connected);
        return PLATFORMS.filter((p) => ids.has(p.id) || (p.id === 'tiktok' && tiktokConnected));
      });

      /** Canal TikTok conectado (para el enlace externo). */
      const tiktokChannel = Vue.computed(() => (workspace.value.channels || []).find((c) => c.platform === 'tiktok') || null);

      /** ¿Filtro TikTok sin mensajería? */
      const tiktokEmpty = Vue.computed(() => platformFilter.value === 'tiktok' && filtered.value.length === 0);

      const selected = Vue.computed(() => conversations.value.find((c) => c.id === selectedId.value) || null);
      const selectedContact = Vue.computed(() => {
        const c = selected.value;
        return c ? contacts.value.find((ct) => ct.id === c.contactId) || null : null;
      });
      const unreadTotal = Vue.computed(() => conversations.value.reduce((acc, c) => acc + (c.unread || 0), 0));
      const isLive = Vue.computed(() => store.mode === 'live');

      /** ¿La conversación seleccionada está fuera de la ventana de 24h? */
      const outsideWindow = Vue.computed(() => {
        const conv = selected.value;
        if (!conv || !conv.messages.length) {
          // Historial no disponible (carga fallida): tratar como fuera de ventana para no violar políticas
          return isLive.value && conv && conv.messagesLoaded === false;
        }
        return Date.now() - conv.messages[conv.messages.length - 1].ts > 24 * 3600 * 1000;
      });

      /** IG/FB permiten responder fuera de ventana con HUMAN_AGENT (política Meta). */
      const canHumanAgent = Vue.computed(() =>
        ['instagram', 'facebook'].includes(selected.value && selected.value.platform) && outsideWindow.value
      );

      /** WhatsApp fuera de ventana exige plantilla aprobada (Campañas). */
      const blockedByWindow = Vue.computed(() =>
        selected.value && selected.value.platform === 'whatsapp' && outsideWindow.value && isLive.value
      );

      /** Pantalla de carga simulada al entrar a la bandeja. */
      later(() => { loading.value = false; }, 600);

      /** Abre una conversación; en live carga sus mensajes si aún no están. */
      async function selectConversation(conv) {
        selectedId.value = conv.id;
        humanAgent.value = false;
        if (conv.unread > 0) conv.unread = 0;
        if (isLive.value && conv.messages.length === 0) {
          // Cada conversación pide sus mensajes con SU cuenta (puede haber varias por perfil)
          const accountId = conv.accountId || (workspace.value.zernio && workspace.value.zernio.accountId);
          if (!accountId) return;
          conv.messagesLoaded = false;
          try {
            const data = await ZernioCrm.api.listMessages(conv.id, accountId);
            const list = Array.isArray(data) ? data : data.messages || [];
            conv.messages = list.map((m) => ({
              id: m.id || m.messageId,
              from: m.direction === 'outgoing' || m.from === 'me' ? 'out' : 'in',
              text: m.text || m.message || '',
              ts: Date.parse(m.timestamp || m.createdAt) || Date.now(),
              status: m.status || m.deliveryStatus || 'delivered',
            }));
            conv.lastTs = conv.messages.length ? conv.messages[conv.messages.length - 1].ts : conv.lastTs;
            conv.messagesLoaded = true;
          } catch (err) {
            toast(err.message || 'No se pudieron cargar los mensajes', 'error');
            // messagesLoaded queda false → ventana de 24h se aplica de forma conservadora
          }
        }
      }

      function backToList() {
        selectedId.value = null;
      }

      /** Último mensaje de una conversación (preview). */
      function lastMessage(conv) {
        const m = conv.messages[conv.messages.length - 1];
        return m ? `${m.from === 'out' ? 'Tú: ' : ''}${m.text}` : 'Sin mensajes';
      }

      /** Marca un mensaje saliente como entregado/leído (demo). */
      function simulateDelivery(msg) {
        later(() => { if (msg.status === 'sent') msg.status = 'delivered'; }, 450);
        later(() => { if (msg.status === 'delivered') msg.status = 'read'; }, 1100);
      }

      /** Programa una respuesta entrante simulada (demo). */
      function simulateIncoming(conv) {
        const delay = 2200 + Math.random() * 1800;
        later(() => {
          const reply = DEMO_REPLIES[(Math.random() * DEMO_REPLIES.length) | 0];
          conv.messages.push({ id: uid('msg'), from: 'in', text: reply, ts: Date.now(), status: 'delivered' });
          conv.lastTs = Date.now();
          if (selectedId.value !== conv.id) conv.unread += 1;
        }, delay);
      }

      /** Envía el borrador por la conversación seleccionada. */
      async function send() {
        const text = draft.value.trim();
        const conv = selected.value;
        if (!text || !conv || sending.value) return;
        // Políticas de ventana de 24h (validación ANTES de insertar el mensaje)
        if (isLive.value && outsideWindow.value) {
          if (conv.platform === 'whatsapp') {
            toast('WhatsApp fuera de la ventana de 24h: usa una plantilla aprobada (Campañas)', 'error');
            return;
          }
          if (['instagram', 'facebook'].includes(conv.platform) && !humanAgent.value) {
            toast('Fuera de la ventana de 24h: activa "Enviar como agente humano"', 'error');
            return;
          }
        }
        sending.value = true;
        const msg = { id: uid('msg'), from: 'out', text, ts: Date.now(), status: 'sent' };
        conv.messages.push(msg);
        conv.lastTs = msg.ts;
        draft.value = '';
        try {
          if (isLive.value) {
            const payload = {
              accountId: (conv.accountId || (workspace.value.zernio && workspace.value.zernio.accountId)) || '',
              message: text,
            };
            if (['instagram', 'facebook'].includes(conv.platform) && outsideWindow.value) {
              payload.messagingType = 'MESSAGE_TAG';
              payload.messageTag = 'HUMAN_AGENT';
            }
            await ZernioCrm.api.sendMessage(conv.id, payload);
          } else {
            simulateDelivery(msg);
            simulateIncoming(conv);
          }
        } catch (err) {
          msg.status = 'failed';
          toast(err.message || 'No se pudo enviar el mensaje', 'error');
        } finally {
          sending.value = false;
        }
      }

      /** Dígitos de un teléfono (para comparar formatos distintos). */
      function digits(phone) {
        return String(phone || '').replace(/\D/g, '');
      }

      /**
       * Sincroniza conversaciones por cada canal con mensajería (WhatsApp e Instagram).
       * Mapea participantes (planos) a contactos locales cuando no existen.
       */
      async function sync() {
        const profileId = workspace.value.zernio && workspace.value.zernio.profileId;
        if (!profileId || syncing.value) return;
        syncing.value = true;
        try {
          let added = 0;
          const errors = [];
          for (const p of PLATFORMS.filter((x) => x.inbox)) {
            const channel = (workspace.value.channels || []).find((c) => c.platform === p.id);
            const accountId = channel ? channel.accountId : p.id === 'whatsapp' ? (workspace.value.zernio && workspace.value.zernio.accountId) || '' : '';
            if (!accountId) continue; // canal no conectado: Zernio devolvería conversaciones de otras cuentas
            try {
              const data = await ZernioCrm.api.listConversations({ profileId, platform: p.id });
              let list = ZernioCrm.asArray(data);
              list = list.filter((c) => c.accountId === accountId);
              // Limpia conversaciones live huérfanas de ESTE canal (demo conv_* se mantienen)
              const liveIds = new Set(list.map((c) => c.id));
              workspace.value.conversations = workspace.value.conversations.filter(
                (c) => c.id.startsWith('conv_') || (c.platform || 'whatsapp') !== p.id || liveIds.has(c.id)
              );
              list.forEach((conv) => {
                const existing = conversations.value.find((c) => c.id === conv.id);
                if (existing) {
                  // Conversaciones sincronizadas antes del fix por-cuenta: asignar accountId y refrescar
                  if (!existing.accountId && conv.accountId) {
                    existing.accountId = conv.accountId;
                    existing.platform = p.id;
                    existing.lastTs = Date.parse(conv.updatedTime) || existing.lastTs;
                  }
                  return;
                }
                const name = conv.participantName || conv.participantUsername || 'Cliente Zernio';
                const phone = conv.participantUsername || conv.participantId || '';
                let contact = contacts.value.find((c) => digits(c.phone) === digits(phone));
                if (contact && /^\d+$/.test(contact.name) && !/^\d+$/.test(name)) {
                  contact.name = name; // mejora el nombre numérico con el del participante
                }
                if (!contact) {
                  contact = {
                    id: uid('ct'),
                    name,
                    phone,
                    platform: p.id,
                    tags: ['cliente'],
                    customFields: {},
                    createdAt: Date.now(),
                  };
                  workspace.value.contacts.unshift(contact);
                }
                workspace.value.conversations.unshift({
                  id: conv.id,
                  contactId: contact.id,
                  platform: p.id,
                  status: conv.status || 'active',
                  unread: conv.unreadCount || 0,
                  tags: contact.tags.slice(0, 1),
                  messages: [],
                  lastTs: Date.parse(conv.updatedTime) || Date.now(),
                  accountId: conv.accountId,
                  igProfile: conv.participant && conv.participant.instagramProfile ? conv.participant.instagramProfile : conv.participantInstagramProfile || null,
                });
                added += 1;
              });
            } catch (err) {
              errors.push(p.nombre);
            }
          }
          // Limpia conversaciones live de plataformas sin canal conectado (fantasmas)
          const connected = new Set(
            PLATFORMS.filter((x) => x.inbox).map((x) => {
              const ch = (workspace.value.channels || []).find((c) => c.platform === x.id);
              const acc = ch ? ch.accountId : x.id === 'whatsapp' ? (workspace.value.zernio && workspace.value.zernio.accountId) || '' : '';
              return acc ? x.id : null;
            }).filter(Boolean)
          );
          workspace.value.conversations = workspace.value.conversations.filter(
            (c) => c.id.startsWith('conv_') || connected.has(c.platform || 'whatsapp')
          );
          if (errors.length > 0) {
            toast(`Sincronización parcial: errores en ${errors.join(', ')}`, 'error');
          } else {
            toast(added > 0 ? `${added} conversaciones sincronizadas` : 'Sin conversaciones nuevas', 'success');
          }
        } catch (err) {
          toast(err.message || 'No se pudo sincronizar', 'error');
        } finally {
          syncing.value = false;
        }
      }

      /** Crea una conversación nueva con un contacto (demo). */
      function startConversation() {
        const contact = contacts.value.find((c) => c.id === newContactId.value);
        if (!contact) return;
        const conv = {
          id: uid('conv'),
          contactId: contact.id,
          platform: 'whatsapp',
          status: 'active',
          unread: 0,
          tags: contact.tags.slice(0, 1),
          messages: [],
          lastTs: Date.now(),
        };
        workspace.value.conversations.unshift(conv);
        newConvOpen.value = false;
        newContactId.value = null;
        selectedId.value = conv.id;
        toast(`Conversación con ${contact.name} iniciada`, 'success');
      }

      return {
        search, filter, platformFilter, selectedId, draft, sending, loading, syncing, newConvOpen, newContactId,
        workspace, niche, conversations, contacts, filtered, selected, selectedContact, unreadTotal, isLive,
        QUICK_REPLIES, canEdit, humanAgent, outsideWindow, canHumanAgent, blockedByWindow,
        presentPlatforms, tiktokChannel, tiktokEmpty, getPlatform, leadTags,
        selectConversation, backToList, lastMessage, send, sync, startConversation, timeAgo, formatTime,
      };
    },

    template: `
      <div class="-mx-5 -my-5 flex h-[calc(100vh-40px)] flex-col lg:-mx-8 lg:-my-8 lg:h-[calc(100vh)]">
        <!-- Barra superior integrada (full-bleed, sin marco) -->
        <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-stone-100/80 px-5 py-3.5 backdrop-blur lg:px-6">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
            </span>
            <div>
              <h2 class="text-lg font-bold leading-tight">Bandeja</h2>
              <p class="text-xs text-neutral-500">
                {{ workspace.whatsapp.phone }}
                <span v-if="!workspace.whatsapp.connected" class="font-semibold text-red-700">· desconectado</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge v-if="isLive" variant="warn" dot>Modo live</ui-badge>
            <ui-badge v-else variant="success" dot>Modo demo</ui-badge>
            <button @click="sync" :disabled="!isLive || syncing"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="syncing" size="h-4 w-4"></ui-spinner>
              <ui-icon v-else name="refresh" class="h-4 w-4"></ui-icon>
              Sincronizar
            </button>
            <button v-if="canEdit('inbox')" @click="newConvOpen = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nueva conversación
            </button>
          </div>
        </header>

        <!-- Carga simulada (integrada) -->
        <div v-if="loading" class="flex min-h-0 flex-1 bg-white">
          <div class="hidden w-[340px] space-y-3 border-r border-neutral-200 p-4 lg:block">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton v-for="i in 6" :key="i" h="h-16"></ui-skeleton>
          </div>
          <div class="flex-1 space-y-3 bg-stone-50 p-4">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton h="h-72"></ui-skeleton>
            <ui-skeleton h="h-14"></ui-skeleton>
          </div>
        </div>

        <!-- Cuerpo de la bandeja (sin marco exterior) -->
        <div v-else class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[340px_1fr]">
          <!-- Lista de conversaciones -->
          <aside :class="['flex min-h-0 flex-col lg:border-r lg:border-neutral-200', selected ? 'hidden lg:flex' : 'flex']">
            <div class="shrink-0 border-b border-neutral-200 p-3">
              <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
                <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
                <input v-model.trim="search" type="search" placeholder="Buscar conversación…"
                  class="w-full bg-transparent text-sm outline-none" />
              </div>
              <!-- Pestañas por plataforma -->
              <div class="mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                <button @click="platformFilter = 'all'"
                  class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="platformFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  Todas
                </button>
                <button v-for="p in presentPlatforms" :key="p.id" @click="platformFilter = p.id"
                  class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="platformFilter === p.id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  <ui-icon :name="p.icon" class="h-3.5 w-3.5"></ui-icon>
                  {{ p.nombre }}
                </button>
              </div>
              <div class="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                <button @click="filter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  Todas ({{ conversations.length }})
                </button>
                <button @click="filter = 'unread'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'unread' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  No leídas ({{ unreadTotal }})
                </button>
                <button v-for="t in leadTags" :key="t" @click="filter = t"
                  class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === t ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ t }}
                </button>
              </div>
            </div>
            <ul class="min-h-0 flex-1 overflow-y-auto">
              <!-- TikTok no tiene mensajería en Zernio -->
              <ui-empty v-if="tiktokEmpty" icon="tiktok" title="TikTok no tiene mensajería en Zernio"
                desc="Zernio solo expone publicación para TikTok. Responde a tus DM desde la app de TikTok." class="m-4">
                <a v-if="tiktokChannel && tiktokChannel.username" :href="'https://www.tiktok.com/@' + tiktokChannel.username.replace('@', '')" target="_blank"
                  class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Abrir perfil externo
                </a>
              </ui-empty>
              <ui-empty v-else-if="filtered.length === 0" icon="message" title="Sin conversaciones"
                desc="Prueba con otro filtro o inicia una conversación nueva." class="m-4"></ui-empty>
              <li v-for="conv in filtered" :key="conv.id">
                <button @click="selectConversation(conv)"
                  class="flex w-full items-center gap-3 border-b border-l-2 border-neutral-100 px-4 py-3.5 text-left transition"
                  :class="conv.id === selectedId
                    ? 'border-l-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-l-transparent hover:bg-stone-100'">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    :class="(getPlatform(conv.platform || 'whatsapp') || {}).tone">
                    <ui-icon :name="(getPlatform(conv.platform || 'whatsapp') || {}).icon" class="h-3 w-3"></ui-icon>
                  </span>
                  <ui-avatar :name="(contacts.find(c => c.id === conv.contactId) || {}).name" size="h-10 w-10 text-sm"></ui-avatar>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="truncate text-sm font-semibold">{{ (contacts.find(c => c.id === conv.contactId) || {}).name }}</p>
                      <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ timeAgo(conv.lastTs) }}</span>
                    </div>
                    <p class="truncate text-sm text-neutral-500">{{ lastMessage(conv) }}</p>
                  </div>
                  <span v-if="conv.unread > 0" class="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[11px] font-bold text-white tabular-nums">
                    {{ conv.unread }}
                  </span>
                </button>
              </li>
            </ul>
          </aside>

          <!-- Panel de chat (integrado sobre stone-50, separación sutil) -->
          <section :class="['flex min-h-0 flex-col bg-stone-50', selected ? 'flex' : 'hidden lg:flex']">
            <!-- Estado vacío sin conversación seleccionada -->
            <div v-if="!selected" class="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <span class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                <ui-icon name="whatsapp" class="h-8 w-8"></ui-icon>
              </span>
              <h3 class="text-lg font-semibold">Selecciona una conversación</h3>
              <p class="max-w-md text-sm text-neutral-500">Las consultas de tus clientes por WhatsApp aparecerán aquí.</p>
            </div>

            <template v-else>
              <!-- Header del chat -->
              <header class="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
                <div class="flex items-center gap-3">
                  <button class="lg:hidden" @click="backToList" aria-label="Volver a la lista">
                    <ui-icon name="chevron-left" class="h-5 w-5"></ui-icon>
                  </button>
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    :class="(getPlatform(selected.platform || 'whatsapp') || {}).tone">
                    <ui-icon :name="(getPlatform(selected.platform || 'whatsapp') || {}).icon" class="h-4 w-4"></ui-icon>
                  </span>
                  <ui-avatar :name="selectedContact ? selectedContact.name : '?'" size="h-10 w-10 text-sm"></ui-avatar>
                  <div>
                    <p class="font-semibold leading-tight">{{ selectedContact ? selectedContact.name : 'Contacto' }}
                      <span class="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ (getPlatform(selected.platform || 'whatsapp') || {}).nombre }}</span>
                    </p>
                    <p class="font-mono text-[11px] uppercase tracking-wider text-neutral-400">{{ selectedContact ? selectedContact.phone : '' }}</p>
                    <p v-if="selected.igProfile" class="font-mono text-[10px] text-neutral-400">
                      {{ selected.igProfile.isFollower ? '· te sigue' : '' }}{{ selected.igProfile.followerCount != null ? ' · ' + selected.igProfile.followerCount + ' seguidores' : '' }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <ui-badge v-for="t in selected.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                </div>
              </header>

              <!-- Mensajes -->
              <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
                <div v-for="m in selected.messages" :key="m.id" class="flex" :class="m.from === 'out' ? 'justify-end' : 'justify-start'">
                  <div class="max-w-[70%] px-4 py-2.5 shadow-sm"
                    :class="m.from === 'out'
                      ? 'bg-[var(--accent)] text-white'
                      : 'border border-neutral-200 bg-white'">
                    <p class="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{{ m.text }}</p>
                    <div class="mt-1 flex items-center justify-end gap-1.5">
                      <span class="font-mono text-[10px] uppercase tracking-wider opacity-60">{{ formatTime(m.ts) }}</span>
                      <ui-icon v-if="m.from === 'out'" name="check" class="h-3 w-3"
                        :class="m.status === 'read' ? 'text-emerald-400' : m.status === 'failed' ? 'text-red-400' : 'opacity-60'"></ui-icon>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Composer -->
              <footer class="shrink-0 border-t border-neutral-200 bg-white p-3.5">
                <div v-if="canHumanAgent" class="mb-2.5 flex items-center gap-2.5 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <ui-toggle v-model="humanAgent" class="shrink-0"></ui-toggle>
                  <span>Conversación fuera de la ventana de 24h: enviar como agente humano (HUMAN_AGENT).</span>
                </div>
                <div v-if="blockedByWindow" class="mb-2.5 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
                  WhatsApp fuera de la ventana de 24h: usa una plantilla aprobada desde Campañas.
                </div>
                <div class="mb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                  <button v-for="qr in QUICK_REPLIES" :key="qr" @click="draft = qr"
                    class="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-sm transition hover:border-neutral-900">
                    {{ qr }}
                  </button>
                </div>
                <div class="flex items-end gap-2">
                  <textarea v-model="draft" rows="2" placeholder="Escribe un mensaje… (Enter para enviar)"
                    @keydown.enter.exact.prevent="send"
                    class="flex-1 resize-none border border-neutral-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:bg-white"></textarea>
                  <button @click="send" :disabled="sending || !draft.trim()"
                    class="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-neutral-900 bg-[var(--accent)] text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40"
                    aria-label="Enviar mensaje">
                    <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
                    <ui-icon v-else name="send" class="h-5 w-5"></ui-icon>
                  </button>
                </div>
              </footer>
            </template>
          </section>
        </div>

        <!-- Modal: nueva conversación -->
        <ui-modal :open="newConvOpen" title="Nueva conversación" @close="newConvOpen = false">
          <ui-field label="Contacto">
            <select v-model="newContactId" class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null" disabled>Elige un contacto…</option>
              <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }} · {{ c.phone }}</option>
            </select>
          </ui-field>
          <button @click="startConversation" :disabled="!newContactId"
            class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            Iniciar conversación
          </button>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
