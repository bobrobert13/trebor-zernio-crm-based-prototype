/**
 * @file broadcast-modals.js — BC Broadcasts del módulo de campañas.
 * Panel del tab Broadcasts (grid de campañas + tabla de plantillas de
 * WhatsApp) y modales de creación de campaña y de destinatarios.
 * Presentacional: recibe props y handlers por props; emite cierre.
 * Verbatim de los bloques originales de broadcasts-view.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Estados de plantilla → variante de badge. */
  const TEMPLATE_TONES = { APPROVED: 'success', PENDING: 'warn', REJECTED: 'danger' };

  /** Panel del tab Broadcasts: campañas + plantillas. */
  components['broadcast-tab'] = {
    props: {
      broadcasts: { type: Array, default: () => [] },
      allTemplates: { type: Array, default: () => [] },
      canEdit: Function, formatDate: Function, tplId: Function,
      openRecipients: Function, openTemplates: Function,
      openPreview: Function, submitApproval: Function, discard: Function,
      tplSaving: Boolean,
    },
    template: `
      <div class="space-y-6">
        <div v-if="broadcasts.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
          <ui-empty icon="megaphone" title="Sin campañas" desc="Crea tu primera campaña masiva por WhatsApp."></ui-empty>
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article v-for="b in broadcasts" :key="b.id || b._id" class="border-2 border-neutral-900 bg-white p-5">
            <div class="flex items-start justify-between gap-2">
              <h4 class="font-semibold">{{ b.name }}</h4>
              <ui-badge :variant="(b.status === 'sent' || b.status === 'completed') ? 'success' : 'warn'" dot>
                {{ (b.status || 'sent') === 'completed' ? 'Enviada' : (b.status || 'sent') === 'sent' ? 'Enviada' : b.status }}
              </ui-badge>
            </div>
            <p class="mt-1 text-sm text-neutral-500">{{ b.audience || b.segmentFilters?.tags?.join(', ') || 'Todos los contactos activos' }}</p>
            <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
              {{ formatDate(b.sentAt || b.createdAt || Date.now()) }}
            </p>
            <div class="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <div class="font-mono text-[11px] tabular-nums text-neutral-500">
                <template v-if="b.stats">
                  {{ b.stats.total || 0 }} dest. · <span class="text-emerald-700">{{ b.stats.delivered || 0 }} ✓</span>
                </template>
                <template v-else>{{ b.recipientCount || b.totalRecipients || 0 }} dest.</template>
              </div>
              <button @click="openRecipients(b)" class="border border-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">
                Destinatarios
              </button>
            </div>
          </article>
        </div>

        <!-- Plantillas de WhatsApp -->
        <section>
          <div class="mb-3 flex items-center justify-between">
            <div>
              <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Plantillas de WhatsApp</h3>
              <p class="text-xs text-neutral-500">Fuera de la ventana de 24h solo se envían plantillas aprobadas por Meta (UTILITY/MARKETING).</p>
            </div>
            <button v-if="canEdit('broadcasts')" @click="openTemplates"
              class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="plus" class="h-3.5 w-3.5"></ui-icon> Nueva plantilla
            </button>
          </div>
          <div class="overflow-x-auto border-2 border-neutral-900 bg-white">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-3">Nombre</th>
                  <th class="px-4 py-3">Categoría</th>
                  <th class="px-4 py-3">Idioma</th>
                  <th class="px-4 py-3">Estado</th>
                  <th class="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-for="t in allTemplates" :key="tplId(t)" class="hover:bg-stone-50">
                  <td class="px-4 py-3 font-mono text-xs">{{ t.name }}</td>
                  <td class="px-4 py-3"><ui-badge variant="neutral">{{ t.category }}</ui-badge></td>
                  <td class="px-4 py-3 font-mono text-xs uppercase text-neutral-500">{{ t.language }}</td>
                  <td class="px-4 py-3"><ui-badge :variant="t.status === 'draft' ? 'neutral' : TEMPLATE_TONES[t.status] || 'neutral'" dot>{{ t.status }}</ui-badge></td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-1.5">
                      <button @click="openPreview(t)" class="border border-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">Ver preview</button>
                      <template v-if="t.status === 'draft' && canEdit('broadcasts')">
                        <button @click="submitApproval(t)" :disabled="tplSaving"
                          class="border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white transition hover:shadow-brutal-sm disabled:opacity-40">
                          {{ tplSaving ? 'Enviando…' : 'Enviar a aprobación' }}
                        </button>
                        <button @click="discard(t)" class="border border-red-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-red-800 transition hover:shadow-brutal-sm">Descartar</button>
                      </template>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-2 text-xs text-neutral-500">
            Los borradores no se envían a Meta: pulsa "Enviar a aprobación" cuando estés listo. La revisión puede tardar hasta 24 h.
          </p>
        </section>
      </div>`,
  };

  /** Modal: nueva campaña (con borrador sugerido por el agente IA). */
  components['create-campaign-modal'] = {
    props: {
      open: Boolean, form: { type: Object, default: null },
      templates: { type: Array, default: () => [] },
      niche: { type: Object, default: null }, tplId: Function,
      campaignAgents: { type: Array, default: () => [] },
      agentSuggestion: { type: Object, default: null },
      agentBusy: Boolean, sending: Boolean,
      askAgent: Function, create: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" title="Nueva campaña" @close="$emit('close')">
        <div class="space-y-4">
          <ui-field label="Nombre de la campaña">
            <input v-model.trim="form.name" type="text" placeholder="Ej: Promoción de fin de semana"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
            <!-- Borrador sugerido por el agente IA conectado (módulo Agente) -->
            <div v-if="campaignAgents.length" class="mt-2 space-y-1.5">
              <div v-for="a in campaignAgents" :key="a.id" class="flex items-center justify-between gap-2 border border-neutral-200 px-2.5 py-1.5">
                <span class="text-[11px] text-neutral-500">
                  <ui-icon name="sparkles" class="mr-1 inline h-3 w-3 text-[var(--accent)] align-[-2px]"></ui-icon>
                  {{ agentSuggestion && agentSuggestion.agent && agentSuggestion.agent.id === a.id && agentSuggestion.action && agentSuggestion.action.text
                    ? 'Borrador de ' + a.name + ' listo en el campo nombre'
                    : 'Sugerir un borrador con ' + a.name }}
                  <span v-if="agentSuggestion && agentSuggestion.agent && agentSuggestion.agent.id === a.id && agentSuggestion.error" class="text-red-700">{{ agentSuggestion.error }}</span>
                </span>
                <button @click="askAgent(a)" :disabled="agentBusy"
                  class="shrink-0 border border-neutral-900 px-2 py-0.5 text-[10px] font-semibold transition hover:bg-neutral-900 hover:text-white disabled:opacity-40">
                  <ui-spinner v-if="agentBusy" size="h-3 w-3"></ui-spinner>
                  <span v-else>Sugerir</span>
                </button>
              </div>
            </div>
          </ui-field>
          <ui-field label="Plantilla" hint="Solo plantillas APROBADAS salen de la ventana de 24h.">
            <select v-model="form.templateId" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null" disabled>Elige una plantilla…</option>
              <option v-for="t in templates" :key="tplId(t)" :value="tplId(t)">{{ t.name }} ({{ t.status }})</option>
            </select>
          </ui-field>
          <ui-field label="Audiencia" hint="Consentimiento: solo se envían mensajes a contactos suscritos (isSubscribed).">
            <select v-model="form.tag" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null">Todos los contactos activos y suscritos</option>
              <option v-for="t in niche.tags" :key="t" :value="t">Contactos suscritos con tag "{{ t }}"</option>
            </select>
          </ui-field>
          <button @click="create" :disabled="!form.name.trim() || !form.templateId || sending"
            class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
            {{ sending ? 'Enviando…' : 'Crear y enviar' }}
          </button>
        </div>
      </ui-modal>`,
  };

  /** Modal: destinatarios de un broadcast con su estado de entrega. */
  components['recipients-modal'] = {
    props: {
      open: Boolean,
      broadcast: { type: Object, default: null },
      list: { type: Array, default: () => [] },
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" :title="'Destinatarios · ' + (broadcast ? broadcast.name : '')"
        width="max-w-2xl" @close="$emit('close')">
        <div class="overflow-x-auto border-2 border-neutral-900">
          <table class="w-full text-left text-sm">
            <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th class="px-4 py-2.5">Contacto</th>
                <th class="px-4 py-2.5">Estado</th>
                <th class="px-4 py-2.5">Error</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="r in list" :key="r.id || r._id">
                <td class="px-4 py-2.5">{{ r.name || r.contactName || r.phone || '—' }}</td>
                <td class="px-4 py-2.5">
                  <ui-badge :variant="r.status === 'failed' ? 'danger' : r.status === 'read' || r.status === 'delivered' ? 'success' : 'neutral'" dot>
                    {{ r.status || 'pending' }}
                  </ui-badge>
                </td>
                <td class="px-4 py-2.5 font-mono text-xs text-red-700">{{ r.error || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();