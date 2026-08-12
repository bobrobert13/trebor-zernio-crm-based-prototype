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
    buildProductCard, formatPrice,
  } = ZernioCrm;

  const components = {};

  components['products-view'] = {
    setup() {
      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const products = Vue.computed(() => workspace.value.products || []);
      const mentions = Vue.computed(() => workspace.value.productMentions || []);
      const cardDefaults = Vue.computed(
        () => (PRODUCT_CARD_DEFAULTS || {})[niche.value.id] || (PRODUCT_CARD_DEFAULTS || {}).generic
      );

      // ── Pestañas del módulo ────────────────────────────────────────────────
      const tab = Vue.ref('catalogo');
      const tabs = [
        { id: 'catalogo', label: 'Catálogo', icon: 'box' },
        { id: 'importar', label: 'Importar', icon: 'download' },
        { id: 'demanda', label: 'Demanda y ventas', icon: 'chart' },
        { id: 'oportunidades', label: 'Oportunidades', icon: 'zap' },
      ];

      // ── Catálogo: filtros y KPIs ───────────────────────────────────────────
      const q = Vue.ref('');
      const typeFilter = Vue.ref('all');
      const stockFilter = Vue.ref('all');

      const filtered = Vue.computed(() => {
        const needle = q.value.trim().toLowerCase();
        return products.value.filter((p) => {
          if (typeFilter.value !== 'all' && p.type !== typeFilter.value) return false;
          if (stockFilter.value === 'agotados' && p.stock !== false) return false;
          if (stockFilter.value === 'disponibles' && p.stock === false) return false;
          if (needle && !`${p.name} ${(p.aliases || []).join(' ')} ${p.category || ''}`.toLowerCase().includes(needle)) return false;
          return true;
        });
      });

      /** Consultas por producto en los últimos N días. */
      function mentionsOf(productId, days) {
        const from = Date.now() - (days || 30) * 864e5;
        return mentions.value.filter((m) => m.productId === productId && m.ts >= from);
      }

      const kpis = Vue.computed(() => ({
        total: products.value.length,
        servicios: products.value.filter((p) => p.type === 'servicio').length,
        agotados: products.value.filter((p) => p.stock === false).length,
        consultas: mentions.value.filter((m) => m.ts >= Date.now() - 30 * 864e5).length,
      }));

      // ── CRUD con ficha técnica ─────────────────────────────────────────────
      const modalOpen = Vue.ref(false);
      const editId = Vue.ref(null);
      const confirmRemove = Vue.ref(null);
      const form = Vue.reactive({ name: '', type: 'producto', category: '', price: null, unit: '', aliases: '', stock: true, active: true, description: '', details: [], cardTemplate: '' });

      function emptyForm() {
        return {
          name: '', type: 'producto', category: '', price: null, unit: '', aliases: '',
          stock: true, active: true, description: '',
          details: (getNicheProductFields(niche.value.id) || []).map((label) => ({ label, value: '' })),
          cardTemplate: cardDefaults.value.template,
        };
      }

      function openCreate() {
        editId.value = null;
        Object.assign(form, emptyForm());
        modalOpen.value = true;
      }

      function openEdit(p) {
        editId.value = p.id;
        Object.assign(form, {
          name: p.name,
          type: p.type || 'producto',
          category: p.category || '',
          price: p.price != null ? p.price : null,
          unit: p.unit || '',
          aliases: (p.aliases || []).join(', '),
          stock: p.stock !== false,
          active: p.active !== false,
          description: p.description || '',
          details: (p.details || []).map((d) => ({ ...d })),
          cardTemplate: p.cardTemplate || cardDefaults.value.template,
        });
        modalOpen.value = true;
      }

      function saveProduct() {
        if (!form.name.trim()) {
          toast('El nombre del producto es obligatorio', 'error');
          return;
        }
        const data = {
          name: form.name.trim(),
          type: form.type,
          category: form.category.trim(),
          price: form.price != null && form.price !== '' ? Number(form.price) : null,
          unit: form.unit.trim(),
          aliases: form.aliases.split(',').map((a) => a.trim()).filter(Boolean),
          stock: form.stock !== false,
          active: form.active !== false,
          description: form.description,
          details: form.details.map((d) => ({ label: (d.label || '').trim(), value: (d.value || '').trim() })),
          cardTemplate: form.cardTemplate,
        };
        if (editId.value) {
          const idx = products.value.findIndex((p) => p.id === editId.value);
          if (idx >= 0) products.value[idx] = { ...products.value[idx], ...data };
          toast('Producto actualizado', 'success');
        } else {
          products.value.push({ id: uid('prd'), ...data, createdAt: Date.now() });
          toast('Producto agregado al catálogo', 'success');
        }
        modalOpen.value = false;
      }

      function removeProduct() {
        const id = confirmRemove.value;
        if (!id) return;
        workspace.value.products = products.value.filter((p) => p.id !== id);
        confirmRemove.value = null;
        toast('Producto eliminado', 'info');
      }

      function toggleActive(p) {
        p.active = p.active !== false ? false : true;
      }

      function toggleStock(p) {
        p.stock = p.stock === false ? true : false;
      }

      // ── Ficha técnica: rows y markup ───────────────────────────────────────
      const descRef = Vue.ref(null);

      function addDetailRow() {
        form.details.push({ label: '', value: '' });
      }

      function removeDetailRow(i) {
        form.details.splice(i, 1);
      }

      function moveDetailRow(i, dir) {
        const next = i + dir;
        if (next < 0 || next >= form.details.length) return;
        [form.details[i], form.details[next]] = [form.details[next], form.details[i]];
      }

      /** Inserta markup en el textarea de descripción (posición del cursor). */
      function insertMarkup(markup) {
        const el = descRef.value;
        if (!el) return;
        const start = el.selectionStart || 0;
        const end = el.selectionEnd || start;
        form.description = form.description.slice(0, start) + markup + form.description.slice(end);
        Vue.nextTick(() => {
          el.focus();
          const pos = start + markup.length;
          el.setSelectionRange(pos, pos);
        });
      }

      /** Preview en vivo de la tarjeta (ficha técnica del producto). */
      const previewText = Vue.computed(() =>
        buildProductCard(
          {
            name: form.name,
            description: form.description,
            details: form.details,
            price: form.price,
            unit: form.unit,
            stock: form.stock,
            cardTemplate: form.cardTemplate,
          },
          niche.value.id
        )
      );
      const previewFull = Vue.ref(false);

      /** Etiqueta del campo plantilla (los placeholders son literales, no mustaches). */
      const tplLabel = 'Plantilla del mensaje ({{nombre}} {{descripcion}} {{detalles}} {{precio}} {{unidad}} {{stock}})';
      /** Markup del separador (evita escapes dentro del template). */
      const separatorMarkup = '—\n';

      // ── Importación (CSV / JSON) y exportación ─────────────────────────────
      const importMode = Vue.ref('csv');
      const importInput = Vue.ref('');
      const importRows = Vue.ref(null); // preview validado
      const importReport = Vue.ref(null);
      const csvPlaceholder = 'Arroz con pollo,producto,Platos principales,8.5,porción,"arroz con pollo asado",si';
      const jsonPlaceholder = '[{"name":"Arroz con pollo","type":"producto","category":"Platos principales","price":8.5}]';

      function parseCsv(text) {
        return text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const cols = [];
            let cur = '';
            let inQ = false;
            for (const ch of line) {
              if (ch === '"') inQ = !inQ;
              else if (ch === ',' && !inQ) {
                cols.push(cur.trim());
                cur = '';
              } else cur += ch;
            }
            cols.push(cur.trim());
            return cols;
          });
      }

      /** Normaliza una fila importada al shape de producto. */
      function rowToProduct(cols) {
        return {
          name: cols[0] || '',
          type: String(cols[1] || 'producto').trim().toLowerCase() === 'servicio' ? 'servicio' : 'producto',
          category: cols[2] || '',
          price: cols[3] != null && String(cols[3]).trim() !== '' ? Number(String(cols[3]).replace(/[^0-9.]/g, '')) || null : null,
          unit: cols[4] || '',
          aliases: cols[5] || '',
          stock: cols[6] == null || String(cols[6]).trim() === '' ? true : !['0', 'no', 'false', 'agotado'].includes(String(cols[6]).trim().toLowerCase()),
        };
      }

      function parseImport() {
        importReport.value = null;
        const text = importInput.value.trim();
        if (!text) {
          toast('Pega o carga el contenido a importar', 'error');
          return;
        }
        let raw;
        try {
          if (importMode.value === 'json') {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) throw new Error('Se espera un array JSON');
            raw = parsed.map((o) => [o.name, o.type, o.category, o.price, o.unit, (o.aliases || []).join(', '), o.stock]);
          } else {
            raw = parseCsv(text);
            const headerIdx = raw.findIndex((r) => ['name', 'nombre'].includes(normalizeText(r[0] || '')));
            if (headerIdx >= 0) raw = raw.slice(headerIdx + 1);
          }
        } catch (err) {
          toast('No se pudo interpretar el contenido: ' + err.message, 'error');
          return;
        }
        const existing = new Set(products.value.map((p) => normalizeText(p.name)));
        const seen = new Set();
        const rows = raw.map(rowToProduct).map((p) => {
          const key = normalizeText(p.name);
          let error = '';
          if (!p.name) error = 'Falta el nombre';
          else if (existing.has(key) || seen.has(key)) error = 'Duplicado';
          seen.add(key);
          return { ...p, error };
        });
        importRows.value = rows;
        toast(rows.length ? `${rows.length} fila(s) analizadas` : 'Sin filas para importar', rows.length ? 'info' : 'error');
      }

      function doImport() {
        if (!importRows.value) return;
        const rows = importRows.value;
        const valid = rows.filter((r) => !r.error);
        const imported = valid.map((r) => ({
          id: uid('prd'),
          name: r.name,
          type: r.type,
          category: r.category,
          price: r.price,
          unit: r.unit,
          aliases: r.aliases.split(',').map((a) => a.trim()).filter(Boolean),
          stock: r.stock,
          active: true,
          description: '',
          details: (getNicheProductFields(niche.value.id) || []).map((label) => ({ label, value: '' })),
          cardTemplate: cardDefaults.value.template,
          createdAt: Date.now(),
        }));
        workspace.value.products = [...products.value, ...imported];
        importReport.value = {
          imported: imported.length,
          skipped: rows.filter((r) => r.error === 'Duplicado').length,
          errors: rows.filter((r) => r.error && r.error !== 'Duplicado').length,
        };
        importRows.value = null;
        importInput.value = '';
        toast(`${imported.length} producto(s) importados`, imported.length ? 'success' : 'info');
      }

      function exportCsv() {
        const head = ['name', 'type', 'category', 'price', 'unit', 'aliases', 'stock'];
        const lines = [head.join(',')];
        products.value.forEach((p) => {
          lines.push(
            [
              `"${String(p.name).replace(/"/g, '""')}"`,
              p.type,
              `"${String(p.category || '').replace(/"/g, '""')}"`,
              p.price != null ? p.price : '',
              `"${String(p.unit || '').replace(/"/g, '""')}"`,
              `"${(p.aliases || []).join('|').replace(/"/g, '""')}"`,
              p.stock === false ? 'no' : 'si',
            ].join(',')
          );
        });
        downloadText('catalogo-productos.csv', lines.join('\n'), 'text/csv');
      }

      function downloadText(filename, content, mime) {
        const blob = new Blob([content], { type: mime || 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      return {
        workspace, niche, products, mentions, cardDefaults,
        tab, tabs,
        q, typeFilter, stockFilter, filtered, kpis, mentionsOf,
        modalOpen, editId, confirmRemove, form,
        openCreate, openEdit, saveProduct, removeProduct, toggleActive, toggleStock,
        descRef, addDetailRow, removeDetailRow, moveDetailRow, insertMarkup,
        previewText, previewFull,
        importMode, importInput, importRows, importReport,
        parseImport, doImport, exportCsv,
        tplLabel, csvPlaceholder, jsonPlaceholder, separatorMarkup,
        canEdit, formatPrice,
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
        <div v-if="tab === 'catalogo'" class="space-y-4">
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
                      <button v-if="canEdit('products')" @click="confirmRemove = p.id" class="p-1 text-red-600 hover:text-red-800" aria-label="Eliminar">
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
        </div>

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
        <div v-if="tab === 'demanda'" class="border-2 border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">
          Demandas y ventas por producto (próximamente en esta iteración).
        </div>

        <!-- ── Oportunidades ────────────────────────────────────────────── -->
        <div v-if="tab === 'oportunidades'" class="border-2 border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-400">
          Oportunidades de negocio por producto (próximamente en esta iteración).
        </div>

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
