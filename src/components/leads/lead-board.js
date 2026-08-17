/**
 * @file lead-board.js — BC Board + Card del tablero de leads.
 * Componentes presentacionales puros: reciben props (incl. funciones
 * derivadas y handlers) y renderizan. Sin estado propio, sin tocar el store.
 * Registrados en window.ZernioCrm.components (app.js los monta).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  /** Tarjeta de lead activa (BC Card). Verbatim del bloque original. */
  components['lead-card'] = {
    props: {
      contact: { type: Object, required: true },
      canEdit: Function, metricsOf: Function, lastMessageOf: Function,
      pendingReminders: Function, hasOverdue: Function, interestScore: Function,
      timeAgo: Function, getPlatform: Function,
      openDetail: Function, openClose: Function, moveContact: Function,
      onDragStart: Function, onDragEnd: Function,
    },
    template: `
      <article draggable="true" @dragstart="onDragStart($event, contact)" @dragend="onDragEnd" @click="openDetail(contact)"
        class="cursor-grab border-2 border-neutral-900 bg-white p-4 shadow-brutal-sm transition hover:-translate-y-0.5 active:cursor-grabbing">
        <!-- Encabezado: avatar + nombre + canal -->
        <div class="flex items-center gap-3">
          <ui-avatar :name="contact.name" size="h-10 w-10 text-sm"></ui-avatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ contact.name }}</p>
            <p class="truncate font-mono text-[10px] text-neutral-400">{{ contact.phone || 'sin teléfono' }}</p>
          </div>
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" :class="(getPlatform(contact.platform || 'whatsapp') || {}).tone">
            <ui-icon :name="(getPlatform(contact.platform || 'whatsapp') || {}).icon" class="h-3.5 w-3.5"></ui-icon>
          </span>
        </div>

        <!-- Chips de relación -->
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          <ui-badge v-if="metricsOf(contact).vip" variant="warn" dot>VIP</ui-badge>
          <ui-badge v-if="metricsOf(contact).frecuente" variant="success" dot>Frecuente</ui-badge>
          <ui-badge variant="neutral">{{ metricsOf(contact).totalMsgs }} msgs</ui-badge>
          <span v-if="pendingReminders(contact).length" class="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider"
            :class="hasOverdue(contact) ? 'text-red-700' : 'text-neutral-500'">
            <ui-icon name="clock" class="h-3 w-3"></ui-icon>
            {{ pendingReminders(contact).length }} pend.
          </span>
          <span v-if="interestScore(contact).products.length" class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ interestScore(contact).products.length }} producto(s)</span>
        </div>

        <!-- Último mensaje -->
        <p v-if="lastMessageOf(contact)" class="mt-3 line-clamp-2 border-t border-neutral-100 pt-2.5 text-xs leading-relaxed text-neutral-500">
          {{ lastMessageOf(contact).text }}
        </p>

        <!-- Footer: fecha + acciones -->
        <div class="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5">
          <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
            {{ lastMessageOf(contact) ? timeAgo(lastMessageOf(contact).ts) : 'sin actividad' }}
          </span>
          <div class="flex gap-1">
            <button v-if="canEdit('leads')" @click.stop="openClose(contact)" class="p-1.5 text-neutral-400 transition hover:text-red-700" aria-label="Cerrar lead">
              <ui-icon name="check-circle" class="h-4 w-4"></ui-icon>
            </button>
            <button @click.stop="moveContact(contact, -1)" class="p-1.5 text-neutral-400 transition hover:text-neutral-900" aria-label="Mover atrás">
              <ui-icon name="chevron-left" class="h-4 w-4"></ui-icon>
            </button>
            <button @click.stop="moveContact(contact, 1)" class="p-1.5 text-neutral-400 transition hover:text-neutral-900" aria-label="Mover adelante">
              <ui-icon name="chevron-right" class="h-4 w-4"></ui-icon>
            </button>
          </div>
        </div>
      </article>`,
  };

  /** Tarjeta de lead finalizada (BC Card). */
  components['lead-card-closed'] = {
    props: {
      contact: { type: Object, required: true },
      closeLabel: Function, productName: Function, fmtD: Function,
      openDetail: Function, reopen: Function,
    },
    template: `
      <article @click="openDetail(contact)"
        class="cursor-pointer border-2 border-neutral-900 bg-white p-4 shadow-brutal-sm transition hover:-translate-y-0.5">
        <!-- Encabezado: avatar + nombre + resultado -->
        <div class="flex items-center gap-3">
          <ui-avatar :name="contact.name" size="h-10 w-10 text-sm"></ui-avatar>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ contact.name }}</p>
            <p class="truncate font-mono text-[10px] text-neutral-400">{{ contact.phone || 'sin teléfono' }}</p>
          </div>
          <ui-badge :variant="contact.leadClosed.outcome === 'ganada' ? 'success' : 'danger'" dot class="shrink-0">
            Cerrada · {{ closeLabel(contact.leadClosed.outcome) }}
          </ui-badge>
        </div>
        <div v-if="(contact.leadClosed.products || []).length" class="mt-3 flex flex-wrap gap-1.5">
          <span v-for="pid in contact.leadClosed.products" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            {{ productName(pid) }}
          </span>
        </div>
        <p v-if="contact.leadClosed.reason" class="mt-2 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ contact.leadClosed.reason }}</p>
        <p v-if="contact.leadClosed.note" class="mt-3 border-t border-neutral-100 pt-2.5 text-xs leading-relaxed text-neutral-600">{{ contact.leadClosed.note }}</p>
        <div class="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5">
          <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">
            {{ contact.leadClosed.at ? fmtD(contact.leadClosed.at) : '' }}
          </span>
          <button @click.stop="reopen(contact)" class="border border-neutral-300 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">
            Reabrir
          </button>
        </div>
      </article>`,
  };

  /** Columna del kanban (BC Board): header + cada lead-card + zona de drop. */
  components['lead-column'] = {
    props: {
      column: { type: Object, required: true }, cards: { type: Array, required: true },
      canEdit: Function, metricsOf: Function, lastMessageOf: Function,
      pendingReminders: Function, hasOverdue: Function, interestScore: Function,
      timeAgo: Function, getPlatform: Function,
      openDetail: Function, openClose: Function, moveContact: Function,
      onDragStart: Function, onDragEnd: Function, onDragOver: Function, onDrop: Function,
    },
    template: `
      <section class="flex min-h-[420px] w-64 shrink-0 flex-col border-2 border-neutral-900 bg-stone-50"
        @dragover="onDragOver" @drop="onDrop(column)">
        <header class="flex items-center justify-between border-b-2 border-neutral-900 bg-white px-3 py-2.5">
          <h3 class="truncate font-mono text-[11px] font-semibold uppercase tracking-widest">{{ column.nombre }}</h3>
          <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[10px] font-bold text-white tabular-nums">
            {{ cards.length }}
          </span>
        </header>
        <div class="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-2.5">
          <lead-card v-for="c in cards" :key="c.id" :contact="c"
            :can-edit="canEdit" :metrics-of="metricsOf" :last-message-of="lastMessageOf"
            :pending-reminders="pendingReminders" :has-overdue="hasOverdue" :interest-score="interestScore"
            :time-ago="timeAgo" :get-platform="getPlatform"
            :open-detail="openDetail" :open-close="openClose" :move-contact="moveContact"
            :on-drag-start="onDragStart" :on-drag-end="onDragEnd"></lead-card>
          <p v-if="cards.length === 0" class="py-8 text-center text-xs text-neutral-400">Sin clientes en esta etapa</p>
        </div>
      </section>`,
  };

  /** Tablero completo: tabs activas/finalizadas + kanban o grid de finalizadas. */
  components['lead-board'] = {
    props: {
      viewTab: String, columns: Array, activeContacts: Array, closedContacts: Array,
      cardsOf: Function, metricsOf: Function, lastMessageOf: Function,
      pendingReminders: Function, hasOverdue: Function, interestScore: Function,
      closeLabel: Function, productName: Function, fmtD: Function, timeAgo: Function,
      getPlatform: Function, canEdit: Function,
      openDetail: Function, openClose: Function, moveContact: Function, reopen: Function,
      setViewTab: Function, onDragStart: Function, onDragEnd: Function,
      onDragOver: Function, onDrop: Function,
    },
    template: `
      <div>
        <!-- Tabs: activas / finalizadas -->
        <div class="flex gap-1.5 border-b-2 border-neutral-900">
          <button @click="setViewTab('activas')"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="viewTab === 'activas' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            Activas ({{ activeContacts.length }})
          </button>
          <button @click="setViewTab('finalizadas')"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="viewTab === 'finalizadas' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            Finalizadas ({{ closedContacts.length }})
          </button>
        </div>

        <!-- Kanban: leads activas -->
        <div v-if="viewTab === 'activas'" class="flex gap-4 overflow-x-auto pb-4">
          <lead-column v-for="col in columns" :key="col.id"
            :column="col" :cards="cardsOf(col)"
            :can-edit="canEdit" :metrics-of="metricsOf" :last-message-of="lastMessageOf"
            :pending-reminders="pendingReminders" :has-overdue="hasOverdue" :interest-score="interestScore"
            :time-ago="timeAgo" :get-platform="getPlatform"
            :open-detail="openDetail" :open-close="openClose" :move-contact="moveContact"
            :on-drag-start="onDragStart" :on-drag-end="onDragEnd"
            :on-drag-over="onDragOver" :on-drop="onDrop"></lead-column>
        </div>

        <!-- Finalizadas: tarjetas con resultado -->
        <div v-else>
          <div v-if="closedContacts.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
            <p class="px-6 py-10 text-center text-sm text-neutral-400">Aún no hay leads finalizadas.</p>
          </div>
          <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <lead-card-closed v-for="c in closedContacts" :key="c.id"
              :contact="c" :close-label="closeLabel" :product-name="productName"
              :fmt-d="fmtD" :open-detail="openDetail" :reopen="reopen"></lead-card-closed>
          </div>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();