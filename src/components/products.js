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
        // Solo menciones de productos vigentes (coherente con el ranking)
        consultas: mentions.value.filter(
          (m) => m.ts >= Date.now() - 30 * 864e5 && products.value.some((p) => p.id === m.productId)
        ).length,
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
              `"${(p.aliases || []).join(',')}"`,
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

      // ── Demanda y ventas ───────────────────────────────────────────────────
      const demandRange = Vue.ref(30);
      const demandPeriods = [
        { id: 7, label: '7 días' },
        { id: 30, label: '30 días' },
        { id: 90, label: '90 días' },
      ];

      function mentionsInRange(days) {
        const from = Date.now() - days * 864e5;
        return mentions.value.filter((m) => m.ts >= from);
      }

      /** Ventas por producto: cierres ganados con products en el periodo. */
      function salesInRange(days) {
        const from = Date.now() - days * 864e5;
        const sold = {};
        (workspace.value.contacts || []).forEach((c) => {
          const cl = c.leadClosed;
          if (cl && cl.outcome === 'ganada' && cl.at >= from && Array.isArray(cl.products)) {
            cl.products.forEach((pid) => {
              sold[pid] = (sold[pid] || 0) + 1;
            });
          }
        });
        return sold;
      }

      /** Ranking demanda/ventas por producto del periodo. */
      const demand = Vue.computed(() => {
        const range = demandRange.value;
        const cons = {};
        mentionsInRange(range).forEach((m) => {
          cons[m.productId] = (cons[m.productId] || 0) + 1;
        });
        const sold = salesInRange(range);
        const rows = products.value.map((p) => ({
          product: p,
          consultas: cons[p.id] || 0,
          vendidos: sold[p.id] || 0,
          conversion: cons[p.id] ? Math.round(((sold[p.id] || 0) / cons[p.id]) * 100) : 0,
        }));
        rows.sort((a, b) => b.consultas - a.consultas);
        return rows.filter((r) => r.consultas > 0 || r.vendidos > 0);
      });

      const demandTotal = Vue.computed(() => demand.value.reduce((acc, r) => acc + r.consultas, 0));
      const bestSellers = Vue.computed(() => demand.value.filter((r) => r.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos));
      const topDemand = Vue.computed(() => demand.value[0] || null);

      function exportDemandCsv() {
        const lines = ['producto,tipo,consultas,vendidos,conversion'];
        demand.value.forEach((r) => {
          lines.push(`"${r.product.name}",${r.product.type},${r.consultas},${r.vendidos},${r.conversion}`);
        });
        downloadText('demanda-productos.csv', lines.join('\n'), 'text/csv');
      }

      // ── Oportunidades (6 casos) ────────────────────────────────────────────
      const OP_CASES = {
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

      const opportunities = Vue.computed(() => {
        const out = [];
        const range = demandRange.value;
        const now = Date.now();
        const from = now - range * 864e5;
        const cons = mentionsInRange(range);
        const sold = salesInRange(range);
        const prevFrom = from - range * 864e5;
        const prevCons = mentions.value.filter((m) => m.ts >= prevFrom && m.ts < from);
        const contacts = workspace.value.contacts || [];

        products.value.forEach((p) => {
          const pc = cons.filter((m) => m.productId === p.id);
          if (!pc.length) return;
          const soldCount = sold[p.id] || 0;
          const lastM = pc.reduce((a, b) => (b.ts > a.ts ? b : a), pc[0]);
          const base = {
            product: p,
            count: pc.length,
            lastTs: lastM.ts,
            convId: lastM.convId,
            contact: contacts.find((c) => c.id === lastM.contactId) || null,
          };
          if (pc.length >= 2 && !soldCount) out.push({ ...base, caseId: 'demanda_sin_venta' });
          if (p.stock === false) out.push({ ...base, caseId: 'agotado_con_demanda' });
          const prevCount = prevCons.filter((m) => m.productId === p.id).length;
          if (prevCount > 0 && pc.length >= prevCount * 2) out.push({ ...base, caseId: 'pico_reciente', prev: prevCount });
          const byContact = {};
          pc.forEach((m) => {
            byContact[m.contactId] = (byContact[m.contactId] || 0) + 1;
          });
          const rec = Object.entries(byContact).find(([, n]) => n >= 2);
          if (rec) {
            out.push({ ...base, caseId: 'interes_recurrente', contact: contacts.find((c) => c.id === rec[0]) || null });
          }
          if (!soldCount && pc.some((m) => ['pedido', 'precio', 'reserva'].includes(m.intent))) {
            out.push({ ...base, caseId: 'intencion_fuerte' });
          }
        });

        // Venta cruzada: pares co-ocurrentes por contacto
        const byContactMap = {};
        cons.forEach((m) => {
          (byContactMap[m.contactId] = byContactMap[m.contactId] || new Set()).add(m.productId);
        });
        const pairs = {};
        Object.values(byContactMap).forEach((set) => {
          const arr = [...set];
          for (let i = 0; i < arr.length; i += 1) {
            for (let j = i + 1; j < arr.length; j += 1) {
              const key = arr[i] < arr[j] ? arr[i] + '|' + arr[j] : arr[j] + '|' + arr[i];
              pairs[key] = (pairs[key] || 0) + 1;
            }
          }
        });
        const topPair = Object.entries(pairs).sort((a, b) => b[1] - a[1])[0];
        if (topPair) {
          const [idA, idB] = topPair[0].split('|');
          const pa = products.value.find((p) => p.id === idA);
          const pb = products.value.find((p) => p.id === idB);
          if (pa && pb) {
            const pairMentions = cons.filter((m) => m.productId === idA || m.productId === idB);
            const lastM = pairMentions.reduce((a, b) => (b.ts > a.ts ? b : a), pairMentions[0]);
            out.push({
              caseId: 'venta_cruzada',
              product: pa,
              productB: pb,
              count: topPair[1],
              lastTs: lastM.ts,
              convId: lastM.convId,
              contact: contacts.find((c) => c.id === lastM.contactId) || null,
            });
          }
        }

        out.sort((a, b) => b.count - a.count);
        return out;
      });

      function openConversation(convId) {
        if (!convId) return;
        store.pendingConversationId = convId;
        ZernioCrm.navigate('inbox');
      }

      function goToLeads() {
        ZernioCrm.navigate('leads');
      }

      /** Nombre de un producto por id (o fallback). */
      function productNameOf(id) {
        const p = (workspace.value.products || []).find((x) => x.id === id);
        return p ? p.name : id;
      }

      // ── Drawer de oportunidad: leads interesadas en el producto (o par) ──
      const oppDrawerOpen = Vue.ref(false);
      const oppSelected = Vue.ref(null);

      function openOppDrawer(o) {
        oppSelected.value = o;
        oppDrawerOpen.value = true;
      }

      function closeOppDrawer() {
        oppDrawerOpen.value = false;
        oppSelected.value = null;
      }

      /** Contactos con menciones del producto (o del par) en el periodo activo. */
      const oppLeads = Vue.computed(() => {
        const o = oppSelected.value;
        if (!o) return [];
        const range = demandRange.value;
        const from = Date.now() - range * 864e5;
        const ids = new Set([o.product.id, ...(o.productB ? [o.productB.id] : [])]);
        const byContact = {};
        mentions.value.forEach((m) => {
          if (!ids.has(m.productId) || m.ts < from) return;
          const cur = byContact[m.contactId] || { contactId: m.contactId, count: 0, last: m, productIds: new Set() };
          cur.count += 1;
          cur.productIds.add(m.productId);
          if (m.ts >= cur.last.ts) cur.last = m;
          byContact[m.contactId] = cur;
        });
        const contactsMap = workspace.value.contacts || [];
        return Object.values(byContact)
          .map((x) => ({
            contact: contactsMap.find((c) => c.id === x.contactId) || null,
            count: x.count,
            last: x.last,
            productIds: [...x.productIds],
          }))
          .filter((x) => x.contact)
          .sort((a, b) => b.last.ts - a.last.ts);
      });

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
        demandRange, demandPeriods, demand, demandTotal, bestSellers, topDemand, exportDemandCsv,
        OP_CASES, opportunities, openConversation, goToLeads,
        productNameOf, oppDrawerOpen, oppSelected, oppLeads, openOppDrawer, closeOppDrawer,
        timeAgo, INTENT_LABELS, fmtD,
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
