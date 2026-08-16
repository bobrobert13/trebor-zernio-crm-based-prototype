/* Helpers compartidos entre componentes (se carga tras store.js y antes de ui.js). */
(function () {
  const Z = (window.ZernioCrm = window.ZernioCrm || {});

  /**
   * Fábrica del flujo "cierre de lead" (compartido por bandeja y tablero de leads).
   * Recibe el workspace y el computed local de menciones, más un callback onClosed
   * para cerrar el drawer tras confirmar. Devuelve estado + helpers reutilizables.
   */
  Z.makeCloseLead = function makeCloseLead({ workspace, productMentions, toast, onClosed }) {
    const closeOpen = Vue.ref(false);
    const closeTarget = Vue.ref(null);
    const closeForm = Vue.reactive({ outcome: 'ganada', note: '', reason: '', products: [] });
    const closeProductQuery = Vue.ref('');

    /** Resultados del buscador de productos del modal de cierre. */
    const closeProductResults = Vue.computed(() => {
      const qq = closeProductQuery.value.trim().toLowerCase();
      return (workspace.value.products || [])
        .filter((p) => p.active !== false && (!qq || `${p.name} ${(p.aliases || []).join(' ')}`.toLowerCase().includes(qq)))
        .slice(0, 6);
    });

    function toggleCloseProduct(id) {
      const i = closeForm.products.indexOf(id);
      if (i >= 0) closeForm.products.splice(i, 1);
      else closeForm.products.push(id);
    }

    function productNameOf(id) {
      const p = (workspace.value.products || []).find((x) => x.id === id);
      return p ? p.name : id;
    }

    /** Etiqueta amigable del resultado interno (ganada/perdida). */
    function closeLabel(outcome) {
      return outcome === 'ganada' ? 'Concretada' : 'No concretada';
    }

    /** Etiqueta legible de una entrada del historial (cierres y reaperturas). */
    function stageLabel(tag) {
      if (!tag) return 'Sin asignar';
      if (tag === 'reabierta' || tag === 'reabierto') return 'Reabierta';
      if (String(tag).startsWith('finalizada:')) return 'Cerrada · ' + closeLabel(tag.split(':')[1]);
      return tag;
    }

    /** Historial de etapas del contacto, de la más reciente a la más antigua. */
    function historyOf(contact) {
      return ((contact && contact.leadHistory) || []).slice().reverse();
    }

    function openCloseModal(contact) {
      if (!contact) return;
      closeTarget.value = contact;
      const catalog = workspace.value.products || [];
      const ms = productMentions.value.filter(
        (m) => m.contactId === contact.id && catalog.some((p) => p.id === m.productId)
      );
      Object.assign(closeForm, {
        outcome: 'ganada',
        note: '',
        reason: '',
        products: [...new Set(ms.map((m) => m.productId).filter(Boolean))],
      });
      closeProductQuery.value = '';
      closeOpen.value = true;
    }

    function confirmClose() {
      const contact = closeTarget.value;
      if (!contact) return;
      contact.leadClosed = {
        at: Date.now(),
        outcome: closeForm.outcome,
        note: closeForm.note.trim(),
        reason: closeForm.reason || undefined,
        products: [...closeForm.products],
      };
      contact.leadHistory = contact.leadHistory || [];
      contact.leadHistory.push({
        tag: `finalizada:${closeForm.outcome}`,
        at: contact.leadClosed.at,
        note: closeForm.note.trim() || undefined,
        reason: closeForm.reason || undefined,
      });
      closeOpen.value = false;
      closeTarget.value = null;
      if (onClosed) onClosed();
      toast(`Lead cerrado como ${closeLabel(closeForm.outcome).toLowerCase()}`, 'success');
    }

    function reopenLead(contact) {
      if (!contact) return;
      contact.leadHistory = contact.leadHistory || [];
      // Conserva el cierre previo para que la timeline muestre "antes: …"
      contact.leadHistory.push({ tag: 'reabierta', at: Date.now(), prev: contact.leadClosed });
      delete contact.leadClosed;
      toast('Lead reabierto: vuelve al tablero activo', 'success');
    }

    return {
      closeOpen, closeTarget, closeForm, closeProductQuery, closeProductResults,
      toggleCloseProduct, productNameOf, closeLabel, stageLabel, historyOf,
      openCloseModal, confirmClose, reopenLead,
    };
  };
})();