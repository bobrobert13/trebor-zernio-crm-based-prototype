/**
 * @file agents.js — Módulo Agente: agentes de IA externos conectables (Mary y
 * otros). Configuración de conexión tipo webhooks (URL + key del servicio),
 * definición del JSON de respuesta del servicio + mapeo campo a campo a la
 * acción canónica del CRM (con prueba de adaptación), flujos de venta que
 * atiende cada agente (atención, clasificación, leads, personalización,
 * campañas), autonomía (auto-respuesta y cierre de ventas) y log de
 * interacciones. Demo: el agente se simula localmente (Mary demo).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, uid, canEdit } = ZernioCrm;
  const { AGENT_FLOWS, CANONICAL_FIELDS, MARY_MAPPING, MARY_EXAMPLE } = ZernioCrm;

  const components = {};

  components['agents-view'] = {
    setup() {
      const isLive = Vue.computed(() => store.mode === 'live');
      const agents = Vue.computed(() => (store.workspace && store.workspace.agents) || []);

      const editorOpen = Vue.ref(false);
      const editingId = Vue.ref(null); // null = agente nuevo
      const showKey = Vue.ref(false);
      const testing = Vue.ref(false);
      const saving = Vue.ref(false);
      const adaptPreview = Vue.ref('');
      const adaptError = Vue.ref('');
      const logsOpen = Vue.ref(false);
      const logsAgent = Vue.ref(null);

      /** Formulario del editor (flujos y mapeo como objetos editables). */
      const form = Vue.reactive({
        name: '',
        provider: 'Mary',
        url: '',
        apiKey: '',
        active: true,
        flows: { inbox: true, classification: true, leads: true, personalization: false, campaigns: false },
        autoReply: false,
        autoCloseSale: false,
        responseExample: MARY_EXAMPLE,
        mapping: {},
      });

      function resetForm() {
        editingId.value = null;
        Object.assign(form, {
          name: '', provider: 'Mary', url: '', apiKey: '', active: true,
          flows: { inbox: true, classification: true, leads: true, personalization: false, campaigns: false },
          autoReply: false, autoCloseSale: false,
          responseExample: MARY_EXAMPLE,
          mapping: Object.assign({}, MARY_MAPPING),
        });
        showKey.value = false;
        adaptPreview.value = '';
        adaptError.value = '';
      }

      /** Abre el editor (agente existente o nuevo). */
      function openEditor(agent) {
        resetForm();
        if (agent) {
          editingId.value = agent.id;
          Object.assign(form, {
            name: agent.name, provider: agent.provider || 'Mary', url: agent.url || '',
            apiKey: agent.apiKey || '', active: agent.active !== false,
            flows: Object.assign({ inbox: true, classification: true, leads: true, personalization: false, campaigns: false }, agent.flows || {}),
            autoReply: Boolean(agent.autoReply), autoCloseSale: Boolean(agent.autoCloseSale),
            responseExample: agent.responseExample || MARY_EXAMPLE,
            mapping: Object.assign({}, MARY_MAPPING, agent.mapping || {}),
          });
        }
        editorOpen.value = true;
      }

      /** Guarda (crea o actualiza) el agente en workspace.agents (persistido). */
      function saveAgent() {
        if (saving.value) return;
        if (!form.name.trim()) {
          toast('Ponle un nombre al agente', 'error');
          return;
        }
        saving.value = true;
        const payload = {
          name: form.name.trim(),
          provider: form.provider || 'Mary',
          url: form.url.trim(),
          apiKey: form.apiKey.trim(),
          active: form.active,
          flows: Object.assign({}, form.flows),
          autoReply: Boolean(form.autoReply),
          autoCloseSale: Boolean(form.autoCloseSale),
          responseExample: form.responseExample,
          mapping: Object.assign({}, form.mapping),
        };
        if (editingId.value) {
          const agent = agents.value.find((a) => a.id === editingId.value);
          if (agent) Object.assign(agent, payload);
          toast(`Agente ${payload.name} actualizado`, 'success');
        } else {
          store.workspace.agents.unshift({ id: uid('ag'), logs: [], ...payload });
          toast(`Agente ${payload.name} conectado`, 'success');
        }
        saving.value = false;
        editorOpen.value = false;
      }

      function removeAgent(agent) {
        if (!canEdit('agents')) return;
        const i = agents.value.indexOf(agent);
        if (i >= 0) agents.value.splice(i, 1);
        toast('Agente eliminado', 'info');
      }

      /** Prueba la conexión al servicio (live) o simula (demo). */
      async function testConnection(agent) {
        if (testing.value) return;
        testing.value = true;
        try {
          await ZernioCrm.testAgent(agent);
          toast('Conexión OK: el servicio respondió', 'success');
        } catch (err) {
          toast(err.message || 'No se pudo conectar con el servicio', 'error');
        } finally {
          testing.value = false;
        }
      }

      /** Corre el JSON de ejemplo por el mapeo y muestra la acción canónica. */
      function testAdaptation() {
        adaptError.value = '';
        adaptPreview.value = '';
        try {
          const raw = JSON.parse(form.responseExample);
          const action = ZernioCrm.adapt({ mapping: form.mapping }, raw);
          adaptPreview.value = JSON.stringify(action, null, 2);
        } catch (err) {
          adaptError.value = err.message || 'JSON inválido';
        }
      }

      function flowLabel(id) {
        const f = AGENT_FLOWS.find((x) => x.id === id);
        return f ? f.label : id;
      }

      function openLogs(agent) {
        logsAgent.value = agent;
        logsOpen.value = true;
      }

      return {
        isLive, agents, canEdit, AGENT_FLOWS, CANONICAL_FIELDS,
        editorOpen, editingId, form, showKey, testing, saving,
        adaptPreview, adaptError, logsOpen, logsAgent,
        openEditor, saveAgent, removeAgent, testConnection, testAdaptation,
        flowLabel, openLogs, resetForm,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Agente</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Agentes de IA externos (Mary y otros) que atienden tus flujos de venta: atención, clasificación, leads, personalización y campañas.
              <span class="font-semibold">{{ isLive ? '· conectado a Zernio' : '· modo demo' }}</span>
            </p>
          </div>
          <button v-if="canEdit('agents')" @click="openEditor(null)"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Nuevo agente
          </button>
        </header>

        <!-- Cómo funciona -->
        <div class="flex items-start gap-3 border-2 border-neutral-900 bg-white p-4 text-sm">
          <ui-icon name="sparkles" class="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]"></ui-icon>
          <p class="text-neutral-600">
            Conecta un agente con la <strong>key que te da el servicio</strong> (como los webhooks). Define el <strong>JSON de respuesta</strong> del servicio y mapea sus campos a las acciones del CRM.
            Si activas <strong>auto-respuesta</strong> y <strong>cierre de ventas</strong>, el agente opera con total libertad usando inventario, leads, cliente e históricos.
          </p>
        </div>

        <!-- Lista de agentes -->
        <ui-empty v-if="agents.length === 0" icon="sparkles" title="Sin agentes conectados"
          desc="Conecta tu primer agente (ej. Mary) para atender los flujos de venta con IA.">
          <button v-if="canEdit('agents')" @click="openEditor(null)"
            class="border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Conectar agente
          </button>
        </ui-empty>
        <div v-else class="grid gap-4 lg:grid-cols-2">
          <article v-for="a in agents" :key="a.id" class="border-2 border-neutral-900 bg-white p-4 shadow-brutal-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <ui-icon name="sparkles" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <p class="font-semibold leading-tight">{{ a.name }}</p>
                  <p class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                    {{ a.provider }} · {{ a.url || (isLive ? 'sin URL' : 'simulación local') }}
                  </p>
                </div>
              </div>
              <ui-badge :variant="a.active ? 'success' : 'neutral'" dot>{{ a.active ? 'Activo' : 'Pausado' }}</ui-badge>
            </div>

            <div class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="f in AGENT_FLOWS" :key="f.id" class="border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                :class="a.flows[f.id] ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-neutral-200 text-neutral-300 line-through'">
                {{ f.label }}
              </span>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <ui-badge v-if="a.autoReply" variant="accent" dot>Auto-respuesta</ui-badge>
              <ui-badge v-if="a.autoCloseSale" variant="warn" dot>Cierra ventas</ui-badge>
              <span class="font-mono text-[10px] text-neutral-400">{{ (a.logs || []).length }} interacciones</span>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              <button v-if="canEdit('agents')" @click="openEditor(a)"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm">
                <ui-icon name="edit" class="h-3.5 w-3.5"></ui-icon> Editar
              </button>
              <button @click="testConnection(a)" :disabled="testing"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm disabled:opacity-40">
                <ui-spinner v-if="testing" size="h-3.5 w-3.5"></ui-spinner>
                <ui-icon v-else name="zap" class="h-3.5 w-3.5"></ui-icon> Probar conexión
              </button>
              <button @click="openLogs(a)"
                class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm">
                <ui-icon name="activity" class="h-3.5 w-3.5"></ui-icon> Log
              </button>
              <button v-if="canEdit('agents')" @click="removeAgent(a)"
                class="ml-auto px-2 py-1.5 text-xs font-semibold text-red-700 underline">Eliminar</button>
            </div>
          </article>
        </div>

        <!-- Editor de agente -->
        <ui-modal :open="editorOpen" :title="editingId ? 'Editar agente' : 'Nuevo agente'" width="max-w-3xl" @close="editorOpen = false">
          <div class="space-y-5">
            <!-- Conexión -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conexión al servicio</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <ui-field label="Nombre del agente">
                  <input v-model.trim="form.name" type="text" placeholder="Mary ventas"
                    class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="Proveedor">
                  <select v-model="form.provider" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                    <option value="Mary">Mary</option>
                    <option value="custom">Personalizado</option>
                  </select>
                </ui-field>
                <ui-field label="URL del servicio" hint="Endpoint que recibe el contexto del CRM (POST)." class="sm:col-span-2">
                  <input v-model.trim="form.url" type="text" placeholder="https://agente.mary.io/v1/mensajes"
                    class="w-full border-2 border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900" />
                </ui-field>
                <ui-field label="API key del servicio" hint="La key que te da el servicio externo (como los webhooks).">
                  <div class="relative">
                    <input v-model.trim="form.apiKey" :type="showKey ? 'text' : 'password'" placeholder="key_…" autocomplete="off"
                      class="w-full border-2 border-neutral-300 px-3 py-2 pr-16 font-mono text-xs outline-none focus:border-neutral-900" />
                    <button @click="showKey = !showKey" class="absolute inset-y-0 right-2 text-[10px] font-semibold underline">
                      {{ showKey ? 'Ocultar' : 'Mostrar' }}
                    </button>
                  </div>
                </ui-field>
              </div>
              <div class="mt-3 flex items-center gap-2">
                <ui-toggle v-model="form.active"></ui-toggle>
                <span class="text-sm">{{ form.active ? 'Agente activo' : 'Agente pausado (no atiende flujos)' }}</span>
              </div>
            </div>

            <!-- Flujos y autonomía -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Flujos de venta que atiende</p>
              <div class="grid gap-1.5 sm:grid-cols-2">
                <label v-for="f in AGENT_FLOWS" :key="f.id" class="flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm">
                  <input v-model="form.flows[f.id]" type="checkbox" />
                  {{ f.label }}
                </label>
              </div>
              <div class="mt-3 space-y-2">
                <label class="flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm">
                  <ui-toggle v-model="form.autoReply"></ui-toggle>
                  <span><strong>Auto-respuesta:</strong> responde automáticamente los mensajes entrantes (respeta la ventana de 24 h de WhatsApp).</span>
                </label>
                <label class="flex items-center gap-2 border border-neutral-200 px-3 py-2 text-sm">
                  <ui-toggle v-model="form.autoCloseSale"></ui-toggle>
                  <span><strong>Cierre de ventas:</strong> el agente puede cerrar leads con total libertad (inventario, cliente, historial…).</span>
                </label>
              </div>
            </div>

            <!-- Adaptación de la respuesta -->
            <div>
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Adaptación de la respuesta del servicio</p>
              <p class="mb-2 text-xs text-neutral-500">
                Pega un <strong>JSON de ejemplo</strong> de la respuesta del servicio y mapea cada acción del CRM al campo correspondiente (notación con puntos).
              </p>
              <div class="grid gap-4 lg:grid-cols-2">
                <ui-field label="JSON de respuesta de ejemplo">
                  <textarea v-model.trim="form.responseExample" rows="12" spellcheck="false"
                    class="w-full resize-none border-2 border-neutral-300 bg-stone-50 px-3 py-2 font-mono text-[11px] outline-none focus:border-neutral-900"></textarea>
                </ui-field>
                <div>
                  <p class="mb-1.5 text-xs font-semibold text-neutral-600">Acción del CRM → campo del servicio</p>
                  <div class="space-y-1.5">
                    <div v-for="f in CANONICAL_FIELDS" :key="f.key" class="flex items-center gap-2">
                      <span class="w-32 shrink-0 truncate font-mono text-[10px] uppercase text-neutral-500">{{ f.label }}</span>
                      <input v-model.trim="form.mapping[f.key]" type="text" :placeholder="f.placeholder"
                        class="w-full border border-neutral-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-neutral-900" />
                    </div>
                  </div>
                  <button @click="testAdaptation" class="mt-3 w-full border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-semibold transition hover:shadow-brutal-sm">
                    Probar adaptación
                  </button>
                  <p v-if="adaptError" class="mt-2 border border-red-700 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">{{ adaptError }}</p>
                  <pre v-if="adaptPreview" class="mt-2 max-h-40 overflow-auto border border-neutral-200 bg-stone-50 p-2.5 font-mono text-[11px]">{{ adaptPreview }}</pre>
                </div>
              </div>
            </div>

            <button @click="saveAgent" :disabled="saving"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="saving" size="h-4 w-4"></ui-spinner>
              {{ editingId ? 'Guardar cambios' : 'Conectar agente' }}
            </button>
          </div>
        </ui-modal>

        <!-- Log de interacciones -->
        <ui-modal :open="logsOpen" :title="logsAgent ? 'Log · ' + logsAgent.name : 'Log'" width="max-w-2xl" @close="logsOpen = false">
          <ui-empty v-if="!logsAgent || (logsAgent.logs || []).length === 0" icon="activity" title="Sin interacciones todavía"
            desc="Las llamadas del agente (sugerencias, auto-respuestas, acciones) aparecerán aquí." class="my-4"></ui-empty>
          <ul v-else class="space-y-2">
            <li v-for="l in logsAgent.logs" :key="l.id" class="border border-neutral-200 p-2.5 text-xs">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono font-semibold">{{ l.event }}</span>
                <span class="font-mono text-[10px] text-neutral-400">{{ new Date(l.at).toLocaleTimeString('es-VE') }}</span>
              </div>
              <p class="mt-1">
                <ui-badge :variant="l.ok ? 'success' : 'danger'">{{ l.ok ? 'ok · ' + (l.action || '') : 'error' }}</ui-badge>
                <span v-if="l.contact" class="ml-1 text-neutral-500">{{ l.contact }}</span>
                <span v-if="l.error" class="ml-1 text-red-700">{{ l.error }}</span>
              </p>
            </li>
          </ul>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = window.ZernioCrm.components || {};
  Object.assign(window.ZernioCrm.components, components);
})();
