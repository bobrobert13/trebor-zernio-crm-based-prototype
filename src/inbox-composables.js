/**
 * @file inbox-composables.js — Composables por bounded context de la bandeja
 * unificada (inbox-view). Extraen la lógica del setup a objetos
 * `{ refs, computeds, helpers }` con convención `Z.makeXxx`; sin template.
 * 1:1 con el comportamiento previo de src/components/inbox.js.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC Shell: estado base derivado del store (workspace, contexto por nicho,
   * listas, modo live/demo, menciones de producto, temporizadores).
   */
  function makeInboxShell({ store, getNiche, makeTimers }) {
    const workspace = Vue.computed(() => store.workspace);
    const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
    const contacts = Vue.computed(() => workspace.value.contacts || []);
    const conversations = Vue.computed(() => workspace.value.conversations || []);
    const isLive = Vue.computed(() => store.mode === 'live');

    /** Etiquetas de leads del negocio (personalizables en Configuración). */
    const leadTags = Vue.computed(() => workspace.value.leadTags || niche.value.tags || []);

    /** Campos del negocio (personalizables en Configuración). */
    const bizFields = Vue.computed(() => workspace.value.customFields || niche.value.customFields || []);

    const productMentions = Vue.computed(() => ZernioCrm.productMentionsFor(workspace.value));

    /** Núcleo compartido del score de interés (misma lógica que el tablero). */
    const interestCore = ZernioCrm.makeInterestScore({ workspace, productMentions });

    /** Pantalla de carga simulada al entrar a la bandeja. */
    const loading = Vue.ref(true);

    /** Temporizadores con cleanup en onUnmounted (composable general). */
    const { later } = makeTimers();

    return {
      workspace, niche, contacts, conversations, isLive,
      leadTags, bizFields, productMentions, interestCore,
      loading, later,
    };
  }

  /**
   * BC List: búsqueda/filtros de la bandeja, selección de conversación,
   * sincronización live y creación de conversación nueva.
   */
  function makeInboxList({ shell, toast, api, asArray, uid, resolveContactName, detachCard }) {
    const { workspace, contacts, conversations, isLive } = shell;

    const search = Vue.ref('');
    const filter = Vue.ref('all');
    const platformFilter = Vue.ref('all');
    const selectedId = Vue.ref(null);
    const newConvOpen = Vue.ref(false);
    const newContactId = Vue.ref(null);
    const humanAgent = Vue.ref(false);
    const syncing = Vue.ref(false);

    /** Conversaciones filtradas por búsqueda, pestaña/tag y plataforma. */
    const filtered = Vue.computed(() => {
      const q = search.value.trim().toLowerCase();
      return conversations.value
        .slice()
        .sort((a, b) => b.lastTs - a.lastTs)
        .filter((c) => {
          const contact = contacts.value.find((ct) => ct.id === c.contactId);
          // Leads finalizados no aparecen en la bandeja (su conversación queda archivada)
          if (contact && contact.leadClosed) return false;
          const convPlatform = c.platform || 'whatsapp';
          if (platformFilter.value !== 'all' && convPlatform !== platformFilter.value) return false;
          const haystack = `${contact ? contact.name : ''} ${(c.messages && c.messages.length) ? c.messages[c.messages.length - 1].text : ''}`.toLowerCase();
          if (q && !haystack.includes(q)) return false;
          if (filter.value === 'unread') return c.unread > 0;
          // Las pestañas son etapas del pipeline: se filtran por la etapa VIVA
          // del contacto (no por el snapshot de la conversación) para que los
          // cambios hechos en el drawer se reflejen al instante.
          if (filter.value !== 'all') {
            if (!contact) return false; // conversaciones huérfanas solo en "Todas"
            if (filter.value === 'Sin asignar') return !contact.leadTag;
            return contact.leadTag === filter.value;
          }
          return true;
        });
    });

    /** Plataformas presentes en la bandeja (conversaciones o canal conectado). */
    const presentPlatforms = Vue.computed(() => {
      const ids = new Set(conversations.value.map((c) => c.platform || 'whatsapp'));
      const tiktokConnected = (workspace.value.channels || []).some((c) => c.platform === 'tiktok' && c.connected);
      return ZernioCrm.PLATFORMS.filter((p) => ids.has(p.id) || (p.id === 'tiktok' && tiktokConnected));
    });

    /** Canal TikTok conectado (para el enlace externo). */
    const tiktokChannel = Vue.computed(() => (workspace.value.channels || []).find((c) => c.platform === 'tiktok') || null);

    /** ¿Filtro TikTok sin mensajería? */
    const tiktokEmpty = Vue.computed(() => platformFilter.value === 'tiktok' && filtered.value.length === 0);

    const selected = Vue.computed(() => conversations.value.find((c) => c.id === selectedId.value) || null);
    const selectedContact = Vue.computed(() => {
      const c = selected.value;
      return c ? contacts.value.find((ct) => ct.id === c.contactId) || null : null;
    });
    const unreadTotal = Vue.computed(() =>
      conversations.value.reduce((acc, c) => {
        const ct = contacts.value.find((x) => x.id === c.contactId);
        if (ct && ct.leadClosed) return acc; // leads finalizados no cuentan
        return acc + (c.unread || 0);
      }, 0)
    );

    /** Conversaciones visibles (excluye leads finalizados) — para los contadores. */
    const activeConversations = Vue.computed(() =>
      conversations.value.filter((c) => {
        const ct = contacts.value.find((x) => x.id === c.contactId);
        return !(ct && ct.leadClosed);
      })
    );

    /** ¿La conversación seleccionada está fuera de la ventana de 24h? */
    const outsideWindow = Vue.computed(() => {
      const conv = selected.value;
      if (!conv || !conv.messages || !conv.messages.length) {
        // Historial no disponible (carga fallida): tratar como fuera de ventana para no violar políticas
        return isLive.value && conv && conv.messagesLoaded === false;
      }
      return Date.now() - conv.messages[conv.messages.length - 1].ts > 24 * 3600 * 1000;
    });

    /** Contacto elegido en "Nueva conversación" sin actividad en las últimas 24h →
     *  WhatsApp exige una plantilla aprobada para abrir el hilo (aviso persistente). */
    const newConvNeedsTemplate = Vue.computed(() => {
      if (!newContactId.value) return false;
      return !conversations.value.some(
        (c) => c.contactId === newContactId.value && Date.now() - (c.lastTs || 0) < 24 * 3600 * 1000
      );
    });

    /** Abre una conversación; en live carga sus mensajes si aún no están. */
    async function selectConversation(conv) {
      const ct = contacts.value.find((x) => x.id === conv.contactId);
      if (ct && ct.leadClosed) {
        // Lead finalizado: su conversación no se abre desde la bandeja
        toast('Lead finalizado: la conversación ya no está activa en la bandeja', 'info');
        return;
      }
      selectedId.value = conv.id;
      humanAgent.value = false;
      detachCard(); // la ficha adjunta pertenece a la conversación anterior
      if (conv.unread > 0) conv.unread = 0;
      if (isLive.value && (conv.messages || []).length === 0) {
        // Cada conversación pide sus mensajes con SU cuenta (puede haber varias por perfil)
        const accountId = conv.accountId || (workspace.value.zernio && workspace.value.zernio.accountId);
        if (!accountId) return;
        conv.messagesLoaded = false;
        try {
          const data = await api.listMessages(conv.id, accountId);
          const list = Array.isArray(data) ? data : (data && data.messages) || [];
          conv.messages = list.map((m) => ({
            id: m.id || m.messageId,
            from: m.direction === 'outgoing' || m.from === 'me' ? 'out' : 'in',
            text: m.text || m.message || '',
            ts: Date.parse(m.timestamp || m.createdAt) || Date.now(),
            status: m.status || m.deliveryStatus || 'delivered',
          }));
          conv.lastTs = conv.messages.length ? conv.messages[conv.messages.length - 1].ts : conv.lastTs;
          conv.messagesLoaded = true;
        } catch (err) {
          toast(err.message || 'No se pudieron cargar los mensajes', 'error');
          // messagesLoaded queda false → ventana de 24h se aplica de forma conservadora
        }
      }
    }

    function backToList() {
      selectedId.value = null;
    }

    /** Último mensaje de una conversación (preview). */
    function lastMessage(conv) {
      const m = (conv.messages && conv.messages.length) ? conv.messages[conv.messages.length - 1] : null;
      return m ? `${m.from === 'out' ? 'Tú: ' : ''}${m.text}` : 'Sin mensajes';
    }

    /**
     * Sincroniza conversaciones por cada canal con mensajería (WhatsApp e Instagram).
     * Mapea participantes (planos) a contactos locales cuando no existen.
     */
    async function sync() {
      const profileId = workspace.value.zernio && workspace.value.zernio.profileId;
      if (!profileId || syncing.value) return;
      syncing.value = true;
      try {
        let added = 0;
        const errors = [];
        for (const p of ZernioCrm.PLATFORMS.filter((x) => x.inbox)) {
          const channel = (workspace.value.channels || []).find((c) => c.platform === p.id);
          const accountId = channel ? channel.accountId : p.id === 'whatsapp' ? (workspace.value.zernio && workspace.value.zernio.accountId) || '' : '';
          if (!accountId) continue; // canal no conectado: Zernio devolvería conversaciones de otras cuentas
          try {
            const data = await api.listConversations({ profileId, platform: p.id });
            let list = asArray(data);
            list = list.filter((c) => c.accountId === accountId);
            // Limpia conversaciones live huérfanas de ESTE canal (demo conv_* se mantienen)
            const liveIds = new Set(list.map((c) => c.id));
            workspace.value.conversations = workspace.value.conversations.filter(
              (c) => c.id.startsWith('conv_') || (c.platform || 'whatsapp') !== p.id || liveIds.has(c.id)
            );
            list.forEach((conv) => {
              const existing = conversations.value.find((c) => c.id === conv.id);
              if (existing) {
                // Conversaciones sincronizadas antes del fix por-cuenta: asignar accountId y refrescar
                if (!existing.accountId && conv.accountId) {
                  existing.accountId = conv.accountId;
                  existing.platform = p.id;
                  existing.lastTs = Date.parse(conv.updatedTime) || existing.lastTs;
                }
                return;
              }
              const name = conv.participantName || conv.participantUsername || 'Cliente Zernio';
              const phone = conv.participantUsername || conv.participantId || '';
              let contact = contacts.value.find((c) => digits(c.phone) === digits(phone));
              if (contact && contact.nameSource !== 'manual') {
                // Auto-corrección: nombre auto (no editado) + participante con
                // un nombre mejor sin colisión → actualizar
                const improved = resolveContactName(name, contact.phone, contacts.value);
                if (improved !== contact.name && !improved.startsWith('Cliente ')) contact.name = improved;
              }
              if (!contact) {
                contact = {
                  id: uid('ct'),
                  // Anti-colisión: si el participante trae el nombre de OTRO
                  // contacto, se usa el fallback numérico
                  name: resolveContactName(name, phone, contacts.value),
                  phone,
                  platform: p.id,
                  tags: ['cliente'],
                  leadTag: null,
                  customFields: {},
                  createdAt: Date.now(),
                  leadHistory: [{ tag: null, at: Date.now() }],
                  nameSource: 'auto',
                };
                workspace.value.contacts.unshift(contact);
              }
              workspace.value.conversations.unshift({
                id: conv.id,
                contactId: contact.id,
                platform: p.id,
                status: conv.status || 'active',
                unread: conv.unreadCount || 0,
                tags: contact.tags.slice(0, 1),
                messages: [],
                lastTs: Date.parse(conv.updatedTime) || Date.now(),
                accountId: conv.accountId,
                igProfile: conv.participant && conv.participant.instagramProfile ? conv.participant.instagramProfile : conv.participantInstagramProfile || null,
              });
              added += 1;
            });
          } catch (err) {
            errors.push(p.nombre);
          }
        }
        // Limpia conversaciones live de plataformas sin canal conectado (fantasmas)
        const connected = new Set(
          ZernioCrm.PLATFORMS.filter((x) => x.inbox).map((x) => {
            const ch = (workspace.value.channels || []).find((c) => c.platform === x.id);
            const acc = ch ? ch.accountId : x.id === 'whatsapp' ? (workspace.value.zernio && workspace.value.zernio.accountId) || '' : '';
            return acc ? x.id : null;
          }).filter(Boolean)
        );
        workspace.value.conversations = workspace.value.conversations.filter(
          (c) => c.id.startsWith('conv_') || connected.has(c.platform || 'whatsapp')
        );
        if (errors.length > 0) {
          toast(`Sincronización parcial: errores en ${errors.join(', ')}`, 'error');
        } else {
          toast(added > 0 ? `${added} conversaciones sincronizadas` : 'Sin conversaciones nuevas', 'success');
        }
      } catch (err) {
        toast(err.message || 'No se pudo sincronizar', 'error');
      } finally {
        syncing.value = false;
      }
    }

    /** Crea una conversación nueva con un contacto (demo). */
    function startConversation(onRequireTemplate) {
      const contact = contacts.value.find((c) => c.id === newContactId.value);
      if (!contact) return;
      // Regla de 24h de WhatsApp: mensaje libre solo si hubo conversación reciente;
      // si el contacto es nuevo o la última conversación pasó de 24h → plantilla aprobada
      const recent = conversations.value.some(
        (c) => c.contactId === contact.id && Date.now() - (c.lastTs || 0) < 24 * 3600 * 1000
      );
      if (!recent) {
        newConvOpen.value = false;
        onRequireTemplate();
        toast('Sin conversación en las últimas 24h: se requiere una plantilla aprobada', 'info', 5000);
        return;
      }
      const conv = {
        id: uid('conv'),
        contactId: contact.id,
        platform: 'whatsapp',
        status: 'active',
        unread: 0,
        tags: contact.tags.slice(0, 1),
        messages: [],
        lastTs: Date.now(),
      };
      workspace.value.conversations.unshift(conv);
      newConvOpen.value = false;
      newContactId.value = null;
      selectedId.value = conv.id;
      toast(`Conversación con ${contact.name} iniciada`, 'success');
    }

    /** Dígitos de un teléfono (para comparar formatos distintos). */
    function digits(phone) {
      return String(phone || '').replace(/\D/g, '');
    }

    return {
      search, filter, platformFilter, selectedId, syncing,
      newConvOpen, newContactId, humanAgent,
      filtered, presentPlatforms, tiktokChannel, tiktokEmpty,
      selected, selectedContact, unreadTotal, activeConversations, outsideWindow,
      newConvNeedsTemplate,
      selectConversation, backToList, lastMessage, sync, startConversation,
    };
  }

  /**
   * BC Tips: consejos de atención contextuales y las políticas de ventana de
   * 24h del panel de chat (agente humano IG/FB, plantilla WhatsApp).
   */
  function makeInboxTips({ shell, list, getProductMentions, getContactConvs }) {
    const tipsOpen = Vue.ref(true);

    /** Consejos de atención contextuales para el equipo (objetivo de conversión). */
    const attentionTips = Vue.computed(() => {
      const conv = list.selected.value;
      const contact = list.selectedContact.value;
      if (!conv) return [];
      const tips = [];
      const catalog = shell.workspace.value.products || [];
      const convMentions = getProductMentions().value.filter((m) => m.convId === conv.id);
      const lastOut = (conv.messages || []).filter((m) => m.from === 'out').slice(-1)[0];
      // 1. Mención con intención de compra: priorizar y ofrecer cierre
      const compra = convMentions.filter((m) => ['pedido', 'precio', 'reserva'].includes(m.intent));
      if (compra.length) {
        const lastCompra = compra.reduce((a, b) => (b.ts > a.ts ? b : a), compra[0]);
        const p = catalog.find((x) => x.id === lastCompra.productId);
        const unanswered = !lastOut || lastOut.ts < lastCompra.ts;
        if (unanswered) tips.push({ icon: 'zap', text: `El cliente preguntó por ${p ? p.name : 'un producto'} — responde con la ficha para cerrar.` });
        else tips.push({ icon: 'zap', text: 'Intención de compra detectada — ofrece el cierre con datos de pago.' });
      }
      // 2. Ventanas de 24h por plataforma
      if (list.outsideWindow.value) {
        if (conv.platform === 'whatsapp') tips.push({ icon: 'clock', text: 'Fuera de la ventana de 24h: usa una plantilla aprobada para re-enganchar.' });
        else if (['instagram', 'facebook'].includes(conv.platform)) tips.push({ icon: 'clock', text: "El cliente no ha escrito en 24h: activa 'agente humano' para responder." });
      }
      // 3. Producto agotado mencionado → ofrecer alternativa
      const agotado = convMentions
        .map((m) => catalog.find((x) => x.id === m.productId))
        .filter((p) => p && p.stock === false);
      if (agotado.length) tips.push({ icon: 'alert', text: `Preguntó por ${agotado[agotado.length - 1].name} (agotado) — ofrece una alternativa.` });
      // 4. Lead sin etapa
      if (contact && !contact.leadTag) tips.push({ icon: 'tag', text: 'Asigna una etapa a este lead para no perder el seguimiento.' });
      // 5. Clientes especiales (frecuencia a nivel de contacto, no del hilo)
      if (contact && (contact.tags || []).includes('vip')) tips.push({ icon: 'star', text: 'Cliente VIP — trato preferente y prioridad de respuesta.' });
      const contactConvs = getContactConvs().value;
      const totalMsgs = contactConvs.reduce((n, c) => n + (c.messages || []).length, 0);
      if (contactConvs.length > 1 || totalMsgs >= 12) tips.push({ icon: 'users', text: 'Cliente frecuente — aprovecha para ofrecer fidelización o combos.' });
      // 6. Primer contacto sin respuesta del equipo
      if (!lastOut && (conv.messages || []).some((m) => m.from === 'in')) tips.push({ icon: 'message', text: 'Primer contacto: personaliza el saludo con su nombre.' });
      return tips;
    });

    /** IG/FB permiten responder fuera de ventana con HUMAN_AGENT (política Meta). */
    const canHumanAgent = Vue.computed(() =>
      ['instagram', 'facebook'].includes(list.selected.value && list.selected.value.platform) && list.outsideWindow.value
    );

    /** WhatsApp fuera de ventana exige plantilla aprobada (Campañas). */
    const blockedByWindow = Vue.computed(() =>
      list.selected.value && list.selected.value.platform === 'whatsapp' && list.outsideWindow.value && shell.isLive.value
    );

    return { attentionTips, tipsOpen, canHumanAgent, blockedByWindow };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeInboxShell, makeInboxList, makeInboxTips,
  });
})();