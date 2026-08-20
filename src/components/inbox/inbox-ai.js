/**
 * @file inbox-ai.js — BC IA de la bandeja unificada: diagnóstico, análisis,
 * plan de acción, respuestas sugeridas y agentes IA conectados.
 * Presentacional puro: estado por props, acciones por eventos.
 * Verbatim del bloque `<ui-drawer>` del asistente original.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['inbox-ai-drawer'] = {
    props: {
      open: Boolean, selected: { type: Object, default: null },
      selectedContact: { type: Object, default: null },
      analysis: { type: Object, default: null },
      agents: Array, aiAgentBusy: Boolean, aiAgentResult: { type: Object, default: null },
      stageLabel: Function, getPlatform: Function, formatPrice: Function,
      intentLabels: { type: Object, default: () => ({}) },
      outsideWindow: Boolean, timeAgo: Function,
    },
    emits: ['close', 'reminder', 'use-reply', 'ask', 'use-action', 'use-action-close'],
    template: `
      <ui-drawer :open="open" width="max-w-xl" :title="'Asistente IA · ' + (selectedContact ? selectedContact.name : 'Conversación')" @close="$emit('close')">
        <div v-if="analysis" class="space-y-5">
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
                  {{ analysis.interest.nivel ? (analysis.interest.nivel === 'alto' ? 'Alto' : analysis.interest.nivel === 'medio' ? 'Medio' : 'Bajo') : 'Sin señales' }}
                  <span v-if="analysis.interest.value > 0" class="font-mono text-[10px] text-neutral-500">· {{ formatPrice(analysis.interest.value) }}</span>
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
              <li v-for="(s, i) in analysis.senales" :key="i" class="flex items-start gap-2 text-xs">
                <ui-icon name="check-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"></ui-icon>
                <span>{{ s }}</span>
              </li>
            </ul>
            <div v-if="analysis.interest.productos.length" class="mt-2 flex flex-wrap gap-1.5">
              <span v-for="x in analysis.interest.productos" :key="x.product.id" class="border border-neutral-200 bg-stone-50 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                {{ x.product.name }} · {{ formatPrice(x.product.price) }} · {{ intentLabels[x.intent] || x.intent }}
              </span>
            </div>
          </div>

          <!-- Plan de acción -->
          <div class="border-2 border-[var(--accent)] p-3">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Plan de acción sugerido</p>
            <ol class="space-y-1.5">
              <li v-for="(p, i) in analysis.plan" :key="i" class="flex items-start gap-2 text-xs">
                <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[9px] font-bold text-white">{{ i + 1 }}</span>
                <span>{{ p }}</span>
              </li>
            </ol>
            <button @click="$emit('reminder')" class="mt-3 flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="clock" class="h-3.5 w-3.5"></ui-icon> Crear recordatorio de seguimiento
            </button>
          </div>

          <!-- Respuestas sugeridas -->
          <div>
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Respuestas sugeridas</p>
            <div class="space-y-2">
              <button v-for="r in analysis.respuestas" :key="r.label" @click="$emit('use-reply', r)"
                class="flex w-full items-center justify-between gap-2 border-2 border-neutral-200 px-3 py-2.5 text-left text-xs transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                <span class="min-w-0 flex-1">{{ r.text }}</span>
                <span class="shrink-0 font-semibold text-[var(--accent)] underline">Usar</span>
              </button>
            </div>
          </div>

          <!-- Agentes IA conectados (módulo Agente) -->
          <div class="border-t-2 border-neutral-900 pt-4">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agentes conectados</p>
            <div v-if="agents.length" class="space-y-2">
              <div v-for="a in agents" :key="a.id" class="border border-neutral-200 p-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold">{{ a.name }}
                    <span class="font-mono text-[9px] uppercase text-neutral-400">· {{ a.provider }}</span>
                  </span>
                  <button @click="$emit('ask', a)" :disabled="aiAgentBusy"
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
                      <button v-if="aiAgentResult.action.text" @click="$emit('use-action-close', aiAgentResult.action)"
                        class="border-2 border-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">Usar respuesta</button>
                      <button v-if="aiAgentResult.action.leadTag" @click="$emit('use-action', aiAgentResult.action)"
                        class="border-2 border-neutral-900 px-2 py-1 text-[11px] font-semibold">Asignar etapa</button>
                      <button v-if="aiAgentResult.action.action === 'close_sale'" @click="$emit('use-action', aiAgentResult.action)"
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
      </ui-drawer>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();