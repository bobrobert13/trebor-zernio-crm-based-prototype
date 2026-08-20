/**
 * @file inbox-contact-drawer.js — BC ContactDrawer de la bandeja unificada:
 * ficha del cliente (etapas, historial, cierre, campos, productos de interés,
 * recordatorios) y actividades (estadísticas e historial de conversaciones).
 * Presentacional puro: estado por props, cambios por eventos y handlers.
 * Verbatim del bloque `<ui-drawer>` original (refs → props/emits).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['inbox-contact-drawer'] = {
    props: {
      open: Boolean, tab: String,
      selected: { type: Object, default: null }, selectedContact: { type: Object, default: null },
      contactTags: Array, leadTags: Array, bizFields: Array, niche: { type: Object, default: null },
      contactProductMentions: Function, productOf: Function, INTENT_LABELS: { type: Object, default: () => ({}) },
      historyOf: Function, stageLabel: Function, closeLabel: Function, productNameOf: Function,
      fmtD: Function, fmtDT: Function, formatDate: Function, timeAgo: Function, getPlatform: Function,
      canEdit: Function, lastMessage: Function, contactConvs: Array,
      contactStats: { type: Object, default: null }, contactReminders: Function,
      convRange: Function, remInput: { type: Object, default: null }, selectedId: String,
      toggleContactTag: Function, setLeadTag: Function, registerContact: Function,
      selectConversation: Function, openCloseModal: Function, reopenLead: Function,
      attachCard: Function, openTemplatePicker: Function, confirmMention: Function,
      openProductPick: Function, toggleReminder: Function, removeReminder: Function,
      addReminderFor: Function,
    },
    emits: ['close', 'update:tab'],
    template: `
      <ui-drawer :open="open" width="max-w-lg" :title="'Ficha · ' + (selectedContact ? selectedContact.name : 'Sin ficha')" @close="$emit('close')">
        <div v-if="selected" class="space-y-5">
          <!-- Pestañas del drawer -->
          <div class="flex border-b-2 border-neutral-900">
            <button @click="$emit('update:tab', 'ficha')" class="flex-1 border-r-2 border-neutral-900 px-3 py-2 text-sm font-semibold transition"
              :class="tab === 'ficha' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Ficha</button>
            <button @click="$emit('update:tab', 'actividades')" class="flex-1 px-3 py-2 text-sm font-semibold transition"
              :class="tab === 'actividades' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Actividades</button>
          </div>
          <template v-if="tab === 'ficha'">
            <template v-if="selectedContact">
            <div class="flex items-center gap-3">
              <ui-avatar :name="selectedContact.name" size="h-12 w-12 text-base"></ui-avatar>
              <div class="min-w-0 flex-1">
                <input :value="selectedContact.name" @change="selectedContact.name = $event.target.value; selectedContact.nameSource = 'manual'"
                  class="w-full border-b border-transparent bg-transparent font-semibold outline-none focus:border-neutral-900" />
                <input :value="selectedContact.phone" @change="selectedContact.phone = $event.target.value"
                  class="w-full border-b border-transparent bg-transparent font-mono text-xs text-neutral-500 outline-none focus:border-neutral-900" />
              </div>
            </div>
            <p class="text-xs text-neutral-400">Cliente desde {{ selectedContact.createdAt ? fmtD(selectedContact.createdAt) : '—' }}</p>

            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas de contacto</p>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="t in contactTags" :key="t" @click="toggleContactTag(t)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="selectedContact.tags.includes(t) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ t }}
                </button>
              </div>
            </div>

            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etapa del lead</p>
              <select :value="selectedContact.leadTag || ''" @change="setLeadTag($event.target.value)"
                class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                <option value="">Sin asignar</option>
                <option v-for="t in leadTags" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>

            <!-- Historial de etapas del lead (desde el momento 0) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de etapas</p>
              <div class="mb-3 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
                <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa actual</span>
                <ui-badge variant="accent" dot>{{ stageLabel(selectedContact.leadTag) }}</ui-badge>
              </div>
              <ol v-if="historyOf(selectedContact).length" class="relative ml-1.5 space-y-2.5 border-l border-neutral-200 pl-4">
                <li v-for="(h, i) in historyOf(selectedContact)" :key="h.at + '-' + i" class="relative">
                  <span class="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-white"
                    :class="i === 0 ? 'bg-[var(--accent)]' : ''"></span>
                  <p class="text-xs">
                    <span class="font-semibold">{{ stageLabel(h.tag) }}</span>
                    <span v-if="historyOf(selectedContact)[i + 1]" class="ml-1 font-mono text-[9px] uppercase text-neutral-400">← desde {{ stageLabel(historyOf(selectedContact)[i + 1].tag) }}</span>
                    <span class="ml-1 font-mono text-[9px] uppercase text-neutral-400">{{ fmtDT(h.at) }}</span>
                  </p>
                  <p v-if="h.note" class="mt-0.5 text-[11px] text-neutral-500">{{ h.note }}</p>
                  <p v-if="h.reason" class="mt-0.5 text-[11px] text-neutral-500">motivo: {{ h.reason }}</p>
                  <p v-else-if="h.prev && h.prev.outcome" class="mt-0.5 text-[11px] text-neutral-500">antes: {{ stageLabel('finalizada:' + h.prev.outcome) }}</p>
                </li>
              </ol>
              <p v-else class="text-xs text-neutral-400">Sin cambios de etapa registrados.</p>
            </div>

            <!-- Cierre del lead desde la conversación -->
            <div class="border border-neutral-200 p-3">
              <template v-if="selectedContact.leadClosed">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="font-semibold" :class="selectedContact.leadClosed.outcome === 'ganada' ? 'text-emerald-700' : 'text-red-700'">
                      Lead cerrado · {{ closeLabel(selectedContact.leadClosed.outcome) }}
                    </p>
                    <p class="font-mono text-[10px] text-neutral-400">{{ fmtDT(selectedContact.leadClosed.at) }}</p>
                    <div v-if="(selectedContact.leadClosed.products || []).length" class="mt-1 flex flex-wrap gap-1">
                      <span v-for="pid in selectedContact.leadClosed.products" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        {{ productNameOf(pid) }}
                      </span>
                    </div>
                    <p v-if="selectedContact.leadClosed.reason" class="mt-1 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                      {{ selectedContact.leadClosed.reason }}
                    </p>
                    <p v-if="selectedContact.leadClosed.note" class="mt-1 text-xs text-neutral-600">{{ selectedContact.leadClosed.note }}</p>
                  </div>
                  <button @click="reopenLead(selectedContact)" class="shrink-0 border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition hover:border-neutral-900">
                    Reabrir lead
                  </button>
                </div>
              </template>
              <template v-else>
                <p class="text-xs text-neutral-500">¿Terminaste el seguimiento de este lead?</p>
                <button v-if="canEdit('leads')" @click="openCloseModal(selectedContact)"
                  class="mt-2 w-full border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Finalizar lead
                </button>
              </template>
            </div>

            <div v-if="bizFields.length">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Campos del negocio · {{ niche.nombre }}</p>
              <div class="space-y-2">
                <ui-field v-for="f in bizFields" :key="f.slug" :label="f.name">
                  <input v-model="selectedContact.customFields[f.slug]" type="text"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
              </div>
            </div>

            <!-- Productos de interés (menciones detectadas o vinculadas) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos de interés</p>
              <ul v-if="contactProductMentions(selectedContact).length" class="space-y-1.5">
                <li v-for="men in contactProductMentions(selectedContact)" :key="men.id"
                  class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium">{{ productOf(men) ? productOf(men).name : '—' }}</span>
                  <span class="shrink-0 font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[men.intent] || men.intent }}</span>
                  <ui-badge :variant="men.status === 'confirmada' ? 'success' : 'warn'" dot class="shrink-0">
                    {{ men.status === 'confirmada' ? 'Confirmada' : 'Pendiente' }}
                  </ui-badge>
                  <button v-if="men.status === 'pendiente'" @click="confirmMention(men.id, men.productId)" class="shrink-0 font-semibold text-emerald-700">
                    Confirmar
                  </button>
                  <button v-if="productOf(men)" @click="attachCard(productOf(men)); $emit('close')" class="shrink-0 font-semibold text-[var(--accent)]">
                    Enviar ficha
                  </button>
                  <button v-if="productOf(men)" @click="$emit('close'); openTemplatePicker(selected)" class="shrink-0 font-semibold text-[var(--accent)]">
                    Responder con plantilla
                  </button>
                </li>
              </ul>
              <p v-else class="text-xs text-neutral-400">Sin productos de interés registrados.</p>
              <button @click="openProductPick(null)" class="mt-2 border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">
                + Vincular producto
              </button>
            </div>

            <!-- Recordatorios del contacto -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Recordatorios</p>
              <div class="space-y-1.5">
                <div v-for="r in contactReminders(selectedContact)" :key="r.id"
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
                <p v-if="contactReminders(selectedContact).length === 0" class="text-xs text-neutral-400">Sin recordatorios.</p>
              </div>
              <div class="mt-2 flex gap-2">
                <input v-model.trim="remInput.text" type="text" placeholder="Ej: llamar para confirmar pedido" @keydown.enter="addReminderFor(selectedContact)"
                  class="min-w-0 flex-1 border-2 border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-neutral-900" />
                <input v-model="remInput.dueAt" type="datetime-local"
                  class="shrink-0 border-2 border-neutral-300 px-2 py-2 text-xs outline-none focus:border-neutral-900" />
                <button @click="addReminderFor(selectedContact)" :disabled="!remInput.text.trim()"
                  class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                  Agregar
                </button>
              </div>
            </div>
            </template>
            <template v-else>
              <p class="text-sm text-neutral-500">Esta conversación no tiene contacto registrado.</p>
              <button @click="registerContact()"
                class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Registrar contacto
              </button>
            </template>
          </template>
          <template v-else-if="tab === 'actividades'">
            <!-- Estadísticas de comunicación del contacto -->
            <div v-if="contactStats" class="grid grid-cols-2 gap-2">
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Conversaciones</p>
                <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactConvs.length }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes recibidos</p>
                <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactStats.totalIn }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes enviados</p>
                <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactStats.totalOut }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Primera actividad</p>
                <p class="mt-0.5 text-xs font-semibold">{{ contactStats.first ? formatDate(contactStats.first) : '—' }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Última actividad</p>
                <p class="mt-0.5 text-xs font-semibold">{{ contactStats.last ? timeAgo(contactStats.last) : '—' }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canales usados</p>
                <p class="mt-0.5 flex flex-wrap gap-1">
                  <span v-for="ch in contactStats.channels" :key="ch[0]" class="flex items-center gap-1 border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                    <ui-icon :name="(getPlatform(ch[0]) || {}).icon" class="h-3 w-3"></ui-icon>
                    {{ (getPlatform(ch[0]) || {}).nombre }} · {{ ch[1] }}
                  </span>
                </p>
              </div>
            </div>

            <!-- Historial detallado del contacto (click = abrir esa conversación) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de conversaciones</p>
              <ul class="space-y-2">
                <li v-for="c in contactConvs" :key="c.id">
                  <button @click="selectConversation(c); $emit('close')"
                    class="w-full border p-3 text-left transition hover:border-neutral-900 hover:bg-stone-50"
                    :class="c.id === selectedId ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200'">
                    <div class="flex items-center justify-between gap-2">
                      <span class="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                        <ui-icon :name="(getPlatform(c.platform || 'whatsapp') || {}).icon" class="h-3.5 w-3.5"></ui-icon>
                        {{ (getPlatform(c.platform || 'whatsapp') || {}).nombre }}
                        <ui-badge v-if="c.id === selectedId" variant="accent" class="ml-1">Actual</ui-badge>
                      </span>
                      <span class="shrink-0 font-mono text-[9px] uppercase text-neutral-400">
                        {{ formatDate(convRange(c).from) }} → {{ formatDate(convRange(c).to) }}
                      </span>
                    </div>
                    <p class="mt-1 truncate text-xs text-neutral-600">{{ lastMessage(c) }}</p>
                    <p class="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                      {{ (c.messages || []).length }} mensajes · {{ timeAgo(c.lastTs) }}
                    </p>
                  </button>
                </li>
                <li v-if="contactConvs.length === 0" class="text-xs text-neutral-400">
                  Sin historial previo.
                </li>
              </ul>
            </div>
          </template>
        </div>
      </ui-drawer>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();