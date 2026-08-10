/**
 * @file inbox.js — Bandeja unificada de conversaciones WhatsApp a pantalla
 * completa: lista filtrable (380px) + panel de chat que llena el área.
 * Demo: envía con delivery/lectura y respuestas entrantes simuladas.
 * Live: sincroniza conversaciones reales desde /inbox/conversations (proxy).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, getNiche, timeAgo, formatTime, uid, canEdit } = ZernioCrm;

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
      const selectedId = Vue.ref(null);
      const draft = Vue.ref('');
      const sending = Vue.ref(false);
      const loading = Vue.ref(true);
      const syncing = Vue.ref(false);
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

      /** Conversaciones filtradas por búsqueda y pestaña/tag. */
      const filtered = Vue.computed(() => {
        const q = search.value.trim().toLowerCase();
        return conversations.value
          .slice()
          .sort((a, b) => b.lastTs - a.lastTs)
          .filter((c) => {
            const contact = contacts.value.find((ct) => ct.id === c.contactId);
            const haystack = `${contact ? contact.name : ''} ${c.messages.length ? c.messages[c.messages.length - 1].text : ''}`.toLowerCase();
            if (q && !haystack.includes(q)) return false;
            if (filter.value === 'unread') return c.unread > 0;
            if (filter.value !== 'all') return c.tags.includes(filter.value);
            return true;
          });
      });

      const selected = Vue.computed(() => conversations.value.find((c) => c.id === selectedId.value) || null);
      const selectedContact = Vue.computed(() => {
        const c = selected.value;
        return c ? contacts.value.find((ct) => ct.id === c.contactId) || null : null;
      });
      const unreadTotal = Vue.computed(() => conversations.value.reduce((acc, c) => acc + (c.unread || 0), 0));
      const isLive = Vue.computed(() => store.mode === 'live');

      /** Pantalla de carga simulada al entrar a la bandeja. */
      later(() => { loading.value = false; }, 600);

      /** Abre una conversación; en live carga sus mensajes si aún no están. */
      async function selectConversation(conv) {
        selectedId.value = conv.id;
        if (conv.unread > 0) conv.unread = 0;
        if (isLive.value && conv.messages.length === 0) {
          const accountId = workspace.value.zernio && workspace.value.zernio.accountId;
          if (!accountId) return;
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
          } catch (err) {
            toast(err.message || 'No se pudieron cargar los mensajes', 'error');
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
        sending.value = true;
        const msg = { id: uid('msg'), from: 'out', text, ts: Date.now(), status: 'sent' };
        conv.messages.push(msg);
        conv.lastTs = msg.ts;
        draft.value = '';
        try {
          if (isLive.value) {
            await ZernioCrm.api.sendMessage(conv.id, {
              accountId: (workspace.value.zernio && workspace.value.zernio.accountId) || '',
              message: text,
            });
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
       * Sincroniza conversaciones desde Zernio (modo live).
       * Mapea participantes (planos) a contactos locales cuando no existen.
       */
      async function sync() {
        const profileId = workspace.value.zernio && workspace.value.zernio.profileId;
        const accountId = workspace.value.zernio && workspace.value.zernio.accountId;
        if (!profileId || !accountId || syncing.value) return;
        syncing.value = true;
        try {
          const data = await ZernioCrm.api.listConversations({ profileId, platform: 'whatsapp' });
          const list = ZernioCrm.asArray(data).filter((c) => c.accountId === accountId);
          let added = 0;
          list.forEach((conv) => {
            const existing = conversations.value.find((c) => c.id === conv.id);
            if (existing) return;
            const name = conv.participantName || conv.participantUsername || 'Cliente Zernio';
            const phone = conv.participantUsername || conv.participantId || '';
            let contact = contacts.value.find((c) => digits(c.phone) === digits(phone));
            if (!contact) {
              contact = {
                id: uid('ct'),
                name,
                phone,
                platform: 'whatsapp',
                tags: ['cliente'],
                customFields: {},
                createdAt: Date.now(),
              };
              workspace.value.contacts.unshift(contact);
            }
            workspace.value.conversations.unshift({
              id: conv.id,
              contactId: contact.id,
              platform: 'whatsapp',
              status: conv.status || 'active',
              unread: conv.unreadCount || 0,
              tags: contact.tags.slice(0, 1),
              messages: [],
              lastTs: Date.parse(conv.updatedTime) || Date.now(),
            });
            added += 1;
          });
          toast(added > 0 ? `${added} conversaciones sincronizadas` : 'Sin conversaciones nuevas', 'success');
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
        search, filter, selectedId, draft, sending, loading, syncing, newConvOpen, newContactId,
        workspace, niche, conversations, contacts, filtered, selected, selectedContact, unreadTotal, isLive,
        QUICK_REPLIES, canEdit,
        selectConversation, backToList, lastMessage, send, sync, startConversation, timeAgo, formatTime,
      };
    },

    template: `
      <div class="flex h-[calc(100vh-140px)] min-h-[560px] flex-col">
        <!-- Barra superior -->
        <header class="flex flex-wrap items-center justify-between gap-3 border-2 border-b-0 border-neutral-900 bg-white px-5 py-3">
          <div>
            <h2 class="text-xl font-bold leading-tight">Bandeja de WhatsApp</h2>
            <p class="text-sm text-neutral-500">
              {{ workspace.whatsapp.phone }}
              <span v-if="!workspace.whatsapp.connected" class="font-semibold text-red-700">· desconectado</span>
            </p>
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

        <!-- Carga simulada -->
        <div v-if="loading" class="flex flex-1 border-2 border-neutral-900 bg-white">
          <div class="w-[380px] space-y-3 border-r-2 border-neutral-200 p-4">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton v-for="i in 6" :key="i" h="h-20"></ui-skeleton>
          </div>
          <div class="flex-1 space-y-3 p-4">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton h="h-72"></ui-skeleton>
            <ui-skeleton h="h-14"></ui-skeleton>
          </div>
        </div>

        <!-- Cuerpo de la bandeja -->
        <div v-else class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden border-2 border-neutral-900 bg-white lg:grid-cols-[380px_1fr]">
          <!-- Lista de conversaciones -->
          <aside :class="['min-h-0 border-b-2 border-neutral-200 lg:border-b-0 lg:border-r-2', selected ? 'hidden lg:block' : 'block']">
            <div class="border-b-2 border-neutral-200 p-3">
              <div class="flex items-center gap-2 border-2 border-neutral-300 px-3 py-2.5 focus-within:border-neutral-900">
                <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
                <input v-model.trim="search" type="search" placeholder="Buscar conversación…"
                  class="w-full bg-transparent text-sm outline-none" />
              </div>
              <div class="mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                <button @click="filter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                  Todas ({{ conversations.length }})
                </button>
                <button @click="filter = 'unread'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'unread' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                  No leídas ({{ unreadTotal }})
                </button>
                <button v-for="t in niche.tags" :key="t" @click="filter = t"
                  class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === t ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                  {{ t }}
                </button>
              </div>
            </div>
            <ul class="h-[calc(100%-108px)] overflow-y-auto">
              <ui-empty v-if="filtered.length === 0" icon="message" title="Sin conversaciones"
                desc="Prueba con otro filtro o inicia una conversación nueva." class="m-4"></ui-empty>
              <li v-for="conv in filtered" :key="conv.id">
                <button @click="selectConversation(conv)" class="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-4 text-left transition hover:bg-stone-50"
                  :class="conv.id === selectedId ? 'bg-[var(--accent-soft)]' : ''">
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

          <!-- Panel de chat -->
          <section :class="['flex min-h-0 flex-col', selected ? 'flex' : 'hidden lg:flex']">
            <!-- Estado vacío sin conversación seleccionada -->
            <div v-if="!selected" class="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <span class="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <ui-icon name="whatsapp" class="h-10 w-10"></ui-icon>
              </span>
              <h3 class="text-xl font-semibold">Selecciona una conversación</h3>
              <p class="max-w-md text-neutral-500">Las consultas de tus clientes por WhatsApp aparecerán aquí.</p>
            </div>

            <template v-else>
              <!-- Header del chat -->
              <header class="flex items-center justify-between border-b-2 border-neutral-200 px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <button class="lg:hidden" @click="backToList" aria-label="Volver a la lista">
                    <ui-icon name="chevron-left" class="h-5 w-5"></ui-icon>
                  </button>
                  <ui-avatar :name="selectedContact ? selectedContact.name : '?'" size="h-10 w-10 text-sm"></ui-avatar>
                  <div>
                    <p class="font-semibold leading-tight">{{ selectedContact ? selectedContact.name : 'Contacto' }}</p>
                    <p class="font-mono text-[11px] uppercase tracking-wider text-neutral-400">{{ selectedContact ? selectedContact.phone : '' }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <ui-badge v-for="t in selected.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                </div>
              </header>

              <!-- Mensajes -->
              <div class="flex-1 space-y-3 overflow-y-auto bg-stone-50 p-5">
                <div v-for="m in selected.messages" :key="m.id" class="flex" :class="m.from === 'out' ? 'justify-end' : 'justify-start'">
                  <div class="max-w-[70%] border-2 px-4 py-2.5 shadow-sm"
                    :class="m.from === 'out'
                      ? 'border-neutral-900 bg-[var(--accent)] text-white'
                      : 'border-neutral-300 bg-white'">
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
              <footer class="border-t-2 border-neutral-200 p-3.5">
                <div class="mb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                  <button v-for="qr in QUICK_REPLIES" :key="qr" @click="draft = qr"
                    class="shrink-0 border border-neutral-300 px-3 py-1.5 text-sm transition hover:border-neutral-900">
                    {{ qr }}
                  </button>
                </div>
                <div class="flex items-end gap-2">
                  <textarea v-model="draft" rows="2" placeholder="Escribe un mensaje… (Enter para enviar)"
                    @keydown.enter.exact.prevent="send"
                    class="flex-1 resize-none border-2 border-neutral-300 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900"></textarea>
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
