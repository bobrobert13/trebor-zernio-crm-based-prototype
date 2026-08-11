/**
 * @file leads.js — Tablero Kanban de leads: columnas = etapas del pipeline
 * (workspace.leadTags, configurables) + "Sin asignar". Cada tarjeta es un
 * contacto con métricas de relación (VIP, frecuencia, canales) y un drawer
 * de detalle profundo. Drag & drop nativo HTML5 + botones de respaldo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, timeAgo, getPlatform, canEdit, getNiche } = ZernioCrm;

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

      /** Contactos de una columna. */
      function cardsOf(col) {
        return contacts.value.filter((c) => {
          if (col.id === '__sin_asignar__') return !c.leadTag || !leadTags.value.includes(c.leadTag);
          return c.leadTag === col.id;
        });
      }

      // ── Drag & drop nativo HTML5 + botones ─────────────────────────────────
      const dragContactId = Vue.ref(null);

      function onDragStart(contact) {
        if (!canEdit('leads')) return;
        dragContactId.value = contact.id;
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
        contact.leadTag = col.id === '__sin_asignar__' ? null : col.id;
        toast(`Lead movido a "${col.nombre}"`, 'success');
      }

      /** Mueve un contacto a la columna anterior/siguiente (respaldo accesible). */
      function moveContact(contact, dir) {
        if (!canEdit('leads')) return;
        const idx = columns.value.findIndex((c) => (contact.leadTag && leadTags.value.includes(contact.leadTag) ? c.id === contact.leadTag : c.id === '__sin_asignar__'));
        const next = columns.value[idx + dir];
        if (!next) return;
        contact.leadTag = next.id === '__sin_asignar__' ? null : next.id;
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

      return {
        workspace, isLive, leadTags, columns, cardsOf, metricsOf, lastMessageOf,
        dragContactId, onDragStart, onDragOver, onDrop, moveContact,
        detailOpen, detailContact, openDetail, channelBars,
        getPlatform, timeAgo, canEdit,
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

        <!-- Kanban -->
        <div class="flex gap-4 overflow-x-auto pb-4">
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
                @dragstart="onDragStart(c)" @click="openDetail(c)"
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
                </div>
                <p v-if="lastMessageOf(c)" class="mt-2 truncate border-t border-neutral-100 pt-2 text-xs text-neutral-500">
                  {{ lastMessageOf(c).text }}
                </p>
                <div class="mt-1.5 flex items-center justify-between">
                  <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                    {{ lastMessageOf(c) ? timeAgo(lastMessageOf(c).ts) : 'sin actividad' }}
                  </span>
                  <div class="flex gap-0.5">
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

        <!-- Drawer: detalle profundo del lead -->
        <ui-drawer :open="detailOpen" :title="'Lead · ' + (detailContact ? detailContact.name : '')" @close="detailOpen = false">
          <div v-if="detailContact" class="space-y-5">
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

            <!-- Etiquetas del contacto -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas</p>
              <div class="flex flex-wrap gap-1">
                <ui-badge v-for="t in detailContact.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                <span v-if="!detailContact.tags || detailContact.tags.length === 0" class="text-xs text-neutral-400">Sin etiquetas</span>
              </div>
            </div>

            <!-- Conversaciones recientes -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conversaciones recientes</p>
              <ul class="space-y-2">
                <li v-for="c in metricsOf(detailContact).convs.slice(-3).reverse()" :key="c.id" class="border border-neutral-200 p-2.5">
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
                </li>
                <li v-if="metricsOf(detailContact).convs.length === 0" class="text-xs text-neutral-400">Sin conversaciones registradas.</li>
              </ul>
            </div>
          </div>
        </ui-drawer>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
