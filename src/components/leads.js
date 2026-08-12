/**
 * @file leads.js — Tablero Kanban de leads: columnas = etapas del pipeline
 * (workspace.leadTags, configurables) + "Sin asignar". Cada tarjeta es un
 * contacto con métricas de relación (VIP, frecuencia, canales) y un drawer
 * de detalle profundo. Drag & drop nativo HTML5 + botones de respaldo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, timeAgo, getPlatform, canEdit, getNiche, remindersOf, addReminder, toggleReminder, removeReminder } = ZernioCrm;

  const components = {};

  /** Hash determinista para métricas demo estables por contacto. */
  function hashSeed(str) {
    return [...String(str)].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 7);
  }

  components['leads-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const contacts = Vue.computed(() => workspace.value.contacts || []);
      const conversations = Vue.computed(() => workspace.value.conversations || []);
      const isLive = Vue.computed(() => store.mode === 'live');
      const leadTags = Vue.computed(() => workspace.value.leadTags || niche.value.tags || []);

      /** Columnas del kanban: "Sin asignar" + etapas del pipeline. */
      const columns = Vue.computed(() => [
        { id: '__sin_asignar__', nombre: 'Sin asignar' },
        ...leadTags.value.map((t) => ({ id: t, nombre: t })),
      ]);

      /** Conversaciones de un contacto. */
      function conversationsOf(contact) {
        return conversations.value.filter((c) => c.contactId === contact.id);
      }

      /** Último mensaje (texto y hora) de un contacto. */
      function lastMessageOf(contact) {
        const convs = conversationsOf(contact);
        let best = null;
        convs.forEach((c) => {
          const m = c.messages && c.messages[c.messages.length - 1];
          if (m && (!best || m.ts > best.ts)) best = m;
        });
        return best;
      }

      /** Métricas de relación del contacto (para tarjeta y drawer). */
      function metricsOf(contact) {
        const convs = conversationsOf(contact);
        const totalMsgs = convs.reduce((acc, c) => acc + (c.messages ? c.messages.length : 0), 0);
        const days = Math.max(1, Math.round((Date.now() - (contact.createdAt || Date.now())) / 864e5));
        // Canal más frecuente por conteo de mensajes (demo: pseudo si no hay historial)
        const channelCounts = {};
        convs.forEach((c) => {
          const p = c.platform || 'whatsapp';
          channelCounts[p] = (channelCounts[p] || 0) + (c.messages ? c.messages.length : 0);
        });
        if (Object.keys(channelCounts).length === 0) {
          const seed = hashSeed(contact.id + 'ch');
          channelCounts.whatsapp = (seed % 5) + 1;
          if (seed % 2 === 0) channelCounts.instagram = (seed % 3) + 1;
        }
        const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0] || ['whatsapp', 0];
        const freqPerDay = totalMsgs / days;
        const vip = (contact.tags || []).includes('vip');
        const frecuente = totalMsgs >= 10 || (contact.tags || []).includes('frecuente');
        return { convs, totalMsgs, days, channelCounts, topChannel, freqPerDay, vip, frecuente };
      }

      // ── Tabs: activas / finalizadas ────────────────────────────────────────
      const viewTab = Vue.ref('activas');
      const activeContacts = Vue.computed(() => contacts.value.filter((c) => !c.leadClosed));
      const closedContacts = Vue.computed(() => contacts.value.filter((c) => c.leadClosed));

      /** Contactos de una columna (solo leads activas). */
      function cardsOf(col) {
        return activeContacts.value.filter((c) => {
          if (col.id === '__sin_asignar__') return !c.leadTag || !leadTags.value.includes(c.leadTag);
          return c.leadTag === col.id;
        });
      }

      // ── Cierre de leads (flujo amigable: concretada / no concretada) ───────
      const closeOpen = Vue.ref(false);
      const closeTarget = Vue.ref(null);
      const closeForm = Vue.reactive({ outcome: 'ganada', note: '', reason: '' });
      const CLOSE_REASONS = ['Compró', 'Sin respuesta', 'Se pospuso', 'Eligió otra opción'];

      /** Etiqueta amigable del resultado interno (ganada/perdida). */
      function closeLabel(outcome) {
        return outcome === 'ganada' ? 'Concretada' : 'No concretada';
      }

      function openCloseModal(contact) {
        closeTarget.value = contact;
        Object.assign(closeForm, { outcome: 'ganada', note: '', reason: '' });
        closeOpen.value = true;
      }

      function confirmClose() {
        const contact = closeTarget.value;
        if (!contact) return;
        contact.leadClosed = { at: Date.now(), outcome: closeForm.outcome, note: closeForm.note.trim(), reason: closeForm.reason || undefined };
        // El cierre queda registrado en el historial de etapas (timeline del drawer)
        contact.leadHistory = contact.leadHistory || [];
        contact.leadHistory.push({
          tag: `finalizada:${closeForm.outcome}`,
          at: contact.leadClosed.at,
          note: closeForm.note.trim() || undefined,
          reason: closeForm.reason || undefined,
        });
        closeOpen.value = false;
        closeTarget.value = null;
        detailOpen.value = false;
        toast(`Lead cerrado como ${closeLabel(closeForm.outcome).toLowerCase()}`, 'success');
      }

      function reopenLead(contact) {
        if (!contact) return;
        contact.leadHistory = contact.leadHistory || [];
        // Conserva el cierre previo para que la timeline muestre "antes: …"
        contact.leadHistory.push({ tag: 'reabierta', at: Date.now(), prev: contact.leadClosed });
        delete contact.leadClosed;
        toast('Lead reabierto: vuelve al tablero activo', 'success');
      }

      // ── Recordatorios por lead ─────────────────────────────────────────────
      const remInput = Vue.reactive({ text: '', dueAt: '' });
      const remPanelOpen = Vue.ref(false);

      /** Pendientes sin completar de un contacto. */
      function pendingReminders(contact) {
        return remindersOf(contact.id).filter((r) => !r.done);
      }

      /** ¿Hay recordatorios vencidos para el contacto? */
      function hasOverdue(contact) {
        return pendingReminders(contact).some((r) => r.dueAt && Date.parse(r.dueAt) < Date.now());
      }

      function addReminderFor(contact) {
        const text = remInput.text.trim();
        if (!text) return;
        addReminder(contact.id, text, remInput.dueAt || null);
        remInput.text = '';
        remInput.dueAt = '';
        toast('Recordatorio creado', 'success');
      }

      /** Próximos recordatorios de todas las leads (panel del header). */
      const upcomingReminders = Vue.computed(() =>
        (store.workspace && store.workspace.reminders || [])
          .filter((r) => !r.done)
          .map((r) => ({ ...r, contact: contacts.value.find((c) => c.id === r.contactId) || null }))
          .sort((a, b) => (a.dueAt || '9999') < (b.dueAt || '9999') ? -1 : 1)
          .slice(0, 12)
      );

      // ── Drag & drop nativo HTML5 + botones ─────────────────────────────────
      const dragContactId = Vue.ref(null);

      function onDragStart(event, contact) {
        if (!canEdit('leads')) {
          event.preventDefault();
          return;
        }
        // Firefox exige datos en dataTransfer para iniciar el arrastre
        event.dataTransfer.setData('text/plain', contact.id);
        event.dataTransfer.effectAllowed = 'move';
        dragContactId.value = contact.id;
      }

      function onDragEnd() {
        dragContactId.value = null;
      }

      function onDragOver(event) {
        event.preventDefault(); // permite el drop
      }

      function onDrop(col) {
        const id = dragContactId.value;
        dragContactId.value = null;
        if (!id || !canEdit('leads')) return;
        const contact = contacts.value.find((c) => c.id === id);
        if (!contact) return;
        ZernioCrm.applyLeadTag(contact, col.id === '__sin_asignar__' ? null : col.id);
        toast(`Lead movido a "${col.nombre}"`, 'success');
      }

      /** Mueve un contacto a la columna anterior/siguiente (respaldo accesible). */
      function moveContact(contact, dir) {
        if (!canEdit('leads')) return;
        const idx = columns.value.findIndex((c) => (contact.leadTag && leadTags.value.includes(contact.leadTag) ? c.id === contact.leadTag : c.id === '__sin_asignar__'));
        const next = columns.value[idx + dir];
        if (!next) return;
        ZernioCrm.applyLeadTag(contact, next.id === '__sin_asignar__' ? null : next.id);
        toast(`Lead movido a "${next.nombre}"`, 'success');
      }

      // ── Drawer de detalle del contacto ─────────────────────────────────────
      const detailOpen = Vue.ref(false);
      const detailContact = Vue.ref(null);

      function openDetail(contact) {
        detailContact.value = contact;
        detailOpen.value = true;
      }

      /** Suma de mensajes por canal (para barras del drawer). */
      function channelBars(metrics) {
        const entries = Object.entries(metrics.channelCounts).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...entries.map(([, v]) => v));
        return entries.map(([platform, count]) => ({
          platform,
          count,
          pct: Math.round((count / max) * 100),
        }));
      }

      /** Abre la conversación en la bandeja (sin salir de la lógica del drawer). */
      function openConversation(conv) {
        if (!conv) return;
        store.pendingConversationId = conv.id;
        ZernioCrm.navigate('inbox');
      }

      /** Historial de etapas del contacto, de la más reciente a la más antigua. */
      function historyOf(contact) {
        return ((contact && contact.leadHistory) || []).slice().reverse();
      }

      /** Etiqueta legible de una entrada del historial (cierres y reaperturas). */
      function stageLabel(tag) {
        if (!tag) return 'Sin asignar';
        if (tag === 'reabierta' || tag === 'reabierto') return 'Reabierta';
        if (String(tag).startsWith('finalizada:')) return 'Cerrada · ' + closeLabel(tag.split(':')[1]);
        return tag;
      }

      return {
        workspace, isLive, leadTags, columns, cardsOf, metricsOf, lastMessageOf,
        contacts, conversations,
        dragContactId, onDragStart, onDragOver, onDrop, moveContact,
        detailOpen, detailContact, openDetail, channelBars, openConversation,
        viewTab, activeContacts, closedContacts,
        closeOpen, closeTarget, closeForm, openCloseModal, confirmClose, reopenLead,
        remInput, remPanelOpen, pendingReminders, hasOverdue, addReminderFor, upcomingReminders,
        remindersOf, toggleReminder, removeReminder,
        historyOf, stageLabel, closeLabel, CLOSE_REASONS,
        getPlatform, timeAgo, canEdit, ZernioCrm,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Leads</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Tablero de seguimiento de tus clientes por etapa.
              <span class="font-semibold">{{ isLive ? '· live' : '· demo' }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge variant="accent">{{ contacts.length }} clientes</ui-badge>
            <button @click="remPanelOpen = true"
              class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="clock" class="h-4 w-4"></ui-icon>
              Recordatorios ({{ upcomingReminders.length }})
            </button>
            <button @click="ZernioCrm.navigate('settings')"
              class="border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              Configurar etapas
            </button>
          </div>
        </header>

        <p class="border border-neutral-200 bg-stone-50 px-4 py-2.5 text-xs text-neutral-500">
          Arrastra una tarjeta entre columnas para cambiar la etapa del lead (o usa las flechas ←/→).
          Las etapas se administran en Configuración → Gestión de leads y se reflejan en la bandeja.
        </p>

        <!-- Tabs: activas / finalizadas -->
        <div class="flex gap-1.5 border-b-2 border-neutral-900">
          <button @click="viewTab = 'activas'"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="viewTab === 'activas' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            Activas ({{ activeContacts.length }})
          </button>
          <button @click="viewTab = 'finalizadas'"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="viewTab === 'finalizadas' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            Finalizadas ({{ closedContacts.length }})
          </button>
        </div>

        <!-- Kanban: leads activas -->
        <div v-if="viewTab === 'activas'" class="flex gap-4 overflow-x-auto pb-4">
          <section v-for="col in columns" :key="col.id"
            class="flex min-h-[420px] w-64 shrink-0 flex-col border-2 border-neutral-900 bg-stone-50"
            @dragover="onDragOver" @drop="onDrop(col)">
            <header class="flex items-center justify-between border-b-2 border-neutral-900 bg-white px-3 py-2.5">
              <h3 class="truncate font-mono text-[11px] font-semibold uppercase tracking-widest">{{ col.nombre }}</h3>
              <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-white tabular-nums">
                {{ cardsOf(col).length }}
              </span>
            </header>
            <div class="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
              <article v-for="c in cardsOf(col)" :key="c.id" draggable="true"
                @dragstart="onDragStart($event, c)" @dragend="onDragEnd" @click="openDetail(c)"
                class="cursor-grab border-2 border-neutral-900 bg-white p-3 shadow-brutal-sm transition hover:-translate-y-0.5 active:cursor-grabbing">
                <div class="flex items-start justify-between gap-2">
                  <p class="min-w-0 truncate text-sm font-semibold">{{ c.name }}</p>
                  <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" :class="(getPlatform(c.platform || 'whatsapp') || {}).tone">
                    <ui-icon :name="(getPlatform(c.platform || 'whatsapp') || {}).icon" class="h-3 w-3"></ui-icon>
                  </span>
                </div>
                <p class="mt-0.5 truncate font-mono text-[10px] text-neutral-400">{{ c.phone || 'sin teléfono' }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-1">
                  <ui-badge v-if="metricsOf(c).vip" variant="warn" dot>VIP</ui-badge>
                  <ui-badge v-if="metricsOf(c).frecuente" variant="success" dot>Frecuente</ui-badge>
                  <ui-badge variant="neutral">{{ metricsOf(c).totalMsgs }} msgs</ui-badge>
                  <span v-if="pendingReminders(c).length" class="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider"
                    :class="hasOverdue(c) ? 'text-red-700' : 'text-neutral-500'">
                    <ui-icon name="clock" class="h-3 w-3"></ui-icon>
                    {{ pendingReminders(c).length }} pend.
                  </span>
                </div>
                <p v-if="lastMessageOf(c)" class="mt-2 truncate border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  {{ lastMessageOf(c).text }}
                </p>
                <div class="mt-1.5 flex items-center justify-between">
                  <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                    {{ lastMessageOf(c) ? timeAgo(lastMessageOf(c).ts) : 'sin actividad' }}
                  </span>
                  <div class="flex gap-0.5">
                    <button v-if="canEdit('leads')" @click.stop="openCloseModal(c)" class="p-0.5 text-neutral-400 hover:text-red-700" aria-label="Cerrar lead">
                      <ui-icon name="check-circle" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                    <button @click.stop="moveContact(c, -1)" class="p-0.5 text-neutral-400 hover:text-neutral-900" aria-label="Mover atrás">
                      <ui-icon name="chevron-left" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                    <button @click.stop="moveContact(c, 1)" class="p-0.5 text-neutral-400 hover:text-neutral-900" aria-label="Mover adelante">
                      <ui-icon name="chevron-right" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                  </div>
                </div>
              </article>
              <p v-if="cardsOf(col).length === 0" class="py-8 text-center text-xs text-neutral-400">Sin clientes en esta etapa</p>
            </div>
          </section>
        </div>

        <!-- Finalizadas: tarjetas con resultado -->
        <div v-else>
          <div v-if="closedContacts.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
            <p class="px-6 py-10 text-center text-sm text-neutral-400">Aún no hay leads finalizadas.</p>
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <article v-for="c in closedContacts" :key="c.id" @click="openDetail(c)"
              class="cursor-pointer border-2 border-neutral-900 bg-white p-4 shadow-brutal-sm transition hover:-translate-y-0.5">
              <div class="flex items-start justify-between gap-2">
                <p class="min-w-0 truncate text-sm font-semibold">{{ c.name }}</p>
                <ui-badge :variant="c.leadClosed.outcome === 'ganada' ? 'success' : 'danger'" dot>
                  Cerrada · {{ closeLabel(c.leadClosed.outcome) }}
                </ui-badge>
              </div>
              <p class="mt-0.5 truncate font-mono text-[10px] text-neutral-400">{{ c.phone || 'sin teléfono' }}</p>
              <p v-if="c.leadClosed.reason" class="mt-2 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ c.leadClosed.reason }}</p>
              <p v-if="c.leadClosed.note" class="mt-2 border-t border-neutral-100 pt-2 text-xs text-neutral-600">{{ c.leadClosed.note }}</p>
              <div class="mt-2 flex items-center justify-between">
                <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                  {{ c.leadClosed.at ? new Date(c.leadClosed.at).toLocaleDateString('es-VE') : '' }}
                </span>
                <button @click.stop="reopenLead(c)" class="border border-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">
                  Reabrir
                </button>
              </div>
            </article>
          </div>
        </div>
        <ui-drawer :open="detailOpen" width="max-w-xl" :title="'Lead · ' + (detailContact ? detailContact.name : '')" @close="detailOpen = false">
          <div v-if="detailContact" :key="detailContact.id" class="space-y-5">
            <div class="flex items-center gap-3">
              <ui-avatar :name="detailContact.name" size="h-12 w-12 text-base"></ui-avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ detailContact.name }}</p>
                <p class="truncate font-mono text-xs text-neutral-500">{{ detailContact.phone || 'sin teléfono' }}</p>
              </div>
              <div class="flex gap-1">
                <ui-badge v-if="metricsOf(detailContact).vip" variant="warn" dot>VIP</ui-badge>
                <ui-badge v-if="metricsOf(detailContact).frecuente" variant="success" dot>Frecuente</ui-badge>
              </div>
            </div>

            <!-- Métricas de relación -->
            <div class="grid grid-cols-2 gap-3">
              <div class="border border-neutral-200 p-3">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cliente desde</p>
                <p class="mt-0.5 text-sm font-semibold">{{ detailContact.createdAt ? new Date(detailContact.createdAt).toLocaleDateString('es-VE') : '—' }}</p>
                <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(detailContact).days }} días en el CRM</p>
              </div>
              <div class="border border-neutral-200 p-3">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes totales</p>
                <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ metricsOf(detailContact).totalMsgs }}</p>
                <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(detailContact).freqPerDay.toFixed(1) }} por día</p>
              </div>
              <div class="border border-neutral-200 p-3">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Promedio semanal</p>
                <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ (metricsOf(detailContact).freqPerDay * 7).toFixed(1) }} msgs/sem</p>
                <p class="font-mono text-[10px] text-neutral-400">ritmo de comunicación</p>
              </div>
              <div class="border border-neutral-200 p-3">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canal principal</p>
                <p class="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                  <ui-icon :name="(getPlatform(metricsOf(detailContact).topChannel[0]) || {}).icon" class="h-4 w-4"></ui-icon>
                  {{ (getPlatform(metricsOf(detailContact).topChannel[0]) || {}).nombre }}
                </p>
                <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(detailContact).topChannel[1] }} mensajes</p>
              </div>
            </div>

            <!-- Canales más frecuentes (barras) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Canales más frecuentes</p>
              <div class="space-y-1.5">
                <div v-for="ch in channelBars(metricsOf(detailContact))" :key="ch.platform" class="flex items-center gap-2">
                  <span class="flex w-24 items-center gap-1.5 text-xs">
                    <ui-icon :name="(getPlatform(ch.platform) || {}).icon" class="h-3.5 w-3.5"></ui-icon>
                    {{ (getPlatform(ch.platform) || {}).nombre }}
                  </span>
                  <div class="h-2.5 flex-1 border border-neutral-200 bg-neutral-100">
                    <div class="h-full bg-[var(--accent)]" :style="{ width: ch.pct + '%' }"></div>
                  </div>
                  <span class="w-8 text-right font-mono text-[10px] tabular-nums text-neutral-500">{{ ch.count }}</span>
                </div>
              </div>
            </div>

            <!-- Recordatorios del lead -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Recordatorios</p>
              <div class="space-y-1.5">
                <div v-for="r in remindersOf(detailContact.id)" :key="r.id"
                  class="flex items-center gap-2 border border-neutral-200 px-2.5 py-2"
                  :class="r.done ? 'opacity-50' : r.dueAt && Date.parse(r.dueAt) < Date.now() ? 'border-red-700 bg-red-50' : ''">
                  <button @click="toggleReminder(r.id)" class="shrink-0" :aria-label="r.done ? 'Marcar pendiente' : 'Marcar completado'">
                    <ui-icon :name="r.done ? 'check-circle' : 'check'" class="h-4 w-4"
                      :class="r.done ? 'text-emerald-700' : 'text-neutral-300'"></ui-icon>
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs" :class="r.done ? 'line-through' : ''">{{ r.text }}</p>
                    <p v-if="r.dueAt" class="font-mono text-[9px] uppercase"
                      :class="!r.done && Date.parse(r.dueAt) < Date.now() ? 'text-red-700' : 'text-neutral-400'">
                      {{ new Date(r.dueAt).toLocaleString('es-VE') }}
                    </p>
                  </div>
                  <button @click="removeReminder(r.id)" class="shrink-0 p-1 text-neutral-400 hover:text-red-700" aria-label="Eliminar recordatorio">
                    <ui-icon name="trash" class="h-3.5 w-3.5"></ui-icon>
                  </button>
                </div>
                <p v-if="remindersOf(detailContact.id).length === 0" class="text-xs text-neutral-400">Sin recordatorios.</p>
              </div>
              <div class="mt-2 flex gap-2">
                <input v-model.trim="remInput.text" type="text" placeholder="Ej: llamar para confirmar pedido" @keydown.enter="addReminderFor(detailContact)"
                  class="min-w-0 flex-1 border-2 border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-neutral-900" />
                <input v-model="remInput.dueAt" type="datetime-local"
                  class="shrink-0 border-2 border-neutral-300 px-2 py-2 text-xs outline-none focus:border-neutral-900" />
                <button @click="addReminderFor(detailContact)" :disabled="!remInput.text.trim()"
                  class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  Agregar
                </button>
              </div>
            </div>

            <!-- Historial de etapas del lead (desde el momento 0) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de etapas</p>
              <div class="mb-3 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
                <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa actual</span>
                <ui-badge variant="accent" dot>{{ stageLabel(detailContact.leadTag) }}</ui-badge>
              </div>
              <ol v-if="historyOf(detailContact).length" class="relative ml-1.5 space-y-2.5 border-l border-neutral-200 pl-4">
                <li v-for="(h, i) in historyOf(detailContact)" :key="h.at + '-' + i" class="relative">
                  <span class="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-white"
                    :class="i === 0 ? 'bg-[var(--accent)]' : ''"></span>
                  <p class="text-xs">
                    <span class="font-semibold">{{ stageLabel(h.tag) }}</span>
                    <span v-if="historyOf(detailContact)[i + 1]" class="ml-1 font-mono text-[9px] uppercase text-neutral-400">← desde {{ stageLabel(historyOf(detailContact)[i + 1].tag) }}</span>
                    <span class="ml-1 font-mono text-[9px] uppercase text-neutral-400">{{ new Date(h.at).toLocaleString('es-VE') }}</span>
                  </p>
                  <p v-if="h.note" class="mt-0.5 text-[11px] text-neutral-500">{{ h.note }}</p>
                  <p v-else-if="h.reason" class="mt-0.5 text-[11px] text-neutral-500">motivo: {{ h.reason }}</p>
                  <p v-else-if="h.prev && h.prev.outcome" class="mt-0.5 text-[11px] text-neutral-500">antes: {{ stageLabel('finalizada:' + h.prev.outcome) }}</p>
                </li>
              </ol>
              <p v-else class="text-xs text-neutral-400">Sin cambios de etapa registrados.</p>
            </div>

            <!-- Cierre del lead -->
            <div class="border border-neutral-200 p-3">
              <template v-if="detailContact.leadClosed">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="font-semibold" :class="detailContact.leadClosed.outcome === 'ganada' ? 'text-emerald-700' : 'text-red-700'">
                      Lead cerrado · {{ closeLabel(detailContact.leadClosed.outcome) }}
                    </p>
                    <p class="font-mono text-[10px] text-neutral-400">{{ new Date(detailContact.leadClosed.at).toLocaleString('es-VE') }}</p>
                    <p v-if="detailContact.leadClosed.reason" class="mt-1 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                      {{ detailContact.leadClosed.reason }}
                    </p>
                    <p v-if="detailContact.leadClosed.note" class="mt-1 text-xs text-neutral-600">{{ detailContact.leadClosed.note }}</p>
                  </div>
                  <button @click="reopenLead(detailContact)" class="shrink-0 border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition hover:border-neutral-900">
                    Reabrir lead
                  </button>
                </div>
              </template>
              <template v-else>
                <p class="text-xs text-neutral-500">¿Terminaste el seguimiento de este lead?</p>
                <button v-if="canEdit('leads')" @click="openCloseModal(detailContact)"
                  class="mt-2 w-full border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Cerrar lead
                </button>
              </template>
            </div>

            <!-- Etiquetas del contacto -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas</p>
              <div class="flex flex-wrap gap-1">
                <ui-badge v-for="t in detailContact.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                <span v-if="!detailContact.tags || detailContact.tags.length === 0" class="text-xs text-neutral-400">Sin etiquetas</span>
              </div>
            </div>

            <!-- Conversaciones recientes (click = abrir en la bandeja) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conversaciones</p>
              <ul class="space-y-2">
                <li v-for="c in metricsOf(detailContact).convs.slice(-6).reverse()" :key="c.id">
                  <button @click="openConversation(c)"
                    class="w-full border border-neutral-200 p-2.5 text-left transition hover:border-neutral-900 hover:bg-stone-50">
                    <div class="flex items-center justify-between">
                      <span class="flex items-center gap-1.5 text-xs font-semibold">
                        <ui-icon :name="(getPlatform(c.platform || 'whatsapp') || {}).icon" class="h-3.5 w-3.5"></ui-icon>
                        {{ (getPlatform(c.platform || 'whatsapp') || {}).nombre }}
                      </span>
                      <span class="font-mono text-[9px] uppercase text-neutral-400">{{ timeAgo(c.lastTs) }}</span>
                    </div>
                    <p class="mt-1 truncate text-xs text-neutral-600">
                      {{ c.messages && c.messages.length ? c.messages[c.messages.length - 1].text : 'Sin mensajes' }}
                    </p>
                  </button>
                </li>
                <li v-if="metricsOf(detailContact).convs.length === 0" class="text-xs text-neutral-400">Sin conversaciones registradas.</li>
              </ul>
            </div>
          </div>
        </ui-drawer>

        <!-- Drawer: próximos recordatorios (todas las leads) -->
        <ui-drawer :open="remPanelOpen" title="Recordatorios próximos" width="max-w-md" @close="remPanelOpen = false">
          <div class="space-y-2">
            <div v-for="r in upcomingReminders" :key="r.id">
              <button v-if="r.contact" @click="remPanelOpen = false; openDetail(r.contact)"
                class="w-full border border-neutral-200 p-3 text-left transition hover:border-neutral-900 hover:bg-stone-50"
                :class="r.dueAt && Date.parse(r.dueAt) < Date.now() ? 'border-red-700 bg-red-50' : ''">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-semibold">{{ r.contact ? r.contact.name : 'Contacto' }}</span>
                  <span v-if="r.dueAt" class="shrink-0 font-mono text-[9px] uppercase"
                    :class="Date.parse(r.dueAt) < Date.now() ? 'text-red-700' : 'text-neutral-400'">
                    {{ new Date(r.dueAt).toLocaleString('es-VE') }}
                  </span>
                </div>
                <p class="mt-1 text-xs text-neutral-600">{{ r.text }}</p>
              </button>
            </div>
            <p v-if="upcomingReminders.length === 0" class="py-8 text-center text-sm text-neutral-400">Sin recordatorios pendientes.</p>
          </div>
        </ui-drawer>

        <!-- Modal: cerrar lead -->
        <ui-modal :open="closeOpen" :title="'Cerrar lead · ' + (closeTarget ? closeTarget.name : '')" width="max-w-md" @close="closeOpen = false">
          <div class="space-y-4">
            <p class="text-sm text-neutral-500">
              Da por terminado el seguimiento de este lead. Puedes reabrirlo cuando quieras.
            </p>

            <!-- Resumen del lead -->
            <div v-if="closeTarget" class="flex items-center gap-3 border border-neutral-200 bg-stone-50 p-3">
              <ui-avatar :name="closeTarget.name" size="h-10 w-10 text-sm"></ui-avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ closeTarget.name }}</p>
                <p class="truncate font-mono text-[11px] text-neutral-500">
                  Etapa: {{ stageLabel(closeTarget.leadTag) }}
                  <span v-if="closeTarget.createdAt"> · Cliente desde {{ new Date(closeTarget.createdAt).toLocaleDateString('es-VE') }}</span>
                </p>
              </div>
              <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ metricsOf(closeTarget).days }} días</span>
            </div>

            <ui-field label="¿Se concretó?">
              <div class="flex gap-1.5">
                <button @click="closeForm.outcome = 'ganada'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                  :class="closeForm.outcome === 'ganada' ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-neutral-300'">
                  Sí, se concretó
                </button>
                <button @click="closeForm.outcome = 'perdida'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                  :class="closeForm.outcome === 'perdida' ? 'border-red-800 bg-red-50 text-red-900' : 'border-neutral-300'">
                  No se concretó
                </button>
              </div>
            </ui-field>

            <ui-field label="Motivo (opcional)">
              <div class="flex flex-wrap gap-1.5">
                <button v-for="r in CLOSE_REASONS" :key="r" @click="closeForm.reason = closeForm.reason === r ? '' : r"
                  class="border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="closeForm.reason === r ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ r }}
                </button>
              </div>
            </ui-field>

            <ui-field label="Nota (opcional)">
              <textarea v-model.trim="closeForm.note" rows="3" placeholder="Cuéntanos cómo fue el cierre…"
                class="w-full resize-none border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"></textarea>
            </ui-field>
            <button @click="confirmClose"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Confirmar cierre
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
