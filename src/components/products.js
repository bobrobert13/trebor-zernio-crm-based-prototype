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
        <product-import v-if="tab === 'importar'"
          :import-mode="importMode" v-model:importInput="importInput"
          :import-rows="importRows" :import-report="importReport"
          :parse-import="parseImport" :do-import="doImport"></product-import>

        <!-- ── Demanda y ventas ─────────────────────────────────────────── -->
        <product-demand v-if="tab === 'demanda'"
          v-model:demandRange="demandRange" :demand-periods="demandPeriods"
          :demand="demand" :demand-total="demandTotal"
          :best-sellers="bestSellers" :top-demand="topDemand"
          :export-demand-csv="exportDemandCsv"></product-demand>

        <!-- ── Oportunidades ────────────────────────────────────────────── -->
        <product-opportunities v-if="tab === 'oportunidades'"
          :opportunities="opportunities"
          :opp-drawer-open="oppDrawerOpen" :opp-selected="oppSelected" :opp-leads="oppLeads"
          v-model:demandRange="demandRange" :demand-periods="demandPeriods"
          :open-opp-drawer="openOppDrawer" :close-opp-drawer="closeOppDrawer"
          :open-conversation="openConversation" :go-to-leads="goToLeads"
          :product-name-of="productNameOf" :fmt-d="fmtD" :format-price="formatPrice" :time-ago="timeAgo"
          :intent-labels="INTENT_LABELS"></product-opportunities>

        <!-- Editor + preview + confirmar eliminación (BC Editor) -->
        <product-editor
          :open="modalOpen" :edit-id="editId" :form="form"
          :preview-text="previewText" v-model:previewFull="previewFull"
          :tpl-label="tplLabel" :separator-markup="separatorMarkup"
          :remove-open="Boolean(confirmRemove)"
          :add-detail-row="addDetailRow" :remove-detail-row="removeDetailRow" :move-detail-row="moveDetailRow"
          :insert-markup="insertMarkup" :save-product="saveProduct" :remove-product="removeProduct"
          @close="modalOpen = false" @close-remove="confirmRemove = null"></product-editor>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
