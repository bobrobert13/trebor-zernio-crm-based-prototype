/**
 * @file broadcasts.js — Campañas con 3 tabs: Broadcasts, Secuencias y Flows.
 * Broadcasts: crear draft → destinatarios por segmento → enviar/programar
 * (live usa /broadcasts; demo simula). Plantillas de WhatsApp desde
 * /whatsapp/templates con creación custom o desde el library de Meta.
 * Secuencias y Flows se añaden en la sección correspondiente del fichero.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, formatDate, formatTime, uid, canEdit, getNiche, api, asArray } = ZernioCrm;

  const components = {};

  /** Estados de plantilla → variante de badge. */
  const TEMPLATE_TONES = { APPROVED: 'success', PENDING: 'warn', REJECTED: 'danger' };

  /** Guiones demo de secuencias por nicho. */
  function demoSequences(niche) {
    return [
      {
        id: uid('seq'),
        name: `Seguimiento post-${niche.tags[0] || 'venta'}`,
        status: 'active',
        steps: [{ order: 1, delayMinutes: 0, message: '¡Gracias por escribirnos! Un asesor te atiende enseguida.' }],
        enrolled: 24,
      },
      {
        id: uid('seq'),
        name: 'Bienvenida 3 pasos',
        status: 'draft',
        steps: [
          { order: 1, delayMinutes: 0, message: '¡Hola! 👋 Bienvenido a nuestro canal.' },
          { order: 2, delayMinutes: 1440, message: '¿Tienes alguna duda sobre nuestros productos?' },
        ],
        enrolled: 0,
      },
    ];
  }

  /** Flows demo de captura de leads. */
  function demoFlows() {
    return [
      { id: uid('flow'), name: 'captura_leads', category: 'LEAD_GENERATION', status: 'PUBLISHED' },
      { id: uid('flow'), name: 'contacto_soporte', category: 'CUSTOMER_SUPPORT', status: 'DRAFT' },
    ];
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

  components['broadcasts-view'] = {
    setup() {
      const tab = Vue.ref('broadcasts');
      const loading = Vue.ref(true);

      const createOpen = Vue.ref(false);
      const sending = Vue.ref(false);
      const form = Vue.reactive({ name: '', templateId: null, tag: null });

      const tplOpen = Vue.ref(false);
      const tplSaving = Vue.ref(false);
      const tplForm = Vue.reactive({ mode: 'custom', name: '', category: 'UTILITY', body: '', libraryName: '' });

      const recipientsOpen = Vue.ref(false);
      const recipientsList = Vue.ref([]);
      const recipientsBroadcast = Vue.ref(null);

      const seqOpen = Vue.ref(false);
      const seqSaving = Vue.ref(false);
      const seqForm = Vue.reactive({ name: '', templateId: null, steps: [{ delayMinutes: 0, message: '' }] });
      const seqEnrollOpen = Vue.ref(false);
      const seqEnrollTarget = Vue.ref(null);
      const enrolling = Vue.ref(false);

      const flowOpen = Vue.ref(false);
      const flowSaving = Vue.ref(false);
      const flowForm = Vue.reactive({ name: '', category: 'LEAD_GENERATION' });
      const flowSendOpen = Vue.ref(false);
      const flowSendTarget = Vue.ref(null);
      const flowPhone = Vue.ref('');

      /** Temporizadores activos (cleanup en onUnmounted). */
      const timers = [];
      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => getNiche(workspace.value && workspace.value.nicheId));
      const profileId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.profileId);
      const accountId = Vue.computed(() => workspace.value.zernio && workspace.value.zernio.accountId);
      const isLive = Vue.computed(() => store.mode === 'live' && Boolean(profileId.value));

      const broadcasts = Vue.ref([]);
      const templates = Vue.ref([]);
      const sequences = Vue.ref([]);
      const flows = Vue.ref([]);

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

      // ── Plantillas: borradores + consentimiento ────────────────────────────

      /** Borradores de plantillas locales (nunca se envían a Meta sin consentimiento). */
      const draftTemplates = Vue.computed(() => workspace.value.draftTemplates || []);

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

      /** Guía educativa de campañas (pipeline). */
      const guideOpen = Vue.ref(false);

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

      function tplId(t) {
        return t.id || t._id || t.name;
      }

      // ── Secuencias ─────────────────────────────────────────────────────────

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

      // ── Flows de WhatsApp ──────────────────────────────────────────────────

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

      function seqStatusTone(status) {
        return status === 'active' ? 'success' : status === 'paused' ? 'warn' : 'neutral';
      }

      return {
        tab, loading, createOpen, sending, form, tplOpen, tplSaving, tplForm,
        recipientsOpen, recipientsList, recipientsBroadcast,
        seqOpen, seqSaving, seqForm, seqEnrollOpen, seqEnrollTarget, enrolling,
        flowOpen, flowSaving, flowForm, flowSendOpen, flowSendTarget, flowPhone,
        workspace, niche, isLive, broadcasts, templates, sequences, flows, TEMPLATE_TONES,
        approvedTemplates, draftTemplates, allTemplates,
        saveDraftTemplate, submitTemplateForApproval, discardDraft,
        previewTpl, previewOpen, openPreview, guideOpen,
        canEdit, createBroadcast, createTemplate, openRecipients, tplId,
        addSeqStep, removeSeqStep, createSequence, toggleSequence, enrollSequence,
        createFlow, sendFlow, seqStatusTone, formatDate, formatTime,
        ui: ZernioCrm,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Campañas</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Mensajes masivos, secuencias y formularios de WhatsApp.
              <span class="font-semibold">{{ isLive ? '· conectado a Zernio' : '· modo demo' }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button @click="load" class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Actualizar
            </button>
            <button v-if="canEdit('broadcasts')" @click="createOpen = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="megaphone" class="h-4 w-4"></ui-icon> Nueva campaña
            </button>
          </div>
        </header>

        <!-- Pipeline educativo: para qué sirve cada herramienta -->
        <section class="border-2 border-neutral-900 bg-white">
          <button @click="guideOpen = !guideOpen" class="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <ui-icon name="book" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">¿Qué puedes hacer aquí?</p>
                <p class="text-xs text-neutral-500">Guía rápida: para qué sirve cada herramienta y cuándo usarla.</p>
              </div>
            </div>
            <ui-icon name="chevron-down" class="h-4 w-4 shrink-0 text-neutral-400 transition-transform" :class="guideOpen ? 'rotate-180' : ''"></ui-icon>
          </button>
          <div v-if="guideOpen" class="border-t border-neutral-200 p-5">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article v-for="tool in ui.CAMPAIGN_TOOLS" :key="tool.id" class="flex flex-col border border-neutral-200 p-4">
                <div class="flex items-center justify-between gap-2">
                  <ui-icon :name="tool.icon" class="h-5 w-5 text-[var(--accent)]"></ui-icon>
                  <ui-badge :variant="tool.aprobacion ? 'warn' : 'success'">{{ tool.aprobacion ? 'Requiere aprobación' : 'Inmediato' }}</ui-badge>
                </div>
                <h4 class="mt-2 font-semibold">{{ tool.nombre }}</h4>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">{{ tool.para }}</p>
                <p class="mt-3 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cuándo usarlo</p>
                <ul class="mt-1.5 space-y-1">
                  <li v-for="c in tool.cuando" :key="c" class="flex items-start gap-1.5 text-xs text-neutral-600">
                    <ui-icon name="check" class="mt-0.5 h-3 w-3 shrink-0 text-emerald-700"></ui-icon>
                    {{ c }}
                  </li>
                </ul>
              </article>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2 border border-neutral-200 bg-stone-50 p-4 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <span class="flex items-center gap-1.5"><ui-icon name="message" class="h-4 w-4"></ui-icon> Plantilla aprobada</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="megaphone" class="h-4 w-4"></ui-icon> Broadcast / Secuencia</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="users" class="h-4 w-4"></ui-icon> Contacto suscrito</span>
            </div>
          </div>
        </section>

        <!-- Tabs -->
        <div class="flex gap-1.5 border-b-2 border-neutral-900">
          <button v-for="t in [['broadcasts', 'Broadcasts'], ['sequences', 'Secuencias'], ['flows', 'Flows']]" :key="t[0]"
            @click="tab = t[0]"
            class="border-2 border-b-0 px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition"
            :class="tab === t[0] ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-transparent text-neutral-500 hover:text-neutral-900'">
            {{ t[1] }}
          </button>
        </div>

        <!-- Carga -->
        <div v-if="loading" class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ui-skeleton v-for="i in 3" :key="i" h="h-40"></ui-skeleton>
          </div>
          <ui-skeleton h="h-48"></ui-skeleton>
        </div>

        <template v-else>
          <!-- ═══ TAB: BROADCASTS ═══ -->
          <section v-if="tab === 'broadcasts'" class="space-y-6">
            <div v-if="broadcasts.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
              <ui-empty icon="megaphone" title="Sin campañas" desc="Crea tu primera campaña masiva por WhatsApp."></ui-empty>
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article v-for="b in broadcasts" :key="b.id || b._id" class="border-2 border-neutral-900 bg-white p-5">
                <div class="flex items-start justify-between gap-2">
                  <h4 class="font-semibold">{{ b.name }}</h4>
                  <ui-badge :variant="(b.status === 'sent' || b.status === 'completed') ? 'success' : 'warn'" dot>
                    {{ (b.status || 'sent') === 'completed' ? 'Enviada' : (b.status || 'sent') === 'sent' ? 'Enviada' : b.status }}
                  </ui-badge>
                </div>
                <p class="mt-1 text-sm text-neutral-500">{{ b.audience || b.segmentFilters?.tags?.join(', ') || 'Todos los contactos activos' }}</p>
                <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  {{ formatDate(b.sentAt || b.createdAt || Date.now()) }}
                </p>
                <div class="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                  <div class="font-mono text-[11px] tabular-nums text-neutral-500">
                    <template v-if="b.stats">
                      {{ b.stats.total || 0 }} dest. · <span class="text-emerald-700">{{ b.stats.delivered || 0 }} ✓</span>
                    </template>
                    <template v-else>{{ b.recipientCount || b.totalRecipients || 0 }} dest.</template>
                  </div>
                  <button @click="openRecipients(b)" class="border border-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">
                    Destinatarios
                  </button>
                </div>
              </article>
            </div>

            <!-- Plantillas de WhatsApp -->
            <section>
              <div class="mb-3 flex items-center justify-between">
                <div>
                  <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Plantillas de WhatsApp</h3>
                  <p class="text-xs text-neutral-500">Fuera de la ventana de 24h solo se envían plantillas aprobadas por Meta (UTILITY/MARKETING).</p>
                </div>
                <button v-if="canEdit('broadcasts')" @click="tplOpen = true"
                  class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  <ui-icon name="plus" class="h-3.5 w-3.5"></ui-icon> Nueva plantilla
                </button>
              </div>
              <div class="overflow-x-auto border-2 border-neutral-900 bg-white">
                <table class="w-full min-w-[640px] text-left text-sm">
                  <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th class="px-4 py-3">Nombre</th>
                      <th class="px-4 py-3">Categoría</th>
                      <th class="px-4 py-3">Idioma</th>
                      <th class="px-4 py-3">Estado</th>
                      <th class="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    <tr v-for="t in allTemplates" :key="tplId(t)" class="hover:bg-stone-50">
                      <td class="px-4 py-3 font-mono text-xs">{{ t.name }}</td>
                      <td class="px-4 py-3"><ui-badge variant="neutral">{{ t.category }}</ui-badge></td>
                      <td class="px-4 py-3 font-mono text-xs uppercase text-neutral-500">{{ t.language }}</td>
                      <td class="px-4 py-3"><ui-badge :variant="t.status === 'draft' ? 'neutral' : TEMPLATE_TONES[t.status] || 'neutral'" dot>{{ t.status }}</ui-badge></td>
                      <td class="px-4 py-3">
                        <div class="flex justify-end gap-1.5">
                          <button @click="openPreview(t)" class="border border-neutral-300 px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition hover:border-neutral-900">Ver preview</button>
                          <template v-if="t.status === 'draft' && canEdit('broadcasts')">
                            <button @click="submitTemplateForApproval(t)" :disabled="tplSaving"
                              class="border border-[var(--accent)] bg-[var(--accent)] px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white transition hover:shadow-brutal-sm disabled:opacity-40">
                              {{ tplSaving ? 'Enviando…' : 'Enviar a aprobación' }}
                            </button>
                            <button @click="discardDraft(t)" class="border border-red-800 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-red-800 transition hover:shadow-brutal-sm">Descartar</button>
                          </template>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p class="mt-2 text-xs text-neutral-500">
                Los borradores no se envían a Meta: pulsa "Enviar a aprobación" cuando estés listo. La revisión puede tardar hasta 24 h.
              </p>
            </section>
          </section>

          <!-- ═══ TAB: SECUENCIAS ═══ -->
          <section v-if="tab === 'sequences'" class="space-y-5">
            <div class="flex items-center justify-between">
              <p class="text-sm text-neutral-500">
                Drip multi-paso por WhatsApp. Los contactos enrolados salen al responder (exitOnReply).
              </p>
              <button v-if="canEdit('broadcasts')" @click="seqOpen = true"
                class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nueva secuencia
              </button>
            </div>
            <div v-if="sequences.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
              <ui-empty icon="zap" title="Sin secuencias" desc="Crea un flujo de seguimiento automático."></ui-empty>
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article v-for="s in sequences" :key="s.id || s._id" class="border-2 border-neutral-900 bg-white p-5">
                <div class="flex items-start justify-between gap-2">
                  <h4 class="font-semibold">{{ s.name }}</h4>
                  <ui-badge :variant="seqStatusTone(s.status)" dot>{{ s.status }}</ui-badge>
                </div>
                <p class="mt-2 font-mono text-[11px] tabular-nums text-neutral-500">
                  {{ (s.steps || []).length }} pasos · {{ s.enrolled || s.enrollmentCount || 0 }} enrolados
                </p>
                <ul class="mt-3 space-y-1.5 border-t border-neutral-100 pt-3">
                  <li v-for="st in (s.steps || []).slice(0, 3)" :key="st.order" class="flex items-center gap-2 text-xs text-neutral-600">
                    <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 font-mono text-[10px] tabular-nums">{{ st.order }}</span>
                    <span class="min-w-0 flex-1 truncate">{{ (st.message && st.message.text) || (st.template && st.template.name) || 'Mensaje' }}</span>
                    <span class="shrink-0 font-mono text-[9px] uppercase text-neutral-400">{{ st.delayMinutes === 0 ? 'ahora' : Math.round((st.delayMinutes || 0) / 1440) + ' d' }}</span>
                  </li>
                </ul>
                <div class="mt-4 flex gap-2">
                  <button @click="toggleSequence(s)" class="flex-1 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                    {{ s.status === 'active' ? 'Pausar' : 'Activar' }}
                  </button>
                  <button @click="seqEnrollTarget = s; seqEnrollOpen = true" class="flex-1 border-2 border-neutral-900 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                    Enrolar
                  </button>
                </div>
              </article>
            </div>
          </section>

          <!-- ═══ TAB: FLOWS ═══ -->
          <section v-if="tab === 'flows'" class="space-y-5">
            <div class="flex items-center justify-between">
              <p class="text-sm text-neutral-500">
                Formularios nativos de WhatsApp (captura de leads por nicho). Publicados son inmutables: para editar se clona.
              </p>
              <button v-if="canEdit('broadcasts')" @click="flowOpen = true"
                class="flex shrink-0 items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo flow
              </button>
            </div>
            <div v-if="flows.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
              <ui-empty icon="edit" title="Sin flows" desc="Crea tu primer formulario de captura de leads."></ui-empty>
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <article v-for="f in flows" :key="f.id || f._id" class="border-2 border-neutral-900 bg-white p-5">
                <div class="flex items-start justify-between gap-2">
                  <h4 class="break-all font-mono text-sm font-semibold">{{ f.name }}</h4>
                  <ui-badge :variant="f.status === 'PUBLISHED' ? 'success' : f.status === 'DEPRECATED' ? 'warn' : 'neutral'" dot>{{ f.status }}</ui-badge>
                </div>
                <div class="mt-3 flex items-center gap-2">
                  <ui-badge variant="neutral">{{ f.category }}</ui-badge>
                  <span v-if="f.previewUrl" class="truncate font-mono text-[10px] text-neutral-400">{{ f.previewUrl }}</span>
                </div>
                <button v-if="f.status === 'PUBLISHED'" @click="flowSendTarget = f; flowSendOpen = true"
                  class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                  Enviar flow
                </button>
              </article>
            </div>
          </section>
        </template>

        <!-- Modal: nueva campaña -->
        <ui-modal :open="createOpen" title="Nueva campaña" @close="createOpen = false">
          <div class="space-y-4">
            <ui-field label="Nombre de la campaña">
              <input v-model.trim="form.name" type="text" placeholder="Ej: Promoción de fin de semana"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Plantilla" hint="Solo plantillas APROBADAS salen de la ventana de 24h.">
              <select v-model="form.templateId" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option :value="null" disabled>Elige una plantilla…</option>
                <option v-for="t in templates" :key="tplId(t)" :value="tplId(t)">{{ t.name }} ({{ t.status }})</option>
              </select>
            </ui-field>
            <ui-field label="Audiencia" hint="Consentimiento: solo se envían mensajes a contactos suscritos (isSubscribed).">
              <select v-model="form.tag" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option :value="null">Todos los contactos activos y suscritos</option>
                <option v-for="t in niche.tags" :key="t" :value="t">Contactos suscritos con tag "{{ t }}"</option>
              </select>
            </ui-field>
            <button @click="createBroadcast" :disabled="!form.name.trim() || !form.templateId || sending"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
              {{ sending ? 'Enviando…' : 'Crear y enviar' }}
            </button>
          </div>
        </ui-modal>

        <!-- Modal: nueva plantilla (guarda borrador; no envía a Meta) -->
        <ui-modal :open="tplOpen" title="Nueva plantilla de WhatsApp" @close="tplOpen = false">
          <div class="space-y-4">
            <div class="flex gap-1.5">
              <button @click="tplForm.mode = 'custom'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="tplForm.mode === 'custom' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-neutral-300'">Personalizada</button>
              <button @click="tplForm.mode = 'library'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="tplForm.mode === 'library' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-neutral-300'">Library de Meta</button>
            </div>
            <div class="grid gap-4 sm:grid-cols-2">
              <ui-field label="Nombre (minúsculas y _)">
                <input v-model.trim="tplForm.name" type="text" placeholder="ej: confirmacion_pedido"
                  class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Categoría">
                <select v-model="tplForm.category" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                  <option value="UTILITY">UTILITY</option>
                  <option value="MARKETING">MARKETING</option>
                  <option value="AUTHENTICATION">AUTHENTICATION</option>
                </select>
              </ui-field>
            </div>
            <ui-field v-if="tplForm.mode === 'custom'" label="Texto del mensaje ({{ '{{1}}' }} para variables)">
              <textarea v-model.trim="tplForm.body" rows="3" placeholder="Tu pedido {{1}} fue confirmado…"
                class="w-full resize-none border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900"></textarea>
            </ui-field>
            <ui-field v-else label="Nombre en el library de Meta" hint="Ej: appointment_reminder — aprobada, sin espera.">
              <input v-model.trim="tplForm.libraryName" type="text" placeholder="appointment_reminder"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            </ui-field>
            <p class="border border-neutral-200 bg-stone-50 px-3 py-2 text-xs text-neutral-600">
              Se guardará como borrador local. Nada se envía a Meta hasta que pulses "Enviar a aprobación" en la lista.
            </p>
            <button @click="saveDraftTemplate" :disabled="tplSaving || !tplForm.name.trim()"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Guardar borrador
            </button>
          </div>
        </ui-modal>

        <!-- Modal: preview de plantilla -->
        <ui-modal :open="previewOpen" :title="'Plantilla · ' + (previewTpl ? previewTpl.name : '')" width="max-w-3xl" @close="previewOpen = false">
          <template v-if="previewTpl">
            <template-preview :tpl="previewTpl"></template-preview>
            <div v-if="previewTpl.status === 'draft'" class="mt-4 flex justify-end gap-2">
              <button @click="discardDraft(previewTpl); previewOpen = false" class="border-2 border-red-800 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:shadow-brutal-sm">Descartar</button>
              <button @click="submitTemplateForApproval(previewTpl)" :disabled="tplSaving"
                class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="tplSaving" size="h-4 w-4"></ui-spinner>
                Enviar a aprobación (Meta revisa hasta 24 h)
              </button>
            </div>
          </template>
        </ui-modal>

        <!-- Modal: nueva secuencia -->
        <ui-modal :open="seqOpen" title="Nueva secuencia" width="max-w-2xl" @close="seqOpen = false">
          <div class="space-y-4">
          <ui-field label="Nombre de la secuencia">
              <input v-model.trim="seqForm.name" type="text" placeholder="Ej: Seguimiento post-venta"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field v-if="isLive" label="Plantilla de WhatsApp (aprobada)" hint="En WhatsApp cada paso usa una plantilla; el texto libre del paso no aplica.">
              <select v-model="seqForm.templateId" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option :value="null" disabled>Elige una plantilla aprobada…</option>
                <option v-for="t in approvedTemplates" :key="tplId(t)" :value="tplId(t)">{{ t.name }} ({{ t.language }})</option>
              </select>
            </ui-field>
            <div class="space-y-3">
              <div v-for="(step, i) in seqForm.steps" :key="i" class="border-2 border-neutral-200 p-3">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Paso {{ i + 1 }}</span>
                  <button v-if="seqForm.steps.length > 1" @click="removeSeqStep(i)" class="text-neutral-400 hover:text-red-700" aria-label="Quitar paso">
                    <ui-icon name="x" class="h-4 w-4"></ui-icon>
                  </button>
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <span class="font-mono text-[10px] uppercase text-neutral-400">Espera</span>
                  <select v-model.number="step.delayMinutes" class="border-2 border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900">
                    <option :value="0">Ahora</option>
                    <option :value="1440">1 día</option>
                    <option :value="2880">2 días</option>
                    <option :value="4320">3 días</option>
                    <option :value="10080">7 días</option>
                  </select>
                </div>
                <textarea v-model.trim="step.message" rows="2" placeholder="Mensaje del paso…"
                  class="mt-2 w-full resize-none border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"></textarea>
              </div>
            </div>
            <button @click="addSeqStep" class="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)]">
              <ui-icon name="plus" class="h-4 w-4"></ui-icon> Añadir paso
            </button>
            <button @click="createSequence" :disabled="seqSaving || !seqForm.name.trim() || (isLive && !seqForm.templateId)"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="seqSaving" size="h-4 w-4"></ui-spinner>
              {{ seqSaving ? 'Creando…' : 'Crear secuencia' }}
            </button>
          </div>
        </ui-modal>

        <!-- Modal: enrolar contactos -->
        <ui-modal :open="seqEnrollOpen" title="Enrolar contactos" width="max-w-md" @close="seqEnrollOpen = false">
          <p class="text-sm text-neutral-600">
            Se enrolarán <span class="font-semibold">{{ workspace.contacts.length }}</span> contactos en
            <span class="font-semibold">{{ seqEnrollTarget ? seqEnrollTarget.name : '' }}</span>.
            Los que ya estén enrolados se omiten.
          </p>
          <button @click="enrollSequence" :disabled="enrolling"
            class="mt-4 flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            <ui-spinner v-if="enrolling" size="h-4 w-4"></ui-spinner>
            {{ enrolling ? 'Enrolando…' : 'Enrolar contactos' }}
          </button>
        </ui-modal>

        <!-- Modal: nuevo flow -->
        <ui-modal :open="flowOpen" title="Nuevo flow de captura de leads" @close="flowOpen = false">
          <div class="space-y-4">
            <ui-field label="Nombre (minúsculas y _)">
              <input v-model.trim="flowForm.name" type="text" placeholder="ej: captura_leads"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Categoría">
              <select v-model="flowForm.category" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option value="LEAD_GENERATION">LEAD_GENERATION</option>
                <option value="CONTACT_US">CONTACT_US</option>
                <option value="CUSTOMER_SUPPORT">CUSTOMER_SUPPORT</option>
                <option value="SURVEY">SURVEY</option>
                <option value="APPOINTMENT_BOOKING">APPOINTMENT_BOOKING</option>
                <option value="SIGN_UP">SIGN_UP</option>
              </select>
            </ui-field>
            <div class="border-2 border-dashed border-neutral-300 bg-stone-50 p-3 text-xs text-neutral-500">
              Se generará un formulario de captura (nombre, teléfono y mensaje) adaptado a
              <span class="font-semibold">{{ niche.nombre }}</span>, se subirá el JSON y se publicará (irreversible).
            </div>
            <button @click="createFlow" :disabled="flowSaving || !flowForm.name.trim()"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="flowSaving" size="h-4 w-4"></ui-spinner>
              {{ flowSaving ? 'Publicando…' : 'Crear y publicar' }}
            </button>
          </div>
        </ui-modal>

        <!-- Modal: enviar flow -->
        <ui-modal :open="flowSendOpen" :title="'Enviar flow · ' + (flowSendTarget ? flowSendTarget.name : '')" width="max-w-md" @close="flowSendOpen = false">
          <ui-field label="Teléfono (E.164)">
            <input v-model.trim="flowPhone" type="tel" placeholder="+58 412 000 0000"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
          </ui-field>
          <button @click="sendFlow" :disabled="!flowPhone.trim()"
            class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            Enviar formulario
          </button>
        </ui-modal>

        <!-- Modal: destinatarios -->
        <ui-modal :open="recipientsOpen" :title="'Destinatarios · ' + (recipientsBroadcast ? recipientsBroadcast.name : '')"
          width="max-w-2xl" @close="recipientsOpen = false">
          <div class="overflow-x-auto border-2 border-neutral-900">
            <table class="w-full text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-2.5">Contacto</th>
                  <th class="px-4 py-2.5">Estado</th>
                  <th class="px-4 py-2.5">Error</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-for="r in recipientsList" :key="r.id || r._id">
                  <td class="px-4 py-2.5">{{ r.name || r.contactName || r.phone || '—' }}</td>
                  <td class="px-4 py-2.5">
                    <ui-badge :variant="r.status === 'failed' ? 'danger' : r.status === 'read' || r.status === 'delivered' ? 'success' : 'neutral'" dot>
                      {{ r.status || 'pending' }}
                    </ui-badge>
                  </td>
                  <td class="px-4 py-2.5 font-mono text-xs text-red-700">{{ r.error || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </ui-modal>
      </div>`,
  };

  /**
   * Preview gráfico de una plantilla de WhatsApp: burbuja simulada con
   * header/body/footer/botones y panel de información de la plantilla.
   * Robusto ante plantillas sin body (solo media o interactivas).
   */
  components['template-preview'] = {
    props: { tpl: { type: Object, required: true } },
    setup(props) {
      const comps = props.tpl.components || [];
      const body = comps.find((c) => c.type === 'body') || {};
      const header = comps.find((c) => c.type === 'header') || {};
      const footer = comps.find((c) => c.type === 'footer') || {};
      const buttons = (comps.find((c) => c.type === 'buttons') || {}).buttons || [];

      /** Sustituye {{n}} por los ejemplos de Meta (o deja la variable visible). */
      function fill(text, example) {
        const list = Array.isArray(example) ? example : [];
        return String(text || '').replace(/\{\{(\d+)\}\}/g, (_, n) => list[Number(n) - 1] || `{{${n}}}`);
      }

      const bodyText = Vue.computed(() => fill(props.tpl.body || body.text || '', (body.example || {}).body_text?.[0]));
      const headerText = Vue.computed(() => fill(header.text || '', (header.example || {}).header_text?.[0]));
      const footerText = Vue.computed(() => fill(footer.text || '', null));
      const hasBody = Vue.computed(() => Boolean(String(bodyText.value).trim()));
      const headerFormat = Vue.computed(() => (header.format ? String(header.format).toLowerCase() : ''));
      const variables = Vue.computed(() => {
        const m = String(props.tpl.body || body.text || '').match(/\{\{\d+\}\}/g) || [];
        return [...new Set(m)];
      });
      /** Envelope sin componentes: no hay nada que renderizar (ni header ni body). */
      const noComponents = Vue.computed(() => !props.tpl.components || !props.tpl.components.length);
      return { bodyText, headerText, footerText, buttons, fill, hasBody, headerFormat, variables, noComponents };
    },
    template: `
      <div class="grid gap-5 sm:grid-cols-2">
        <!-- Burbuja de WhatsApp simulada -->
        <div class="rounded-lg bg-[#efeae2] p-4">
          <div class="mx-auto max-w-[300px]">
            <div class="mb-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-neutral-400">Vista previa en WhatsApp</div>
            <div class="rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 shadow-sm">
              <!-- Header: texto o media -->
              <div v-if="headerText" class="border-b border-neutral-100 pb-1.5">
                <span v-if="headerFormat" class="mr-1.5 border px-1 py-px font-mono text-[8px] uppercase" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
                  {{ headerFormat === 'image' ? 'Imagen' : headerFormat === 'video' ? 'Video' : 'Documento' }}
                </span>
                <p class="text-xs font-semibold text-neutral-500">{{ headerText }}</p>
              </div>
              <div v-else-if="headerFormat" class="border-b border-neutral-100 pb-1.5">
                <span class="border px-1.5 py-px font-mono text-[8px] uppercase" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
                  {{ headerFormat === 'image' ? 'Imagen adjunta' : headerFormat === 'video' ? 'Video adjunto' : 'Documento adjunto' }}
                </span>
              </div>
              <!-- Body: texto o placeholder claro -->
              <p v-if="hasBody" class="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{{ bodyText }}</p>
              <p v-else class="mt-1 rounded border border-dashed border-neutral-300 bg-stone-50 px-2 py-2 text-center text-xs text-neutral-400">
                {{ headerFormat ? 'Esta plantilla no tiene texto: usa el ' + (headerFormat === 'image' ? 'adjunto' : headerFormat) + ' o los botones para comunicar.' : 'Plantilla sin contenido de texto definido.' }}
              </p>
              <p v-if="footerText" class="mt-1 text-[11px] text-neutral-400">{{ footerText }}</p>
              <div v-if="buttons.length" class="mt-2 space-y-1.5 border-t border-neutral-100 pt-2">
                <div v-for="(b, i) in buttons" :key="i" class="rounded-md border px-3 py-1.5 text-center text-xs font-medium"
                  :class="b.type === 'url' ? 'border-sky-600 text-sky-700' : b.type === 'phone_number' ? 'border-emerald-700 text-emerald-800' : 'border-neutral-300 text-neutral-700'">
                  {{ b.text || b.url || b.phone_number || 'Botón' }}
                </div>
              </div>
            </div>
            <p class="mt-1.5 text-right font-mono text-[9px] text-neutral-400">WhatsApp · ahora</p>
          </div>
        </div>
        <!-- Información de la plantilla -->
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Nombre</p>
              <p class="mt-0.5 break-all font-mono text-xs font-semibold">{{ tpl.name }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Categoría</p>
              <p class="mt-0.5 text-xs font-semibold">{{ tpl.category }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Idioma</p>
              <p class="mt-0.5 text-xs font-semibold">{{ tpl.language }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Estado</p>
              <p class="mt-0.5 text-xs font-semibold" :class="tpl.status === 'APPROVED' ? 'text-emerald-700' : tpl.status === 'draft' ? 'text-neutral-500' : 'text-amber-700'">{{ tpl.status }}</p>
            </div>
          </div>
          <!-- Desglose de componentes -->
          <p v-if="noComponents" class="border border-dashed border-neutral-400 bg-stone-50 px-3 py-2 text-xs text-neutral-500">
            Sin componentes definidos en esta plantilla.
          </p>
          <div v-else class="flex flex-wrap gap-1.5">
            <span v-if="headerFormat" class="border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
              Header {{ headerFormat === 'image' ? 'imagen' : headerFormat === 'video' ? 'video' : 'documento' }}
            </span>
            <span v-if="hasBody" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">Body texto</span>
            <span v-else class="border border-dashed border-neutral-400 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">Sin body</span>
            <span v-if="footerText" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">Footer</span>
            <span v-if="buttons.length" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">{{ buttons.length }} botón(es)</span>
          </div>
          <div v-if="variables.length" class="border border-neutral-200 p-3">
            <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Variables (se llenan al enviar)</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span v-for="v in variables" :key="v" class="border border-neutral-300 bg-stone-50 px-2 py-0.5 font-mono text-[10px]">{{ v }}</span>
            </div>
          </div>
          <p v-if="tpl.status === 'draft'" class="border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Borrador local: aún no fue enviado a Meta. Pulsa "Enviar a aprobación" para iniciar la revisión (hasta 24 h).
          </p>
          <p v-else-if="tpl.status === 'PENDING'" class="border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            En revisión de Meta: puede tardar hasta 24 h. Podrás usarla cuando esté aprobada.
          </p>
          <p v-else-if="tpl.status === 'REJECTED'" class="border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
            Rechazada por Meta: revisa el motivo y crea una nueva versión.
          </p>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
