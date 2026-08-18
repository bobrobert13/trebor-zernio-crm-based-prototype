/**
 * @file product-opportunities.js — BC Opportunities del módulo de productos.
 * Grid de oportunidades (6 casos) + drawer de leads interesadas. Presentacional:
 * recibe opCases, opportunities, oppLeads y handlers por props. Verbatim.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  /** Mapa de casos de oportunidad (datos estáticos, sin dependencias). */
  const opCases = {
    demanda_sin_venta: {
      label: 'Demanda sin venta', icon: 'chart',
      desc: 'Varios clientes consultaron este producto pero ninguno concretó.',
      sugerencia: 'Responde con la ficha y cierra: hay demanda sin venta.',
    },
    agotado_con_demanda: {
      label: 'Agotado con demanda', icon: 'alert',
      desc: 'El producto está agotado y siguen preguntando.',
      sugerencia: 'Repón stock o deriva a una alternativa.',
    },
    pico_reciente: {
      label: 'Pico de demanda', icon: 'activity',
      desc: 'Las consultas se duplicaron vs el periodo anterior.',
      sugerencia: 'Aprovecha el momento: refuerza stock y oferta.',
    },
    interes_recurrente: {
      label: 'Interés recurrente', icon: 'clock',
      desc: 'Un mismo cliente vuelve a preguntar por este producto.',
      sugerencia: 'Es un comprador probable: prioriza su seguimiento.',
    },
    intencion_fuerte: {
      label: 'Intención fuerte', icon: 'zap',
      desc: 'Las consultas muestran intención de compra (pedido/precio/reserva).',
      sugerencia: 'Prioriza y ofrece cierre con datos de pago.',
    },
    venta_cruzada: {
      label: 'Venta cruzada', icon: 'link',
      desc: 'Quienes consultan este producto también preguntan por su complemento.',
      sugerencia: 'Arma combos o sugiere el par al cerrar.',
    },
  };

  components['product-opportunities'] = {
    props: {
      opportunities: { type: Array, default: () => [] },
      oppDrawerOpen: Boolean, oppSelected: { type: Object, default: null }, oppLeads: { type: Array, default: () => [] },
      demandRange: { type: Number, default: 30 }, demandPeriods: { type: Array, default: () => [] },
      openOppDrawer: Function, closeOppDrawer: Function, openConversation: Function, goToLeads: Function,
      productNameOf: Function, fmtD: Function, formatPrice: Function, timeAgo: Function,
      INTENT_LABELS: { type: Object, default: () => ({}) },
    },
    emits: ['update:demandRange'],
    setup(props, { emit }) {
      const range = Vue.computed({ get: () => props.demandRange, set: (v) => emit('update:demandRange', v) });
      const opc = (id) => opCases[id] || {};
      return { range, opCases, opc };
    },
    template: `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold">Oportunidades de negocio</h3>
            <p class="text-sm text-neutral-500">Señales accionables por producto según las consultas del periodo ({{ range }} días).</p>
          </div>
          <select v-model.number="range" class="border-2 border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-neutral-900">
            <option v-for="p in demandPeriods" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </div>

        <div v-if="opportunities.length" class="grid gap-4 lg:grid-cols-2">
          <article v-for="(o, i) in opportunities" :key="o.caseId + '-' + i" @click="openOppDrawer(o)"
            class="cursor-pointer border-2 border-neutral-900 bg-white p-4 transition hover:-translate-y-0.5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ui-icon :name="opc(o.caseId).icon" class="h-4 w-4"></ui-icon>
                </span>
                <div>
                  <p class="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{{ opc(o.caseId).label }}</p>
                  <p class="font-semibold">{{ o.product.name }}<span v-if="o.productB"> + {{ o.productB.name }}</span></p>
                </div>
              </div>
              <ui-badge variant="accent">{{ o.count }} consulta(s)</ui-badge>
            </div>
            <p class="mt-2 text-xs text-neutral-500">
              Última: {{ fmtD(o.lastTs || Date.now()) }}
              <template v-if="o.contact"> · {{ o.contact.name }}</template>
              <template v-if="o.prev != null"> · antes: {{ o.prev }}</template>
              <template v-if="o.product.stock === false"> · <span class="text-red-700">AGOTADO</span></template>
            </p>
            <p class="mt-1.5 text-[11px] leading-snug text-neutral-400">{{ opc(o.caseId).desc }}</p>
            <div class="mt-3 flex flex-wrap gap-2">
              <button v-if="o.convId" @click.stop="openConversation(o.convId)"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="message" class="h-3.5 w-3.5"></ui-icon> Ver conversación
              </button>
              <button @click.stop="goToLeads"
                class="border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Ir al lead
              </button>
              <button class="ml-auto flex items-center gap-1 font-semibold text-[var(--accent)] underline">
                Ver leads interesadas <ui-icon name="chevron-right" class="h-3.5 w-3.5"></ui-icon>
              </button>
            </div>
          </article>
        </div>
        <div v-else class="border-2 border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">
          Sin oportunidades en este periodo: las consultas de productos generarán señales aquí.
        </div>

        <!-- Drawer: oportunidad seleccionada con las leads interesadas -->
        <ui-drawer :open="oppDrawerOpen" :title="oppSelected ? (opc(oppSelected.caseId).label + ' · ' + oppSelected.product.name + (oppSelected.productB ? ' + ' + oppSelected.productB.name : '')) : ''" width="max-w-lg" @close="closeOppDrawer">
          <div v-if="oppSelected" class="space-y-5">
            <!-- Resumen -->
            <div class="flex items-start justify-between gap-3 border-2 border-neutral-900 bg-white p-3">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ui-icon :name="opc(oppSelected.caseId).icon" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <p class="font-semibold">{{ oppSelected.product.name }}<span v-if="oppSelected.productB"> + {{ oppSelected.productB.name }}</span></p>
                  <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{{ opc(oppSelected.caseId).label }}<span v-if="oppSelected.prev != null"> · antes: {{ oppSelected.prev }}</span></p>
                </div>
              </div>
              <ui-badge :variant="oppSelected.product.stock === false ? 'danger' : 'success'" dot>{{ oppSelected.product.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <div class="border border-neutral-200 p-2.5 text-center">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Consultas</p>
                <p class="text-xl font-bold tabular-nums">{{ oppSelected.count }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5 text-center">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Última</p>
                <p class="mt-1 text-xs font-semibold">{{ fmtD(oppSelected.lastTs || Date.now()) }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5 text-center">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Valor potencial</p>
                <p class="text-xl font-bold tabular-nums text-[var(--accent)]">{{ formatPrice((oppSelected.product.price || 0) * oppSelected.count) }}</p>
              </div>
            </div>

            <!-- Qué significa esta oportunidad -->
            <div class="border border-neutral-200 bg-stone-50 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Qué significa esta oportunidad</p>
              <p class="mt-1 text-xs text-neutral-600">{{ opc(oppSelected.caseId).desc }}</p>
              <p class="mt-2 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">Qué hacer</p>
              <p class="mt-1 text-xs font-medium text-neutral-700">{{ opc(oppSelected.caseId).sugerencia }}</p>
            </div>

            <!-- Leads interesadas en el producto (o par) -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Leads interesadas ({{ oppLeads.length }})</p>
              <ul v-if="oppLeads.length" class="space-y-2">
                <li v-for="l in oppLeads" :key="l.contact.id" class="border border-neutral-200 bg-white p-3">
                  <div class="flex items-center gap-2.5">
                    <ui-avatar :name="l.contact.name" size="h-9 w-9 text-xs"></ui-avatar>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-semibold">{{ l.contact.name }}</p>
                      <p class="truncate font-mono text-[10px] text-neutral-400">{{ l.contact.phone || 'sin teléfono' }}</p>
                    </div>
                    <span class="shrink-0 font-mono text-[9px] uppercase text-neutral-400">{{ timeAgo(l.last.ts) }}</span>
                  </div>
                  <p class="mt-2 truncate border-t border-neutral-100 pt-2 text-xs text-neutral-600">{{ l.last.text }}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5">
                    <span class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ INTENT_LABELS[l.last.intent] || l.last.intent }}</span>
                    <span v-for="pid in l.productIds" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ productNameOf(pid) }}</span>
                    <span class="ml-auto flex gap-1.5">
                      <button v-if="l.last.convId" @click="openConversation(l.last.convId)"
                        class="flex items-center gap-1 border border-neutral-300 px-2 py-1 text-[11px] font-medium transition hover:border-neutral-900">
                        <ui-icon name="message" class="h-3 w-3"></ui-icon> Ver conversación
                      </button>
                      <button @click="goToLeads"
                        class="border-2 border-neutral-900 bg-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-white transition hover:shadow-none">
                        Ir al lead
                      </button>
                    </span>
                  </div>
                </li>
              </ul>
              <p v-else class="border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-400">Sin leads con consultas en el periodo.</p>
            </div>
          </div>
        </ui-drawer>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();