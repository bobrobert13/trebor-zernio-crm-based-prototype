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
      const setDetailTab = (t) => { detail.detailTab.value = t; };
      const setRemPanelOpen = (v) => { reminders.remPanelOpen.value = v; };

      return {
        workspace, isLive, leadTags, contacts, conversations,
        ...board,           // columns, viewTab, active/closedContacts, cardsOf, drag handlers, moveContact
        ...metrics,         // lastMessageOf, metricsOf, channelBars
        ...detail,          // detailOpen, detailContact, detailTab, openDetail, openConversation, historyOf
        ...reminders,       // remInput, remPanelOpen, pendingReminders, hasOverdue, addReminderFor, upcomingReminders
        ...interest,        // interestScore
        setViewTab, setDetailTab, setRemPanelOpen,
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

        <lead-drawer
          :open="detailOpen" :contact="detailContact" :tab="detailTab" :set-tab="setDetailTab"
          :metrics-of="metricsOf" :channel-bars="channelBars" :history-of="historyOf" :stage-label="stageLabel"
          :reminders-of="remindersOf" :toggle-reminder="toggleReminder" :remove-reminder="removeReminder"
          :add-reminder-for="addReminderFor" :rem-input="remInput"
          :fmt-d="fmtD" :fmt-d-t="fmtDT" :get-platform="getPlatform" :time-ago="timeAgo"
          :interest-score="interestScore" :format-price="formatPrice" :intent-labels="INTENT_LABELS"
          :close-label="closeLabel" :product-name="productName"
          :open-conversation="openConversation" :open-close="openCloseModal" :reopen="reopenLead" :can-edit="canEdit"
          @close="detailOpen = false"></lead-drawer>

        <!-- Drawer: próximos recordatorios (todas las leads) -->
        <lead-reminders-panel
          :open="remPanelOpen" :upcoming="upcomingReminders" :fmt-d-t="fmtDT"
          :open-detail="openDetail" :set-open="setRemPanelOpen"></lead-reminders-panel>

        <!-- Modal: cerrar lead -->
        <lead-close-modal
          :open="closeOpen" :target="closeTarget" :form="closeForm"
          v-model:productQuery="closeProductQuery" :product-results="closeProductResults"
          :workspace-products="workspace.products" :stage-label="stageLabel" :metrics-of="metricsOf"
          :fmt-d="fmtD" :product-name="productName" :toggle-close-product="toggleCloseProduct"
          :confirm-close="confirmClose" :close-reasons="CLOSE_REASONS"
          @close="closeOpen = false"></lead-close-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
