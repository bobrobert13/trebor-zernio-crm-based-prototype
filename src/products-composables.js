/**
 * @file products-composables.js — Composables por bounded context del módulo
 * de productos y servicios. Extraen la lógica del setup de products-view
 * (catálogo, editor de ficha, importación, demanda y oportunidades) a objetos
 * `{ refs, computeds, helpers }`. Convención `Z.makeXxx`; sin template.
 * 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  function makeCatalog({ products, mentions }) {
    const tab = Vue.ref('catalogo');
    const tabs = [
      { id: 'catalogo', label: 'Catálogo', icon: 'box' },
      { id: 'importar', label: 'Importar', icon: 'download' },
      { id: 'demanda', label: 'Demanda y ventas', icon: 'chart' },
      { id: 'oportunidades', label: 'Oportunidades', icon: 'zap' },
    ];

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

    function mentionsOf(productId, days) {
      const from = Date.now() - (days || 30) * 864e5;
      return mentions.value.filter((m) => m.productId === productId && m.ts >= from);
    }

    const kpis = Vue.computed(() => ({
      total: products.value.length,
      servicios: products.value.filter((p) => p.type === 'servicio').length,
      agotados: products.value.filter((p) => p.stock === false).length,
      consultas: mentions.value.filter(
        (m) => m.ts >= Date.now() - 30 * 864e5 && products.value.some((p) => p.id === m.productId)
      ).length,
    }));

    return { tab, tabs, q, typeFilter, stockFilter, filtered, mentionsOf, kpis };
  }

  function makeProductEditor({ products, workspace, niche, cardDefaults, canEdit, toast }) {
    const modalOpen = Vue.ref(false);
    const editId = Vue.ref(null);
    const confirmRemove = Vue.ref(null);
    const form = Vue.reactive({ name: '', type: 'producto', category: '', price: null, unit: '', aliases: '', stock: true, active: true, description: '', details: [], cardTemplate: '' });

    function emptyForm() {
      return {
        name: '', type: 'producto', category: '', price: null, unit: '', aliases: '',
        stock: true, active: true, description: '',
        details: (ZernioCrm.getNicheProductFields(niche.value.id) || []).map((label) => ({ label, value: '' })),
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
        products.value.push({ id: ZernioCrm.uid('prd'), ...data, createdAt: Date.now() });
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

    const descRef = Vue.ref(null);

    function addDetailRow() {
      form.details.push({ label: '', value: '' });
    }

    function removeDetailRow(i) {
      form.details.splice(i, 1);
    }

    function moveDetailRow(i, dir) {
      ZernioCrm.swapInPlace(form.details, i, dir);
    }

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

    const previewText = Vue.computed(() =>
      ZernioCrm.buildProductCard(
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

    const tplLabel = 'Plantilla del mensaje ({{nombre}} {{descripcion}} {{detalles}} {{precio}} {{unidad}} {{stock}})';
    const separatorMarkup = '—\n';

    return {
      modalOpen, editId, confirmRemove, form,
      openCreate, openEdit, saveProduct, removeProduct, toggleActive, toggleStock,
      descRef, addDetailRow, removeDetailRow, moveDetailRow, insertMarkup,
      previewText, previewFull, tplLabel, separatorMarkup,
    };
  }

  function makeImport({ products, workspace, niche, cardDefaults, toast }) {
    const importMode = Vue.ref('csv');
    const importInput = Vue.ref('');
    const importRows = Vue.ref(null);
    const importReport = Vue.ref(null);
    const csvPlaceholder = 'Arroz con pollo,producto,Platos principales,8.5,porción,"arroz con pollo asado",si';
    const jsonPlaceholder = '[{"name":"Arroz con pollo","type":"producto","category":"Platos principales","price":8.5}]';

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
          raw = ZernioCrm.parseCsv(text);
          const headerIdx = raw.findIndex((r) => ['name', 'nombre'].includes(ZernioCrm.normalizeText(r[0] || '')));
          if (headerIdx >= 0) raw = raw.slice(headerIdx + 1);
        }
      } catch (err) {
        toast('No se pudo interpretar el contenido: ' + err.message, 'error');
        return;
      }
      const existing = new Set(products.value.map((p) => ZernioCrm.normalizeText(p.name)));
      const seen = new Set();
      const rows = raw.map(rowToProduct).map((p) => {
        const key = ZernioCrm.normalizeText(p.name);
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
        id: ZernioCrm.uid('prd'),
        name: r.name,
        type: r.type,
        category: r.category,
        price: r.price,
        unit: r.unit,
        aliases: r.aliases.split(',').map((a) => a.trim()).filter(Boolean),
        stock: r.stock,
        active: true,
        description: '',
        details: (ZernioCrm.getNicheProductFields(niche.value.id) || []).map((label) => ({ label, value: '' })),
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
      ZernioCrm.downloadText('catalogo-productos.csv', lines.join('\n'), 'text/csv');
    }

    return {
      importMode, importInput, importRows, importReport, csvPlaceholder, jsonPlaceholder,
      parseImport, doImport, exportCsv,
    };
  }

  function makeDemand({ mentions, products, workspace }) {
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
      ZernioCrm.downloadText('demanda-productos.csv', lines.join('\n'), 'text/csv');
    }

    return { demandRange, demandPeriods, mentionsInRange, salesInRange, demand, demandTotal, bestSellers, topDemand, exportDemandCsv };
  }

  function makeOpportunities({ products, mentions, workspace, demandRange, mentionsInRange, salesInRange }) {
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
      ZernioCrm.store.pendingConversationId = convId;
      ZernioCrm.navigate('inbox');
    }

    function goToLeads() {
      ZernioCrm.navigate('leads');
    }

    function productNameOf(id) {
      const p = (workspace.value.products || []).find((x) => x.id === id);
      return p ? p.name : id;
    }

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

    return { OP_CASES, opportunities, openConversation, goToLeads, productNameOf, oppDrawerOpen, oppSelected, oppLeads, openOppDrawer, closeOppDrawer };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeCatalog, makeProductEditor, makeImport, makeDemand, makeOpportunities,
  });
})();