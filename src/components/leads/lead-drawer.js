/**
 * @file lead-drawer.js — BC Detail del tablero de leads.
 * Drawer de detalle del contacto con pestañas perfil/actividades. Recibe el
 * contacto activo, la pestaña y las funciones derivadas por props; emite
 * eventos de salida (close/tab/open-close/reopen/open-conversation).
 * Verbatim del bloque original (refs `detailContact`→`contact`, `detailTab`→`tab`).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['lead-drawer'] = {
    props: {
      open: Boolean, contact: { type: Object, default: null }, tab: { type: String, default: 'perfil' },
      setTab: Function, metricsOf: Function, channelBars: Function, historyOf: Function,
      stageLabel: Function, remindersOf: Function, toggleReminder: Function, removeReminder: Function,
      addReminderFor: Function, remInput: { type: Object, default: null },
      fmtD: Function, fmtDT: Function, getPlatform: Function, timeAgo: Function,
      interestScore: Function, formatPrice: Function, INTENT_LABELS: { type: Object, default: () => ({}) },
      closeLabel: Function, productName: Function,
      openConversation: Function, openClose: Function, reopen: Function, canEdit: Function,
    },
    emits: ['close', 'open-close', 'reopen'],
    template: `
      <ui-drawer :open="open" width="max-w-xl" :title="'Lead · ' + (contact ? contact.name : '')" @close="$emit('close')">
        <div v-if="contact" :key="contact.id" class="space-y-5">
          <div class="flex items-center gap-3">
            <ui-avatar :name="contact.name" size="h-12 w-12 text-base"></ui-avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ contact.name }}</p>
              <p class="truncate font-mono text-xs text-neutral-500">{{ contact.phone || 'sin teléfono' }}</p>
            </div>
            <div class="flex gap-1">
              <ui-badge v-if="metricsOf(contact).vip" variant="warn" dot>VIP</ui-badge>
              <ui-badge v-if="metricsOf(contact).frecuente" variant="success" dot>Frecuente</ui-badge>
            </div>
          </div>

          <!-- Pestañas del drawer -->
          <div class="flex border-b-2 border-neutral-900">
            <button @click="setTab('perfil')" class="flex-1 border-r-2 border-neutral-900 px-3 py-2 text-sm font-semibold transition"
              :class="tab === 'perfil' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Perfil</button>
            <button @click="setTab('actividades')" class="flex-1 px-3 py-2 text-sm font-semibold transition"
              :class="tab === 'actividades' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Actividades</button>
          </div>

          <!-- Métricas de relación (Actividades) -->
          <div v-if="tab === 'actividades'" class="grid grid-cols-2 gap-3">
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cliente desde</p>
              <p class="mt-0.5 text-sm font-semibold">{{ contact.createdAt ? fmtD(contact.createdAt) : '—' }}</p>
              <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(contact).days }} días en el CRM</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes totales</p>
              <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ metricsOf(contact).totalMsgs }}</p>
              <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(contact).freqPerDay.toFixed(1) }} por día</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Promedio semanal</p>
              <p class="mt-0.5 text-sm font-semibold tabular-nums">{{ (metricsOf(contact).freqPerDay * 7).toFixed(1) }} msgs/sem</p>
              <p class="font-mono text-[10px] text-neutral-400">ritmo de comunicación</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canal principal</p>
              <p class="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
                <ui-icon :name="(getPlatform(metricsOf(contact).topChannel[0]) || {}).icon" class="h-4 w-4"></ui-icon>
                {{ (getPlatform(metricsOf(contact).topChannel[0]) || {}).nombre }}
              </p>
              <p class="font-mono text-[10px] text-neutral-400">{{ metricsOf(contact).topChannel[1] }} mensajes</p>
            </div>
          </div>

          <!-- Canales más frecuentes (Actividades) -->
          <div v-if="tab === 'actividades'">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Canales más frecuentes</p>
            <div class="space-y-1.5">
              <div v-for="ch in channelBars(metricsOf(contact))" :key="ch.platform" class="flex items-center gap-2">
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

          <!-- Recordatorios del lead (Perfil) -->
          <div v-if="tab === 'perfil'">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Recordatorios</p>
            <div class="space-y-1.5">
              <div v-for="r in remindersOf(contact.id)" :key="r.id"
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
                    {{ fmtDT(r.dueAt) }}
                  </p>
                </div>
                <button @click="removeReminder(r.id)" class="shrink-0 p-1 text-neutral-400 hover:text-red-700" aria-label="Eliminar recordatorio">
                  <ui-icon name="trash" class="h-3.5 w-3.5"></ui-icon>
                </button>
              </div>
              <p v-if="remindersOf(contact.id).length === 0" class="text-xs text-neutral-400">Sin recordatorios.</p>
            </div>
            <div class="mt-2 flex gap-2">
              <input v-model.trim="remInput.text" type="text" placeholder="Ej: llamar para confirmar pedido" @keydown.enter="addReminderFor(contact)"
                class="min-w-0 flex-1 border-2 border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-neutral-900" />
              <input v-model="remInput.dueAt" type="datetime-local"
                class="shrink-0 border-2 border-neutral-300 px-2 py-2 text-xs outline-none focus:border-neutral-900" />
              <button @click="addReminderFor(contact)" :disabled="!remInput.text.trim()"
                class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                Agregar
              </button>
            </div>
          </div>

          <!-- Historial de etapas del lead (Perfil) -->
          <div v-if="tab === 'perfil'">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de etapas</p>
            <div class="mb-3 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa actual</span>
              <ui-badge variant="accent" dot>{{ stageLabel(contact.leadTag) }}</ui-badge>
            </div>
            <ol v-if="historyOf(contact).length" class="relative ml-1.5 space-y-2.5 border-l border-neutral-200 pl-4">
              <li v-for="(h, i) in historyOf(contact)" :key="h.at + '-' + i" class="relative">
                <span class="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-white"
                  :class="i === 0 ? 'bg-[var(--accent)]' : ''"></span>
                <p class="text-xs">
                  <span class="font-semibold">{{ stageLabel(h.tag) }}</span>
                  <span v-if="historyOf(contact)[i + 1]" class="ml-1 font-mono text-[9px] uppercase text-neutral-400">← desde {{ stageLabel(historyOf(contact)[i + 1].tag) }}</span>
                  <span class="ml-1 font-mono text-[9px] uppercase text-neutral-400">{{ fmtDT(h.at) }}</span>
                </p>
                <p v-if="h.note" class="mt-0.5 text-[11px] text-neutral-500">{{ h.note }}</p>
                <p v-if="h.reason" class="mt-0.5 text-[11px] text-neutral-500">motivo: {{ h.reason }}</p>
                <p v-else-if="h.prev && h.prev.outcome" class="mt-0.5 text-[11px] text-neutral-500">antes: {{ stageLabel('finalizada:' + h.prev.outcome) }}</p>
              </li>
            </ol>
            <p v-else class="text-xs text-neutral-400">Sin cambios de etapa registrados.</p>
          </div>

          <!-- Cierre del lead (Perfil) -->
          <div v-if="tab === 'perfil'" class="border border-neutral-200 p-3">
            <template v-if="contact.leadClosed">
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="font-semibold" :class="contact.leadClosed.outcome === 'ganada' ? 'text-emerald-700' : 'text-red-700'">
                    Lead cerrado · {{ closeLabel(contact.leadClosed.outcome) }}
                  </p>
                  <p class="font-mono text-[10px] text-neutral-400">{{ fmtDT(contact.leadClosed.at) }}</p>
                  <div v-if="(contact.leadClosed.products || []).length" class="mt-1 flex flex-wrap gap-1">
                    <span v-for="pid in contact.leadClosed.products" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                      {{ productName(pid) }}
                    </span>
                  </div>
                  <p v-if="contact.leadClosed.reason" class="mt-1 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                    {{ contact.leadClosed.reason }}
                  </p>
                  <p v-if="contact.leadClosed.note" class="mt-1 text-xs text-neutral-600">{{ contact.leadClosed.note }}</p>
                </div>
                <button @click="reopen(contact)" class="shrink-0 border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition hover:border-neutral-900">
                  Reabrir lead
                </button>
              </div>
            </template>
            <template v-else>
              <p class="text-xs text-neutral-500">¿Terminaste el seguimiento de este lead?</p>
              <button v-if="canEdit('leads')" @click="openClose(contact)"
                class="mt-2 w-full border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Cerrar lead
              </button>
            </template>
          </div>

          <!-- Etiquetas del contacto (Perfil) -->
          <div v-if="tab === 'perfil'">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas</p>
            <div class="flex flex-wrap gap-1">
              <ui-badge v-for="t in contact.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
              <span v-if="!contact.tags || contact.tags.length === 0" class="text-xs text-neutral-400">Sin etiquetas</span>
            </div>
          </div>

          <!-- Interés comercial (Perfil) -->
          <div v-if="tab === 'perfil' && interestScore(contact).nivel">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Interés comercial</p>
            <div class="mb-2 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <ui-icon name="flame" class="h-4 w-4" :class="interestScore(contact).nivel === 'alto' ? 'text-red-700' : interestScore(contact).nivel === 'medio' ? 'text-amber-600' : 'text-neutral-500'"></ui-icon>
              <span class="text-sm font-semibold">{{ interestScore(contact).label }}</span>
              <span class="ml-auto font-mono text-[11px] font-bold tabular-nums text-neutral-600">{{ formatPrice(interestScore(contact).value) }} estimado</span>
            </div>
            <ul v-if="interestScore(contact).perProduct.length" class="mb-2 space-y-1.5">
              <li v-for="x in interestScore(contact).perProduct" :key="x.product.id" class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                <span class="min-w-0 flex-1 truncate font-medium">{{ x.product.name }}</span>
                <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(x.product.price) }}</span>
                <ui-badge :variant="x.product.stock === false ? 'danger' : 'success'" dot>{{ x.product.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
                <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[x.intent] || x.intent }}</span>
              </li>
            </ul>
            <div v-if="interestScore(contact).factors.length" class="flex flex-wrap gap-1">
              <span v-for="f in interestScore(contact).factors" :key="f.id" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ f.label }}</span>
            </div>
          </div>

          <!-- Productos de interés (Actividades) -->
          <div v-if="tab === 'actividades' && interestScore(contact).perProduct.length">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos de interés</p>
            <ul class="space-y-1.5">
              <li v-for="x in interestScore(contact).perProduct" :key="x.product.id" class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                <span class="min-w-0 flex-1 truncate font-medium">{{ x.product.name }}</span>
                <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(x.product.price) }}</span>
                <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[x.intent] || x.intent }}</span>
                <ui-badge variant="neutral">{{ x.count }}x</ui-badge>
              </li>
            </ul>
          </div>

          <!-- Conversaciones recientes (Actividades) -->
          <div v-if="tab === 'actividades'">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conversaciones</p>
            <ul class="space-y-2">
              <li v-for="c in metricsOf(contact).convs.slice(-6).reverse()" :key="c.id">
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
              <li v-if="metricsOf(contact).convs.length === 0" class="text-xs text-neutral-400">Sin conversaciones registradas.</li>
            </ul>
          </div>
        </div>
      </ui-drawer>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();