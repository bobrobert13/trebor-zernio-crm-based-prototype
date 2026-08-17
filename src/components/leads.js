/**
 * @file leads.js — Tablero Kanban de leads: columnas = etapas del pipeline
 * (workspace.leadTags, configurables) + "Sin asignar". Cada tarjeta es un
 * contacto con métricas de relación (VIP, frecuencia, canales) y un drawer
 * de detalle profundo. Drag & drop nativo HTML5 + botones de respaldo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, timeAgo, getPlatform, canEdit, getNiche, remindersOf, addReminder, toggleReminder, removeReminder, formatPrice, fmtDT, fmtD, INTENT_LABELS } = ZernioCrm;

  const components = {};

  components['leads-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const contacts = Vue.computed(() => workspace.value.contacts || []);
      const conversations = Vue.computed(() => workspace.value.conversations || []);
      const isLive = Vue.computed(() => store.mode === 'live');
      const leadTags = Vue.computed(() => workspace.value.leadTags || niche.value.tags || []);
      const productMentions = Vue.computed(() => ZernioCrm.productMentionsFor(workspace.value));

      // Composición por bounded context (ver src/leads-composables.js)
      const board = ZernioCrm.makeLeadBoard({ workspace, leadTags, contacts, canEdit, toast });
      const metrics = ZernioCrm.makeContactMetrics({ workspace, contacts, conversations });
      const detail = ZernioCrm.makeLeadDetail({ store, navigate: (r) => ZernioCrm.navigate(r) });
      const reminders = ZernioCrm.makeLeadReminders({ store, contacts, remindersOf, addReminder, toast });
      const interest = ZernioCrm.makeLeadInterest({ workspace, productMentions });

      // Cierre de lead: lógica compartida (shared · makeCloseLead). onClosed cierra el drawer.
      // El template de leads usa `productName`, así que se alía el nombre del factory.
      const close = ZernioCrm.makeCloseLead({
        workspace, productMentions, toast,
        onClosed: () => { detail.detailOpen.value = false; },
      });
      const { stageLabel } = ZernioCrm.makeLeadHistory({ closeLabel: close.closeLabel });
      const CLOSE_REASONS = ['Compró', 'Sin respuesta', 'Se pospuso', 'Eligió otra opción'];
      const setViewTab = (t) => { board.viewTab.value = t; };

      return {
        workspace, isLive, leadTags, contacts, conversations,
        ...board,           // columns, viewTab, active/closedContacts, cardsOf, drag handlers, moveContact
        ...metrics,         // lastMessageOf, metricsOf, channelBars
        ...detail,          // detailOpen, detailContact, detailTab, openDetail, openConversation, historyOf
        ...reminders,       // remInput, remPanelOpen, pendingReminders, hasOverdue, addReminderFor, upcomingReminders
        ...interest,        // interestScore
        setViewTab,
        stageLabel,
        closeOpen: close.closeOpen, closeTarget: close.closeTarget, closeForm: close.closeForm,
        openCloseModal: close.openCloseModal, confirmClose: close.confirmClose, reopenLead: close.reopenLead,
        closeProductQuery: close.closeProductQuery, closeProductResults: close.closeProductResults,
        toggleCloseProduct: close.toggleCloseProduct, productName: close.productNameOf,
        closeLabel: close.closeLabel,
        CLOSE_REASONS,
        remindersOf, toggleReminder, removeReminder,
        formatPrice, INTENT_LABELS, getPlatform, timeAgo, canEdit, fmtDT, fmtD, ZernioCrm,
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

        <lead-board
          :view-tab="viewTab" :columns="columns" :active-contacts="activeContacts" :closed-contacts="closedContacts"
          :cards-of="cardsOf" :metrics-of="metricsOf" :last-message-of="lastMessageOf"
          :pending-reminders="pendingReminders" :has-overdue="hasOverdue" :interest-score="interestScore"
          :close-label="closeLabel" :product-name="productName" :fmt-d="fmtD" :time-ago="timeAgo"
          :get-platform="getPlatform" :can-edit="canEdit"
          :open-detail="openDetail" :open-close="openCloseModal" :move-contact="moveContact" :reopen="reopenLead"
          :set-view-tab="setViewTab" :on-drag-start="onDragStart" :on-drag-end="onDragEnd"
          :on-drag-over="onDragOver" :on-drop="onDrop"></lead-board>

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

            <!-- Pestañas del drawer -->
            <div class="flex border-b-2 border-neutral-900">
              <button @click="detailTab = 'perfil'" class="flex-1 border-r-2 border-neutral-900 px-3 py-2 text-sm font-semibold transition"
                :class="detailTab === 'perfil' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Perfil</button>
              <button @click="detailTab = 'actividades'" class="flex-1 px-3 py-2 text-sm font-semibold transition"
                :class="detailTab === 'actividades' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Actividades</button>
            </div>

            <!-- Métricas de relación (Actividades) -->
            <div v-if="detailTab === 'actividades'" class="grid grid-cols-2 gap-3">
              <div class="border border-neutral-200 p-3">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cliente desde</p>
                <p class="mt-0.5 text-sm font-semibold">{{ detailContact.createdAt ? fmtD(detailContact.createdAt) : '—' }}</p>
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

            <!-- Canales más frecuentes (Actividades) -->
            <div v-if="detailTab === 'actividades'">
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

            <!-- Recordatorios del lead (Perfil) -->
            <div v-if="detailTab === 'perfil'">
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
                      {{ fmtDT(r.dueAt) }}
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

            <!-- Historial de etapas del lead (Perfil) -->
            <div v-if="detailTab === 'perfil'">
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
            <div v-if="detailTab === 'perfil'" class="border border-neutral-200 p-3">
              <template v-if="detailContact.leadClosed">
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="font-semibold" :class="detailContact.leadClosed.outcome === 'ganada' ? 'text-emerald-700' : 'text-red-700'">
                      Lead cerrado · {{ closeLabel(detailContact.leadClosed.outcome) }}
                    </p>
                    <p class="font-mono text-[10px] text-neutral-400">{{ fmtDT(detailContact.leadClosed.at) }}</p>
                    <div v-if="(detailContact.leadClosed.products || []).length" class="mt-1 flex flex-wrap gap-1">
                      <span v-for="pid in detailContact.leadClosed.products" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        {{ productName(pid) }}
                      </span>
                    </div>
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

            <!-- Etiquetas del contacto (Perfil) -->
            <div v-if="detailTab === 'perfil'">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas</p>
              <div class="flex flex-wrap gap-1">
                <ui-badge v-for="t in detailContact.tags" :key="t" variant="neutral">{{ t }}</ui-badge>
                <span v-if="!detailContact.tags || detailContact.tags.length === 0" class="text-xs text-neutral-400">Sin etiquetas</span>
              </div>
            </div>

            <!-- Interés comercial (Perfil) -->
            <div v-if="detailTab === 'perfil' && interestScore(detailContact).nivel">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Interés comercial</p>
              <div class="mb-2 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
                <ui-icon name="flame" class="h-4 w-4" :class="interestScore(detailContact).nivel === 'alto' ? 'text-red-700' : interestScore(detailContact).nivel === 'medio' ? 'text-amber-600' : 'text-neutral-500'"></ui-icon>
                <span class="text-sm font-semibold">{{ interestScore(detailContact).label }}</span>
                <span class="ml-auto font-mono text-[11px] font-bold tabular-nums text-neutral-600">{{ formatPrice(interestScore(detailContact).value) }} estimado</span>
              </div>
              <ul v-if="interestScore(detailContact).perProduct.length" class="mb-2 space-y-1.5">
                <li v-for="x in interestScore(detailContact).perProduct" :key="x.product.id" class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium">{{ x.product.name }}</span>
                  <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(x.product.price) }}</span>
                  <ui-badge :variant="x.product.stock === false ? 'danger' : 'success'" dot>{{ x.product.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
                  <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[x.intent] || x.intent }}</span>
                </li>
              </ul>
              <div v-if="interestScore(detailContact).factors.length" class="flex flex-wrap gap-1">
                <span v-for="f in interestScore(detailContact).factors" :key="f.id" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ f.label }}</span>
              </div>
            </div>

            <!-- Productos de interés (Actividades) -->
            <div v-if="detailTab === 'actividades' && interestScore(detailContact).perProduct.length">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos de interés</p>
              <ul class="space-y-1.5">
                <li v-for="x in interestScore(detailContact).perProduct" :key="x.product.id" class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                  <span class="min-w-0 flex-1 truncate font-medium">{{ x.product.name }}</span>
                  <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(x.product.price) }}</span>
                  <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[x.intent] || x.intent }}</span>
                  <ui-badge variant="neutral">{{ x.count }}x</ui-badge>
                </li>
              </ul>
            </div>

            <!-- Conversaciones recientes (Actividades) -->
            <div v-if="detailTab === 'actividades'">
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
                    {{ fmtDT(r.dueAt) }}
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
                  <span v-if="closeTarget.createdAt"> · Cliente desde {{ fmtD(closeTarget.createdAt) }}</span>
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

            <!-- Productos/servicios vinculados al cierre (preselección desde menciones) -->
            <div v-if="(workspace.products || []).length">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">¿Qué productos/servicios se cerraron?</p>
              <div v-if="closeForm.products.length" class="mb-2 flex flex-wrap gap-1.5">
                <button v-for="id in closeForm.products" :key="id" @click="toggleCloseProduct(id)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition border-[var(--accent)] bg-[var(--accent)] text-white">
                  {{ productName(id) }} ✕
                </button>
              </div>
              <input v-model.trim="closeProductQuery" type="search" placeholder="Buscar y agregar producto…"
                class="w-full border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
              <div v-if="closeProductQuery" class="mt-1.5 flex flex-wrap gap-1.5">
                <button v-for="p in closeProductResults" :key="p.id" @click="toggleCloseProduct(p.id)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="closeForm.products.includes(p.id) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ p.name }}
                </button>
              </div>
            </div>

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
