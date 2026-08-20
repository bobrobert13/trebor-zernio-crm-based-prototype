/**
 * @file agent-editor.js — Modal presentacional de alta/edición de un agente.
 * Recibe datos y handlers por props; emite close y v-model de showKey/toolsOpen.
 * Verbatim del bloque original de agents-view.
 */
(function () {
  'use strict';

  const components = {};

  components['agent-editor'] = {
    props: {
      open: Boolean,
      editingId: String,
      form: Object,
      showKey: Boolean,
      saving: Boolean,
      toolsOpen: Boolean,
      adaptError: String,
      adaptPreview: String,
      flows: Array,
      canonicalFields: Array,
      tools: Array,
      pipelines: Array,
      toolName: Function,
      testAdaptation: Function,
      saveAgent: Function,
    },

    emits: ['close', 'update:showKey', 'update:toolsOpen'],

    template: `
        <!-- Editor de agente -->
        <ui-modal :open="editorOpen" :title="editingId ? 'Editar agente' : 'Nuevo agente'" width="max-w-3xl" @close="$emit('close')">
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
                <ui-field label="API key del servicio" hint="La key que te da el servicio externo.">
                  <div class="relative">
                    <input v-model.trim="form.apiKey" :type="showKey ? 'text' : 'password'" placeholder="key_…" autocomplete="off"
                      class="w-full border-2 border-neutral-300 px-3 py-2 pr-16 font-mono text-xs outline-none focus:border-neutral-900" />
                    <button @click="$emit('update:showKey', !showKey)" class="absolute inset-y-0 right-2 text-[10px] font-semibold underline">
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

            <!-- Capacidades expuestas al agente (MCP del CRM) -->
            <div>
              <button @click="$emit('update:toolsOpen', !toolsOpen)" type="button"
                class="flex w-full items-center justify-between gap-2 border-2 border-neutral-900 bg-white px-4 py-3 text-left transition hover:bg-stone-50">
                <span class="flex items-center gap-2">
                  <ui-icon name="box" class="h-4 w-4 text-[var(--accent)]"></ui-icon>
                  <span class="text-sm font-semibold">Capacidades que exponemos al agente</span>
                  <ui-badge variant="neutral">{{ CRM_TOOLS.length }} herramientas</ui-badge>
                </span>
                <ui-icon :name="toolsOpen ? 'chevron-up' : 'chevron-down'" class="h-4 w-4 text-neutral-400"></ui-icon>
              </button>
              <div v-if="toolsOpen" class="space-y-4 border-2 border-t-0 border-neutral-900 p-4">
                <p class="text-xs text-neutral-500">
                  Así nutrimos al agente: recibe el contexto del negocio (contacto, historial, inventario,
                  conversación y ventana de 24h) y puede modificar los datos solo con estas herramientas.
                  Cada una tiene sus barreras; si una acción no las cumple, el CRM la ignora.
                </p>
                <div class="grid gap-2">
                  <div v-for="t in CRM_TOOLS" :key="t.id" class="border border-neutral-200 p-3">
                    <span class="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      <ui-icon :name="t.icon" class="h-4 w-4 text-[var(--accent)]"></ui-icon>
                      {{ t.name }}
                      <span class="font-mono text-[9px] uppercase tracking-wider text-neutral-400">{{ t.action }}</span>
                    </span>
                    <p class="mt-1 text-xs text-neutral-600">{{ t.desc }}</p>
                    <div class="mt-2 grid gap-1 text-xs sm:grid-cols-3">
                      <p class="text-neutral-600">
                        <span class="mr-1 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Modifica</span>{{ t.modifies }}
                      </p>
                      <p class="text-amber-900">
                        <span class="mr-1 font-mono text-[9px] uppercase tracking-widest text-amber-700">Barrera</span>{{ t.barrier }}
                      </p>
                      <p class="text-neutral-600">
                        <span class="mr-1 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cuándo</span>{{ t.trigger }}
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Pipelines — varias acciones encadenadas para un objetivo</p>
                  <div class="grid gap-2">
                    <div v-for="p in TOOL_PIPELINES" :key="p.id" class="border border-neutral-200 bg-stone-50 p-3">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="text-xs font-semibold">{{ p.name }}</p>
                        <span class="font-mono text-[9px] uppercase text-neutral-400">{{ p.tools.length }} pasos</span>
                      </div>
                      <p class="mt-0.5 text-[11px] text-neutral-500">{{ p.goal }}</p>
                      <div class="mt-2 flex flex-wrap items-center gap-1.5">
                        <template v-for="(tid, i) in p.tools" :key="tid">
                          <span v-if="i > 0" class="text-neutral-400">→</span>
                          <span class="border border-neutral-300 bg-white px-2 py-0.5 font-mono text-[10px]">{{ toolName(tid) }}</span>
                        </template>
                      </div>
                    </div>
                  </div>
                </div>
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
`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
