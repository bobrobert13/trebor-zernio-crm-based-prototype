/**
 * @file product-catalog.js — BC Catalog del módulo de productos.
 * Catálogo completo: KPIs, buscador+filtros (tipo/stock) y tabla de productos
 * con acciones. Presentacional puro: recibe datos y handlers por props; los
 * filtros se sincronizan con v-model:query (computed get/set + emit).
 * Verbatim del bloque original (refs `q`/`typeFilter`/`stockFilter` locales).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['product-catalog'] = {
    props: {
      filtered: { type: Array, default: () => [] },
      kpis: { type: Object, default: () => ({ total: 0, servicios: 0, agotados: 0, consultas: 0 }) },
      mentionsOf: Function, canEdit: Function, formatPrice: Function,
      openEdit: Function, toggleStock: Function, toggleActive: Function,
      q: { type: String, default: '' },
      typeFilter: { type: String, default: 'all' },
      stockFilter: { type: String, default: 'all' },
    },
    emits: ['update:q', 'update:typeFilter', 'update:stockFilter', 'confirm-remove'],
    setup(props, { emit }) {
      const makeModel = (prop) => Vue.computed({
        get: () => props[prop],
        set: (v) => emit(`update:${prop}`, v),
      });
      const q = makeModel('q');
      const typeFilter = makeModel('typeFilter');
      const stockFilter = makeModel('stockFilter');
      const confirmRemove = (id) => emit('confirm-remove', id);
      return { q, typeFilter, stockFilter, confirmRemove };
    },
    template: `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ kpis.total }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Servicios</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ kpis.servicios }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agotados</p>
            <p class="mt-1 text-2xl font-bold tabular-nums" :class="kpis.agotados ? 'text-red-700' : ''">{{ kpis.agotados }}</p>
          </div>
          <div class="border-2 border-neutral-900 bg-white p-4">
            <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Consultas (30 días)</p>
            <p class="mt-1 text-2xl font-bold tabular-nums">{{ kpis.consultas }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-3">
          <div class="flex w-full items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
            <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
            <input v-model.trim="q" type="search" placeholder="Buscar por nombre, alias o categoría…"
              class="w-full bg-transparent text-sm outline-none" />
          </div>
          <div class="flex w-full items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button @click="typeFilter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="typeFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Todos</button>
            <button @click="typeFilter = 'producto'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="typeFilter === 'producto' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Productos</button>
            <button @click="typeFilter = 'servicio'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="typeFilter === 'servicio' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Servicios</button>
            <span class="mx-1 h-4 w-px shrink-0 bg-neutral-200"></span>
            <button @click="stockFilter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="stockFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Stock</button>
            <button @click="stockFilter = 'disponibles'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="stockFilter === 'disponibles' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Disponibles</button>
            <button @click="stockFilter = 'agotados'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
              :class="stockFilter === 'agotados' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">Agotados</button>
          </div>
        </div>

        <div class="overflow-auto border-2 border-neutral-900 bg-white">
          <table class="w-full min-w-[820px] text-left text-sm">
            <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <tr>
                <th class="px-4 py-3">Producto</th>
                <th class="px-4 py-3">Tipo</th>
                <th class="px-4 py-3">Categoría</th>
                <th class="px-4 py-3">Precio</th>
                <th class="px-4 py-3">Stock</th>
                <th class="px-4 py-3">Consultas</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-100">
              <tr v-for="p in filtered" :key="p.id" class="hover:bg-stone-50">
                <td class="px-4 py-3">
                  <p class="font-semibold">{{ p.name }}</p>
                  <p v-if="p.aliases && p.aliases.length" class="font-mono text-[10px] text-neutral-400">{{ p.aliases.join(', ') }}</p>
                </td>
                <td class="px-4 py-3">
                  <ui-badge :variant="p.type === 'servicio' ? 'warn' : 'neutral'">{{ p.type }}</ui-badge>
                </td>
                <td class="px-4 py-3 text-xs text-neutral-500">{{ p.category || '—' }}</td>
                <td class="px-4 py-3 font-mono tabular-nums">{{ formatPrice(p.price) || '—' }} <span v-if="p.unit" class="text-[10px] text-neutral-400">/{{ p.unit }}</span></td>
                <td class="px-4 py-3">
                  <ui-badge v-if="p.stock === false" variant="danger" dot>Agotado</ui-badge>
                  <ui-badge v-else variant="success" dot>Disponible</ui-badge>
                </td>
                <td class="px-4 py-3 font-mono tabular-nums">{{ mentionsOf(p.id, 30).length }}</td>
                <td class="px-4 py-3">
                  <ui-badge :variant="p.active === false ? 'neutral' : 'success'">{{ p.active === false ? 'Inactivo' : 'Activo' }}</ui-badge>
                </td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1">
                    <button v-if="canEdit('products')" @click="openEdit(p)" class="p-1 text-neutral-400 hover:text-neutral-900" aria-label="Editar">
                      <ui-icon name="edit" class="h-4 w-4"></ui-icon>
                    </button>
                    <button v-if="canEdit('products')" @click="toggleStock(p)" class="p-1 text-neutral-400 hover:text-neutral-900" :aria-label="p.stock === false ? 'Marcar disponible' : 'Marcar agotado'">
                      <ui-icon name="alert" class="h-4 w-4"></ui-icon>
                    </button>
                    <button v-if="canEdit('products')" @click="toggleActive(p)" class="p-1 text-neutral-400 hover:text-neutral-900" :aria-label="p.active === false ? 'Activar' : 'Desactivar'">
                      <ui-icon name="eye" class="h-4 w-4"></ui-icon>
                    </button>
                    <button v-if="canEdit('products')" @click="confirmRemove(p.id)" class="p-1 text-red-600 hover:text-red-800" aria-label="Eliminar">
                      <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="8" class="px-4 py-10 text-center text-sm text-neutral-400">Sin productos para los filtros actuales.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();