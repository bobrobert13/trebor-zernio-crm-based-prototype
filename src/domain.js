/**
 * @file domain.js — Composables de dominio compactos y reutilizables.
 * Lógica de negocio pequeña duplicada entre módulos. Se cargan tras
 * constants/store y ANTES de shared.js (que los consume). 1:1 con el
 * comportamiento previo; las derivaciones de presentación (nivel/label)
 * se mantienen en cada componente.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * Resultados de un buscador de productos activos por name+aliases.
   * `workspace` es un computed del workspace; `query` un ref con el texto.
   * @param {import('vue').ComputedRef} workspace
   * @param {{query:string, limit?:number}} [opts]
   * @returns {import('vue').ComputedRef<Array>}
   */
  function makeProductSearch(workspace, { query, limit = 8 } = {}) {
    return Vue.computed(() => {
      const qq = query.value.trim().toLowerCase();
      return (workspace.value.products || [])
        .filter((p) => p.active !== false && (!qq || `${p.name} ${(p.aliases || []).join(' ')}`.toLowerCase().includes(qq)))
        .slice(0, limit);
    });
  }

  /**
   * Cierre de un lead (mutación canónica de leadClosed + leadHistory).
   * Cada caller aporta el `note` exacto que ya producía (trim vs default)
   * vía `note` (para leadClosed) y `historyNote` (para leadHistory).
   * @param {object} contact
   * @param {{outcome:string, note:string, reason?:string, products?:Array, at?:number, historyNote?:string}} opts
   */
  function applyLeadClose(contact, { outcome, note, reason, products, at, historyNote }) {
    if (!contact) return;
    contact.leadClosed = { at: at || Date.now(), outcome, note, reason, products: products || [] };
    contact.leadHistory = contact.leadHistory || [];
    contact.leadHistory.push({ tag: `finalizada:${outcome}`, at: contact.leadClosed.at, note: historyNote, reason });
  }

  /**
   * Núcleo del score de interés comercial por contacto: agrupa menciones
   * por producto, calcula value/threshold (percentil 75, piso $50) y los
   * factores (compra/frecuencia/alto_valor/agotado). Devuelve null si no
   * hay menciones válidas. La derivación de nivel/label es del caller.
   * @param {{workspace:import('vue').ComputedRef, productMentions:import('vue').ComputedRef}} deps
   * @returns {{scoreFor:(contact:object)=>({value:number,threshold:number,perProduct:Array,factors:string[]}|null)}} result
   */
  function makeInterestScore({ workspace, productMentions }) {
    function scoreFor(contact) {
      if (!contact) return null;
      const catalog = workspace.value.products || [];
      const ms = productMentions.value.filter(
        (m) => m.contactId === contact.id && catalog.some((p) => p.id === m.productId)
      );
      if (!ms.length) return null;
      const byP = {};
      ms.forEach((m) => {
        const cur = byP[m.productId] || { product: catalog.find((p) => p.id === m.productId), count: 0, last: m };
        cur.count += 1;
        if (m.ts >= cur.last.ts) cur.last = m;
        byP[m.productId] = cur;
      });
      const perProduct = Object.values(byP).filter((x) => x.product);
      const value = perProduct.reduce((acc, x) => acc + (Number(x.product.price) > 0 ? Number(x.product.price) : 0), 0);
      const priced = catalog.map((p) => Number(p.price)).filter((n) => n > 0).sort((a, b) => a - b);
      const threshold = priced.length ? priced[Math.floor(0.75 * (priced.length - 1))] : 50;
      const factors = [];
      if (ms.some((m) => ['pedido', 'precio', 'reserva'].includes(m.intent))) factors.push('compra');
      if (ms.length >= 2) factors.push('frecuencia');
      if (value >= threshold) factors.push('alto_valor');
      if (perProduct.some((x) => x.product.stock === false)) factors.push('agotado');
      return { value, threshold, perProduct, factors };
    }
    return { scoreFor };
  }

  /**
   * Variables {{n}} únicas de un texto de plantilla.
   * @param {string} text
   * @returns {string[]}
   */
  function makeTemplateVars(text) {
    const m = String(text || '').match(/\{\{(\d+)\}\}/g) || [];
    return [...new Set(m)];
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeProductSearch, applyLeadClose, makeInterestScore, makeTemplateVars,
  });
})();