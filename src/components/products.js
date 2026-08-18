/**
 * @file products.js — Módulo de productos y servicios: catálogo con ficha
 * técnica (formato WhatsApp con preview), importación CSV/JSON, demanda y
 * ventas por producto, y oportunidades de negocio (6 casos).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const {
    store, toast, uid, canEdit, getNiche,
    getNicheProductFields, PRODUCT_CARD_DEFAULTS, normalizeText,
    buildProductCard, formatPrice, timeAgo, INTENT_LABELS, fmtD,
  } = ZernioCrm;

  const components = {};

  components['products-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const products = Vue.computed(() => workspace.value.products || []);
      const mentions = Vue.computed(() => ZernioCrm.productMentionsFor(workspace.value));
      const cardDefaults = Vue.computed(
        () => (PRODUCT_CARD_DEFAULTS || {})[niche.value.id] || (PRODUCT_CARD_DEFAULTS || {}).generic
      );

      // Composición por bounded context (ver src/products-composables.js)
      const catalog = ZernioCrm.makeCatalog({ products, mentions });
      const editor = ZernioCrm.makeProductEditor({ products, workspace, niche, cardDefaults, canEdit, toast });
      const importer = ZernioCrm.makeImport({ products, workspace, niche, cardDefaults, toast });
      const demand = ZernioCrm.makeDemand({ mentions, products, workspace });
      const opp = ZernioCrm.makeOpportunities({
        products, mentions, workspace,
        demandRange: demand.demandRange,
        mentionsInRange: demand.mentionsInRange,
        salesInRange: demand.salesInRange,
      });

      return {
        workspace, niche, products, mentions, cardDefaults,
        ...catalog,     // tab, tabs, q, typeFilter, stockFilter, filtered, kpis, mentionsOf
        ...editor,      // modalOpen, editId, confirmRemove, form, handlers, preview, tpl, separator
        ...importer,    // importMode/input/rows/report, placeholders, parse/doImport, exportCsv
        ...demand,      // demandRange, demandPeriods, demand, demandTotal, bestSellers, topDemand, exportDemandCsv
        ...opp,         // OP_CASES, opportunities, openConversation, goToLeads, productNameOf, oppDrawer*, oppLeads
        canEdit, formatPrice, timeAgo, INTENT_LABELS, fmtD,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Productos y servicios</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Catálogo de {{ workspace.name }} · {{ niche.nombre }}
              <span class="font-mono text-[10px] text-neutral-400">({{ products.length }} items)</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="exportCsv" class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar CSV
            </button>
            <button v-if="canEdit('products')" @click="openCreate"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo producto
            </button>
          </div>
        </header>

        <!-- Tabs del módulo -->
        <div class="flex gap-1.5 overflow-x-auto scrollbar-none border-b-2 border-neutral-900">
          <button v-for="t in tabs" :key="t.id" @click="tab = t.id"
            class="flex shrink-0 items-center gap-1.5 border-2 border-b-0 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition"
            :class="tab === t.id ? 'border-neutral-900 bg-white text-neutral-900' : 'border-transparent text-neutral-400 hover:text-neutral-900'">
            <ui-icon :name="t.icon" class="h-3.5 w-3.5"></ui-icon>
            {{ t.label }}
          </button>
        </div>

        <!-- ── Catálogo ─────────────────────────────────────────────────── -->
        <product-catalog
          v-if="tab === 'catalogo'"
          :filtered="filtered" :kpis="kpis" :mentions-of="mentionsOf"
          :can-edit="canEdit" :format-price="formatPrice" :open-edit="openEdit"
          :toggle-stock="toggleStock" :toggle-active="toggleActive"
          v-model:q="q" v-model:typeFilter="typeFilter" v-model:stockFilter="stockFilter"
          @confirm-remove="confirmRemove = $event"></product-catalog>

        <!-- ── Importar ─────────────────────────────────────────────────── -->
        <div v-if="tab === 'importar'" class="grid items-start gap-6 lg:grid-cols-2">
          <section class="border-2 border-neutral-900 bg-white p-5">
            <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Importar catálogo</h3>
            <p class="text-sm text-neutral-500">
              Carga productos desde <span class="font-semibold">CSV</span> (columnas
              <span class="font-mono text-xs">name,type,category,price,unit,aliases,stock</span>) o un
              <span class="font-semibold">JSON</span> (array de objetos con las mismas claves).
            </p>
            <div class="mt-3 flex gap-1.5">
              <button @click="importMode = 'csv'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="importMode === 'csv' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300'">CSV</button>
              <button @click="importMode = 'json'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="importMode === 'json' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300'">JSON</button>
            </div>
            <textarea v-model.trim="importInput" rows="8" spellcheck="false"
              :placeholder="importMode === 'csv' ? csvPlaceholder : jsonPlaceholder"
              class="mt-3 w-full resize-none border-2 border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900"></textarea>
            <button @click="parseImport" class="mt-3 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Analizar contenido
            </button>
          </section>

          <section class="border-2 border-neutral-900 bg-white p-5">
            <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Vista previa y resultado</h3>
            <template v-if="importRows">
              <div class="max-h-80 overflow-auto border border-neutral-200">
                <table class="w-full text-left text-xs">
                  <thead class="sticky top-0 bg-white font-mono text-[9px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th class="px-2 py-2">Nombre</th>
                      <th class="px-2 py-2">Tipo</th>
                      <th class="px-2 py-2">Precio</th>
                      <th class="px-2 py-2">Stock</th>
                      <th class="px-2 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    <tr v-for="(r, i) in importRows" :key="i" :class="r.error ? 'bg-red-50' : ''">
                      <td class="px-2 py-1.5 font-medium">{{ r.name || '—' }}</td>
                      <td class="px-2 py-1.5">{{ r.type }}</td>
                      <td class="px-2 py-1.5 font-mono">{{ r.price != null ? r.price : '—' }}</td>
                      <td class="px-2 py-1.5">{{ r.stock === false ? 'Agotado' : 'Disponible' }}</td>
                      <td class="px-2 py-1.5 font-mono text-[10px]" :class="r.error ? 'text-red-700' : 'text-emerald-700'">{{ r.error || 'OK' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <button @click="doImport" class="mt-3 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Importar {{ importRows.filter(r => !r.error).length }} producto(s)
              </button>
            </template>
            <template v-else-if="importReport">
              <div class="space-y-2 border-2 border-emerald-800 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p class="font-semibold">Importación completada</p>
                <p>{{ importReport.imported }} importados · {{ importReport.skipped }} duplicados omitidos · {{ importReport.errors }} con errores</p>
              </div>
            </template>
            <p v-else class="text-sm text-neutral-400">Pega el contenido a la izquierda y pulsa "Analizar contenido".</p>
          </section>
        </div>

        <!-- ── Demanda y ventas ─────────────────────────────────────────── -->
        <div v-if="tab === 'demanda'" class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold">Demanda y ventas por producto</h3>
              <p class="text-sm text-neutral-500">Consultas detectadas en conversaciones y cierres ganados vinculados.</p>
            </div>
            <div class="flex items-center gap-2">
              <select v-model.number="demandRange" class="border-2 border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-neutral-900">
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
        </div>

        <!-- ── Oportunidades ────────────────────────────────────────────── -->
        <div v-if="tab === 'oportunidades'" class="space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-bold">Oportunidades de negocio</h3>
              <p class="text-sm text-neutral-500">Señales accionables por producto según las consultas del periodo ({{ demandRange }} días).</p>
            </div>
            <select v-model.number="demandRange" class="border-2 border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-neutral-900">
              <option v-for="p in demandPeriods" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>

          <div v-if="opportunities.length" class="grid gap-4 lg:grid-cols-2">
            <article v-for="(o, i) in opportunities" :key="o.caseId + '-' + i" @click="openOppDrawer(o)"
              class="cursor-pointer border-2 border-neutral-900 bg-white p-4 transition hover:-translate-y-0.5">
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                    <ui-icon :name="OP_CASES[o.caseId].icon" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">{{ OP_CASES[o.caseId].label }}</p>
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
              <p class="mt-1.5 text-[11px] leading-snug text-neutral-400">{{ OP_CASES[o.caseId].desc }}</p>
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
        </div>

        <!-- Drawer: oportunidad seleccionada con las leads interesadas -->
        <ui-drawer :open="oppDrawerOpen" :title="oppSelected ? (OP_CASES[oppSelected.caseId].label + ' · ' + oppSelected.product.name + (oppSelected.productB ? ' + ' + oppSelected.productB.name : '')) : ''" width="max-w-lg" @close="closeOppDrawer">
          <div v-if="oppSelected" class="space-y-5">
            <!-- Resumen -->
            <div class="flex items-start justify-between gap-3 border-2 border-neutral-900 bg-white p-3">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ui-icon :name="OP_CASES[oppSelected.caseId].icon" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <p class="font-semibold">{{ oppSelected.product.name }}<span v-if="oppSelected.productB"> + {{ oppSelected.productB.name }}</span></p>
                  <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{{ OP_CASES[oppSelected.caseId].label }}<span v-if="oppSelected.prev != null"> · antes: {{ oppSelected.prev }}</span></p>
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
              <p class="mt-1 text-xs text-neutral-600">{{ OP_CASES[oppSelected.caseId].desc }}</p>
              <p class="mt-2 font-mono text-[9px] uppercase tracking-widest text-[var(--accent)]">Qué hacer</p>
              <p class="mt-1 text-xs font-medium text-neutral-700">{{ OP_CASES[oppSelected.caseId].sugerencia }}</p>
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

        <!-- Modal: nuevo/editar producto con ficha técnica -->
        <ui-modal :open="modalOpen" :title="(editId ? 'Editar' : 'Nuevo') + ' producto'" width="max-w-4xl" @close="modalOpen = false">
          <div class="grid gap-6 lg:grid-cols-2">
            <!-- Editor -->
            <div class="space-y-4">
              <div class="grid gap-3 sm:grid-cols-2">
                <ui-field label="Nombre *">
                  <input v-model.trim="form.name" type="text" placeholder="Ej: Arroz con pollo"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Tipo">
                  <select v-model="form.type" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                    <option value="producto">Producto</option>
                    <option value="servicio">Servicio</option>
                  </select>
                </ui-field>
              </div>
              <div class="grid gap-3 sm:grid-cols-3">
                <ui-field label="Categoría">
                  <input v-model.trim="form.category" type="text" placeholder="Ej: Platos principales"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Precio">
                  <input v-model.number="form.price" type="number" min="0" step="0.01" placeholder="0.00"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Unidad">
                  <input v-model.trim="form.unit" type="text" placeholder="porción"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
              </div>
              <ui-field label="Alias de detección (separados por coma)">
                <input v-model.trim="form.aliases" type="text" placeholder="Ej: arroz con pollo asado, pollo"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <div class="flex items-center gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <ui-toggle v-model="form.stock"></ui-toggle> Disponible
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <ui-toggle v-model="form.active"></ui-toggle> Activo
                </label>
              </div>

              <!-- Ficha técnica -->
              <div class="border-2 border-neutral-900 p-4">
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Descripción (formato WhatsApp)</p>
                <div class="mb-2 flex flex-wrap gap-1">
                  <button @click="insertMarkup('*negrita*')" class="border px-2 py-1 font-mono text-[10px] font-bold">B</button>
                  <button @click="insertMarkup('_cursiva_')" class="border px-2 py-1 font-mono text-[10px] italic">I</button>
                  <button @click="insertMarkup('~tachado~')" class="border px-2 py-1 font-mono text-[10px] line-through">S</button>
                  <button @click="insertMarkup('• ')">• lista</button>
                  <button @click="insertMarkup(separatorMarkup)">— separador</button>
                  <button @click="insertMarkup('😊')">emoji</button>
                </div>
                <textarea ref="descRef" v-model.trim="form.description" rows="4" placeholder="Descripción del producto…"
                  class="w-full resize-none border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"></textarea>
              </div>

              <!-- Detalles de la ficha -->
              <div class="border-2 border-neutral-900 p-4">
                <div class="mb-2 flex items-center justify-between">
                  <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Ficha técnica (detalles)</p>
                  <button @click="addDetailRow" class="flex items-center gap-1 border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">
                    <ui-icon name="plus" class="h-3 w-3"></ui-icon> Agregar
                  </button>
                </div>
                <div class="space-y-1.5">
                  <div v-for="(d, i) in form.details" :key="i" class="flex items-center gap-1.5">
                    <input v-model.trim="d.label" type="text" placeholder="Etiqueta"
                      class="w-1/3 border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-900" />
                    <input v-model.trim="d.value" type="text" placeholder="Valor"
                      class="min-w-0 flex-1 border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-900" />
                    <button @click="moveDetailRow(i, -1)" class="p-1 text-neutral-400 hover:text-neutral-900" aria-label="Subir">
                      <ui-icon name="chevron-up" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                    <button @click="moveDetailRow(i, 1)" class="p-1 text-neutral-400 hover:text-neutral-900" aria-label="Bajar">
                      <ui-icon name="chevron-down" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                    <button @click="removeDetailRow(i)" class="p-1 text-red-600 hover:text-red-800" aria-label="Quitar">
                      <ui-icon name="trash" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                  </div>
                </div>
              </div>

              <ui-field :label="tplLabel">
                <textarea v-model.trim="form.cardTemplate" rows="5" spellcheck="false"
                  class="w-full resize-none border-2 border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900"></textarea>
              </ui-field>

              <button @click="saveProduct"
                class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                {{ editId ? 'Guardar cambios' : 'Agregar al catálogo' }}
              </button>
            </div>

            <!-- Preview en vivo -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cómo lo recibe el cliente</p>
                <button @click="previewFull = true" class="border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">Ampliar</button>
              </div>
              <wa-preview :text="previewText"></wa-preview>
            </div>
          </div>
        </ui-modal>

        <!-- Modal: preview a pantalla completa -->
        <ui-modal :open="previewFull" title="Vista previa en WhatsApp" width="max-w-lg" @close="previewFull = false">
          <wa-preview :text="previewText" :show-header="false"></wa-preview>
        </ui-modal>

        <!-- Modal: confirmar eliminación -->
        <ui-modal :open="Boolean(confirmRemove)" title="Eliminar producto" width="max-w-md" @close="confirmRemove = null">
          <p class="text-sm text-neutral-600">¿Eliminar este producto del catálogo? Las menciones históricas se conservan.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmRemove = null" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="removeProduct" class="border-2 border-red-800 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
