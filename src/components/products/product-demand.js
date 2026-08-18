/**
 * @file product-demand.js — BC Demand del módulo de productos.
 * KPIs y gráficos de demanda/ventas por producto en un rango. Presentacional:
 * recibe demand/computed y range (v-model) por props. Verbatim de products-view.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['product-demand'] = {
    props: {
      demandRange: { type: Number, default: 30 }, demandPeriods: { type: Array, default: () => [] },
      demand: { type: Array, default: () => [] }, demandTotal: { type: Number, default: 0 },
      bestSellers: { type: Array, default: () => [] }, topDemand: { type: Object, default: null },
      exportDemandCsv: Function,
    },
    emits: ['update:demandRange'],
    setup(props, { emit }) {
      const range = Vue.computed({ get: () => props.demandRange, set: (v) => emit('update:demandRange', v) });
      return { range };
    },
    template: `
      <div class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold">Demanda y ventas por producto</h3>
            <p class="text-sm text-neutral-500">Consultas detectadas en conversaciones y cierres ganados vinculados.</p>
          </div>
          <div class="flex items-center gap-2">
            <select v-model.number="range" class="border-2 border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-neutral-900">
              <option v-for="p in demandPeriods" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
            <button @click="exportDemandCsv" class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar CSV
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Consultas del periodo</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ demandTotal }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos con demanda</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ demand.length }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Más consultado</p>
            <p class="mt-1 truncate text-lg font-bold">{{ topDemand ? topDemand.product.name : '—' }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Ventas del periodo</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ bestSellers.reduce((a, r) => a + r.vendidos, 0) }}</p>
          </div>
        </div>

        <div class="border-2 border-neutral-900 bg-white p-5">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Consultas por producto</p>
          <div v-if="demand.length" class="space-y-2.5">
            <div v-for="r in demand" :key="r.product.id" class="flex items-center gap-3">
              <span class="w-44 truncate text-sm font-medium">{{ r.product.name }}</span>
              <div class="h-2.5 flex-1 border border-neutral-200 bg-neutral-100">
                <div class="h-full bg-[var(--accent)]" :style="{ width: Math.round((r.consultas / demand[0].consultas) * 100) + '%' }"></div>
              </div>
              <span class="w-10 text-right font-mono text-xs tabular-nums">{{ r.consultas }}</span>
              <span class="w-24 text-right font-mono text-[10px] text-neutral-400">{{ r.vendidos }} vendidos · {{ r.conversion }}%</span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm text-neutral-400">Sin consultas de productos en este periodo.</p>
        </div>

        <div class="border-2 border-neutral-900 bg-white p-5">
          <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Más vendidos</p>
          <div v-if="bestSellers.length" class="space-y-2">
            <div v-for="r in bestSellers" :key="r.product.id" class="flex items-center gap-3">
              <ui-icon name="star" class="h-4 w-4 text-amber-600"></ui-icon>
              <span class="min-w-0 flex-1 truncate text-sm font-medium">{{ r.product.name }}</span>
              <span class="font-mono text-xs tabular-nums">{{ r.vendidos }} venta(s)</span>
            </div>
          </div>
          <p v-else class="py-6 text-center text-sm text-neutral-400">Sin ventas vinculadas: cierra leads ganados con productos para verlos aquí.</p>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();