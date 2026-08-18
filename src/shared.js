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
    const closeProductResults = Z.makeProductSearch(workspace, { query: closeProductQuery, limit: 6 });

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
      const note = closeForm.note.trim();
      Z.applyLeadClose(contact, {
        outcome: closeForm.outcome,
        note,
        reason: closeForm.reason || undefined,
        products: [...closeForm.products],
        historyNote: note || undefined,
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

  /**
   * Fábrica del upload/eliminado del logo de la empresa (compartido por settings
   * y onboarding). El cuerpo FileReader → Image → canvas ≤256px → dataURL es
   * idéntico; solo cambia el destino del dataURL (onLogo), el mensaje y onRemove.
   */
  Z.makeLogoUpload = function makeLogoUpload({ toast, onLogo, onRemove, removeMsg = 'Logo eliminado', successMsg = 'Logo actualizado' }) {
    function uploadLogo(event) {
      const file = event.target.files && event.target.files[0];
      event.target.value = ''; // permite volver a elegir el mismo archivo
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        toast('Solo imágenes (PNG/JPG/WebP)', 'error');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast('Imagen muy grande: máximo 2 MB', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => toast('No se pudo leer la imagen: archivo inválido o formato no soportado', 'error');
        img.onload = () => {
          const MAX = 256;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            toast('No se pudo procesar la imagen', 'error');
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onLogo(canvas.toDataURL('image/png'));
          toast(successMsg, 'success');
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }

    function removeLogo() {
      if (onRemove) onRemove();
      toast(removeMsg, 'info');
    }

    return { uploadLogo, removeLogo };
  };
})();