/**
 * @file broadcasts-composables.js — Composables por bounded context del módulo
 * de campañas. Extraen la lógica del setup de broadcasts-view (shell/loader,
 * broadcasts+destinatarios, plantillas, secuencias y flows) a objetos
 * `{ refs, computeds, helpers }`. Convención `Z.makeXxx`; sin template.
 * 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /** Guiones demo de secuencias por nicho (con pasos y retrasos para el pipeline). */
  function demoSequences(niche) {
    return [
      {
        id: ZernioCrm.uid('seq'),
        name: `Seguimiento post-${niche.tags[0] || 'venta'}`,
        status: 'active',
        steps: [
          { order: 1, delayMinutes: 0, message: { text: '¡Gracias por tu compra! 🙌 Te avisamos cuando tu pedido esté listo.' } },
          { order: 2, delayMinutes: 1440, message: { text: 'Hola, tu pedido sigue en camino. ¿Necesitas algo más?' } },
          { order: 3, delayMinutes: 4320, message: { text: '¿Cómo te fue con tu compra? Nos importa tu opinión.' } },
        ],
        enrolled: 24,
      },
      {
        id: ZernioCrm.uid('seq'),
        name: 'Bienvenida 3 pasos',
        status: 'draft',
        steps: [
          { order: 1, delayMinutes: 0, message: { text: '¡Hola! 👋 Bienvenido a nuestro canal.' } },
          { order: 2, delayMinutes: 30, message: { text: '¿Tienes alguna duda sobre nuestros productos?' } },
          { order: 3, delayMinutes: 1440, message: { text: 'Te dejamos nuestro catálogo por si quieres revisarlo con calma.' } },
        ],
        enrolled: 0,
      },
    ];
  }

  /** Arma una pantalla de flow (formato Meta 6.0, screens a nivel raíz) de forma compacta. */
  function flowScreen(id, title, body, fields, opts = {}) {
    return {
      id,
      title,
      terminal: opts.terminal !== false,
      layout: { type: 'SingleColumnLayout', children: [{ type: 'FormScreen', name: 'form' }] },
      data: {
        form: {
          title,
          body,
          fields,
          footer: opts.footer || 'Respuestas de la encuesta: trebor',
        },
      },
    };
  }

  /** Flows demo con pantallas completas (header + CTA + screens) para el preview presentacional. */
  function demoFlows() {
    return [
      {
        id: ZernioCrm.uid('flow'),
        name: 'captura_leads',
        category: 'LEAD_GENERATION',
        status: 'PUBLISHED',
        header: '¡Hola! 👋 Déjanos tus datos y un asesor te contacta enseguida.',
        cta: 'Comenzar',
        screens: [
          flowScreen('LEAD_FORM', 'Cuéntanos qué necesitas', 'Completa tus datos y te respondemos al instante.', [
            { type: 'text_input', name: 'nombre', label: 'Nombre', required: true, placeholder: 'Tu nombre' },
            { type: 'phone_input', name: 'telefono', label: 'Teléfono', placeholder: '+58 412 000 0000' },
            { type: 'text_input', name: 'mensaje', label: 'Mensaje', placeholder: '¿En qué te ayudamos?' },
          ]),
        ],
      },
      {
        id: ZernioCrm.uid('flow'),
        name: 'reporte_falla',
        category: 'CUSTOMER_SUPPORT',
        status: 'PUBLISHED',
        header: 'Hola 👋, cuéntanos qué falla presenta tu equipo y lo resolvemos rápido.',
        cta: 'Reportar falla',
        screens: [
          flowScreen('FALLA_FORM', 'Reporte de falla', 'Los detalles nos ayudan a darte soporte más rápido.', [
            { type: 'dropdown', name: 'tipo', label: 'Tipo de falla', options: ['Eléctrica', 'Mecánica', 'No enciende', 'Otra'] },
            { type: 'text_input', name: 'descripcion', label: 'Describe la falla', required: true, placeholder: 'Qué ocurre y desde cuándo…' },
            { type: 'number_input', name: 'serie', label: 'Nº de serie del equipo', placeholder: 'Opcional' },
          ], { footer: 'Soporte técnico · respuesta en < 24 h' }),
          flowScreen('FALLA_OK', '¡Reporte recibido!', 'Te contactamos con el diagnóstico.', [], { footer: 'Gracias por tu reporte' }),
        ],
      },
      {
        id: ZernioCrm.uid('flow'),
        name: 'reclamo_garantia',
        category: 'CUSTOMER_SUPPORT',
        status: 'PUBLISHED',
        header: 'Lamentamos el inconveniente 🙏, cuéntanos el detalle de tu reclamo.',
        cta: 'Iniciar reclamo',
        screens: [
          flowScreen('RECLAMO_FORM', 'Reclamo de garantía', 'Verifica los datos y describe lo sucedido.', [
            { type: 'text_input', name: 'nombre', label: 'Nombre del cliente', required: true, placeholder: 'Tu nombre' },
            { type: 'number_input', name: 'orden', label: 'Nº de orden o recibo', placeholder: 'Ej: 1042' },
            { type: 'text_input', name: 'detalle', label: '¿Qué sucedió?', required: true, placeholder: 'Describe el problema…' },
            { type: 'check_box', name: 'acepto', label: 'Autorizo revisión del equipo', required: true },
          ]),
          flowScreen('RECLAMO_OK', 'Reclamo registrado', 'Te damos respuesta con el estado de tu caso.', [], { footer: 'Caso asignado al área de garantía' }),
        ],
      },
      {
        id: ZernioCrm.uid('flow'),
        name: 'contacto_soporte',
        category: 'CUSTOMER_SUPPORT',
        status: 'DRAFT',
        header: '¿Necesitas ayuda? Cuéntanos y te asesoramos.',
        cta: 'Hablar con soporte',
        screens: [
          flowScreen('SOPORTE_FORM', 'Contacto de soporte', 'Elige el tema y describe tu consulta.', [
            { type: 'radio_button', name: 'tema', label: 'Tema', options: ['Consulta', 'Instalación', 'Facturación', 'Otro'] },
            { type: 'text_input', name: 'consulta', label: 'Tu consulta', required: true, placeholder: 'Escribe aquí…' },
          ]),
        ],
      },
    ];
  }

  /** Id estable de una plantilla (real del API o local). */
  function tplId(t) {
    return t.id || t._id || t.name;
  }

  /** JSON de pantallas para un flow de captura de leads (versión Meta 6.0, screens a nivel raíz). */
  function leadFlowJson(nicheName) {
    return {
      version: '6.0',
      data: { theme_name: 'ZernioCRM' },
      screens: [
        {
          id: 'LEAD_FORM',
          title: `Hablemos de ${nicheName}`,
          terminal: true,
          layout: { type: 'SingleColumnLayout', children: [{ type: 'FormScreen', name: 'form' }] },
          data: {
            form: {
              title: 'Cuéntanos qué necesitas',
              body: 'Completa tus datos y un asesor te contactará.',
              fields: [
                { type: 'text_input', name: 'nombre', label: 'Nombre', required: true },
                { type: 'phone_input', name: 'telefono', label: 'Teléfono' },
                { type: 'text_input', name: 'mensaje', label: 'Mensaje' },
              ],
              footer: 'Respuestas de la encuesta: trebor',
            },
          },
        },
      ],
    };
  }

  /**
   * BC Shell: tabs, carga de datos (live o demo), guía educativa y refs
   * compartidos (broadcasts/templates/sequences/flows). Cleanup de timers.
   */
  function makeCampaignShell({ store, getNiche, api, asArray, toast }) {
    const tab = Vue.ref('broadcasts');
    const loading = Vue.ref(true);
    const guideOpen = Vue.ref(false);

    const workspace = Vue.computed(() => store.workspace);
    const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
    const profileId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.profileId);
    const accountId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.accountId);
    const isLive = Vue.computed(() => store.mode === 'live' && Boolean(profileId.value));

    const broadcasts = Vue.ref([]);
    const templates = Vue.ref([]);
    const sequences = Vue.ref([]);
    const flows = Vue.ref([]);

    /** Temporizadores activos (cleanup en onUnmounted). */
    const timers = [];
    Vue.onUnmounted(() => timers.forEach(clearTimeout));

    /** Carga datos: live real o seeds demo (nunca llama al API con params vacíos). */
    async function load() {
      loading.value = true;
      if (isLive.value) {
        if (!profileId.value || !accountId.value) {
          broadcasts.value = (workspace.value.broadcasts || []).slice();
          templates.value = (workspace.value.templates || []).slice();
          sequences.value = demoSequences(niche.value);
          flows.value = demoFlows();
          timers.push(setTimeout(() => { loading.value = false; }, 300));
          toast('Conexión Zernio incompleta: se muestran datos demo. Revisa Configuración → Canal WhatsApp', 'error', 6000);
          return;
        }
        try {
          const [b, t, s, f] = await Promise.all([
            api.listBroadcasts(profileId.value),
            api.listTemplates(accountId.value || ''),
            api.listSequences(profileId.value),
            api.listFlows(accountId.value || ''),
          ]);
          broadcasts.value = asArray(b);
          templates.value = asArray(t);
          sequences.value = asArray(s);
          flows.value = asArray(f);
        } catch (err) {
          toast(err.message || 'No se pudieron cargar las campañas', 'error');
        }
      } else {
        broadcasts.value = (workspace.value.broadcasts || []).slice();
        templates.value = (workspace.value.templates || []).slice();
        sequences.value = demoSequences(niche.value);
        flows.value = demoFlows();
      }
      timers.push(setTimeout(() => { loading.value = false; }, 400));
    }

    Vue.onMounted(load);

    return {
      tab, loading, guideOpen, load,
      workspace, niche, profileId, accountId, isLive,
      broadcasts, templates, sequences, flows,
    };
  }

  /**
   * BC Broadcasts: creación de campaña (draft → segmento → envío), destinatarios
   * y borrador sugerido por el agente IA conectado (módulo Agente).
   */
  function makeCampaignBroadcasts({ broadcasts, templates, isLive, profileId, accountId, api, asArray, toast, uid, niche, activeAgents, askAgent }) {
    const createOpen = Vue.ref(false);
    const sending = Vue.ref(false);
    const form = Vue.reactive({ name: '', templateId: null, tag: null });

    const recipientsOpen = Vue.ref(false);
    const recipientsList = Vue.ref([]);
    const recipientsBroadcast = Vue.ref(null);

    // ── Agente IA conectado (módulo Agente): borradores de campaña ─────────
    const campaignAgents = Vue.computed(() => activeAgents('campaigns'));
    const agentBusy = Vue.ref(false);
    const agentSuggestion = Vue.ref(null); // { agent, action, error }

    /** Pide al agente un borrador de campaña (nombre + texto sugerido). */
    async function askCampaignAgent(agent) {
      if (agentBusy.value) return;
      agentBusy.value = true;
      agentSuggestion.value = null;
      try {
        const res = await askAgent(agent, 'campaign.draft', { extra: niche.value ? niche.value.nombre : '' });
        agentSuggestion.value = Object.assign({ agent }, res);
        if (res.ok && res.action && res.action.text && !form.name.trim()) {
          form.name = res.action.text;
        }
      } finally {
        agentBusy.value = false;
      }
    }

    /** Crea un broadcast (live: draft → segmento → send). */
    async function createBroadcast() {
      if (!form.name.trim() || !form.templateId || sending.value) return;
      const tpl = templates.value.find((t) => tplId(t) === form.templateId);
      if (!tpl || !tpl.name) {
        toast('Selecciona una plantilla válida (la plantilla creada aún no tiene nombre en el API)', 'error');
        return;
      }
      sending.value = true;
      try {
        if (isLive.value) {
          const draft = await api.createBroadcast({
            profileId: profileId.value,
            accountId: accountId.value,
            platform: 'whatsapp',
            name: form.name.trim(),
            template: { name: tpl.name, language: 'es' },
            segmentFilters: form.tag ? { tags: [form.tag] } : { isSubscribed: true },
          });
          const id = draft.id || draft._id || draft.broadcastId;
          await api.addBroadcastRecipients(id, { useSegment: true });
          const result = await api.sendBroadcast(id);
          const failed = Number(result && (result.failed ?? result.failedCount)) || 0;
          if (failed > 0) {
            toast(`${failed} destinatarios fallaron: revisa que la plantilla esté APROBADA por Meta`, 'error', 6000);
          } else {
            toast('Campaña enviada a Zernio', 'success');
          }
        } else {
          const total = 80 + ((Math.random() * 140) | 0);
          broadcasts.value.unshift({
            id: uid('bc'),
            name: form.name.trim(),
            audience: form.tag ? `Contactos con tag "${form.tag}"` : 'Todos los contactos activos',
            status: 'sent',
            sentAt: Date.now(),
            stats: { total, delivered: Math.round(total * 0.92), failed: total - Math.round(total * 0.92) },
          });
          toast('Campaña enviada (simulación)', 'success');
        }
        createOpen.value = false;
        Object.assign(form, { name: '', templateId: null, tag: null });
      } catch (err) {
        toast(err.message || 'No se pudo enviar la campaña', 'error');
      } finally {
        sending.value = false;
      }
    }

    /** Lista destinatarios de un broadcast con su estado de entrega. */
    async function openRecipients(broadcast) {
      recipientsBroadcast.value = broadcast;
      recipientsList.value = [];
      recipientsOpen.value = true;
      const id = broadcast.id || broadcast._id || broadcast.broadcastId;
      if (isLive.value && id) {
        try {
          recipientsList.value = asArray(await api.listBroadcastRecipients(id));
        } catch (err) {
          toast(err.message || 'No se pudieron cargar los destinatarios', 'error');
        }
      } else {
        const total = (broadcast.stats && broadcast.stats.total) || 24;
        recipientsList.value = Array.from({ length: Math.min(total, 12) }, (_, i) => ({
          id: uid('rcp'),
          name: `Cliente ${i + 1}`,
          status: ['sent', 'delivered', 'read', 'failed'][i % 4],
        }));
      }
    }

    return {
      createOpen, sending, form,
      campaignAgents, agentBusy, agentSuggestion, askCampaignAgent,
      createBroadcast,
      recipientsOpen, recipientsList, recipientsBroadcast, openRecipients,
    };
  }

  /**
   * BC Templates: plantillas de WhatsApp (custom o library de Meta), guardado
   * de borradores locales, envío a aprobación, descarte y preview.
   */
  function makeCampaignTemplates({ templates, workspace, isLive, accountId, api, asArray, toast, uid }) {
    const tplOpen = Vue.ref(false);
    const tplSaving = Vue.ref(false);
    const tplForm = Vue.reactive({ mode: 'custom', name: '', category: 'UTILITY', body: '', libraryName: '' });

    /** Borradores de plantillas locales (nunca se envían a Meta sin consentimiento). */
    const draftTemplates = Vue.computed(() => workspace.value.draftTemplates || []);

    /** Crea una plantilla de WhatsApp (custom o desde library de Meta). */
    async function createTemplate() {
      const name = tplForm.name.trim();
      if (!name || tplSaving.value) return;
      if (tplForm.mode === 'custom' && !tplForm.body.trim()) return;
      if (tplForm.mode === 'library' && !tplForm.libraryName.trim()) return;
      tplSaving.value = true;
      try {
        if (isLive.value) {
          const payload = tplForm.mode === 'custom'
            ? {
                accountId: accountId.value,
                name,
                category: tplForm.category,
                language: 'es',
                components: [{ type: 'body', text: tplForm.body.trim() }],
              }
            : {
                accountId: accountId.value,
                name,
                category: tplForm.category,
                language: 'es',
                library_template_name: tplForm.libraryName.trim(),
              };
          const created = await api.createTemplate(payload);
          const createdTpl = asArray(created)[0] || created.template || created;
          templates.value.unshift(createdTpl);
          toast('Plantilla enviada a Meta: la revisión puede tardar hasta 24 h', 'success', 6000);
        } else {
          templates.value.unshift({
            id: uid('tpl'),
            name,
            category: tplForm.category,
            language: 'es',
            status: 'PENDING',
          });
          toast('Plantilla enviada a revisión (simulación): estado PENDING', 'success');
        }
        tplOpen.value = false;
        Object.assign(tplForm, { mode: 'custom', name: '', category: 'UTILITY', body: '', libraryName: '' });
      } catch (err) {
        toast(err.message || 'No se pudo enviar la plantilla a aprobación', 'error');
      } finally {
        tplSaving.value = false;
      }
    }

    /** Guarda la plantilla como borrador local (sin llamar al API). */
    function saveDraftTemplate() {
      const name = tplForm.name.trim();
      if (!name || tplSaving.value) return;
      if (tplForm.mode === 'custom' && !tplForm.body.trim()) return;
      if (tplForm.mode === 'library' && !tplForm.libraryName.trim()) return;
      workspace.value.draftTemplates = workspace.value.draftTemplates || [];
      workspace.value.draftTemplates.unshift({
        id: uid('tpl'),
        name,
        category: tplForm.category,
        language: 'es',
        status: 'draft',
        body: tplForm.mode === 'custom' ? tplForm.body.trim() : '',
        libraryName: tplForm.mode === 'library' ? tplForm.libraryName.trim() : '',
      });
      tplOpen.value = false;
      Object.assign(tplForm, { mode: 'custom', name: '', category: 'UTILITY', body: '', libraryName: '' });
      toast('Borrador guardado: aún no se envió a Meta', 'info');
    }

    /** Envía un borrador a aprobación de Meta (consentimiento explícito). */
    async function submitTemplateForApproval(draft) {
      if (tplSaving.value || !draft) return;
      tplSaving.value = true;
      try {
        if (isLive.value) {
          const payload = draft.libraryName
            ? { accountId: accountId.value, name: draft.name, category: draft.category, language: 'es', library_template_name: draft.libraryName }
            : { accountId: accountId.value, name: draft.name, category: draft.category, language: 'es', components: [{ type: 'body', text: draft.body }] };
          const created = await api.createTemplate(payload);
          const createdTpl = asArray(created)[0] || created.template || created;
          templates.value.unshift(createdTpl);
          toast('Plantilla enviada a Meta: la revisión puede tardar hasta 24 h', 'success', 6000);
        } else {
          templates.value.unshift({
            id: uid('tpl'),
            name: draft.name,
            category: draft.category,
            language: 'es',
            status: 'PENDING',
            body: draft.body,
            libraryName: draft.libraryName,
          });
          toast('Plantilla enviada a revisión (simulación): estado PENDING', 'success');
        }
        workspace.value.draftTemplates = (workspace.value.draftTemplates || []).filter((d) => d.id !== draft.id);
        previewOpen.value = false;
      } catch (err) {
        toast(err.message || 'No se pudo enviar la plantilla a aprobación', 'error');
      } finally {
        tplSaving.value = false;
      }
    }

    /** Descarta un borrador local. */
    function discardDraft(draft) {
      workspace.value.draftTemplates = (workspace.value.draftTemplates || []).filter((d) => d.id !== draft.id);
      toast('Borrador descartado', 'info');
    }

    /** Preview de una plantilla (borrador o real). */
    const previewTpl = Vue.ref(null);
    const previewOpen = Vue.ref(false);
    function openPreview(t) {
      previewTpl.value = t;
      previewOpen.value = true;
    }

    /** Todas las plantillas visibles: borradores primero, luego las de Meta. */
    const allTemplates = Vue.computed(() => [...draftTemplates.value, ...templates.value]);

    return {
      tplOpen, tplSaving, tplForm,
      createTemplate, draftTemplates, saveDraftTemplate,
      submitTemplateForApproval, discardDraft,
      previewTpl, previewOpen, openPreview, allTemplates, tplId,
    };
  }

  /**
   * BC Sequences: drip multi-paso por WhatsApp (creación, activar/pausar,
   * enrolar contactos y preview del pipeline de envío).
   */
  function makeCampaignSequences({ templates, sequences, workspace, isLive, profileId, accountId, api, toast, uid }) {
    const seqOpen = Vue.ref(false);
    const seqSaving = Vue.ref(false);
    const seqForm = Vue.reactive({ name: '', templateId: null, steps: [{ delayMinutes: 0, message: '' }] });
    const seqEnrollOpen = Vue.ref(false);
    const seqEnrollTarget = Vue.ref(null);
    const seqPreviewOpen = Vue.ref(false);
    const seqPreviewTarget = Vue.ref(null);
    const enrolling = Vue.ref(false);

    function addSeqStep() {
      seqForm.steps.push({ delayMinutes: 1440, message: '' });
    }

    function removeSeqStep(index) {
      if (seqForm.steps.length > 1) seqForm.steps.splice(index, 1);
    }

    /** Plantillas APPROVED disponibles para secuencias (WhatsApp las exige). */
    const approvedTemplates = Vue.computed(() => templates.value.filter((t) => t.status === 'APPROVED'));

    /** Crea una secuencia (live: /sequences; demo: local). */
    async function createSequence() {
      if (!seqForm.name.trim() || seqSaving.value) return;
      if (isLive.value) {
        const tpl = templates.value.find((t) => tplId(t) === seqForm.templateId);
        if (!tpl || tpl.status !== 'APPROVED') {
          toast('WhatsApp exige una plantilla APROBADA para cada paso de la secuencia', 'error');
          return;
        }
      }
      const steps = seqForm.steps
        .filter((s) => s.message.trim())
        .map((s, i) => ({
          order: i + 1,
          delayMinutes: Number(s.delayMinutes) || 0,
          ...(isLive.value
            ? { template: { name: templates.value.find((t) => tplId(t) === seqForm.templateId).name, language: 'es' } }
            : { message: { text: s.message.trim() } }),
        }));
      if (steps.length === 0) return;
      seqSaving.value = true;
      try {
        if (isLive.value) {
          const created = await api.createSequence({
            profileId: profileId.value,
            accountId: accountId.value,
            platform: 'whatsapp',
            name: seqForm.name.trim(),
            steps,
            exitOnReply: true,
            exitOnUnsubscribe: true,
          });
          sequences.value.unshift(created);
          toast('Secuencia creada (draft)', 'success');
        } else {
          sequences.value.unshift({
            id: uid('seq'),
            name: seqForm.name.trim(),
            status: 'draft',
            steps,
            enrolled: 0,
          });
          toast('Secuencia creada (simulación)', 'success');
        }
        seqOpen.value = false;
        Object.assign(seqForm, { name: '', steps: [{ delayMinutes: 0, message: '' }] });
      } catch (err) {
        toast(err.message || 'No se pudo crear la secuencia', 'error');
      } finally {
        seqSaving.value = false;
      }
    }

    /** Activa o pausa una secuencia. */
    async function toggleSequence(seq) {
      const id = seq.id || seq._id;
      try {
        if (isLive.value) {
          if (seq.status === 'active') await api.pauseSequence(id);
          else await api.activateSequence(id);
        }
        seq.status = seq.status === 'active' ? 'paused' : 'active';
        toast(seq.status === 'active' ? 'Secuencia activada' : 'Secuencia pausada', 'success');
      } catch (err) {
        toast(err.message || 'No se pudo cambiar el estado', 'error');
      }
    }

    /** Enrola todos los contactos locales en la secuencia. */
    async function enrollSequence() {
      const seq = seqEnrollTarget.value;
      const id = seq && (seq.id || seq._id);
      if (!seq || !id || enrolling.value) return;
      enrolling.value = true;
      try {
        const contactIds = (workspace.value.contacts || []).map((c) => c.id).filter(Boolean);
        if (isLive.value) {
          await api.enrollSequence(id, contactIds);
        } else {
          seq.enrolled += contactIds.length;
        }
        toast(`${contactIds.length} contactos enrolados`, 'success');
        seqEnrollOpen.value = false;
        seqEnrollTarget.value = null;
      } catch (err) {
        toast(err.message || 'No se pudieron enrolar contactos', 'error');
      } finally {
        enrolling.value = false;
      }
    }

    /** Abre el pipeline de envío de una secuencia. */
    function openSeqPreview(seq) {
      seqPreviewTarget.value = seq || null;
      seqPreviewOpen.value = true;
    }

    /** Abre el modal de enrolar de una secuencia. */
    function openEnroll(seq) {
      seqEnrollTarget.value = seq;
      seqEnrollOpen.value = true;
    }

    return {
      seqOpen, seqSaving, seqForm,
      seqEnrollOpen, seqEnrollTarget, enrolling,
      seqPreviewOpen, seqPreviewTarget,
      addSeqStep, removeSeqStep, approvedTemplates,
      createSequence, toggleSequence, enrollSequence, openSeqPreview, openEnroll,
    };
  }

  /**
   * BC Flows: formularios nativos de WhatsApp (creación y publicación, envío
   * como mensaje interactivo y preview presentacional cómo lo verá el cliente).
   */
  function makeCampaignFlows({ flows, isLive, accountId, api, toast, uid, niche }) {
    const flowOpen = Vue.ref(false);
    const flowSaving = Vue.ref(false);
    const flowForm = Vue.reactive({ name: '', category: 'LEAD_GENERATION' });
    const flowSendOpen = Vue.ref(false);
    const flowSendTarget = Vue.ref(null);
    const flowPhone = Vue.ref('');
    const flowPreviewOpen = Vue.ref(false);
    const flowPreviewTarget = Vue.ref(null);

    /** Crea un flow de captura de leads y lo publica. */
    async function createFlow() {
      if (!flowForm.name.trim() || flowSaving.value) return;
      flowSaving.value = true;
      try {
        if (isLive.value) {
          const draft = await api.createFlow({
            accountId: accountId.value,
            name: flowForm.name.trim(),
            categories: [flowForm.category],
          });
          const id = draft.id || draft._id;
          await api.uploadFlowJson(id, leadFlowJson(niche.value.nombre), accountId.value);
          const published = await api.publishFlow(id, accountId.value);
          flows.value.unshift(published);
          toast('Flow publicado en WhatsApp', 'success');
        } else {
          flows.value.unshift({
            id: uid('flow'),
            name: flowForm.name.trim(),
            category: flowForm.category,
            status: 'PUBLISHED',
          });
          toast('Flow publicado (simulación)', 'success');
        }
        flowOpen.value = false;
        Object.assign(flowForm, { name: '', category: 'LEAD_GENERATION' });
      } catch (err) {
        toast(err.message || 'No se pudo publicar el flow', 'error');
      } finally {
        flowSaving.value = false;
      }
    }

    /** Envía un flow publicado como mensaje interactivo. */
    async function sendFlow() {
      const flow = flowSendTarget.value;
      const id = flow && (flow.id || flow._id);
      if (!flow || !id || !flowPhone.value.trim()) return;
      try {
        if (isLive.value) {
          await api.sendFlow({
            accountId: accountId.value,
            to: flowPhone.value.trim(),
            flow_id: id,
            flow_cta: 'Comenzar',
            body: 'Completa este formulario rápido y te contactamos.',
          });
        }
        toast(`Flow enviado a ${flowPhone.value.trim()}`, 'success');
        flowSendOpen.value = false;
        flowSendTarget.value = null;
        flowPhone.value = '';
      } catch (err) {
        toast(err.message || 'No se pudo enviar el flow', 'error');
      }
    }

    /** Abre la vista previa del flow (cómo lo verá el cliente). */
    function openFlowPreview(flow) {
      flowPreviewTarget.value = flow || null;
      flowPreviewOpen.value = true;
    }

    /** Abre el modal de envío de un flow publicado. */
    function openFlowSend(flow) {
      flowSendTarget.value = flow;
      flowSendOpen.value = true;
    }

    return {
      flowOpen, flowSaving, flowForm,
      flowSendOpen, flowSendTarget, flowPhone,
      flowPreviewOpen, flowPreviewTarget,
      createFlow, sendFlow, openFlowPreview, openFlowSend,
    };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeCampaignShell,
    makeCampaignBroadcasts,
    makeCampaignTemplates,
    makeCampaignSequences,
    makeCampaignFlows,
  });
})();