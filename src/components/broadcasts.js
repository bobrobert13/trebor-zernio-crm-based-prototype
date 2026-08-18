/**
 * @file broadcasts.js — Campañas con 3 tabs: Broadcasts, Secuencias y Flows.
 * Orquestador por bounded context: la lógica vive en src/broadcasts-composables.js
 * (Z.makeXxx) y la presentación en sub-componentes de ./broadcasts/ comunicados
 * por props/emits. 1:1 con el comportamiento previo. El preview gráfico de
 * plantillas (`template-preview`) vive en su propio fichero (lo usa también inbox).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const {
    store, toast, formatDate, formatTime, uid, canEdit, getNiche, api, asArray, activeAgents, askAgent,
    seqStatusTone, seqStepText, formatSeqDelay, seqTotalMinutes, seqCumulative, formatSeqTotal,
    flowScreens, flowFields, flowFooter,
  } = ZernioCrm;

  const components = {};

  components['broadcasts-view'] = {
    setup() {
      // Composición por bounded context (ver src/broadcasts-composables.js)
      const shell = ZernioCrm.makeCampaignShell({ store, getNiche, api, asArray, toast });

      const bc = ZernioCrm.makeCampaignBroadcasts({
        broadcasts: shell.broadcasts, templates: shell.templates,
        isLive: shell.isLive, profileId: shell.profileId, accountId: shell.accountId,
        api, asArray, toast, uid, niche: shell.niche, activeAgents, askAgent,
      });

      const tpl = ZernioCrm.makeCampaignTemplates({
        templates: shell.templates, workspace: shell.workspace,
        isLive: shell.isLive, accountId: shell.accountId, api, asArray, toast, uid,
      });

      const seq = ZernioCrm.makeCampaignSequences({
        templates: shell.templates, sequences: shell.sequences, workspace: shell.workspace,
        isLive: shell.isLive, profileId: shell.profileId, accountId: shell.accountId,
        api, toast, uid,
      });

      const flow = ZernioCrm.makeCampaignFlows({
        flows: shell.flows, isLive: shell.isLive, accountId: shell.accountId,
        api, toast, uid, niche: shell.niche,
      });

      /** Setters que abren el modal de cada tab. */
      const openTemplates = () => { tpl.tplOpen.value = true; };
      const openSequences = () => { seq.seqOpen.value = true; };
      const openFlows = () => { flow.flowOpen.value = true; };

      return {
        ui: ZernioCrm,
        canEdit, formatDate, formatTime,
        seqStatusTone, seqStepText, formatSeqDelay, seqTotalMinutes, seqCumulative, formatSeqTotal,
        flowScreens, flowFields, flowFooter,
        ...shell, // tab, loading, load, guideOpen, workspace, niche, isLive, broadcasts/sequences/flows
        ...bc,    // createOpen, sending, form, agent*, createBroadcast, recipients*
        ...tpl,   // tplOpen, tplSaving, tplForm, saveDraftTemplate, discardDraft, preview*, allTemplates, tplId
        ...seq,   // seqOpen/seqSaving/seqForm, add/removeStep, approvedTemplates, create/toggle/enroll, openSeqPreview
        ...flow,  // flowOpen/flowSaving/flowForm, sendFlow, openFlowPreview/openFlowSend, flowPhone
        openTemplates, openSequences, openFlows,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Campañas</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Mensajes masivos, secuencias y formularios de WhatsApp.
              <span class="font-semibold">{{ isLive ? '· conectado a Zernio' : '· modo demo' }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="load" class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Actualizar
            </button>
            <button v-if="canEdit('broadcasts')" @click="createOpen = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="megaphone" class="h-4 w-4"></ui-icon> Nueva campaña
            </button>
          </div>
        </header>

        <!-- Pipeline educativo: para qué sirve cada herramienta -->
        <section class="border-2 border-neutral-900 bg-white">
          <button @click="guideOpen = !guideOpen" class="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <ui-icon name="book" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">¿Qué puedes hacer aquí?</p>
                <p class="text-xs text-neutral-500">Guía rápida: para qué sirve cada herramienta y cuándo usarla.</p>
              </div>
            </div>
            <ui-icon name="chevron-down" class="h-4 w-4 shrink-0 text-neutral-400 transition-transform" :class="guideOpen ? 'rotate-180' : ''"></ui-icon>
          </button>
          <div v-if="guideOpen" class="border-t border-neutral-200 p-5">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article v-for="tool in ui.CAMPAIGN_TOOLS" :key="tool.id" class="flex flex-col border border-neutral-200 p-4">
                <div class="flex items-center justify-between gap-2">
                  <ui-icon :name="tool.icon" class="h-5 w-5 text-[var(--accent)]"></ui-icon>
                  <ui-badge :variant="tool.aprobacion ? 'warn' : 'success'">{{ tool.aprobacion ? 'Requiere aprobación' : 'Inmediato' }}</ui-badge>
                </div>
                <h4 class="mt-2 font-semibold">{{ tool.nombre }}</h4>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">{{ tool.para }}</p>
                <p class="mt-3 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cuándo usarlo</p>
                <ul class="mt-1.5 space-y-1">
                  <li v-for="c in tool.cuando" :key="c" class="flex items-start gap-1.5 text-xs text-neutral-600">
                    <ui-icon name="check" class="mt-0.5 h-3 w-3 shrink-0 text-emerald-700"></ui-icon>
                    {{ c }}
                  </li>
                </ul>
              </article>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2 border border-neutral-200 bg-stone-50 p-4 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <span class="flex items-center gap-1.5"><ui-icon name="message" class="h-4 w-4"></ui-icon> Plantilla aprobada</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="megaphone" class="h-4 w-4"></ui-icon> Broadcast / Secuencia</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="users" class="h-4 w-4"></ui-icon> Contacto suscrito</span>
            </div>
          </div>
        </section>

        <!-- Tabs -->
        <div class="flex gap-1.5 border-b-2 border-neutral-900">
          <button v-for="t in [['broadcasts', 'Broadcasts'], ['sequences', 'Secuencias'], ['flows', 'Flows']]" :key="t[0]"
            @click="tab = t[0]"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="tab === t[0] ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            {{ t[1] }}
          </button>
        </div>

        <!-- Carga -->
        <div v-if="loading" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ui-skeleton v-for="i in 3" :key="i" h="h-40"></ui-skeleton>
          </div>
          <ui-skeleton h="h-48"></ui-skeleton>
        </div>

        <template v-else>
          <!-- ═══ TAB: BROADCASTS ═══ -->
          <broadcast-tab v-if="tab === 'broadcasts'"
            :broadcasts="broadcasts" :all-templates="allTemplates"
            :can-edit="canEdit" :format-date="formatDate" :tpl-id="tplId"
            :open-recipients="openRecipients" :open-templates="openTemplates"
            :open-preview="openPreview" :submit-approval="submitTemplateForApproval"
            :discard="discardDraft" :tpl-saving="tplSaving"></broadcast-tab>

          <!-- ═══ TAB: SECUENCIAS ═══ -->
          <sequences-tab v-if="tab === 'sequences'"
            :sequences="sequences" :can-edit="canEdit" :seq-status-tone="seqStatusTone"
            :open-sequences="openSequences" :open-preview="openSeqPreview"
            :toggle="toggleSequence" :open-enroll="openEnroll"></sequences-tab>

          <!-- ═══ TAB: FLOWS ═══ -->
          <flows-tab v-if="tab === 'flows'"
            :flows="flows" :can-edit="canEdit" :open-flows="openFlows"
            :open-preview="openFlowPreview" :open-send="openFlowSend"></flows-tab>
        </template>

        <!-- Modal: nueva campaña -->
        <create-campaign-modal
          :open="createOpen" :form="form" :templates="templates" :niche="niche" :tpl-id="tplId"
          :campaign-agents="campaignAgents" :agent-suggestion="agentSuggestion"
          :agent-busy="agentBusy" :sending="sending" :ask-agent="askCampaignAgent" :create="createBroadcast"
          @close="createOpen = false"></create-campaign-modal>

        <!-- Modal: nueva plantilla (guarda borrador; no envía a Meta) -->
        <template-modal
          :open="tplOpen" :form="tplForm" :saving="tplSaving" :save="saveDraftTemplate"
          @close="tplOpen = false"></template-modal>

        <!-- Modal: preview de plantilla -->
        <template-preview-modal
          :open="previewOpen" :tpl="previewTpl" :saving="tplSaving"
          :submit-approval="submitTemplateForApproval" :discard="discardDraft"
          @close="previewOpen = false"></template-preview-modal>

        <!-- Modal: nueva secuencia -->
        <sequence-modal
          :open="seqOpen" :form="seqForm" :is-live="isLive" :approved-templates="approvedTemplates"
          :tpl-id="tplId" :saving="seqSaving" :add-step="addSeqStep" :remove-step="removeSeqStep"
          :create-sequence="createSequence" @close="seqOpen = false"></sequence-modal>

        <!-- Modal: pipeline de envío de la secuencia (cómo se ve en el canal) -->
        <sequence-preview-modal
          :open="seqPreviewOpen" :sequence="seqPreviewTarget"
          :seq-step-text="seqStepText" :format-seq-delay="formatSeqDelay"
          :format-seq-total="formatSeqTotal" :seq-cumulative="seqCumulative"
          :seq-total-minutes="seqTotalMinutes" @close="seqPreviewOpen = false"></sequence-preview-modal>

        <!-- Modal: enrolar contactos -->
        <enroll-modal
          :open="seqEnrollOpen" :sequence="seqEnrollTarget" :count="(workspace.contacts || []).length"
          :enrolling="enrolling" :enroll="enrollSequence" @close="seqEnrollOpen = false"></enroll-modal>

        <!-- Modal: nuevo flow -->
        <flow-modal
          :open="flowOpen" :form="flowForm" :niche="niche" :saving="flowSaving" :create="createFlow"
          @close="flowOpen = false"></flow-modal>

        <!-- Modal: enviar flow -->
        <flow-send-modal
          :open="flowSendOpen" :flow="flowSendTarget" v-model:phone="flowPhone" :send="sendFlow"
          @close="flowSendOpen = false"></flow-send-modal>

        <!-- Modal: vista previa presentacional del flow (cómo lo verá el cliente) -->
        <flow-preview-modal
          :open="flowPreviewOpen" :flow="flowPreviewTarget" :workspace="workspace"
          :flow-screens="flowScreens" :flow-fields="flowFields" :flow-footer="flowFooter"
          @close="flowPreviewOpen = false"></flow-preview-modal>

        <!-- Modal: destinatarios -->
        <recipients-modal
          :open="recipientsOpen" :broadcast="recipientsBroadcast" :list="recipientsList"
          @close="recipientsOpen = false"></recipients-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();