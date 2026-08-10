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
  const { store, toast, formatDate, formatTime, uid, canEdit, getNiche, api } = ZernioCrm;

  const components = {};

  /** Estados de plantilla → variante de badge. */
  const TEMPLATE_TONES = { APPROVED: 'success', PENDING: 'warn', REJECTED: 'danger' };

  /** Normaliza respuestas del API que pueden venir como array o { items }. */
  function asArray(data) {
    if (Array.isArray(data)) return data;
    return (data && (data.items || data.data || data.broadcasts || data.sequences || data.flows)) || [];
  }

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

  /** JSON de pantallas para un flow de captura de leads (versión Meta 6.0). */
  function leadFlowJson(nicheName) {
    return {
      version: '6.0',
      data: {
        theme_name: 'ZernioCRM',
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
      },
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

      /** Carga datos: live real o seeds demo. */
      async function load() {
        loading.value = true;
        if (isLive.value) {
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

      /** Crea y envía un broadcast (live: draft → segmento → send). */
      async function createBroadcast() {
        if (!form.name.trim() || !form.templateId || sending.value) return;
        sending.value = true;
        try {
          if (isLive.value) {
            const tpl = templates.value.find((t) => (t.id || t.name) === form.templateId);
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
            await api.sendBroadcast(id);
            toast('Campaña enviada a Zernio', 'success');
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
            templates.value.unshift(created);
            toast('Plantilla creada (en revisión de Meta)', 'success');
          } else {
            templates.value.unshift({
              id: uid('tpl'),
              name,
              category: tplForm.category,
              language: 'es',
              status: 'PENDING',
            });
            toast('Plantilla creada (simulación)', 'success');
          }
          tplOpen.value = false;
          Object.assign(tplForm, { mode: 'custom', name: '', category: 'UTILITY', body: '', libraryName: '' });
        } catch (err) {
          toast(err.message || 'No se pudo crear la plantilla', 'error');
        } finally {
          tplSaving.value = false;
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

      function tplId(t) {
        return t.id || t._id || t.name;
      }

      return {
        tab, loading, createOpen, sending, form, tplOpen, tplSaving, tplForm,
        recipientsOpen, recipientsList, recipientsBroadcast,
        workspace, niche, isLive, broadcasts, templates, sequences, flows, TEMPLATE_TONES,
        canEdit, createBroadcast, createTemplate, openRecipients, tplId, formatDate, formatTime,
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
                <table class="w-full min-w-[560px] text-left text-sm">
                  <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th class="px-4 py-3">Nombre</th>
                      <th class="px-4 py-3">Categoría</th>
                      <th class="px-4 py-3">Idioma</th>
                      <th class="px-4 py-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    <tr v-for="t in templates" :key="tplId(t)" class="hover:bg-stone-50">
                      <td class="px-4 py-3 font-mono text-xs">{{ t.name }}</td>
                      <td class="px-4 py-3"><ui-badge variant="neutral">{{ t.category }}</ui-badge></td>
                      <td class="px-4 py-3 font-mono text-xs uppercase text-neutral-500">{{ t.language }}</td>
                      <td class="px-4 py-3"><ui-badge :variant="TEMPLATE_TONES[t.status] || 'neutral'" dot>{{ t.status }}</ui-badge></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </section>

          <!-- ═══ TAB: SECUENCIAS (commit 9) ═══ -->
          <section v-if="tab === 'sequences'">
            <ui-empty icon="zap" title="Secuencias" desc="Sección en construcción — ver próxima iteración."></ui-empty>
          </section>

          <!-- ═══ TAB: FLOWS (commit 9) ═══ -->
          <section v-if="tab === 'flows'">
            <ui-empty icon="edit" title="Flows de WhatsApp" desc="Sección en construcción — ver próxima iteración."></ui-empty>
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
            <ui-field label="Audiencia">
              <select v-model="form.tag" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option :value="null">Todos los contactos activos</option>
                <option v-for="t in niche.tags" :key="t" :value="t">Contactos con tag "{{ t }}"</option>
              </select>
            </ui-field>
            <button @click="createBroadcast" :disabled="!form.name.trim() || !form.templateId || sending"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
              {{ sending ? 'Enviando…' : 'Crear y enviar' }}
            </button>
          </div>
        </ui-modal>

        <!-- Modal: nueva plantilla -->
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
            <button @click="createTemplate" :disabled="tplSaving || !tplForm.name.trim()"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="tplSaving" size="h-4 w-4"></ui-spinner>
              {{ tplSaving ? 'Creando…' : 'Crear plantilla' }}
            </button>
          </div>
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

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
