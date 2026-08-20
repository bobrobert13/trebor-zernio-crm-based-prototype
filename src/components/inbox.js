/**
 * @file inbox.js — Bandeja unificada de conversaciones WhatsApp a pantalla
 * completa: lista filtrable (380px) + panel de chat que llena el área.
 * Demo: envía con delivery/lectura y respuestas entrantes simuladas.
 * Live: sincroniza conversaciones reales desde /inbox/conversations (proxy).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, getNiche, timeAgo, formatTime, formatDate, fmtDT, fmtD, uid, canEdit, getPlatform, confirmMention, discardMention, INTENT_LABELS, renderWhatsApp, formatPrice, activeAgents, askAgent } = ZernioCrm;

  const components = {};

  /** Auto-respondedor del agente IA: la instancia montada lo asigna; el hook de
   *  mensajes entrantes se registra UNA vez por página (evita duplicados en remounts). */
  let agentAutoReply = null;
  let agentHookRegistered = false;

  /** Motivos de cierre de lead (misma lista que el tablero de Leads). */
  const CLOSE_REASONS = ['Compró', 'Sin respuesta', 'Se pospuso', 'Eligió otra opción'];

  components['inbox-view'] = {
    setup() {
      // Composición por bounded context (ver src/inbox-composables.js)
      const shell = ZernioCrm.makeInboxShell({ store, getNiche, makeTimers: ZernioCrm.makeTimers });
      const { workspace, niche, contacts, conversations, leadTags, bizFields, isLive, productMentions, interestCore, loading, later } = shell;

      // detachCard se inyecta por closure TDZ: products se compone después de
      // list, pero selectConversation corre siempre post-setup, así que la
      // referencia adelantada se resuelve antes del primer uso.
      const list = ZernioCrm.makeInboxList({
        shell, toast, api: ZernioCrm.api, asArray: ZernioCrm.asArray,
        uid: ZernioCrm.uid, resolveContactName: ZernioCrm.resolveContactName,
        detachCard: () => products.detachCard(),
      });
      const {
        search, filter, platformFilter, selectedId, syncing, newConvOpen, newContactId, humanAgent,
        filtered, presentPlatforms, tiktokChannel, tiktokEmpty,
        selected, selectedContact, unreadTotal, activeConversations, outsideWindow,
        newConvNeedsTemplate,
        selectConversation, backToList, lastMessage, sync,
        startConversation: listStartConversation,
      } = list;

      const tips = ZernioCrm.makeInboxTips({
        shell, list,
        getProductMentions: () => productMentions,
        getContactConvs: () => drawer.contactConvs,
      });
      const { attentionTips, tipsOpen, canHumanAgent, blockedByWindow } = tips;

      // Composición BC: products → composer → templates. products obtiene draft
      // y list obtiene detachCard por closures TDZ (referencias adelantadas);
      // ambas se invocan post-setup (render/eventos), así que son seguras.
      const products = ZernioCrm.makeInboxProducts({
        shell, list, toast, uid: ZernioCrm.uid,
        getDraft: () => composer.draft,
      });

      const composer = ZernioCrm.makeInboxComposer({
        shell, list, products, toast, api: ZernioCrm.api, uid: ZernioCrm.uid, later,
        onIncoming: (contact, conv, msg) => agentAutoReply && agentAutoReply(contact, conv, msg),
      });

      const templates = ZernioCrm.makeInboxTemplates({
        shell, list, toast, api: ZernioCrm.api, asArray: ZernioCrm.asArray, uid: ZernioCrm.uid,
      });

      // BC Products — menciones, picker de productos y ficha adjunta
      const {
        mentionsOfMessage, contactProductMentions, productOf,
        productPickOpen, productPickTarget, productPickQuery, productPickResults,
        openProductPick, pickProduct,
        cardAttach, cardGreeting, cardPreview, openCardPicker, attachCard, detachCard,
        productInfoOpen, productInfoTarget, cardOfTarget, openProductInfo, closeProductInfo, sendFichaFromInfo,
      } = products;

      // BC Composer — borrador, envío y autocompletado '@'
      const {
        draft, sending, QUICK_REPLIES, simulateDelivery, send,
        atOpen, atResults, atIndex, pickMention, onComposerKeydown,
      } = composer;

      // BC Templates — plantillas aprobadas (re-enganche >24h y primer mensaje)
      const {
        tplPickerOpen, tplList, tplSelected, tplParams, tplVariables, tplSending, tplError,
        tplTarget, tplModalOpen, tplFirstOpen,
        openTemplatePicker, closeTemplatePicker, sendApprovedTemplate,
      } = templates;

      // BC ContactDrawer — ficha del cliente, actividades y recordatorios
      const drawer = ZernioCrm.makeInboxContactDrawer({
        shell, list, toast, uid: ZernioCrm.uid,
      });
      const {
        contactDrawerOpen, contactTab, contactTags, contactStats,
        toggleContactTag, setLeadTag, registerContact,
        remInput, addReminderFor, contactReminders, contactConvs, convRange,
      } = drawer;

      // Cierre de lead (reuso de shared.js): onClosed cierra el drawer
      const close = ZernioCrm.makeCloseLead({
        workspace, productMentions, toast,
        onClosed: () => { contactDrawerOpen.value = false; },
      });
      const {
        closeOpen, closeTarget, closeForm, closeProductQuery, closeProductResults,
        closeLabel, stageLabel, historyOf, productNameOf,
        toggleCloseProduct, openCloseModal, confirmClose, reopenLead,
      } = close;

      // BC IA — análisis comercial de la conversación + agentes conectados
      const ai = ZernioCrm.makeInboxAi({
        shell, list, composer, products, drawer, close, toast,
        askAgent, activeAgents, canEdit, uid: ZernioCrm.uid,
      });
      const {
        aiOpen, aiAnalysis, applyAiReply, aiReminder,
        inboxAgents, aiAgentBusy, aiAgentResult, askAgentForSuggestion, applyAgentAction,
        maybeAgentAutoReply,
      } = ai;

      /** Abre el flujo de plantilla aprobada cuando la conversación nueva lo exige. */
      const startConversation = () => listStartConversation(() => openTemplatePicker(null));

      /** Pantalla de carga simulada al entrar a la bandeja. */
      later(() => { loading.value = false; }, 600);

      // Abre una conversación pedida desde otro módulo (ej. drawer de Leads).
      // Va al FINAL del setup: el watch immediate corre en setup y usa computeds
      // y selectConversation, que deben estar inicializados (TDZ).
      Vue.watch(
        () => store.pendingConversationId,
        (id) => {
          if (!id) return;
          const conv = conversations.value.find((c) => c.id === id);
          if (!conv) {
            // La conversación pedida ya no existe: no se consume el pendiente
            // (otro módulo podría recrearla) y se avisa para no perder la intención.
            toast('La conversación solicitada ya no está disponible', 'error');
            return;
          }
          store.pendingConversationId = null;
          selectConversation(conv);
        },
        { immediate: true }
      );

      // Auto-respuesta del agente IA: la instancia montada queda como handler;
      // el hook se registra UNA vez con un delegador que siempre llama a la
      // instancia ACTUAL (live: reflectIncomingMessage; demo: simulateIncoming).
      agentAutoReply = (contact, conv, msg) => maybeAgentAutoReply(contact, conv, msg);
      if (!agentHookRegistered) {
        agentHookRegistered = true;
        ZernioCrm.onIncomingMessage((contact, conv, msg) => agentAutoReply && agentAutoReply(contact, conv, msg));
      }

      return {
        search, filter, platformFilter, selectedId, draft, sending, loading, syncing, newConvOpen, newContactId,
        workspace, niche, conversations, contacts, filtered, selected, selectedContact, unreadTotal, isLive,
        activeConversations,
        QUICK_REPLIES, canEdit, humanAgent, outsideWindow, canHumanAgent, blockedByWindow,
        attentionTips, tipsOpen,
        presentPlatforms, tiktokChannel, tiktokEmpty, getPlatform, leadTags,
        tplPickerOpen, tplList, tplSelected, tplParams, tplVariables, tplSending, tplError,
        tplTarget, tplModalOpen, tplFirstOpen, newConvNeedsTemplate,
        openTemplatePicker, closeTemplatePicker, sendApprovedTemplate,
        contactDrawerOpen, contactTab, contactTags, toggleContactTag, setLeadTag, registerContact,
        contactStats, bizFields, remInput, addReminderFor, contactReminders, ZernioCrm,
        contactConvs, convRange, fmtDT, fmtD, formatDate,
        closeOpen, closeTarget, closeForm, closeProductQuery, closeProductResults,
        closeLabel, stageLabel, historyOf, productNameOf, toggleCloseProduct,
        openCloseModal, confirmClose, reopenLead, CLOSE_REASONS,
        aiOpen, aiAnalysis, applyAiReply, aiReminder,
        inboxAgents, aiAgentBusy, aiAgentResult, askAgentForSuggestion, applyAgentAction,
        productMentions, mentionsOfMessage, contactProductMentions, productOf,
        productPickOpen, productPickTarget, productPickQuery, productPickResults,
        openProductPick, pickProduct, INTENT_LABELS,
        confirmMention, discardMention,
        cardAttach, cardGreeting, cardPreview, openCardPicker, detachCard,
        atOpen, atResults, atIndex, pickMention, onComposerKeydown, formatPrice,
        productInfoOpen, productInfoTarget, cardOfTarget, openProductInfo, closeProductInfo, sendFichaFromInfo,
        renderWhatsApp,
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
                {{ (workspace.whatsapp || {}).phone }}
                <span v-if="!(workspace.whatsapp && workspace.whatsapp.connected)" class="font-semibold text-red-700">· desconectado</span>
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
          <!-- Lista de conversaciones (BC List) -->
          <inbox-list :search="search" :platform-filter="platformFilter" :filter="filter"
            :present-platforms="presentPlatforms" :lead-tags="leadTags"
            :active-count="activeConversations.length" :unread-total="unreadTotal"
            :tiktok-empty="tiktokEmpty" :tiktok-channel="tiktokChannel"
            :filtered="filtered" :selected="selected" :selected-id="selectedId" :contacts="contacts"
            :get-platform="getPlatform" :time-ago="timeAgo" :last-message="lastMessage"
            v-model:search="search" v-model:platform-filter="platformFilter" v-model:filter="filter"
            @select="selectConversation"></inbox-list>

          <!-- Panel de chat con composer (BC Chat + BC Composer) -->
          <inbox-chat :selected="selected" :selected-contact="selectedContact" :back-to-list="backToList"
            :get-platform="getPlatform" :format-time="formatTime"
            :attention-tips="attentionTips" :tips-open="tipsOpen" @toggle-tips="tipsOpen = !tipsOpen"
            :render-whatsapp="renderWhatsApp" :mentions-of-message="mentionsOfMessage" :product-of="productOf"
            :format-price="formatPrice" :open-product-info="openProductInfo" :open-product-pick="openProductPick"
            :confirm-mention="confirmMention" :discard-mention="discardMention"
            @open-ai="aiOpen = true" @open-drawer="contactDrawerOpen = true; contactTab = 'ficha'"
            :can-human-agent="canHumanAgent" v-model:human-agent="humanAgent"
            :blocked-by-window="blockedByWindow" :has-products="(workspace.products || []).length > 0"
            :sending="sending" :quick-replies="QUICK_REPLIES" v-model:draft="draft"
            :card-attach="cardAttach" v-model:card-greeting="cardGreeting" :card-preview="cardPreview"
            :at-open="atOpen" :at-results="atResults" v-model:at-index="atIndex"
            :open-template-picker="openTemplatePicker" :open-card-picker="openCardPicker"
            :detach-card="detachCard" :on-composer-keydown="onComposerKeydown"
            :pick-mention="pickMention" :send="send"></inbox-chat>
        </div>

        <!-- Modal: nueva conversación -->
        <inbox-new-conv-modal :open="newConvOpen" :contacts="contacts" v-model:new-contact-id="newContactId"
          :needs-template="newConvNeedsTemplate" @close="newConvOpen = false" @start="startConversation"></inbox-new-conv-modal>

        <!-- Modal: selector de plantilla aprobada (primer mensaje o re-enganche >24h) -->
        <inbox-template-modal :open="tplPickerOpen" :target="tplTarget" :error="tplError" :list="tplList"
          v-model:selected="tplSelected" :variables="tplVariables" :params="tplParams" :sending="tplSending"
          @close="closeTemplatePicker" @retry="openTemplatePicker(tplTarget)" @send="sendApprovedTemplate"></inbox-template-modal>
        <!-- Drawer: ficha del cliente (BC ContactDrawer) -->
        <inbox-contact-drawer :open="contactDrawerOpen" v-model:tab="contactTab"
          :selected="selected" :selected-contact="selectedContact"
          :contact-tags="contactTags" :lead-tags="leadTags" :biz-fields="bizFields" :niche="niche"
          :contact-product-mentions="contactProductMentions" :product-of="productOf" :intent-labels="INTENT_LABELS"
          :history-of="historyOf" :stage-label="stageLabel" :close-label="closeLabel" :product-name-of="productNameOf"
          :fmt-d="fmtD" :fmt-dt="fmtDT" :format-date="formatDate" :time-ago="timeAgo" :get-platform="getPlatform"
          :can-edit="canEdit" :last-message="lastMessage" :contact-convs="contactConvs"
          :contact-stats="contactStats" :contact-reminders="contactReminders" :conv-range="convRange"
          :rem-input="remInput" :selected-id="selectedId"
          :toggle-contact-tag="toggleContactTag" :set-lead-tag="setLeadTag" :register-contact="registerContact"
          :select-conversation="selectConversation" :open-close-modal="openCloseModal" :reopen-lead="reopenLead"
          :attach-card="attachCard" :open-template-picker="openTemplatePicker" :confirm-mention="confirmMention"
          :open-product-pick="openProductPick" :toggle-reminder="ZernioCrm.toggleReminder"
          :remove-reminder="ZernioCrm.removeReminder" :add-reminder-for="addReminderFor"
          @close="contactDrawerOpen = false"></inbox-contact-drawer>

        <!-- Modal: selector de productos (confirmar mention / vincular manual) -->
        <inbox-product-pick-modal :open="productPickOpen" v-model:query="productPickQuery" :results="productPickResults"
          @close="productPickOpen = false" @pick="pickProduct"></inbox-product-pick-modal>

        <!-- Modal: información completa del producto detectado (Ver más) -->
        <inbox-product-info-modal :open="productInfoOpen" :target="productInfoTarget" :card-text="cardOfTarget"
          :format-price="formatPrice" @close="closeProductInfo" @send-ficha="sendFichaFromInfo"
          @template="selected ? (openTemplatePicker(selected), closeProductInfo()) : null"></inbox-product-info-modal>

        <!-- Drawer: Asistente IA (análisis local de conversación + historial) -->
        <inbox-ai-drawer :open="aiOpen" :selected="selected" :selected-contact="selectedContact" :analysis="aiAnalysis"
          :agents="inboxAgents" :ai-agent-busy="aiAgentBusy" :ai-agent-result="aiAgentResult" :stage-label="stageLabel"
          :get-platform="getPlatform" :format-price="formatPrice" :intent-labels="INTENT_LABELS"
          :outside-window="outsideWindow" :time-ago="timeAgo" @close="aiOpen = false" @reminder="aiReminder"
          @use-reply="applyAiReply" @ask="askAgentForSuggestion" @use-action="applyAgentAction"
          @use-action-close="applyAgentAction($event); aiOpen = false"></inbox-ai-drawer>

        <!-- Modal: finalizar lead desde la conversación (mismo flujo que Leads) -->
        <inbox-close-modal :open="closeOpen" :target="closeTarget" :form="closeForm"
          :has-products="(workspace.products || []).length > 0" :close-reasons="CLOSE_REASONS" :product-name-of="productNameOf"
          :stage-label="stageLabel" :fmt-d="fmtD" v-model:close-product-query="closeProductQuery"
          :close-product-results="closeProductResults" :toggle-close-product="toggleCloseProduct"
          :confirm-close="confirmClose" @close="closeOpen = false"></inbox-close-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
