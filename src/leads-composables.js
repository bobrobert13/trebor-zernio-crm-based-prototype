/**
 * @file leads-composables.js — Composables por bounded context del tablero de
 * leads. Extraen la lógica del setup de leads-view (kanban, relaciones, drawer,
 * recordatorios, interés) a objetos `{ refs, computeds, helpers }`. Convención
 * `Z.makeXxx`; sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC Board: columnas, tabs activas/finalizadas, tarjetas por columna y
   * drag & drop nativo HTML5 + botones de respaldo.
   */
  function makeLeadBoard({ workspace, contacts, leadTags, canEdit, toast }) {
    /** Columnas del kanban: "Sin asignar" + etapas del pipeline. */
    const columns = Vue.computed(() => [
      { id: '__sin_asignar__', nombre: 'Sin asignar' },
      ...leadTags.value.map((t) => ({ id: t, nombre: t })),
    ]);

    /** Tabs: activas / finalizadas. */
    const viewTab = Vue.ref('activas');
    const activeContacts = Vue.computed(() => contacts.value.filter((c) => !c.leadClosed));
    const closedContacts = Vue.computed(() => contacts.value.filter((c) => c.leadClosed));

    /** Contactos de una columna (solo leads activas). */
    function cardsOf(col) {
      return activeContacts.value.filter((c) => {
        if (col.id === '__sin_asignar__') return !c.leadTag || !leadTags.value.includes(c.leadTag);
        return c.leadTag === col.id;
      });
    }

    // ── Drag & drop nativo HTML5 + botones ─────────────────────────────────
    const dragContactId = Vue.ref(null);

    function onDragStart(event, contact) {
      if (!canEdit('leads')) {
        event.preventDefault();
        return;
      }
      // Firefox exige datos en dataTransfer para iniciar el arrastre
      event.dataTransfer.setData('text/plain', contact.id);
      event.dataTransfer.effectAllowed = 'move';
      dragContactId.value = contact.id;
    }

    function onDragEnd() {
      dragContactId.value = null;
    }

    function onDragOver(event) {
      event.preventDefault(); // permite el drop
    }

    function onDrop(col) {
      const id = dragContactId.value;
      dragContactId.value = null;
      if (!id || !canEdit('leads')) return;
      const contact = contacts.value.find((c) => c.id === id);
      if (!contact) return;
      ZernioCrm.applyLeadTag(contact, col.id === '__sin_asignar__' ? null : col.id);
      toast(`Lead movido a "${col.nombre}"`, 'success');
    }

    /** Mueve un contacto a la columna anterior/siguiente (respaldo accesible). */
    function moveContact(contact, dir) {
      if (!canEdit('leads')) return;
      const idx = columns.value.findIndex((c) => (contact.leadTag && leadTags.value.includes(contact.leadTag) ? c.id === contact.leadTag : c.id === '__sin_asignar__'));
      const next = columns.value[idx + dir];
      if (!next) return;
      ZernioCrm.applyLeadTag(contact, next.id === '__sin_asignar__' ? null : next.id);
      toast(`Lead movido a "${next.nombre}"`, 'success');
    }

    return {
      columns, viewTab, activeContacts, closedContacts, cardsOf,
      dragContactId, onDragStart, onDragEnd, onDragOver, onDrop, moveContact,
    };
  }

  /**
   * BC Card/Detail: derivados relacionales del contacto (conversaciones,
   * último mensaje, métricas, barras por canal).
   */
  function makeContactMetrics({ workspace, contacts, conversations }) {
    /** Conversaciones de un contacto. */
    function conversationsOf(contact) {
      return conversations.value.filter((c) => c.contactId === contact.id);
    }

    /** Último mensaje (texto y hora) de un contacto. */
    function lastMessageOf(contact) {
      const convs = conversationsOf(contact);
      let best = null;
      convs.forEach((c) => {
        const m = c.messages && c.messages[c.messages.length - 1];
        if (m && (!best || m.ts > best.ts)) best = m;
      });
      return best;
    }

    /** Métricas de relación del contacto (para tarjeta y drawer). */
    function metricsOf(contact) {
      const convs = conversationsOf(contact);
      const totalMsgs = convs.reduce((acc, c) => acc + (c.messages ? c.messages.length : 0), 0);
      const days = Math.max(1, Math.round((Date.now() - (contact.createdAt || Date.now())) / 864e5));
      // Canal más frecuente por conteo de mensajes (demo: pseudo si no hay historial)
      const channelCounts = {};
      convs.forEach((c) => {
        const p = c.platform || 'whatsapp';
        channelCounts[p] = (channelCounts[p] || 0) + (c.messages ? c.messages.length : 0);
      });
      if (Object.keys(channelCounts).length === 0) {
        const seed = ZernioCrm.hashSeed(contact.id + 'ch');
        channelCounts.whatsapp = (seed % 5) + 1;
        if (seed % 2 === 0) channelCounts.instagram = (seed % 3) + 1;
      }
      const topChannel = Object.entries(channelCounts).sort((a, b) => b[1] - a[1])[0] || ['whatsapp', 0];
      const freqPerDay = totalMsgs / days;
      const vip = (contact.tags || []).includes('vip');
      const frecuente = totalMsgs >= 10 || (contact.tags || []).includes('frecuente');
      return { convs, totalMsgs, days, channelCounts, topChannel, freqPerDay, vip, frecuente };
    }

    /** Suma de mensajes por canal (para barras del drawer). */
    function channelBars(metrics) {
      const entries = Object.entries(metrics.channelCounts).sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...entries.map(([, v]) => v));
      return entries.map(([platform, count]) => ({
        platform,
        count,
        pct: Math.round((count / max) * 100),
      }));
    }

    return { conversationsOf, lastMessageOf, metricsOf, channelBars };
  }

  /**
   * BC Detail: estado del drawer de detalle + navegación a bandeja + historial.
   */
  function makeLeadDetail({ store, navigate }) {
    const detailOpen = Vue.ref(false);
    const detailContact = Vue.ref(null);
    const detailTab = Vue.ref('perfil'); // pestaña del drawer: perfil | actividades

    function openDetail(contact) {
      detailContact.value = contact;
      detailTab.value = 'perfil';
      detailOpen.value = true;
    }

    /** Abre la conversación en la bandeja (sin salir de la lógica del drawer). */
    function openConversation(conv) {
      if (!conv) return;
      store.pendingConversationId = conv.id;
      navigate('inbox');
    }

    /** Historial de etapas del contacto, de la más reciente a la más antigua. */
    function historyOf(contact) {
      return ((contact && contact.leadHistory) || []).slice().reverse();
    }

    return { detailOpen, detailContact, detailTab, openDetail, openConversation, historyOf };
  }

  /**
   * BC Detail: etiquetas legibles del historial de etapas (usa closeLabel).
   */
  function makeLeadHistory({ closeLabel }) {
    /** Etiqueta legible de una entrada del historial (cierres y reaperturas). */
    function stageLabel(tag) {
      if (!tag) return 'Sin asignar';
      if (tag === 'reabierta' || tag === 'reabierto') return 'Reabierta';
      if (String(tag).startsWith('finalizada:')) return 'Cerrada · ' + closeLabel(tag.split(':')[1]);
      return tag;
    }
    return { stageLabel };
  }

  /**
   * BC Reminders: estado y operaciones de recordatorios del lead (panel local).
   */
  function makeLeadReminders({ store, contacts, remindersOf, addReminder, toast }) {
    const remInput = Vue.reactive({ text: '', dueAt: '' });
    const remPanelOpen = Vue.ref(false);

    /** Pendientes sin completar de un contacto. */
    function pendingReminders(contact) {
      return remindersOf(contact.id).filter((r) => !r.done);
    }

    /** ¿Hay recordatorios vencidos para el contacto? */
    function hasOverdue(contact) {
      return pendingReminders(contact).some((r) => r.dueAt && Date.parse(r.dueAt) < Date.now());
    }

    function addReminderFor(contact) {
      const text = remInput.text.trim();
      if (!text) return;
      addReminder(contact.id, text, remInput.dueAt || null);
      remInput.text = '';
      remInput.dueAt = '';
      toast('Recordatorio creado', 'success');
    }

    /** Próximos recordatorios de todas las leads (panel del header). */
    const upcomingReminders = Vue.computed(() =>
      (store.workspace && store.workspace.reminders || [])
        .filter((r) => !r.done)
        .map((r) => ({ ...r, contact: contacts.value.find((c) => c.id === r.contactId) || null }))
        .sort((a, b) => (a.dueAt || '9999') < (b.dueAt || '9999') ? -1 : 1)
        .slice(0, 12)
    );

    return { remInput, remPanelOpen, pendingReminders, hasOverdue, addReminderFor, upcomingReminders };
  }

  /**
   * BC Interest: wrapper de interés comercial sobre makeInterestScore.
   */
  function makeLeadInterest({ workspace, productMentions }) {
    /** Etiquetas legibles de cada factor de interés (solo el tablero las pinta). */
    const FACTOR_LABELS = {
      compra: 'Intención de compra',
      frecuencia: 'Interés frecuente',
      alto_valor: 'Alto valor',
      agotado: 'Agotado con demanda',
    };
    const core = ZernioCrm.makeInterestScore({ workspace, productMentions });

    function interestScore(contact) {
      const empty = { nivel: null, label: '', products: [], value: 0, factors: [], perProduct: [] };
      const s = core.scoreFor(contact);
      if (!s) return empty;
      let nivel = 'bajo';
      if (s.factors.length >= 3 || (s.factors.includes('compra') && s.factors.includes('alto_valor'))) nivel = 'alto';
      else if (s.factors.length === 2) nivel = 'medio';
      const label = nivel === 'alto' ? 'Interés alto' : nivel === 'medio' ? 'Interés medio' : 'Interés';
      return {
        nivel, label,
        factors: s.factors.map((id) => ({ id, label: FACTOR_LABELS[id] })),
        products: s.perProduct.map((x) => x.product.name),
        value: s.value,
        perProduct: s.perProduct.map((x) => ({ product: x.product, count: x.count, intent: x.last.intent, lastTs: x.last.ts })),
      };
    }
    return { interestScore };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeLeadBoard, makeContactMetrics, makeLeadDetail, makeLeadHistory,
    makeLeadReminders, makeLeadInterest,
  });
})();