/**
 * @file inbox.js — Bandeja unificada de conversaciones WhatsApp a pantalla
 * completa: lista filtrable (380px) + panel de chat que llena el área.
 * Demo: envía con delivery/lectura y respuestas entrantes simuladas.
 * Live: sincroniza conversaciones reales desde /inbox/conversations (proxy).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, getNiche, timeAgo, formatTime, formatDate, fmtDT, fmtD, uid, canEdit, PLATFORMS, getPlatform, recordProductMentions, confirmMention, discardMention, INTENT_LABELS, buildProductCard, PRODUCT_CARD_DEFAULTS, renderWhatsApp, formatPrice, activeAgents, askAgent } = ZernioCrm;

  const components = {};

  /** Auto-respondedor del agente IA: la instancia montada lo asigna; el hook de
   *  mensajes entrantes se registra UNA vez por página (evita duplicados en remounts). */
  let agentAutoReply = null;
  let agentHookRegistered = false;

  /** Respuestas entrantes simuladas para el modo demo. */
  const DEMO_REPLIES = [
    '¡Perfecto, gracias! 🙌',
    '¿Me puedes confirmar el precio?',
    'Ok, lo reviso y te escribo.',
    '¡Genial! ¿Cuándo me lo entregas?',
    'Muchas gracias por la atención 😊',
  ];

  /** Respuestas rápidas sugeridas en el composer. */
  const QUICK_REPLIES = ['Hola 👋', '¿Tienes disponibilidad?', 'Quiero hacer un pedido', 'Gracias'];

  /** Motivos de cierre de lead (misma lista que el tablero de Leads). */
  const CLOSE_REASONS = ['Compró', 'Sin respuesta', 'Se pospuso', 'Eligió otra opción'];

  components['inbox-view'] = {
    setup() {
      const search = Vue.ref('');
      const filter = Vue.ref('all');
      const platformFilter = Vue.ref('all');
      const selectedId = Vue.ref(null);
      const draft = Vue.ref('');
      const sending = Vue.ref(false);
      const loading = Vue.ref(true);
      const syncing = Vue.ref(false);
      const humanAgent = Vue.ref(false);
      const newConvOpen = Vue.ref(false);
      const newContactId = Vue.ref(null);
      const tipsOpen = Vue.ref(true);

      /** Temporizadores activos (cleanup en onUnmounted). */
      const timers = [];
      function later(fn, ms) {
        const id = setTimeout(fn, ms);
        timers.push(id);
        return id;
      }
      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const contacts = Vue.computed(() => workspace.value.contacts || []);
      const conversations = Vue.computed(() => workspace.value.conversations || []);

      /** Etiquetas de leads del negocio (personalizables en Configuración). */
      const leadTags = Vue.computed(() => workspace.value.leadTags || niche.value.tags || []);

      /** Campos del negocio (personalizables en Configuración). */
      const bizFields = Vue.computed(() => workspace.value.customFields || niche.value.customFields || []);

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
        return PLATFORMS.filter((p) => ids.has(p.id) || (p.id === 'tiktok' && tiktokConnected));
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
      const isLive = Vue.computed(() => store.mode === 'live');

      /** ¿La conversación seleccionada está fuera de la ventana de 24h? */
      const outsideWindow = Vue.computed(() => {
        const conv = selected.value;
        if (!conv || !conv.messages || !conv.messages.length) {
          // Historial no disponible (carga fallida): tratar como fuera de ventana para no violar políticas
          return isLive.value && conv && conv.messagesLoaded === false;
        }
        return Date.now() - conv.messages[conv.messages.length - 1].ts > 24 * 3600 * 1000;
      });

      /** Consejos de atención contextuales para el equipo (objetivo de conversión). */
      const attentionTips = Vue.computed(() => {
        const conv = selected.value;
        const contact = selectedContact.value;
        if (!conv) return [];
        const tips = [];
        const catalog = workspace.value.products || [];
        const convMentions = productMentions.value.filter((m) => m.convId === conv.id);
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
        if (outsideWindow.value) {
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
        const totalMsgs = contactConvs.value.reduce((n, c) => n + (c.messages || []).length, 0);
        if (contactConvs.value.length > 1 || totalMsgs >= 12) tips.push({ icon: 'users', text: 'Cliente frecuente — aprovecha para ofrecer fidelización o combos.' });
        // 6. Primer contacto sin respuesta del equipo
        if (!lastOut && (conv.messages || []).some((m) => m.from === 'in')) tips.push({ icon: 'message', text: 'Primer contacto: personaliza el saludo con su nombre.' });
        return tips;
      });

      /** IG/FB permiten responder fuera de ventana con HUMAN_AGENT (política Meta). */
      const canHumanAgent = Vue.computed(() =>
        ['instagram', 'facebook'].includes(selected.value && selected.value.platform) && outsideWindow.value
      );

      /** WhatsApp fuera de ventana exige plantilla aprobada (Campañas). */
      const blockedByWindow = Vue.computed(() =>
        selected.value && selected.value.platform === 'whatsapp' && outsideWindow.value && isLive.value
      );

      /** Pantalla de carga simulada al entrar a la bandeja. */
      later(() => { loading.value = false; }, 600);

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
            const data = await ZernioCrm.api.listMessages(conv.id, accountId);
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

      /** Marca un mensaje saliente como entregado/leído (demo). */
      function simulateDelivery(msg) {
        later(() => { if (msg.status === 'sent') msg.status = 'delivered'; }, 450);
        later(() => { if (msg.status === 'delivered') msg.status = 'read'; }, 1100);
      }

      /** Programa una respuesta entrante simulada (demo). */
      function simulateIncoming(conv) {
        const delay = 2200 + Math.random() * 1800;
        later(() => {
          const catalog = (workspace.value.products || []).filter((p) => p.active !== false);
          let reply = DEMO_REPLIES[(Math.random() * DEMO_REPLIES.length) | 0];
          // A veces el cliente demo pregunta por un producto del catálogo (demanda demo)
          if (catalog.length && Math.random() < 0.55) {
            const p = catalog[(Math.random() * catalog.length) | 0];
            const alias = (p.aliases && p.aliases.length ? p.aliases[0] : p.name);
            const pool = [
              `¿Tienen ${p.name}?`,
              `¿Cuánto cuesta ${alias}?`,
              `¿Hay ${p.name} disponible?`,
              `Quiero pedir ${p.name} para delivery`,
              `¿Precio de ${alias}?`,
            ];
            reply = pool[(Math.random() * pool.length) | 0];
          }
          const msg = { id: uid('msg'), from: 'in', text: reply, ts: Date.now(), status: 'delivered' };
          conv.messages.push(msg);
          conv.lastTs = Date.now();
          if (selectedId.value !== conv.id) conv.unread += 1;
          const contact = contacts.value.find((c) => c.id === conv.contactId);
          if (contact) recordProductMentions(contact, conv, msg, reply);
          // Auto-respuesta del agente IA (demo) — solo envío, sin nueva simulación
          if (agentAutoReply) agentAutoReply(contact, conv, msg);
        }, delay);
      }

      /** Envía el borrador por la conversación seleccionada. */
      async function send() {
        const text = draft.value.trim();
        const conv = selected.value;
        if ((!text && !cardAttach.value) || !conv || sending.value) return;
        // Políticas de ventana de 24h (validación ANTES de insertar el mensaje)
        if (isLive.value && outsideWindow.value) {
          if (conv.platform === 'whatsapp') {
            toast('WhatsApp fuera de la ventana de 24h: usa una plantilla aprobada (Campañas)', 'error');
            return;
          }
          if (['instagram', 'facebook'].includes(conv.platform) && !humanAgent.value) {
            toast('Fuera de la ventana de 24h: activa "Enviar como agente humano"', 'error');
            return;
          }
        }
        // Si hay una ficha adjunta, el mensaje final = saludo + tarjeta formateada
        const finalText = cardAttach.value ? (cardPreview.value || text) : text;
        sending.value = true;
        const msg = { id: uid('msg'), from: 'out', text: finalText, ts: Date.now(), status: 'sent', card: Boolean(cardAttach.value) };
        conv.messages.push(msg);
        conv.lastTs = msg.ts;
        draft.value = '';
        detachCard();
        try {
          if (isLive.value) {
            const payload = {
              accountId: (conv.accountId || (workspace.value.zernio && workspace.value.zernio.accountId)) || '',
              message: finalText,
            };
            if (['instagram', 'facebook'].includes(conv.platform) && outsideWindow.value) {
              payload.messagingType = 'MESSAGE_TAG';
              payload.messageTag = 'HUMAN_AGENT';
            }
            await ZernioCrm.api.sendMessage(conv.id, payload);
          } else {
            simulateDelivery(msg);
            simulateIncoming(conv);
          }
        } catch (err) {
          msg.status = 'failed';
          toast(err.message || 'No se pudo enviar el mensaje', 'error');
        } finally {
          sending.value = false;
        }
      }

      /** Dígitos de un teléfono (para comparar formatos distintos). */
      function digits(phone) {
        return String(phone || '').replace(/\D/g, '');
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
          for (const p of PLATFORMS.filter((x) => x.inbox)) {
            const channel = (workspace.value.channels || []).find((c) => c.platform === p.id);
            const accountId = channel ? channel.accountId : p.id === 'whatsapp' ? (workspace.value.zernio && workspace.value.zernio.accountId) || '' : '';
            if (!accountId) continue; // canal no conectado: Zernio devolvería conversaciones de otras cuentas
            try {
              const data = await ZernioCrm.api.listConversations({ profileId, platform: p.id });
              let list = ZernioCrm.asArray(data);
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
                  const improved = ZernioCrm.resolveContactName(name, contact.phone, contacts.value);
                  if (improved !== contact.name && !improved.startsWith('Cliente ')) contact.name = improved;
                }
                if (!contact) {
                  contact = {
                    id: uid('ct'),
                    // Anti-colisión: si el participante trae el nombre de OTRO
                    // contacto, se usa el fallback numérico
                    name: ZernioCrm.resolveContactName(name, phone, contacts.value),
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
            PLATFORMS.filter((x) => x.inbox).map((x) => {
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
      function startConversation() {
        const contact = contacts.value.find((c) => c.id === newContactId.value);
        if (!contact) return;
        // Regla de 24h de WhatsApp: mensaje libre solo si hubo conversación reciente;
        // si el contacto es nuevo o la última conversación pasó de 24h → plantilla aprobada
        const recent = conversations.value.some(
          (c) => c.contactId === contact.id && Date.now() - (c.lastTs || 0) < 24 * 3600 * 1000
        );
        if (!recent) {
          newConvOpen.value = false;
          openTemplatePicker(null);
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

      // ── Plantillas aprobadas (fuera de 24h y primer mensaje) ───────────────
      const tplModalOpen = Vue.ref(false); // re-enganche >24h
      const tplFirstOpen = Vue.ref(false); // primer mensaje de conversación nueva
      const tplList = Vue.ref([]);
      const tplSelected = Vue.ref(null);
      const tplParams = Vue.reactive({});
      const tplSending = Vue.ref(false);
      const tplTarget = Vue.ref(null); // conversación objetivo (null = abrir nueva)
      const tplError = Vue.ref(''); // error persistente al cargar plantillas (no toast efímero)

      /** ¿Algún selector de plantilla abierto? */
      const tplPickerOpen = Vue.computed(() => tplModalOpen.value || tplFirstOpen.value);

      /** Contacto elegido en "Nueva conversación" sin actividad en las últimas 24h →
       *  WhatsApp exige una plantilla aprobada para abrir el hilo (aviso persistente). */
      const newConvNeedsTemplate = Vue.computed(() => {
        if (!newContactId.value) return false;
        return !conversations.value.some(
          (c) => c.contactId === newContactId.value && Date.now() - (c.lastTs || 0) < 24 * 3600 * 1000
        );
      });

      function zernioAccountId() {
        return (workspace.value.zernio && workspace.value.zernio.accountId) || '';
      }

      /** Variables {{n}} del body de la plantilla seleccionada. */
      const tplVariables = Vue.computed(() => {
        const t = tplSelected.value;
        if (!t) return [];
        const comps = t.components || [];
        const body = comps.find((c) => c.type === 'body') || {};
        const text = t.body || body.text || '';
        const m = String(text).match(/\{\{(\d+)\}\}/g) || [];
        return [...new Set(m)];
      });

      /** Carga las plantillas APROBADAS del accountId (o demo). Los errores se
       *  muestran DENTRO del modal (tplError, persistente) — un toast se oculta
       *  solo y el usuario no sabría por qué la lista quedó vacía. */
      async function loadApprovedTemplates() {
        tplError.value = '';
        if (isLive.value) {
          const accountId = zernioAccountId();
          if (!accountId) {
            tplError.value = 'Sin cuenta WhatsApp vinculada: reconecta el canal en Canales o Configuración';
            return;
          }
          try {
            const data = await ZernioCrm.api.listTemplates(accountId);
            tplList.value = ZernioCrm.asArray(data).filter((t) => (t.status || '').toUpperCase() === 'APPROVED');
          } catch (err) {
            tplError.value = err.message || 'No se pudieron cargar las plantillas';
          }
        } else {
          const seeded = (workspace.value.templates || []).filter((t) => t.status === 'APPROVED');
          tplList.value = seeded.length
            ? seeded
            : [{ id: uid('tpl'), name: 'confirmacion_pedido', category: 'UTILITY', language: 'es', status: 'APPROVED', body: 'Hola {{1}}, tu pedido {{2}} fue confirmado. Te avisamos cuando esté listo.' }];
        }
      }

      /** Abre el selector de plantilla: target=conversación (>24h) o null (nueva). */
      function openTemplatePicker(target) {
        tplTarget.value = target || null;
        tplSelected.value = null;
        Object.keys(tplParams).forEach((k) => delete tplParams[k]);
        tplError.value = '';
        (target ? tplModalOpen : tplFirstOpen).value = true;
        loadApprovedTemplates();
      }

      function closeTemplatePicker() {
        tplModalOpen.value = false;
        tplFirstOpen.value = false;
        tplError.value = '';
      }

      // ── Ficha del cliente (drawer, flujo CRM por conversación) ─────────────
      const contactDrawerOpen = Vue.ref(false);
      const contactTab = Vue.ref('ficha'); // pestaña del drawer: ficha | actividades
      const contactTags = Vue.computed(() => workspace.value.contactTags || []);

      /** Estadísticas de comunicación del contacto (pestaña Actividades). */
      const contactStats = Vue.computed(() => {
        const c = selectedContact.value;
        if (!c) return null;
        let totalIn = 0;
        let totalOut = 0;
        let first = null;
        let last = null;
        const channels = {};
        contactConvs.value.forEach((x) => {
          const plat = x.platform || 'whatsapp';
          channels[plat] = (channels[plat] || 0) + 1;
          (x.messages || []).forEach((m) => {
            if (m.from === 'in') totalIn += 1;
            else totalOut += 1;
            if (first === null || m.ts < first) first = m.ts;
            if (last === null || m.ts > last) last = m.ts;
          });
        });
        return {
          totalIn,
          totalOut,
          first,
          last,
          channels: Object.entries(channels).sort((a, b) => b[1] - a[1]),
        };
      });

      /** Alterna una etiqueta de contacto (clasificación general, no lead). */
      function toggleContactTag(tag) {
        const c = selectedContact.value;
        if (!c) return;
        const i = c.tags.indexOf(tag);
        if (i >= 0) c.tags.splice(i, 1);
        else c.tags.push(tag);
      }

      /** Asigna la etapa del lead al contacto (centralizado en store.applyLeadTag). */
      function setLeadTag(tag) {
        const contact = selectedContact.value;
        const wasClosed = Boolean(contact && contact.leadClosed);
        ZernioCrm.applyLeadTag(contact, tag || null);
        if (wasClosed) toast('Lead reabierto al cambiar de etapa', 'info');
      }

      /** Registra un contacto desde una conversación huérfana (sin ficha). */
      function registerContact() {
        const conv = selected.value;
        if (!conv || selectedContact.value) return;
        const contact = {
          id: uid('ct'),
          name: 'Cliente sin ficha',
          phone: '',
          platform: conv.platform || 'whatsapp',
          tags: ['cliente'],
          leadTag: null,
          customFields: {},
          createdAt: Date.now(),
          // Momento 0 del historial de etapas: cae en "Sin asignar" (null)
          leadHistory: [{ tag: null, at: Date.now() }],
        };
        workspace.value.contacts.unshift(contact);
        conv.contactId = contact.id;
        toast('Contacto registrado: completa su ficha aquí mismo', 'success');
      }

      // ── Recordatorios (reutiliza los helpers del store) ────────────────────
      const remInput = Vue.reactive({ text: '', dueAt: '' });

      /** Conversaciones del contacto seleccionado, ordenadas por última actividad (desc). */
      const contactConvs = Vue.computed(() => {
        const c = selectedContact.value;
        if (!c) return [];
        return conversations.value
          .filter((x) => x.contactId === c.id)
          .slice()
          .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
      });

      /** Rango de fechas de una conversación (primera → última actividad). */
      function convRange(conv) {
        const first = (conv.messages && conv.messages[0] && conv.messages[0].ts) || conv.createdAt || conv.lastTs;
        return { from: first || Date.now(), to: conv.lastTs || Date.now() };
      }

      // ── Menciones de productos (detección + confirmación del agente) ───────
      const productMentions = Vue.computed(() => ZernioCrm.productMentionsFor(workspace.value));

      /** Menciones asociadas a un mensaje (chips bajo el mensaje). */
      function mentionsOfMessage(messageId) {
        return productMentions.value.filter((m) => m.messageId === messageId);
      }

      /** Menciones del contacto seleccionado (sección de la ficha). */
      function contactProductMentions(contact) {
        if (!contact) return [];
        return productMentions.value.filter((m) => m.contactId === contact.id);
      }

      /** Producto de una mention (o null si fue eliminado). */
      function productOf(mention) {
        return (workspace.value.products || []).find((p) => p.id === mention.productId) || null;
      }

      // Picker de productos reutilizable (confirmar mention, vincular manual)
      const productPickOpen = Vue.ref(false);
      const productPickTarget = Vue.ref(null); // id de mention o null (vinculación manual)
      const productPickQuery = Vue.ref('');
      const productPickResults = Vue.computed(() => {
        const qq = productPickQuery.value.trim().toLowerCase();
        return (workspace.value.products || [])
          .filter((p) => p.active !== false && (!qq || `${p.name} ${(p.aliases || []).join(' ')}`.toLowerCase().includes(qq)))
          .slice(0, 8);
      });

      function openProductPick(targetMentionId) {
        productPickTarget.value = targetMentionId || null;
        productPickQuery.value = '';
        productPickOpen.value = true;
      }

      function pickProduct(product) {
        if (!product) return;
        if (productPickTarget.value === 'attach') {
          attachCard(product);
          productPickOpen.value = false;
          return;
        }
        if (productPickTarget.value) {
          confirmMention(productPickTarget.value, product.id);
          toast('Producto confirmado: ' + product.name, 'success');
        } else {
          // Vinculación manual desde la ficha del cliente
          const conv = selected.value;
          const contact = selectedContact.value;
          if (conv && contact) {
            workspace.value.productMentions.push({
              id: uid('men'),
              productId: product.id,
              messageId: null,
              contactId: contact.id,
              convId: conv.id,
              ts: Date.now(),
              intent: 'consulta',
              match: 'exacta',
              status: 'confirmada',
              source: 'manual',
              text: 'Vinculación manual del agente',
            });
            toast('Producto vinculado al cliente', 'success');
          }
        }
        productPickOpen.value = false;
      }

      // ── Adjuntar ficha de producto al borrador (composer) ──────────────────
      const cardAttach = Vue.ref(null); // producto adjunto al draft
      const cardGreeting = Vue.ref('');

      /** Preview del mensaje final compuesto (saludo + draft + tarjeta formateada). */
      const cardPreview = Vue.computed(() => {
        if (!cardAttach.value) return '';
        const card = buildProductCard(cardAttach.value, niche.value.id);
        const parts = [];
        if (cardGreeting.value.trim()) parts.push(cardGreeting.value.trim());
        if (draft.value.trim()) parts.push(draft.value.trim());
        parts.push(card);
        return parts.join('\n\n');
      });

      function openCardPicker() {
        productPickTarget.value = 'attach';
        productPickQuery.value = '';
        productPickOpen.value = true;
      }

      // ── Modal de información completa del producto detectado (Ver más) ─────
      const productInfoOpen = Vue.ref(false);
      const productInfoTarget = Vue.ref(null);

      const cardOfTarget = Vue.computed(() => {
        const p = productInfoTarget.value;
        return p ? buildProductCard(p, niche.value.id) : '';
      });

      function openProductInfo(p) {
        productInfoTarget.value = p;
        productInfoOpen.value = true;
      }

      function closeProductInfo() {
        productInfoOpen.value = false;
        productInfoTarget.value = null;
      }

      /** Envía la ficha del producto visto al chat y cierra el modal. */
      function sendFichaFromInfo() {
        const p = productInfoTarget.value;
        if (!p) return;
        attachCard(p);
        closeProductInfo();
        toast('Ficha adjuntada: ' + p.name, 'success');
      }

      function attachCard(product) {
        if (!product || product.active === false) return;
        cardAttach.value = product;
        const defaults = (PRODUCT_CARD_DEFAULTS || {})[niche.value.id] || (PRODUCT_CARD_DEFAULTS || {}).generic || {};
        cardGreeting.value = defaults.greeting || '';
      }

      function detachCard() {
        cardAttach.value = null;
        cardGreeting.value = '';
      }

      // ── Autocompletado '@' de productos en el composer ────────────────────
      const atOpen = Vue.ref(false);
      const atIndex = Vue.ref(0);
      const atQuery = Vue.ref('');

      /** Resultados del '@': productos activos filtrados por el texto tecleado. */
      const atResults = Vue.computed(() => {
        const qq = atQuery.value.trim().toLowerCase();
        return (workspace.value.products || [])
          .filter((p) => p.active !== false && (!qq || `${p.name} ${(p.aliases || []).join(' ')}`.toLowerCase().includes(qq)))
          .slice(0, 6);
      });

      /** Detecta el token '@query' al final del borrador y abre el menú. */
      Vue.watch(draft, (val) => {
        const m = /(^|\s)@(\S*)$/.exec(val);
        if (m) {
          atQuery.value = m[2];
          atIndex.value = 0;
          atOpen.value = true;
        } else {
          closeAt();
        }
      });

      function closeAt() {
        atOpen.value = false;
        atQuery.value = '';
      }

      /** Selecciona un producto del menú '@': quita el token y adjunta la ficha. */
      function pickMention(product) {
        if (!product) return;
        const idx = draft.value.lastIndexOf('@');
        const before = idx >= 0 ? draft.value.slice(0, idx).replace(/\s+$/, '') : draft.value;
        draft.value = before;
        closeAt();
        attachCard(product);
        toast('Ficha adjuntada: ' + product.name, 'success');
      }

      /** Teclado del composer: navega el menú '@' o envía con Enter. */
      function onComposerKeydown(e) {
        if (atOpen.value) {
          if (e.key === 'ArrowDown' && atResults.value.length) { e.preventDefault(); atIndex.value = (atIndex.value + 1) % atResults.value.length; return; }
          if (e.key === 'ArrowUp' && atResults.value.length) { e.preventDefault(); atIndex.value = (atIndex.value - 1 + atResults.value.length) % atResults.value.length; return; }
          if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
            // Menú abierto: Enter/Tab selecciona (o cierra si no hay resultados)
            e.preventDefault();
            if (atResults.value.length) pickMention(atResults.value[atIndex.value] || atResults.value[0]);
            else closeAt();
            return;
          }
          if (e.key === 'Escape') { e.preventDefault(); closeAt(); return; }
        }
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
          e.preventDefault();
          send();
        }
      }

      function addReminderFor(contact) {
        const text = remInput.text.trim();
        if (!text || !contact) return;
        ZernioCrm.addReminder(contact.id, text, remInput.dueAt || null);
        remInput.text = '';
        remInput.dueAt = '';
        toast('Recordatorio creado', 'success');
      }

      function contactReminders(contact) {
        return contact ? ZernioCrm.remindersOf(contact.id) : [];
      }

      // ── Cierre de lead desde la conversación (misma lógica que Leads) ─────
      // La lógica compartida vive en shared.js; aquí solo se instancia con el
      // cierre del drawer de contacto (contactDrawerOpen) como onClosed.
      const close = ZernioCrm.makeCloseLead({
        workspace, productMentions, toast,
        onClosed: () => { contactDrawerOpen.value = false; },
      });
      const {
        closeOpen, closeTarget, closeForm, closeProductQuery, closeProductResults,
        closeLabel, stageLabel, historyOf, productNameOf,
        toggleCloseProduct, openCloseModal, confirmClose, reopenLead,
      } = close;

      // ── Asistente IA (análisis local de la conversación + historial) ───────
      const aiOpen = Vue.ref(false);

      /** Agentes IA activos con el flujo de bandeja (módulo Agente). */
      const inboxAgents = Vue.computed(() => activeAgents('inbox'));
      const aiAgentBusy = Vue.ref(false);
      const aiAgentResult = Vue.ref(null); // { agent, action, error }

      /** Nivel de interés comercial compacto (misma lógica que el tablero). */
      function aiInterest(contact) {
        const catalog = workspace.value.products || [];
        const ms = productMentions.value.filter(
          (m) => m.contactId === (contact || {}).id && catalog.some((p) => p.id === m.productId)
        );
        if (!ms.length) return { nivel: null, value: 0, productos: [] };
        const byP = {};
        ms.forEach((m) => {
          const cur = byP[m.productId] || { product: catalog.find((p) => p.id === m.productId), count: 0, last: m };
          cur.count += 1;
          if (m.ts >= cur.last.ts) cur.last = m;
          byP[m.productId] = cur;
        });
        const per = Object.values(byP).filter((x) => x.product);
        const value = per.reduce((acc, x) => acc + (Number(x.product.price) > 0 ? Number(x.product.price) : 0), 0);
        const priced = catalog.map((p) => Number(p.price)).filter((n) => n > 0).sort((a, b) => a - b);
        const threshold = priced.length ? priced[Math.floor(0.75 * (priced.length - 1))] : 50;
        const factors = [];
        if (ms.some((m) => ['pedido', 'precio', 'reserva'].includes(m.intent))) factors.push('compra');
        if (ms.length >= 2) factors.push('frecuencia');
        if (value >= threshold) factors.push('alto_valor');
        if (per.some((x) => x.product.stock === false)) factors.push('agotado');
        const nivel = factors.length >= 3 || (factors.includes('compra') && factors.includes('alto_valor'))
          ? 'alto' : factors.length === 2 ? 'medio' : factors.length === 1 ? 'bajo' : null;
        return { nivel, value, productos: per.map((x) => ({ product: x.product, count: x.count, intent: x.last.intent })) };
      }

      /** Análisis completo: diagnóstico, señales, plan de acción y respuestas. */
      const aiAnalysis = Vue.computed(() => {
        const conv = selected.value;
        const contact = selectedContact.value;
        if (!conv) return null;
        const interest = aiInterest(contact);
        // Solo los mensajes del CLIENTE generan señales (los del equipo no son evidencia)
        const textos = (conv.messages || [])
          .filter((m) => m.from === 'in')
          .map((m) => m.text || '');
        const hayTexto = (re) => textos.some((t) => re.test(t));
        const senales = [];
        if (interest.productos.some((x) => x.intent === 'pedido')) senales.push('El cliente quiere pedir/comprar (intención de pedido).');
        if (interest.productos.some((x) => x.intent === 'precio')) senales.push('Preguntó por precios: está evaluando comprar.');
        if (hayTexto(/pago|pagar|banco|transferencia|referencia/i)) senales.push('La conversación llegó al tema de pago: fase de cierre.');
        if (hayTexto(/confirm|reserv|apartad|pedido/i)) senales.push('Confirmó o reservó algo: asegura el seguimiento del pedido.');
        if (hayTexto(/garant|falla|defecto|dañad|repar/i)) senales.push('Inquietud de garantía o calidad: resuélvela para desbloquear la venta.');
        if (interest.productos.some((x) => x.product.stock === false)) senales.push('Preguntó por un producto agotado: ofrece una alternativa.');
        if (!senales.length) senales.push('Conversación en fase inicial de consulta.');

        const plan = [];
        const compra = interest.productos.filter((x) => ['pedido', 'precio', 'reserva'].includes(x.intent));
        const agotados = interest.productos.filter((x) => x.product.stock === false);
        if (compra.length) plan.push(`Responde la consulta de ${compra[0].product.name} con la ficha técnica y su precio.`);
        if (agotados.length) plan.push(`Informa que ${agotados[0].product.name} está agotado y sugiere una alternativa del catálogo.`);
        if (hayTexto(/pago|pagar|banco|transferencia|referencia/i)) plan.push('El cliente ya habla de pago: envía los datos y pide la referencia para cerrar.');
        else if (compra.length) plan.push('Ofrece el cierre: pregunta si desea apartar el pedido y envía los datos de pago.');
        if (contact && !contact.leadTag) plan.push('Asigna una etapa al lead para mantener el seguimiento.');
        if (outsideWindow.value && conv.platform === 'whatsapp') plan.push('La ventana de 24h venció: re-engancha con una plantilla aprobada antes de continuar.');
        plan.push('Crea un recordatorio de seguimiento si el cliente no responde en 2-3 horas.');

        const respuestas = [];
        const p1 = compra[0] && compra[0].product;
        if (p1) respuestas.push({ label: 'Responder con la ficha', text: `Claro, te paso la ficha de ${p1.name} con todos los detalles.`, product: p1 });
        if (agotados.length) respuestas.push({ label: 'Ofrecer alternativa', text: `El ${agotados[0].product.name} está agotado por ahora. ¿Te interesa una alternativa similar del catálogo?` });
        if (hayTexto(/pago|pagar|banco|transferencia|referencia/i)) respuestas.push({ label: 'Pedir confirmación de pago', text: '¿Ya pudiste hacer el pago? Con la referencia despachamos hoy mismo. 😊' });
        respuestas.push({ label: 'Seguimiento', text: '¡Hola! ¿Quedó alguna duda sobre tu pedido? Estamos atentos para ayudarte.' });

        return { interest, senales, plan, respuestas };
      });

      /** Arma la respuesta sugerida en el composer (y adjunta la ficha si aplica). */
      function applyAiReply(r) {
        if (!r) return;
        draft.value = r.text;
        if (r.product) attachCard(r.product);
        aiOpen.value = false;
        toast('Respuesta lista en el composer: revísala y envía', 'success');
      }

      /** Crea un recordatorio de seguimiento desde el plan de acción. */
      function aiReminder() {
        const c = selectedContact.value;
        if (!c) return;
        remInput.text = 'Seguimiento de conversación con ' + c.name;
        addReminderFor(c);
        toast('Recordatorio de seguimiento creado', 'success');
      }

      // ── Agente IA conectado (módulo Agente): sugerencias y autonomía ────────

      /** Pregunta al agente conectado por la conversación seleccionada. */
      async function askAgentForSuggestion(agent) {
        if (aiAgentBusy.value) return;
        aiAgentBusy.value = true;
        aiAgentResult.value = null;
        try {
          const res = await askAgent(agent, 'suggestion.requested', { contact: selectedContact.value, conversation: selected.value });
          aiAgentResult.value = Object.assign({ agent }, res);
        } finally {
          aiAgentBusy.value = false;
        }
      }

      /** Cierra un lead con la acción close_sale del agente (misma mutación que confirmClose). */
      function closeAgentSale(contact, action) {
        if (!contact || !canEdit('inbox')) return;
        const outcome = action.outcome === 'perdida' ? 'perdida' : action.outcome === 'ganada' ? 'ganada' : null;
        if (!outcome) {
          toast('El agente intentó cerrar la venta sin un resultado válido', 'error');
          return;
        }
        contact.leadClosed = { at: Date.now(), outcome, note: action.note || 'Cierre autónomo del agente', reason: action.reason || undefined, products: [] };
        contact.leadHistory = contact.leadHistory || [];
        contact.leadHistory.push({ tag: `finalizada:${outcome}`, at: contact.leadClosed.at, note: contact.leadClosed.note, reason: contact.leadClosed.reason });
        toast(`El agente cerró el lead como ${closeLabel(outcome).toLowerCase()}`, 'success');
      }

      /** Aplica la acción canónica del agente a una conversación (auto-respuesta). */
      async function applyAgentActionToConv(agent, contact, conv, action) {
        // Clasificación de lead
        if (action.leadTag && contact && (leadTags.value || []).includes(action.leadTag)) {
          if (contact.leadTag !== action.leadTag) {
            ZernioCrm.applyLeadTag(contact, action.leadTag);
            toast(`${agent.name} asignó la etapa ${action.leadTag}`, 'info');
          }
        }
        // Cierre de venta autónomo (requiere autoCloseSale del agente)
        if (action.action === 'close_sale' && contact && agent.autoCloseSale) {
          closeAgentSale(contact, action);
        }
        // Recordatorio de seguimiento (fecha opcional; inválida → sin fecha)
        if (action.action === 'reminder' && contact) {
          const at = action.reminderAt && !Number.isNaN(Date.parse(action.reminderAt)) ? action.reminderAt : null;
          ZernioCrm.addReminder(contact.id, action.text || 'Seguimiento del agente', at);
          toast(`${agent.name} creó un recordatorio`, 'info');
        }
        // Ficha de producto (solo si la conversación está a la vista)
        if (action.productId) {
          const p = (workspace.value.products || []).find((x) => x.id === action.productId);
          if (p && selectedId.value === conv.id) attachCard(p);
        }
        // Respuesta: misma política de ventana de 24h que el composer
        // (solo si el agente tiene autoReply activo)
        if (action.action === 'reply' && action.text && agent.autoReply) {
          const last = (conv.messages || []).slice(-1)[0];
          const outside = last ? Date.now() - last.ts > 24 * 3600 * 1000 : false;
          if (isLive.value && outside && (conv.platform || 'whatsapp') === 'whatsapp') {
            toast(`${agent.name} sugirió una respuesta, pero la ventana de 24h está cerrada (se requiere plantilla)`, 'error', 6000);
            return;
          }
          const msgOut = { id: uid('msg'), from: 'out', text: action.text, ts: Date.now(), status: 'sent' };
          conv.messages.push(msgOut);
          conv.lastTs = Date.now();
          try {
            if (isLive.value) {
              await ZernioCrm.api.sendMessage(conv.id, { accountId: conv.accountId || (workspace.value.zernio && workspace.value.zernio.accountId) || '', message: action.text });
            } else {
              simulateDelivery(msgOut); // demo: sin nueva simulación entrante (evita bucles)
            }
          } catch (err) {
            msgOut.status = 'failed';
            toast(`${agent.name}: ${err.message || 'no se pudo enviar'}`, 'error');
          }
        }
      }

      /** Auto-respuesta: recorre agentes con autonomía activa y aplica su acción. */
      async function maybeAgentAutoReply(contact, conv, msg) {
        if (!conv || !contact || sending.value) return;
        // Una sola respuesta por mensaje entrante: el primer agente que contesta
        // gana el hilo; los demás aún pueden clasificar/cerrar/recordar (no spam).
        let replied = false;
        for (const agent of activeAgents('inbox')) {
          // Autonomía: autoReply (responder) o autoCloseSale (clasificar/cerrar/recordar)
          if (!agent.autoReply && !agent.autoCloseSale) continue;
          let res;
          try {
            res = await askAgent(agent, 'message.received', { contact, conversation: conv });
          } catch (err) {
            toast(`${agent.name}: ${err.message || 'error del agente'}`, 'error');
            continue;
          }
          if (!res.ok || !res.action || res.action.action === 'none') continue;
          if (res.action.action === 'reply') {
            if (replied) continue; // otro agente ya respondió este mensaje
            replied = true;
          }
          await applyAgentActionToConv(agent, contact, conv, res.action);
        }
      }

      /** Aplica la acción del agente desde el panel IA (conversación seleccionada). */
      function applyAgentAction(action) {
        if (!action) return;
        if (action.text) {
          draft.value = action.text;
          toast('Respuesta del agente lista en el composer: revísala y envía', 'success');
        }
        if (action.productId) {
          const p = (workspace.value.products || []).find((x) => x.id === action.productId);
          if (p) { attachCard(p); toast('Ficha adjuntada por el agente: ' + p.name, 'info'); }
        }
        if (action.leadTag && selectedContact.value) {
          ZernioCrm.applyLeadTag(selectedContact.value, action.leadTag);
          toast('Etapa asignada por el agente: ' + action.leadTag, 'info');
        }
        if (action.action === 'close_sale' && selectedContact.value) {
          closeAgentSale(selectedContact.value, action);
        }
      }

      /** Envía la plantilla seleccionada (re-enganche >24h o primer mensaje). */
      async function sendApprovedTemplate() {
        const t = tplSelected.value;
        if (!t || tplSending.value) return;
        tplSending.value = true;
        try {
          const accountId = zernioAccountId();
          const params = tplVariables.value.map((v) => (tplParams[v] || '').trim());
          const name = t.name;
          // Body con variables {{n}} resueltas: mismo texto para el hilo local
          // (conversación nueva o re-enganche), para que el mensaje nunca quede vacío.
          // Se sustituye por token ({{1}}..{{n}} en cualquier orden) y no por índice
          const bodyText = t.body || ((t.components || []).find((c) => c.type === 'body') || {}).text || '';
          let resolved = bodyText;
          tplVariables.value.forEach((token) => {
            resolved = String(resolved).split(token).join((tplParams[token] || '').trim());
          });
          if (!String(resolved).trim()) throw new Error('La plantilla no tiene texto de cuerpo');
          if (!tplTarget.value) {
            // Conversación nueva: WhatsApp exige plantilla aprobada para abrir el hilo
            const contact = contacts.value.find((c) => c.id === newContactId.value);
            if (!contact) throw new Error('Elige un contacto primero');
            let conv;
            if (isLive.value) {
              const created = await ZernioCrm.api.createConversationWithTemplate({
                accountId,
                participantId: contact.phone,
                templateName: name,
                templateLanguage: t.language || 'es',
                ...(params.length ? { templateParams: params } : {}),
              });
              const convData = created.conversation || created.data || created;
              conv = {
                id: convData.id || convData._id || uid('conv'),
                contactId: contact.id,
                platform: 'whatsapp',
                status: 'active',
                unread: 0,
                tags: contact.tags.slice(0, 1),
                messages: [],
                lastTs: Date.now(),
                accountId,
              };
            } else {
              conv = { id: uid('conv'), contactId: contact.id, platform: 'whatsapp', status: 'active', unread: 0, tags: contact.tags.slice(0, 1), messages: [], lastTs: Date.now(), accountId: 'demo_wa' };
            }
            conv.messages.push({ id: uid('msg'), from: 'out', text: `[Plantilla ${name}] ${resolved}`, ts: Date.now(), status: 'delivered' });
            workspace.value.conversations.unshift(conv);
            selectedId.value = conv.id;
            closeTemplatePicker();
            newContactId.value = null;
            toast(`Conversación iniciada con la plantilla ${name}`, 'success');
          } else {
            // Re-enganche >24h: plantilla dentro del hilo existente
            const conv = tplTarget.value;
            if (isLive.value) {
              await ZernioCrm.api.sendTemplate(conv.id, {
                accountId,
                template: { elements: [{ name, language: t.language || 'es', components: [{ type: 'body', text: resolved }] }] },
              });
            }
            conv.messages.push({ id: uid('msg'), from: 'out', text: `[Plantilla ${name}] ${resolved}`, ts: Date.now(), status: 'delivered' });
            conv.lastTs = Date.now();
            closeTemplatePicker();
            toast('Plantilla enviada: el cliente debe responder para abrir la ventana de 24 h', 'info', 6000);
          }
        } catch (err) {
          toast(err.message || 'No se pudo enviar la plantilla', 'error');
        } finally {
          tplSending.value = false;
        }
      }

      // Abre una conversación pedida desde otro módulo (ej. drawer de Leads).
      // Va al FINAL del setup: el watch immediate corre en setup y usa computeds
      // y selectConversation, que deben estar inicializados (TDZ).
      Vue.watch(
        () => store.pendingConversationId,
        (id) => {
          if (!id) return;
          const conv = conversations.value.find((c) => c.id === id);
          if (!conv) {
            // La conversación pedida ya no existe: no se consume el pendiente
            // (otro módulo podría recrearla) y se avisa para no perder la intención.
            toast('La conversación solicitada ya no está disponible', 'error');
            return;
          }
          store.pendingConversationId = null;
          selectConversation(conv);
        },
        { immediate: true }
      );

      // Auto-respuesta del agente IA: la instancia montada queda como handler;
      // el hook se registra UNA vez con un delegador que siempre llama a la
      // instancia ACTUAL (live: reflectIncomingMessage; demo: simulateIncoming).
      agentAutoReply = (contact, conv, msg) => maybeAgentAutoReply(contact, conv, msg);
      if (!agentHookRegistered) {
        agentHookRegistered = true;
        ZernioCrm.onIncomingMessage((contact, conv, msg) => agentAutoReply && agentAutoReply(contact, conv, msg));
      }

      return {
        search, filter, platformFilter, selectedId, draft, sending, loading, syncing, newConvOpen, newContactId,
        workspace, niche, conversations, contacts, filtered, selected, selectedContact, unreadTotal, isLive,
        activeConversations,
        QUICK_REPLIES, canEdit, humanAgent, outsideWindow, canHumanAgent, blockedByWindow,
        attentionTips, tipsOpen,
        presentPlatforms, tiktokChannel, tiktokEmpty, getPlatform, leadTags,
        tplPickerOpen, tplList, tplSelected, tplParams, tplVariables, tplSending, tplError,
        tplTarget, tplModalOpen, tplFirstOpen, newConvNeedsTemplate,
        openTemplatePicker, closeTemplatePicker, sendApprovedTemplate,
        contactDrawerOpen, contactTab, contactTags, toggleContactTag, setLeadTag, registerContact,
        contactStats, bizFields, remInput, addReminderFor, contactReminders, ZernioCrm,
        contactConvs, convRange, fmtDT, fmtD, formatDate,
        closeOpen, closeTarget, closeForm, closeProductQuery, closeProductResults,
        closeLabel, stageLabel, historyOf, productNameOf, toggleCloseProduct,
        openCloseModal, confirmClose, reopenLead, CLOSE_REASONS,
        aiOpen, aiAnalysis, applyAiReply, aiReminder,
        inboxAgents, aiAgentBusy, aiAgentResult, askAgentForSuggestion, applyAgentAction,
        productMentions, mentionsOfMessage, contactProductMentions, productOf,
        productPickOpen, productPickTarget, productPickQuery, productPickResults,
        openProductPick, pickProduct, INTENT_LABELS,
        confirmMention, discardMention,
        cardAttach, cardGreeting, cardPreview, openCardPicker, detachCard,
        atOpen, atResults, atIndex, pickMention, onComposerKeydown, formatPrice,
        productInfoOpen, productInfoTarget, cardOfTarget, openProductInfo, closeProductInfo, sendFichaFromInfo,
        renderWhatsApp,
        selectConversation, backToList, lastMessage, send, sync, startConversation, timeAgo, formatTime,
      };
    },

    template: `
      <div class="-mx-5 -my-5 flex h-[calc(100vh-40px)] flex-col lg:-mx-8 lg:-my-8 lg:h-[calc(100vh)]">
        <!-- Barra superior integrada (full-bleed, sin marco) -->
        <header class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-stone-100/80 px-5 py-3.5 backdrop-blur lg:px-6">
          <div class="flex items-center gap-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
            </span>
            <div>
              <h2 class="text-lg font-bold leading-tight">Bandeja</h2>
              <p class="text-xs text-neutral-500">
                {{ (workspace.whatsapp || {}).phone }}
                <span v-if="!(workspace.whatsapp && workspace.whatsapp.connected)" class="font-semibold text-red-700">· desconectado</span>
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <ui-badge v-if="isLive" variant="warn" dot>Modo live</ui-badge>
            <ui-badge v-else variant="success" dot>Modo demo</ui-badge>
            <button @click="sync" :disabled="!isLive || syncing"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="syncing" size="h-4 w-4"></ui-spinner>
              <ui-icon v-else name="refresh" class="h-4 w-4"></ui-icon>
              Sincronizar
            </button>
            <button v-if="canEdit('inbox')" @click="newConvOpen = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nueva conversación
            </button>
          </div>
        </header>

        <!-- Carga simulada (integrada) -->
        <div v-if="loading" class="flex min-h-0 flex-1 bg-white">
          <div class="hidden w-[340px] space-y-3 border-r border-neutral-200 p-4 lg:block">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton v-for="i in 6" :key="i" h="h-16"></ui-skeleton>
          </div>
          <div class="flex-1 space-y-3 bg-stone-50 p-4">
            <ui-skeleton h="h-10"></ui-skeleton>
            <ui-skeleton h="h-72"></ui-skeleton>
            <ui-skeleton h="h-14"></ui-skeleton>
          </div>
        </div>

        <!-- Cuerpo de la bandeja (sin marco exterior) -->
        <div v-else class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:grid-cols-[340px_1fr]">
          <!-- Lista de conversaciones -->
          <aside :class="['flex min-h-0 flex-col lg:border-r lg:border-neutral-200', selected ? 'hidden lg:flex' : 'flex']">
            <div class="shrink-0 border-b border-neutral-200 p-3">
              <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
                <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
                <input v-model.trim="search" type="search" placeholder="Buscar conversación…"
                  class="w-full bg-transparent text-sm outline-none" />
              </div>
              <!-- Pestañas por plataforma -->
              <div class="mt-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                <button @click="platformFilter = 'all'"
                  class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="platformFilter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  Todas
                </button>
                <button v-for="p in presentPlatforms" :key="p.id" @click="platformFilter = p.id"
                  class="flex shrink-0 items-center gap-1.5 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="platformFilter === p.id ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  <ui-icon :name="p.icon" class="h-3.5 w-3.5"></ui-icon>
                  {{ p.nombre }}
                </button>
              </div>
              <div class="mt-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                <button @click="filter = 'all'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'all' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  Todas ({{ activeConversations.length }})
                </button>
                <button @click="filter = 'unread'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'unread' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  No leídas ({{ unreadTotal }})
                </button>
                <button @click="filter = 'Sin asignar'" class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === 'Sin asignar' ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  Sin asignar
                </button>
                <button v-for="t in leadTags" :key="t" @click="filter = t"
                  class="shrink-0 border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="filter === t ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ t }}
                </button>
              </div>
            </div>
            <ul class="min-h-0 flex-1 overflow-y-auto">
              <!-- TikTok no tiene mensajería en Zernio -->
              <ui-empty v-if="tiktokEmpty" icon="tiktok" title="TikTok no tiene mensajería en Zernio"
                desc="Zernio solo expone publicación para TikTok. Responde a tus DM desde la app de TikTok." class="m-4">
                <a v-if="tiktokChannel && tiktokChannel.username" :href="'https://www.tiktok.com/@' + tiktokChannel.username.replace('@', '')" target="_blank"
                  class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Abrir perfil externo
                </a>
              </ui-empty>
              <ui-empty v-else-if="filtered.length === 0" icon="message" title="Sin conversaciones"
                desc="Prueba con otro filtro o inicia una conversación nueva." class="m-4"></ui-empty>
              <li v-for="conv in filtered" :key="conv.id">
                <button @click="selectConversation(conv)"
                  class="flex w-full items-center gap-3 border-b border-l-2 border-neutral-100 px-4 py-3.5 text-left transition"
                  :class="conv.id === selectedId
                    ? 'border-l-[var(--accent)] bg-[var(--accent-soft)]'
                    : 'border-l-transparent hover:bg-stone-100'">
                  <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    :class="(getPlatform(conv.platform || 'whatsapp') || {}).tone">
                    <ui-icon :name="(getPlatform(conv.platform || 'whatsapp') || {}).icon" class="h-3 w-3"></ui-icon>
                  </span>
                  <ui-avatar :name="(contacts.find(c => c.id === conv.contactId) || {}).name" size="h-10 w-10 text-sm"></ui-avatar>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-baseline justify-between gap-2">
                      <p class="truncate text-sm font-semibold">{{ (contacts.find(c => c.id === conv.contactId) || {}).name }}</p>
                      <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ timeAgo(conv.lastTs) }}</span>
                    </div>
                    <p class="truncate text-sm text-neutral-500">{{ lastMessage(conv) }}</p>
                  </div>
                  <span v-if="conv.unread > 0" class="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 font-mono text-[11px] font-bold text-white tabular-nums">
                    {{ conv.unread }}
                  </span>
                </button>
              </li>
            </ul>
          </aside>

          <!-- Panel de chat (integrado sobre stone-50, separación sutil) -->
          <section :class="['flex min-h-0 flex-col bg-stone-50', selected ? 'flex' : 'hidden lg:flex']">
            <!-- Estado vacío sin conversación seleccionada -->
            <div v-if="!selected" class="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
              <span class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                <ui-icon name="whatsapp" class="h-8 w-8"></ui-icon>
              </span>
              <h3 class="text-lg font-semibold">Selecciona una conversación</h3>
              <p class="max-w-md text-sm text-neutral-500">Las consultas de tus clientes por WhatsApp aparecerán aquí.</p>
            </div>

            <template v-else>
              <!-- Header del chat -->
              <header class="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
                <div class="flex items-center gap-3">
                  <button class="lg:hidden" @click="backToList" aria-label="Volver a la lista">
                    <ui-icon name="chevron-left" class="h-5 w-5"></ui-icon>
                  </button>
                  <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    :class="(getPlatform(selected.platform || 'whatsapp') || {}).tone">
                    <ui-icon :name="(getPlatform(selected.platform || 'whatsapp') || {}).icon" class="h-4 w-4"></ui-icon>
                  </span>
                  <ui-avatar :name="selectedContact ? selectedContact.name : '?'" size="h-10 w-10 text-sm"></ui-avatar>
                  <div>
                    <p class="font-semibold leading-tight">{{ selectedContact ? selectedContact.name : 'Contacto' }}
                      <span class="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ (getPlatform(selected.platform || 'whatsapp') || {}).nombre }}</span>
                    </p>
                    <p class="font-mono text-[11px] uppercase tracking-wider text-neutral-400">{{ selectedContact ? selectedContact.phone : '' }}</p>
                    <p v-if="selected.igProfile" class="font-mono text-[10px] text-neutral-400">
                      {{ selected.igProfile.isFollower ? '· te sigue' : '' }}{{ selected.igProfile.followerCount != null ? ' · ' + selected.igProfile.followerCount + ' seguidores' : '' }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-1.5">
                  <!-- Etiquetas vivas del contacto (no el snapshot de la conversación) -->
                  <ui-badge v-for="t in (selectedContact ? selectedContact.tags : [])" :key="t" variant="neutral">{{ t }}</ui-badge>
                  <ui-badge v-if="selectedContact && selectedContact.leadTag" variant="accent" dot>{{ selectedContact.leadTag }}</ui-badge>
                  <button v-if="selectedContact" @click="aiOpen = true" class="flex items-center gap-1 rounded-full border border-[var(--accent)] px-2 py-1 text-[11px] font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" aria-label="Asistente IA">
                    <ui-icon name="sparkles" class="h-3.5 w-3.5"></ui-icon> IA
                  </button>
                  <button @click="contactDrawerOpen = true; contactTab = 'ficha'" class="p-1.5 hover:text-[var(--accent)]" aria-label="Ficha del cliente">
                    <ui-icon name="user" class="h-4 w-4"></ui-icon>
                  </button>
                </div>
              </header>

              <!-- Consejos de atención al equipo -->
              <div v-if="attentionTips.length" class="shrink-0 border-b border-neutral-200 bg-amber-50/80">
                <button @click="tipsOpen = !tipsOpen" class="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-amber-900">
                  <ui-icon name="alert" class="h-3.5 w-3.5 text-amber-700"></ui-icon>
                  Consejos de atención · {{ attentionTips.length }}
                  <ui-icon :name="tipsOpen ? 'chevron-up' : 'chevron-down'" class="ml-auto h-3.5 w-3.5 text-amber-700"></ui-icon>
                </button>
                <ul v-if="tipsOpen" class="space-y-1.5 px-4 pb-3">
                  <li v-for="(t, i) in attentionTips" :key="i" class="flex items-start gap-2 text-xs text-amber-900">
                    <ui-icon :name="t.icon" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
                    <span>{{ t.text }}</span>
                  </li>
                </ul>
              </div>

              <!-- Mensajes -->
              <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
                <div v-for="m in selected.messages" :key="m.id" class="space-y-1.5" :class="m.from === 'out' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
                  <div class="flex max-w-[70%] px-4 py-2.5 shadow-sm"
                    :class="m.from === 'out'
                      ? 'bg-[var(--accent)] text-white'
                      : 'border border-neutral-200 bg-white'">
                    <p v-if="m.card" class="wa-rich whitespace-pre-wrap break-words text-[15px] leading-relaxed" v-html="renderWhatsApp(m.text)"></p>
                    <p v-else class="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{{ m.text }}</p>
                    <div class="mt-1 flex items-center justify-end gap-1.5">
                      <span class="font-mono text-[10px] uppercase tracking-wider opacity-60">{{ formatTime(m.ts) }}</span>
                      <ui-icon v-if="m.from === 'out'" name="check" class="h-3 w-3"
                        :class="m.status === 'read' ? 'text-emerald-400' : m.status === 'failed' ? 'text-red-400' : 'opacity-60'"></ui-icon>
                    </div>
                  </div>
                  <!-- Feedback de productos detectados en el mensaje entrante -->
                  <div v-for="men in mentionsOfMessage(m.id)" :key="men.id" class="max-w-[85%] text-xs"
                    :class="men.match === 'exacta'
                      ? 'flex items-center gap-2 border border-emerald-700 bg-emerald-50 px-2.5 py-1.5 text-emerald-900'
                      : 'border border-amber-600 bg-amber-50 px-2.5 py-1.5 text-amber-900'">
                    <template v-if="men.match === 'exacta'">
                      <span class="flex items-center gap-1"><ui-icon name="check-circle" class="h-3.5 w-3.5"></ui-icon> Producto detectado: <strong>{{ productOf(men) ? productOf(men).name : '—' }}</strong></span>
                      <template v-if="productOf(men)">
                        <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(productOf(men).price) }}</span>
                        <span :class="productOf(men).stock === false ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'">{{ productOf(men).stock === false ? 'AGOTADO' : 'Disponible' }}</span>
                        <button @click="openProductInfo(productOf(men))" class="font-semibold underline">Ver más</button>
                      </template>
                      <button @click="openProductPick(men.id)" class="font-semibold underline">Cambiar</button>
                    </template>
                    <template v-else>
                      <span>Posible producto: <strong>{{ productOf(men) ? productOf(men).name : '—' }}</strong> (coincidencia parcial)</span>
                      <template v-if="productOf(men)">
                        <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(productOf(men).price) }}</span>
                        <span :class="productOf(men).stock === false ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'">{{ productOf(men).stock === false ? 'AGOTADO' : 'Disponible' }}</span>
                        <button @click="openProductInfo(productOf(men))" class="font-semibold underline">Ver más</button>
                      </template>
                      <span class="flex gap-2">
                        <button v-if="productOf(men)" @click="confirmMention(men.id, men.productId)" class="font-semibold underline">Sí, ese</button>
                        <button @click="openProductPick(men.id)" class="font-semibold underline">Elegir otro</button>
                        <button @click="discardMention(men.id)" class="underline">Descartar</button>
                      </span>
                    </template>
                  </div>
                </div>
              </div>

              <!-- Composer -->
              <footer class="shrink-0 border-t border-neutral-200 bg-white p-3.5">
                <div v-if="canHumanAgent" class="mb-2.5 flex items-center gap-2.5 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <ui-toggle v-model="humanAgent" class="shrink-0"></ui-toggle>
                  <span>El cliente no ha escrito en 24 h: activa el modo agente humano para que Meta permita responder.</span>
                </div>
                <div v-if="blockedByWindow" class="mb-2.5 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
                  WhatsApp fuera de la ventana de 24h:
                  <button @click="openTemplatePicker(selected)" class="font-semibold underline">envía una plantilla aprobada</button>
                  para re-enganchar la conversación.
                </div>
                <div class="mb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
                  <button v-for="qr in QUICK_REPLIES" :key="qr" @click="draft = qr"
                    class="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-sm transition hover:border-neutral-900">
                    {{ qr }}
                  </button>
                </div>
                <div class="flex items-end gap-2">
                  <div class="flex-1">
                    <!-- Ficha de producto adjunta al borrador (preview en vivo) -->
                    <div v-if="cardAttach" class="mb-2 border-2 border-[var(--accent)] bg-white p-2.5">
                      <div class="mb-2 flex items-center justify-between gap-2">
                        <span class="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                          <ui-icon name="box" class="h-3.5 w-3.5 text-[var(--accent)]"></ui-icon>
                          <span class="truncate">Ficha: {{ cardAttach.name }}</span>
                        </span>
                        <span class="flex shrink-0 gap-1">
                          <button @click="openCardPicker" class="text-[11px] font-medium underline">Cambiar</button>
                          <button @click="detachCard" class="text-[11px] text-red-700 underline">Quitar</button>
                        </span>
                      </div>
                      <input v-model.trim="cardGreeting" type="text" placeholder="Saludo del mensaje…"
                        class="mb-2 w-full border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900" />
                      <wa-preview :text="cardPreview" :show-header="false"></wa-preview>
                    </div>
                    <div class="relative">
                      <textarea v-model="draft" rows="2" placeholder="Escribe un mensaje… (@ para adjuntar un producto · Enter para enviar)"
                        @keydown="onComposerKeydown"
                        class="w-full resize-none border border-neutral-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:bg-white"></textarea>
                      <div v-if="atOpen && atResults.length" class="absolute inset-x-0 bottom-full z-20 mb-1.5 max-h-56 overflow-y-auto border-2 border-neutral-900 bg-white shadow-brutal">
                        <p class="border-b border-neutral-100 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Adjuntar ficha de producto</p>
                        <button v-for="(p, i) in atResults" :key="p.id" @mousedown.prevent="pickMention(p)" @mouseenter="atIndex = i"
                          class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition"
                          :class="i === atIndex ? 'bg-[var(--accent)] text-white' : 'hover:bg-stone-100'">
                          <ui-icon name="box" class="h-3.5 w-3.5 shrink-0"></ui-icon>
                          <span class="min-w-0 flex-1 truncate font-medium">{{ p.name }}</span>
                          <span class="shrink-0 font-mono text-[10px] tabular-nums opacity-80">{{ formatPrice(p.price) }}</span>
                          <span v-if="p.stock === false" class="shrink-0 font-mono text-[9px] uppercase text-red-600">agotado</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-col gap-1.5">
                    <button v-if="(workspace.products || []).length" @click="openCardPicker"
                      class="flex h-11 w-11 items-center justify-center border-2 border-neutral-900 bg-white text-neutral-700 shadow-brutal-sm transition hover:shadow-none"
                      aria-label="Adjuntar ficha de producto">
                      <ui-icon name="box" class="h-5 w-5"></ui-icon>
                    </button>
                    <button @click="send" :disabled="sending || (!draft.trim() && !cardAttach)"
                      class="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-neutral-900 bg-[var(--accent)] text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40"
                      aria-label="Enviar mensaje">
                      <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
                      <ui-icon v-else name="send" class="h-5 w-5"></ui-icon>
                    </button>
                  </div>
                </div>
              </footer>
            </template>
          </section>
        </div>

        <!-- Modal: nueva conversación -->
        <ui-modal :open="newConvOpen" title="Nueva conversación" @close="newConvOpen = false">
          <ui-field label="Contacto">
            <select v-model="newContactId" class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900">
              <option :value="null" disabled>Elige un contacto…</option>
              <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }} · {{ c.phone }}</option>
            </select>
          </ui-field>
          <!-- Aviso persistente (no es un toast que se oculta solo): el contacto
               elegido no tiene actividad en las últimas 24h → se exige plantilla -->
          <div v-if="newConvNeedsTemplate" class="mt-3 flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
            <span>Este contacto no tiene conversación en las últimas 24 h: el hilo se abrirá con una <strong>plantilla aprobada</strong> (WhatsApp no permite mensajes libres para iniciar una conversación).</span>
          </div>
          <button @click="startConversation" :disabled="!newContactId"
            class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            {{ newConvNeedsTemplate ? 'Iniciar con plantilla aprobada' : 'Iniciar conversación' }}
          </button>
        </ui-modal>

        <!-- Modal: selector de plantilla aprobada (primer mensaje o re-enganche >24h) -->
        <ui-modal :open="tplPickerOpen" :title="tplTarget ? 'Re-enganchar con plantilla aprobada' : 'Primer mensaje: elige una plantilla aprobada'" width="max-w-3xl" @close="closeTemplatePicker">
          <div class="space-y-4">
            <!-- Política de 24h visible y persistente (el aviso no se oculta solo) -->
            <div class="flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
              <span>{{ tplTarget ? 'La ventana de 24 h ya pasó:' : 'Primer mensaje al cliente:' }} WhatsApp exige <strong>plantillas aprobadas por Meta</strong> para abrir o re-enganchar un hilo. Elige una y completa sus variables; el cliente debe responder para abrir la ventana de 24 h.</span>
            </div>
            <!-- Error persistente al cargar plantillas (live: API/CORS) con reintento -->
            <div v-if="tplError" class="flex items-start gap-2 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
              <ui-icon name="alert" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
              <span class="flex-1">No se pudieron cargar las plantillas: {{ tplError }}</span>
              <button @click="openTemplatePicker(tplTarget)" class="shrink-0 font-semibold underline">Reintentar</button>
            </div>
            <div v-if="tplList.length === 0 && !tplError" class="border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
              Sin plantillas aprobadas todavía. Crea y aprueba una en Campañas primero (Meta revisa hasta 24 h).
            </div>
            <div v-else class="grid gap-2 sm:grid-cols-2">
              <button v-for="t in tplList" :key="t.id || t.name" @click="tplSelected = t"
                class="border-2 p-3 text-left transition"
                :class="tplSelected && (tplSelected.id || tplSelected.name) === (t.id || t.name) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200 hover:border-neutral-900'">
                <p class="truncate font-mono text-xs font-semibold">{{ t.name }}</p>
                <p class="mt-0.5 flex items-center gap-1.5">
                  <ui-badge variant="neutral">{{ t.category }}</ui-badge>
                  <span class="font-mono text-[10px] uppercase text-neutral-400">{{ t.language }}</span>
                </p>
              </button>
            </div>

            <template v-if="tplSelected">
              <!-- Preview gráfico completo (burbuja WhatsApp + info + estado) -->
              <template-preview :tpl="tplSelected"></template-preview>
              <div v-if="tplVariables.length" class="grid gap-3 sm:grid-cols-2">
                <ui-field v-for="v in tplVariables" :key="v" :label="'Valor para ' + v">
                  <input v-model.trim="tplParams[v]" type="text" :placeholder="'Dato para ' + v"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
              </div>
              <button @click="sendApprovedTemplate" :disabled="tplSending || tplVariables.some(v => !tplParams[v])"
                class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="tplSending" size="h-4 w-4"></ui-spinner>
                {{ tplSending ? 'Enviando…' : (tplTarget ? 'Enviar plantilla' : 'Iniciar conversación con esta plantilla') }}
              </button>
            </template>
          </div>
        </ui-modal>
        <!-- Drawer: ficha del cliente (gestión por conversación) -->
        <ui-drawer :open="contactDrawerOpen" width="max-w-lg" :title="'Ficha · ' + (selectedContact ? selectedContact.name : 'Sin ficha')" @close="contactDrawerOpen = false">
          <div v-if="selected" class="space-y-5">
            <!-- Pestañas del drawer -->
            <div class="flex border-b-2 border-neutral-900">
              <button @click="contactTab = 'ficha'" class="flex-1 border-r-2 border-neutral-900 px-3 py-2 text-sm font-semibold transition"
                :class="contactTab === 'ficha' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Ficha</button>
              <button @click="contactTab = 'actividades'" class="flex-1 px-3 py-2 text-sm font-semibold transition"
                :class="contactTab === 'actividades' ? 'bg-[var(--accent)] text-white' : 'bg-white hover:bg-stone-100'">Actividades</button>
            </div>
            <template v-if="contactTab === 'ficha'">
              <template v-if="selectedContact">
              <div class="flex items-center gap-3">
                <ui-avatar :name="selectedContact.name" size="h-12 w-12 text-base"></ui-avatar>
                <div class="min-w-0 flex-1">
                  <input :value="selectedContact.name" @change="selectedContact.name = $event.target.value; selectedContact.nameSource = 'manual'"
                    class="w-full border-b border-transparent bg-transparent font-semibold outline-none focus:border-neutral-900" />
                  <input :value="selectedContact.phone" @change="selectedContact.phone = $event.target.value"
                    class="w-full border-b border-transparent bg-transparent font-mono text-xs text-neutral-500 outline-none focus:border-neutral-900" />
                </div>
              </div>
              <p class="text-xs text-neutral-400">Cliente desde {{ selectedContact.createdAt ? fmtD(selectedContact.createdAt) : '—' }}</p>

              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etiquetas de contacto</p>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="t in contactTags" :key="t" @click="toggleContactTag(t)"
                    class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                    :class="selectedContact.tags.includes(t) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                    {{ t }}
                  </button>
                </div>
              </div>

              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Etapa del lead</p>
                <select :value="selectedContact.leadTag || ''" @change="setLeadTag($event.target.value)"
                  class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                  <option value="">Sin asignar</option>
                  <option v-for="t in leadTags" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <!-- Historial de etapas del lead (desde el momento 0) -->
              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de etapas</p>
                <div class="mb-3 flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
                  <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa actual</span>
                  <ui-badge variant="accent" dot>{{ stageLabel(selectedContact.leadTag) }}</ui-badge>
                </div>
                <ol v-if="historyOf(selectedContact).length" class="relative ml-1.5 space-y-2.5 border-l border-neutral-200 pl-4">
                  <li v-for="(h, i) in historyOf(selectedContact)" :key="h.at + '-' + i" class="relative">
                    <span class="absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-neutral-900 bg-white"
                      :class="i === 0 ? 'bg-[var(--accent)]' : ''"></span>
                    <p class="text-xs">
                      <span class="font-semibold">{{ stageLabel(h.tag) }}</span>
                      <span v-if="historyOf(selectedContact)[i + 1]" class="ml-1 font-mono text-[9px] uppercase text-neutral-400">← desde {{ stageLabel(historyOf(selectedContact)[i + 1].tag) }}</span>
                      <span class="ml-1 font-mono text-[9px] uppercase text-neutral-400">{{ fmtDT(h.at) }}</span>
                    </p>
                    <p v-if="h.note" class="mt-0.5 text-[11px] text-neutral-500">{{ h.note }}</p>
                    <p v-if="h.reason" class="mt-0.5 text-[11px] text-neutral-500">motivo: {{ h.reason }}</p>
                    <p v-else-if="h.prev && h.prev.outcome" class="mt-0.5 text-[11px] text-neutral-500">antes: {{ stageLabel('finalizada:' + h.prev.outcome) }}</p>
                  </li>
                </ol>
                <p v-else class="text-xs text-neutral-400">Sin cambios de etapa registrados.</p>
              </div>

              <!-- Cierre del lead desde la conversación -->
              <div class="border border-neutral-200 p-3">
                <template v-if="selectedContact.leadClosed">
                  <div class="flex items-center justify-between gap-2">
                    <div>
                      <p class="font-semibold" :class="selectedContact.leadClosed.outcome === 'ganada' ? 'text-emerald-700' : 'text-red-700'">
                        Lead cerrado · {{ closeLabel(selectedContact.leadClosed.outcome) }}
                      </p>
                      <p class="font-mono text-[10px] text-neutral-400">{{ fmtDT(selectedContact.leadClosed.at) }}</p>
                      <div v-if="(selectedContact.leadClosed.products || []).length" class="mt-1 flex flex-wrap gap-1">
                        <span v-for="pid in selectedContact.leadClosed.products" :key="pid" class="border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                          {{ productNameOf(pid) }}
                        </span>
                      </div>
                      <p v-if="selectedContact.leadClosed.reason" class="mt-1 inline-block border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                        {{ selectedContact.leadClosed.reason }}
                      </p>
                      <p v-if="selectedContact.leadClosed.note" class="mt-1 text-xs text-neutral-600">{{ selectedContact.leadClosed.note }}</p>
                    </div>
                    <button @click="reopenLead(selectedContact)" class="shrink-0 border border-neutral-300 px-2.5 py-1.5 text-xs font-medium transition hover:border-neutral-900">
                      Reabrir lead
                    </button>
                  </div>
                </template>
                <template v-else>
                  <p class="text-xs text-neutral-500">¿Terminaste el seguimiento de este lead?</p>
                  <button v-if="canEdit('leads')" @click="openCloseModal(selectedContact)"
                    class="mt-2 w-full border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                    Finalizar lead
                  </button>
                </template>
              </div>

              <div v-if="bizFields.length">
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Campos del negocio · {{ niche.nombre }}</p>
                <div class="space-y-2">
                  <ui-field v-for="f in bizFields" :key="f.slug" :label="f.name">
                    <input v-model="selectedContact.customFields[f.slug]" type="text"
                      class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                  </ui-field>
                </div>
              </div>

              <!-- Productos de interés (menciones detectadas o vinculadas) -->
              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Productos de interés</p>
                <ul v-if="contactProductMentions(selectedContact).length" class="space-y-1.5">
                  <li v-for="men in contactProductMentions(selectedContact)" :key="men.id"
                    class="flex items-center gap-2 border border-neutral-200 px-2.5 py-1.5 text-xs">
                    <span class="min-w-0 flex-1 truncate font-medium">{{ productOf(men) ? productOf(men).name : '—' }}</span>
                    <span class="shrink-0 font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ INTENT_LABELS[men.intent] || men.intent }}</span>
                    <ui-badge :variant="men.status === 'confirmada' ? 'success' : 'warn'" dot class="shrink-0">
                      {{ men.status === 'confirmada' ? 'Confirmada' : 'Pendiente' }}
                    </ui-badge>
                    <button v-if="men.status === 'pendiente'" @click="confirmMention(men.id, men.productId)" class="shrink-0 font-semibold text-emerald-700">
                      Confirmar
                    </button>
                    <button v-if="productOf(men)" @click="attachCard(productOf(men)); contactDrawerOpen = false" class="shrink-0 font-semibold text-[var(--accent)]">
                      Enviar ficha
                    </button>
                    <button v-if="productOf(men)" @click="contactDrawerOpen = false; openTemplatePicker(selected)" class="shrink-0 font-semibold text-[var(--accent)]">
                      Responder con plantilla
                    </button>
                  </li>
                </ul>
                <p v-else class="text-xs text-neutral-400">Sin productos de interés registrados.</p>
                <button @click="openProductPick(null)" class="mt-2 border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">
                  + Vincular producto
                </button>
              </div>

              <!-- Recordatorios del contacto -->
              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Recordatorios</p>
                <div class="space-y-1.5">
                  <div v-for="r in contactReminders(selectedContact)" :key="r.id"
                    class="flex items-center gap-2 border border-neutral-200 px-2.5 py-2"
                    :class="r.done ? 'opacity-50' : r.dueAt && Date.parse(r.dueAt) < Date.now() ? 'border-red-700 bg-red-50' : ''">
                    <button @click="ZernioCrm.toggleReminder(r.id)" class="shrink-0" :aria-label="r.done ? 'Marcar pendiente' : 'Marcar completado'">
                      <ui-icon :name="r.done ? 'check-circle' : 'check'" class="h-4 w-4"
                        :class="r.done ? 'text-emerald-700' : 'text-neutral-300'"></ui-icon>
                    </button>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-xs" :class="r.done ? 'line-through' : ''">{{ r.text }}</p>
                      <p v-if="r.dueAt" class="font-mono text-[9px] uppercase"
                        :class="!r.done && Date.parse(r.dueAt) < Date.now() ? 'text-red-700' : 'text-neutral-400'">
                        {{ fmtDT(r.dueAt) }}
                      </p>
                    </div>
                    <button @click="ZernioCrm.removeReminder(r.id)" class="shrink-0 p-1 text-neutral-400 hover:text-red-700" aria-label="Eliminar recordatorio">
                      <ui-icon name="trash" class="h-3.5 w-3.5"></ui-icon>
                    </button>
                  </div>
                  <p v-if="contactReminders(selectedContact).length === 0" class="text-xs text-neutral-400">Sin recordatorios.</p>
                </div>
                <div class="mt-2 flex gap-2">
                  <input v-model.trim="remInput.text" type="text" placeholder="Ej: llamar para confirmar pedido" @keydown.enter="addReminderFor(selectedContact)"
                    class="min-w-0 flex-1 border-2 border-neutral-300 px-2.5 py-2 text-xs outline-none focus:border-neutral-900" />
                  <input v-model="remInput.dueAt" type="datetime-local"
                    class="shrink-0 border-2 border-neutral-300 px-2 py-2 text-xs outline-none focus:border-neutral-900" />
                  <button @click="addReminderFor(selectedContact)" :disabled="!remInput.text.trim()"
                    class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    Agregar
                  </button>
                </div>
              </div>
              </template>
              <template v-else>
                <p class="text-sm text-neutral-500">Esta conversación no tiene contacto registrado.</p>
                <button @click="registerContact"
                  class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Registrar contacto
                </button>
              </template>
            </template>
            <template v-else-if="contactTab === 'actividades'">
              <!-- Estadísticas de comunicación del contacto -->
              <div v-if="contactStats" class="grid grid-cols-2 gap-2">
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Conversaciones</p>
                  <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactConvs.length }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes recibidos</p>
                  <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactStats.totalIn }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Mensajes enviados</p>
                  <p class="mt-0.5 text-lg font-bold tabular-nums">{{ contactStats.totalOut }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Primera actividad</p>
                  <p class="mt-0.5 text-xs font-semibold">{{ contactStats.first ? formatDate(contactStats.first) : '—' }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Última actividad</p>
                  <p class="mt-0.5 text-xs font-semibold">{{ contactStats.last ? timeAgo(contactStats.last) : '—' }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canales usados</p>
                  <p class="mt-0.5 flex flex-wrap gap-1">
                    <span v-for="ch in contactStats.channels" :key="ch[0]" class="flex items-center gap-1 border border-neutral-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                      <ui-icon :name="(getPlatform(ch[0]) || {}).icon" class="h-3 w-3"></ui-icon>
                      {{ (getPlatform(ch[0]) || {}).nombre }} · {{ ch[1] }}
                    </span>
                  </p>
                </div>
              </div>

              <!-- Historial detallado del contacto (click = abrir esa conversación) -->
              <div>
                <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Historial de conversaciones</p>
                <ul class="space-y-2">
                  <li v-for="c in contactConvs" :key="c.id">
                    <button @click="selectConversation(c); contactDrawerOpen = false"
                      class="w-full border p-3 text-left transition hover:border-neutral-900 hover:bg-stone-50"
                      :class="c.id === selectedId ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200'">
                      <div class="flex items-center justify-between gap-2">
                        <span class="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                          <ui-icon :name="(getPlatform(c.platform || 'whatsapp') || {}).icon" class="h-3.5 w-3.5"></ui-icon>
                          {{ (getPlatform(c.platform || 'whatsapp') || {}).nombre }}
                          <ui-badge v-if="c.id === selectedId" variant="accent" class="ml-1">Actual</ui-badge>
                        </span>
                        <span class="shrink-0 font-mono text-[9px] uppercase text-neutral-400">
                          {{ formatDate(convRange(c).from) }} → {{ formatDate(convRange(c).to) }}
                        </span>
                      </div>
                      <p class="mt-1 truncate text-xs text-neutral-600">{{ lastMessage(c) }}</p>
                      <p class="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-400">
                        {{ (c.messages || []).length }} mensajes · {{ timeAgo(c.lastTs) }}
                      </p>
                    </button>
                  </li>
                  <li v-if="contactConvs.length === 0" class="text-xs text-neutral-400">
                    Sin historial previo.
                  </li>
                </ul>
              </div>
            </template>
          </div>
        </ui-drawer>

        <!-- Modal: selector de productos (confirmar mention / vincular manual) -->
        <ui-modal :open="productPickOpen" title="Seleccionar producto" width="max-w-md" @close="productPickOpen = false">
          <div class="space-y-3">
            <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
              <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
              <input v-model.trim="productPickQuery" type="search" placeholder="Buscar producto…"
                class="w-full bg-transparent text-sm outline-none" />
            </div>
            <ul class="max-h-80 divide-y divide-neutral-100 overflow-y-auto border border-neutral-200">
              <li v-for="p in productPickResults" :key="p.id">
                <button @click="pickProduct(p)" class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-stone-50">
                  <span class="min-w-0 truncate font-medium">{{ p.name }}</span>
                  <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ p.category || p.type }}<span v-if="p.stock === false" class="ml-1 text-red-700">· Agotado</span></span>
                </button>
              </li>
              <li v-if="productPickResults.length === 0" class="px-3 py-6 text-center text-sm text-neutral-400">Sin productos para la búsqueda.</li>
            </ul>
          </div>
        </ui-modal>

        <!-- Modal: información completa del producto detectado (Ver más) -->
        <ui-modal :open="productInfoOpen" :title="productInfoTarget ? productInfoTarget.name : ''" width="max-w-lg" @close="closeProductInfo">
          <div v-if="productInfoTarget" class="space-y-4">
            <div class="flex flex-wrap items-center gap-2">
              <ui-badge :variant="productInfoTarget.stock === false ? 'danger' : 'success'" dot>{{ productInfoTarget.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
              <ui-badge variant="accent">{{ formatPrice(productInfoTarget.price) }}</ui-badge>
              <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ productInfoTarget.category || productInfoTarget.type }}<span v-if="productInfoTarget.unit"> · {{ productInfoTarget.unit }}</span></span>
            </div>
            <p class="text-sm text-neutral-600">{{ productInfoTarget.description || 'Sin descripción.' }}</p>
            <div class="border border-neutral-200">
              <p class="border-b border-neutral-200 bg-stone-50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cómo se verá en WhatsApp</p>
              <div class="p-3">
                <wa-preview :text="cardOfTarget" :show-header="false"></wa-preview>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="sendFichaFromInfo"
                class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Enviar ficha al chat
              </button>
              <button @click="selected ? (openTemplatePicker(selected), closeProductInfo()) : null"
                class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
                Responder con plantilla
              </button>
            </div>
          </div>
        </ui-modal>

        <!-- Drawer: Asistente IA (análisis local de conversación + historial) -->
        <ui-drawer :open="aiOpen" width="max-w-xl" :title="'Asistente IA · ' + (selectedContact ? selectedContact.name : 'Conversación')" @close="aiOpen = false">
          <div v-if="aiAnalysis" class="space-y-5">
            <!-- Diagnóstico -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Diagnóstico</p>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Etapa del lead</p>
                  <p class="mt-0.5 font-semibold">{{ stageLabel(selectedContact ? selectedContact.leadTag : null) }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Interés comercial</p>
                  <p class="mt-0.5 font-semibold">
                    {{ aiAnalysis.interest.nivel ? (aiAnalysis.interest.nivel === 'alto' ? 'Alto' : aiAnalysis.interest.nivel === 'medio' ? 'Medio' : 'Bajo') : 'Sin señales' }}
                    <span v-if="aiAnalysis.interest.value > 0" class="font-mono text-[10px] text-neutral-500">· {{ formatPrice(aiAnalysis.interest.value) }}</span>
                  </p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Canal</p>
                  <p class="mt-0.5 font-semibold">{{ (getPlatform(selected ? selected.platform || 'whatsapp' : 'whatsapp') || {}).nombre }}</p>
                </div>
                <div class="border border-neutral-200 p-2.5">
                  <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Ventana 24h</p>
                  <p class="mt-0.5 font-semibold" :class="outsideWindow ? 'text-red-700' : 'text-emerald-700'">{{ outsideWindow ? 'Fuera de ventana' : 'Dentro de ventana' }}</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-neutral-500">
                {{ (selected ? selected.messages : []).length }} mensajes en este hilo · última actividad {{ timeAgo(selected ? selected.lastTs : Date.now()) }}
              </p>
            </div>

            <!-- Análisis de la conversación -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Análisis de la conversación</p>
              <ul class="space-y-1.5">
                <li v-for="(s, i) in aiAnalysis.senales" :key="i" class="flex items-start gap-2 text-xs">
                  <ui-icon name="check-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700"></ui-icon>
                  <span>{{ s }}</span>
                </li>
              </ul>
              <div v-if="aiAnalysis.interest.productos.length" class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="x in aiAnalysis.interest.productos" :key="x.product.id" class="border border-neutral-200 bg-stone-50 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
                  {{ x.product.name }} · {{ formatPrice(x.product.price) }} · {{ INTENT_LABELS[x.intent] || x.intent }}
                </span>
              </div>
            </div>

            <!-- Plan de acción -->
            <div class="border-2 border-[var(--accent)] p-3">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-[var(--accent)]">Plan de acción sugerido</p>
              <ol class="space-y-1.5">
                <li v-for="(p, i) in aiAnalysis.plan" :key="i" class="flex items-start gap-2 text-xs">
                  <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] font-mono text-[9px] font-bold text-white">{{ i + 1 }}</span>
                  <span>{{ p }}</span>
                </li>
              </ol>
              <button @click="aiReminder" class="mt-3 flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="clock" class="h-3.5 w-3.5"></ui-icon> Crear recordatorio de seguimiento
              </button>
            </div>

            <!-- Respuestas sugeridas -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Respuestas sugeridas</p>
              <div class="space-y-2">
                <button v-for="r in aiAnalysis.respuestas" :key="r.label" @click="applyAiReply(r)"
                  class="flex w-full items-center justify-between gap-2 border-2 border-neutral-200 px-3 py-2.5 text-left text-xs transition hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]">
                  <span class="min-w-0 flex-1">{{ r.text }}</span>
                  <span class="shrink-0 font-semibold text-[var(--accent)] underline">Usar</span>
                </button>
              </div>
            </div>

            <!-- Agentes IA conectados (módulo Agente) -->
            <div class="border-t-2 border-neutral-900 pt-4">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agentes conectados</p>
              <div v-if="inboxAgents.length" class="space-y-2">
                <div v-for="a in inboxAgents" :key="a.id" class="border border-neutral-200 p-2.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-xs font-semibold">{{ a.name }}
                      <span class="font-mono text-[9px] uppercase text-neutral-400">· {{ a.provider }}</span>
                    </span>
                    <button @click="askAgentForSuggestion(a)" :disabled="aiAgentBusy"
                      class="border-2 border-neutral-900 bg-white px-2.5 py-1 text-[11px] font-semibold transition hover:shadow-brutal-sm disabled:opacity-40">
                      <ui-spinner v-if="aiAgentBusy" size="h-3 w-3"></ui-spinner>
                      <span v-else>Preguntar</span>
                    </button>
                  </div>
                  <template v-if="aiAgentResult && aiAgentResult.agent && aiAgentResult.agent.id === a.id">
                    <p v-if="aiAgentResult.error" class="mt-1.5 border border-red-700 bg-red-50 px-2 py-1.5 text-[11px] text-red-800">
                      {{ aiAgentResult.error }}
                    </p>
                    <template v-else>
                      <p class="mt-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Acción: {{ aiAgentResult.action.action }}</p>
                      <p v-if="aiAgentResult.action.text" class="mt-1 text-xs">{{ aiAgentResult.action.text }}</p>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <button v-if="aiAgentResult.action.text" @click="applyAgentAction(aiAgentResult.action); aiOpen = false"
                          class="border-2 border-[var(--accent)] px-2 py-1 text-[11px] font-semibold text-[var(--accent)]">Usar respuesta</button>
                        <button v-if="aiAgentResult.action.leadTag" @click="applyAgentAction(aiAgentResult.action)"
                          class="border-2 border-neutral-900 px-2 py-1 text-[11px] font-semibold">Asignar etapa</button>
                        <button v-if="aiAgentResult.action.action === 'close_sale'" @click="applyAgentAction(aiAgentResult.action)"
                          class="border-2 border-red-800 px-2 py-1 text-[11px] font-semibold text-red-800">Cerrar venta</button>
                      </div>
                    </template>
                  </template>
                </div>
              </div>
              <p v-else class="text-xs text-neutral-400">
                Conecta un agente de IA en el módulo Agente para atender esta conversación.
              </p>
            </div>
          </div>
        </ui-drawer>

        <!-- Modal: finalizar lead desde la conversación (mismo flujo que Leads) -->
        <ui-modal :open="closeOpen" :title="'Finalizar lead · ' + (closeTarget ? closeTarget.name : '')" width="max-w-md" @close="closeOpen = false">
          <div class="space-y-4">
            <p class="text-sm text-neutral-500">
              Da por terminado el seguimiento de este lead. Puedes reabrirlo cuando quieras.
            </p>
            <div v-if="closeTarget" class="flex items-center gap-3 border border-neutral-200 bg-stone-50 p-3">
              <ui-avatar :name="closeTarget.name" size="h-10 w-10 text-sm"></ui-avatar>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ closeTarget.name }}</p>
                <p class="truncate font-mono text-[11px] text-neutral-500">
                  Etapa: {{ stageLabel(closeTarget.leadTag) }}
                  <span v-if="closeTarget.createdAt"> · Cliente desde {{ fmtD(closeTarget.createdAt) }}</span>
                </p>
              </div>
            </div>
            <ui-field label="¿Se concretó?">
              <div class="flex gap-1.5">
                <button @click="closeForm.outcome = 'ganada'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                  :class="closeForm.outcome === 'ganada' ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-neutral-300'">
                  Sí, se concretó
                </button>
                <button @click="closeForm.outcome = 'perdida'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                  :class="closeForm.outcome === 'perdida' ? 'border-red-800 bg-red-50 text-red-900' : 'border-neutral-300'">
                  No se concretó
                </button>
              </div>
            </ui-field>
            <div v-if="(workspace.products || []).length">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">¿Qué productos/servicios se cerraron?</p>
              <div v-if="closeForm.products.length" class="mb-2 flex flex-wrap gap-1.5">
                <button v-for="id in closeForm.products" :key="id" @click="toggleCloseProduct(id)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition border-[var(--accent)] bg-[var(--accent)] text-white">
                  {{ productNameOf(id) }} ✕
                </button>
              </div>
              <input v-model.trim="closeProductQuery" type="search" placeholder="Buscar y agregar producto…"
                class="w-full border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
              <div v-if="closeProductQuery" class="mt-1.5 flex flex-wrap gap-1.5">
                <button v-for="p in closeProductResults" :key="p.id" @click="toggleCloseProduct(p.id)"
                  class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="closeForm.products.includes(p.id) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ p.name }}
                </button>
              </div>
            </div>
            <ui-field label="Motivo (opcional)">
              <div class="flex flex-wrap gap-1.5">
                <button v-for="r in CLOSE_REASONS" :key="r" @click="closeForm.reason = closeForm.reason === r ? '' : r"
                  class="border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                  :class="closeForm.reason === r ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                  {{ r }}
                </button>
              </div>
            </ui-field>
            <ui-field label="Nota (opcional)">
              <textarea v-model.trim="closeForm.note" rows="3" placeholder="Cuéntanos cómo fue el cierre…"
                class="w-full resize-none border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"></textarea>
            </ui-field>
            <button @click="confirmClose"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Confirmar cierre
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
