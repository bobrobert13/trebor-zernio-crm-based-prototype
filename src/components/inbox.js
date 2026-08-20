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
        <ui-modal :open="newConvOpen" title="Nueva conversación" @close="newConvOpen = false">
          <ui-field label="Contacto">
            <select v-model="newContactId" class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null" disabled>Elige un contacto…</option>
              <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }} · {{ c.phone }}</option>
            </select>
          </ui-field>
          <!-- Aviso persistente (no es un toast que se oculta solo): el contacto
               elegido no tiene actividad en las últimas 24h → se exige plantilla -->
          <div v-if="newConvNeedsTemplate" class="mt-3 flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
            <span>Este contacto no tiene conversación en las últimas 24 h: el hilo se abrirá con una <strong>plantilla aprobada</strong> (WhatsApp no permite mensajes libres para iniciar una conversación).</span>
          </div>
          <button @click="startConversation" :disabled="!newContactId"
            class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            {{ newConvNeedsTemplate ? 'Iniciar con plantilla aprobada' : 'Iniciar conversación' }}
          </button>
        </ui-modal>

        <!-- Modal: selector de plantilla aprobada (primer mensaje o re-enganche >24h) -->
        <ui-modal :open="tplPickerOpen" :title="tplTarget ? 'Re-enganchar con plantilla aprobada' : 'Primer mensaje: elige una plantilla aprobada'" width="max-w-3xl" @close="closeTemplatePicker">
          <div class="space-y-4">
            <!-- Política de 24h visible y persistente (el aviso no se oculta solo) -->
            <div class="flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
              <span>{{ tplTarget ? 'La ventana de 24 h ya pasó:' : 'Primer mensaje al cliente:' }} WhatsApp exige <strong>plantillas aprobadas por Meta</strong> para abrir o re-enganchar un hilo. Elige una y completa sus variables; el cliente debe responder para abrir la ventana de 24 h.</span>
            </div>
            <!-- Error persistente al cargar plantillas (live: API/CORS) con reintento -->
            <div v-if="tplError" class="flex items-start gap-2 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
              <ui-icon name="alert" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
              <span class="flex-1">No se pudieron cargar las plantillas: {{ tplError }}</span>
              <button @click="openTemplatePicker(tplTarget)" class="shrink-0 font-semibold underline">Reintentar</button>
            </div>
            <div v-if="tplList.length === 0 && !tplError" class="border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
              Sin plantillas aprobadas todavía. Crea y aprueba una en Campañas primero (Meta revisa hasta 24 h).
            </div>
            <div v-else class="grid gap-2 sm:grid-cols-2">
              <button v-for="t in tplList" :key="t.id || t.name" @click="tplSelected = t"
                class="border-2 p-3 text-left transition"
                :class="tplSelected && (tplSelected.id || tplSelected.name) === (t.id || t.name) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200 hover:border-neutral-900'">
                <p class="truncate font-mono text-xs font-semibold">{{ t.name }}</p>
                <p class="mt-0.5 flex items-center gap-1.5">
                  <ui-badge variant="neutral">{{ t.category }}</ui-badge>
                  <span class="font-mono text-[10px] uppercase text-neutral-400">{{ t.language }}</span>
                </p>
              </button>
            </div>

            <template v-if="tplSelected">
              <!-- Preview gráfico completo (burbuja WhatsApp + info + estado) -->
              <template-preview :tpl="tplSelected"></template-preview>
              <div v-if="tplVariables.length" class="grid gap-3 sm:grid-cols-2">
                <ui-field v-for="v in tplVariables" :key="v" :label="'Valor para ' + v">
                  <input v-model.trim="tplParams[v]" type="text" :placeholder="'Dato para ' + v"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
              </div>
              <button @click="sendApprovedTemplate" :disabled="tplSending || tplVariables.some(v => !tplParams[v])"
                class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="tplSending" size="h-4 w-4"></ui-spinner>
                {{ tplSending ? 'Enviando…' : (tplTarget ? 'Enviar plantilla' : 'Iniciar conversación con esta plantilla') }}
              </button>
            </template>
          </div>
        </ui-modal>
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
        <ui-modal :open="productPickOpen" title="Seleccionar producto" width="max-w-md" @close="productPickOpen = false">
          <div class="space-y-3">
            <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
              <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
              <input v-model.trim="productPickQuery" type="search" placeholder="Buscar producto…"
                class="w-full bg-transparent text-sm outline-none" />
            </div>
            <ul class="max-h-80 divide-y divide-neutral-100 overflow-y-auto border border-neutral-200">
              <li v-for="p in productPickResults" :key="p.id">
                <button @click="pickProduct(p)" class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-stone-50">
                  <span class="min-w-0 truncate font-medium">{{ p.name }}</span>
                  <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ p.category || p.type }}<span v-if="p.stock === false" class="ml-1 text-red-700">· Agotado</span></span>
                </button>
              </li>
              <li v-if="productPickResults.length === 0" class="px-3 py-6 text-center text-sm text-neutral-400">Sin productos para la búsqueda.</li>
            </ul>
          </div>
        </ui-modal>

        <!-- Modal: información completa del producto detectado (Ver más) -->
        <ui-modal :open="productInfoOpen" :title="productInfoTarget ? productInfoTarget.name : ''" width="max-w-lg" @close="closeProductInfo">
          <div v-if="productInfoTarget" class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              <ui-badge :variant="productInfoTarget.stock === false ? 'danger' : 'success'" dot>{{ productInfoTarget.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
              <ui-badge variant="accent">{{ formatPrice(productInfoTarget.price) }}</ui-badge>
              <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ productInfoTarget.category || productInfoTarget.type }}<span v-if="productInfoTarget.unit"> · {{ productInfoTarget.unit }}</span></span>
            </div>
            <p class="text-sm text-neutral-600">{{ productInfoTarget.description || 'Sin descripción.' }}</p>
            <div class="border border-neutral-200">
              <p class="border-b border-neutral-200 bg-stone-50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cómo se verá en WhatsApp</p>
              <div class="p-3">
                <wa-preview :text="cardOfTarget" :show-header="false"></wa-preview>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="sendFichaFromInfo"
                class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Enviar ficha al chat
              </button>
              <button @click="selected ? (openTemplatePicker(selected), closeProductInfo()) : null"
                class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
                Responder con plantilla
              </button>
            </div>
          </div>
        </ui-modal>

        <!-- Drawer: Asistente IA (análisis local de conversación + historial) -->
        <ui-drawer :open="aiOpen" width="max-w-xl" :title="'Asistente IA · ' + (selectedContact ? selectedContact.name : 'Conversación')" @close="aiOpen = false">
          <div v-if="aiAnalysis" class="space-y-5">
            <!-- Diagnóstico -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Diagnóstico</p>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa del lead</p>
                  <p class="mt-0.5 font-semibold">{{ stageLabel(selectedContact ? selectedContact.leadTag : null) }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Interés comercial</p>
                  <p class="mt-0.5 font-semibold">
                    {{ aiAnalysis.interest.nivel ? (aiAnalysis.interest.nivel === 'alto' ? 'Alto' : aiAnalysis.interest.nivel === 'medio' ? 'Medio' : 'Bajo') : 'Sin señales' }}
                    <span v-if="aiAnalysis.interest.value > 0" class="font-mono text-[10px] text-neutral-500">· {{ formatPrice(aiAnalysis.interest.value) }}</span>
                  </p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canal</p>
                  <p class="mt-0.5 font-semibold">{{ (getPlatform(selected ? selected.platform || 'whatsapp' : 'whatsapp') || {}).nombre }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Ventana 24h</p>
                  <p class="mt-0.5 font-semibold" :class="outsideWindow ? 'text-red-700' : 'text-emerald-700'">{{ outsideWindow ? 'Fuera de ventana' : 'Dentro de ventana' }}</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-neutral-500">
                {{ (selected ? selected.messages : []).length }} mensajes en este hilo · última actividad {{ timeAgo(selected ? selected.lastTs : Date.now()) }}
              </p>
            </div>

            <!-- Análisis de la conversación -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Análisis de la conversación</p>
              <ul class="space-y-1.5">
                <li v-for="(s, i) in aiAnalysis.senales" :key="i" class="flex items-start gap-2 text-xs">
                  <ui-icon name="check-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"></ui-icon>
                  <span>{{ s }}</span>
                </li>
              </ul>
              <div v-if="aiAnalysis.interest.productos.length" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="x in aiAnalysis.interest.productos" :key="x.product.id" class="border border-neutral-200 bg-stone-50 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                  {{ x.product.name }} · {{ formatPrice(x.product.price) }} · {{ INTENT_LABELS[x.intent] || x.intent }}
                </span>
              </div>
            </div>

            <!-- Plan de acción -->
            <div class="border-2 border-[var(--accent)] p-3">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Plan de acción sugerido</p>
              <ol class="space-y-1.5">
                <li v-for="(p, i) in aiAnalysis.plan" :key="i" class="flex items-start gap-2 text-xs">
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[9px] font-bold text-white">{{ i + 1 }}</span>
                  <span>{{ p }}</span>
                </li>
              </ol>
              <button @click="aiReminder" class="mt-3 flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="clock" class="h-3.5 w-3.5"></ui-icon> Crear recordatorio de seguimiento
              </button>
            </div>

            <!-- Respuestas sugeridas -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Respuestas sugeridas</p>
              <div class="space-y-2">
                <button v-for="r in aiAnalysis.respuestas" :key="r.label" @click="applyAiReply(r)"
                  class="flex w-full items-center justify-between gap-2 border-2 border-neutral-200 px-3 py-2.5 text-left text-xs transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  <span class="min-w-0 flex-1">{{ r.text }}</span>
                  <span class="shrink-0 font-semibold text-[var(--accent)] underline">Usar</span>
                </button>
              </div>
            </div>

            <!-- Agentes IA conectados (módulo Agente) -->
            <div class="border-t-2 border-neutral-900 pt-4">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agentes conectados</p>
              <div v-if="inboxAgents.length" class="space-y-2">
                <div v-for="a in inboxAgents" :key="a.id" class="border border-neutral-200 p-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold">{{ a.name }}
                      <span class="font-mono text-[9px] uppercase text-neutral-400">· {{ a.provider }}</span>
                    </span>
                    <button @click="askAgentForSuggestion(a)" :disabled="aiAgentBusy"
                      class="border-2 border-neutral-900 bg-white px-2.5 py-1 text-[11px] font-semibold transition hover:shadow-brutal-sm disabled:opacity-40">
                      <ui-spinner v-if="aiAgentBusy" size="h-3 w-3"></ui-spinner>
                      <span v-else>Preguntar</span>
                    </button>
                  </div>
                  <template v-if="aiAgentResult && aiAgentResult.agent && aiAgentResult.agent.id === a.id">
                    <p v-if="aiAgentResult.error" class="mt-1.5 border border-red-700 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                      {{ aiAgentResult.error }}
                    </p>
                    <template v-else>
                      <p class="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Acción: {{ aiAgentResult.action.action }}</p>
                      <p v-if="aiAgentResult.action.text" class="mt-1 text-xs">{{ aiAgentResult.action.text }}</p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <button v-if="aiAgentResult.action.text" @click="applyAgentAction(aiAgentResult.action); aiOpen = false"
                          class="border-2 border-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">Usar respuesta</button>
                        <button v-if="aiAgentResult.action.leadTag" @click="applyAgentAction(aiAgentResult.action)"
                          class="border-2 border-neutral-900 px-2 py-1 text-[11px] font-semibold">Asignar etapa</button>
                        <button v-if="aiAgentResult.action.action === 'close_sale'" @click="applyAgentAction(aiAgentResult.action)"
                          class="border-2 border-red-800 px-2 py-1 text-[11px] font-semibold text-red-800">Cerrar venta</button>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
              <p v-else class="text-xs text-neutral-400">
                Conecta un agente de IA en el módulo Agente para atender esta conversación.
              </p>
            </div>
          </div>
        </ui-drawer>

        <!-- Modal: finalizar lead desde la conversación (mismo flujo que Leads) -->
        <ui-modal :open="closeOpen" :title="'Finalizar lead · ' + (closeTarget ? closeTarget.name : '')" width="max-w-md" @close="closeOpen = false">
          <div class="space-y-4">
            <p class="text-sm text-neutral-500">
              Da por terminado el seguimiento de este lead. Puedes reabrirlo cuando quieras.
            </p>
            <div v-if="closeTarget" class="flex items-center gap-3 border border-neutral-200 bg-stone-50 p-3">
              <ui-avatar :name="closeTarget.name" size="h-10 w-10 text-sm"></ui-avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ closeTarget.name }}</p>
                <p class="truncate font-mono text-[11px] text-neutral-500">
                  Etapa: {{ stageLabel(closeTarget.leadTag) }}
                  <span v-if="closeTarget.createdAt"> · Cliente desde {{ fmtD(closeTarget.createdAt) }}</span>
                </p>
              </div>
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
            <div v-if="(workspace.products || []).length">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">¿Qué productos/servicios se cerraron?</p>
              <div v-if="closeForm.products.length" class="mb-2 flex flex-wrap gap-1.5">
                <button v-for="id in closeForm.products" :key="id" @click="toggleCloseProduct(id)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition border-[var(--accent)] bg-[var(--accent)] text-white">
                  {{ productNameOf(id) }} ✕
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
