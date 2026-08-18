/**
 * @file sequence-modals.js — BC Secuencias (parte presentacional modales) del
 * módulo de campañas. Modal de nueva secuencia (pasos con espera y mensaje) y
 * modal del pipeline de envío (cómo se ve en el canal por tiempo). Presentacional:
 * recibe props y handlers; emite cierre. Verbatim de los bloques originales.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Modal: nueva secuencia. */
  components['sequence-modal'] = {
    props: {
      open: Boolean, form: { type: Object, default: null },
      isLive: Boolean, approvedTemplates: { type: Array, default: () => [] },
      tplId: Function, saving: Boolean,
      addStep: Function, removeStep: Function, createSequence: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" title="Nueva secuencia" width="max-w-2xl" @close="$emit('close')">
        <div class="space-y-4">
          <ui-field label="Nombre de la secuencia">
            <input v-model.trim="form.name" type="text" placeholder="Ej: Seguimiento post-venta"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
          </ui-field>
          <ui-field v-if="isLive" label="Plantilla de WhatsApp (aprobada)" hint="En WhatsApp cada paso usa una plantilla; el texto libre del paso no aplica.">
            <select v-model="form.templateId" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null" disabled>Elige una plantilla aprobada…</option>
              <option v-for="t in approvedTemplates" :key="tplId(t)" :value="tplId(t)">{{ t.name }} ({{ t.language }})</option>
            </select>
          </ui-field>
          <div class="space-y-3">
            <div v-for="(step, i) in form.steps" :key="i" class="border-2 border-neutral-200 p-3">
              <div class="flex items-center justify-between">
                <span class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Paso {{ i + 1 }}</span>
                <button v-if="form.steps.length > 1" @click="removeStep(i)" class="text-neutral-400 hover:text-red-700" aria-label="Quitar paso">
                  <ui-icon name="x" class="h-4 w-4"></ui-icon>
                </button>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <span class="font-mono text-[10px] uppercase text-neutral-400">Espera</span>
                <select v-model.number="step.delayMinutes" class="border-2 border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900">
                  <option :value="0">Ahora</option>
                  <option :value="1440">1 día</option>
                  <option :value="2880">2 días</option>
                  <option :value="4320">3 días</option>
                  <option :value="10080">7 días</option>
                </select>
              </div>
              <textarea v-model.trim="step.message" rows="2" placeholder="Mensaje del paso…"
                class="mt-2 w-full resize-none border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"></textarea>
            </div>
          </div>
          <button @click="addStep" class="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Añadir paso
          </button>
          <button @click="createSequence" :disabled="saving || !form.name.trim() || (isLive && !form.templateId)"
            class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            <ui-spinner v-if="saving" size="h-4 w-4"></ui-spinner>
            {{ saving ? 'Creando…' : 'Crear secuencia' }}
          </button>
        </div>
      </ui-modal>`,
  };

  /** Modal: pipeline de envío de la secuencia (cómo se ve en el canal). */
  components['sequence-preview-modal'] = {
    props: {
      open: Boolean, sequence: { type: Object, default: null },
      seqStepText: Function, formatSeqDelay: Function,
      formatSeqTotal: Function, seqCumulative: Function, seqTotalMinutes: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" :title="'Pipeline de envío · ' + (sequence ? sequence.name : '')" width="max-w-4xl" @close="$emit('close')">
        <div v-if="sequence" class="space-y-5">
          <!-- Pipeline horizontal: mensajes a lo largo del tiempo -->
          <div class="flex items-stretch overflow-x-auto border-2 border-neutral-900 bg-stone-50 p-4">
            <template v-for="(st, i) in (sequence.steps || [])" :key="st.order || i">
              <div class="flex w-60 shrink-0 flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[11px] font-bold text-white">
                    {{ st.order || i + 1 }}
                  </span>
                  <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-500">{{ formatSeqDelay(st.delayMinutes) }}</span>
                </div>
                <div class="mt-2 min-h-[92px] rounded-lg border border-neutral-200 bg-[#efeae2] p-2.5">
                  <div class="rounded-lg rounded-tl-none border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px]">{{ seqStepText(st) }}</div>
                </div>
                <p class="mt-1.5 truncate font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                  {{ st.template ? 'Plantilla · ' + st.template.name : 'Mensaje directo' }}
                </p>
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                  se envía en T+{{ formatSeqTotal(seqCumulative(sequence, i)) }}
                </p>
              </div>
              <div v-if="i < (sequence.steps || []).length - 1" class="flex shrink-0 flex-col items-center justify-center px-3">
                <span class="text-neutral-400">→</span>
                <span class="mt-1 whitespace-nowrap font-mono text-[9px] uppercase text-neutral-400">+{{ formatSeqDelay(st.delayMinutes) }}</span>
              </div>
            </template>
          </div>

          <!-- Información de la secuencia -->
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="grid grid-cols-2 gap-2">
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Nombre</p>
                <p class="mt-0.5 break-all text-xs font-semibold">{{ sequence.name }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Estado</p>
                <p class="mt-0.5 text-xs font-semibold" :class="sequence.status === 'active' ? 'text-emerald-700' : 'text-amber-700'">{{ sequence.status }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Pasos</p>
                <p class="mt-0.5 text-xs font-semibold">{{ (sequence.steps || []).length }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Duración total</p>
                <p class="mt-0.5 text-xs font-semibold">{{ formatSeqTotal(seqTotalMinutes(sequence)) }}</p>
              </div>
            </div>
            <div class="border border-neutral-200 bg-stone-50 p-3 text-xs text-neutral-600">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cómo funciona</p>
              <p class="mt-1.5">
                Cada paso se envía automáticamente por <strong>WhatsApp</strong> en el orden y con los
                retrasos configurados. Fuera de la ventana de 24h, WhatsApp exige una
                <strong>plantilla aprobada</strong> para re-enganchar al cliente; los mensajes directos
                solo aplican dentro de la ventana. Con el <strong>agente de ventas IA</strong> conectado,
                cada interacción puede además clasificar y dar seguimiento al lead.
              </p>
            </div>
          </div>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();