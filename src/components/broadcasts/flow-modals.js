/**
 * @file flow-modals.js — BC Flows (parte presentacional modales) del módulo de
 * campañas. Modal de nuevo flow, modal de envío como mensaje interactivo y
 * modal de vista previa presentacional (cómo lo verá el cliente). Presentacional:
 * recibe props y handlers; emite cierre. Verbatim de los bloques originales.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Modal: nuevo flow de captura de leads. */
  components['flow-modal'] = {
    props: {
      open: Boolean, form: { type: Object, default: null },
      niche: { type: Object, default: null },
      saving: Boolean, create: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" title="Nuevo flow de captura de leads" @close="$emit('close')">
        <div class="space-y-4">
          <ui-field label="Nombre (minúsculas y _)">
            <input v-model.trim="form.name" type="text" placeholder="ej: captura_leads"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
          </ui-field>
          <ui-field label="Categoría">
            <select v-model="form.category" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
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
          <button @click="create" :disabled="saving || !form.name.trim()"
            class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            <ui-spinner v-if="saving" size="h-4 w-4"></ui-spinner>
            {{ saving ? 'Publicando…' : 'Crear y publicar' }}
          </button>
        </div>
      </ui-modal>`,
  };

  /** Modal: enviar flow a un teléfono (mensaje interactivo). */
  components['flow-send-modal'] = {
    props: {
      open: Boolean, flow: { type: Object, default: null },
      phone: { type: String, default: '' }, send: Function,
    },
    emits: ['close', 'update:phone'],
    setup(props, ctx) {
      const phone = Vue.computed({
        get: () => props.phone,
        set: (v) => ctx.emit('update:phone', v),
      });
      return { phone };
    },
    template: `
      <ui-modal :open="open" :title="'Enviar flow · ' + (flow ? flow.name : '')" width="max-w-md" @close="$emit('close')">
        <ui-field label="Teléfono (E.164)">
          <input v-model.trim="phone" type="tel" placeholder="+58 412 000 0000"
            class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900" />
        </ui-field>
        <button @click="send" :disabled="!phone.trim()"
          class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
          Enviar formulario
        </button>
      </ui-modal>`,
  };

  /** Modal: vista previa presentacional del flow (cómo lo verá el cliente). */
  components['flow-preview-modal'] = {
    props: {
      open: Boolean, flow: { type: Object, default: null },
      workspace: { type: Object, default: null },
      flowScreens: Function, flowFields: Function, flowFooter: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" :title="'Vista previa · ' + (flow ? flow.name : '')" width="max-w-4xl" @close="$emit('close')">
        <div v-if="flow" class="grid gap-5 lg:grid-cols-[340px_1fr]">
          <!-- Teléfono simulado: la experiencia del cliente -->
          <div class="mx-auto w-full max-w-[340px]">
            <div class="overflow-hidden rounded-2xl border-2 border-neutral-900 bg-[#efeae2] shadow-brutal-sm">
              <div class="flex items-center gap-2 border-b border-neutral-200 bg-white px-3 py-2.5">
                <span class="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <ui-icon name="whatsapp" class="h-4 w-4"></ui-icon>
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-xs font-semibold">{{ workspace.name }}</p>
                  <p class="text-[10px] text-neutral-400">en línea · flow interactivo</p>
                </div>
              </div>
              <div class="space-y-2.5 p-3">
                <!-- Mensaje introductorio del flow -->
                <div v-if="flow.header" class="flex justify-end">
                  <div class="max-w-[85%] rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-xs">
                    {{ flow.header }}
                  </div>
                </div>
                <!-- Tarjeta del flow (CTA) -->
                <div class="flex justify-start">
                  <div class="w-full max-w-[85%] overflow-hidden rounded-lg rounded-tl-none border border-neutral-200 bg-white">
                    <div class="flex items-center gap-1.5 border-b border-neutral-100 px-2.5 py-1.5">
                      <ui-icon name="edit" class="h-3 w-3 text-neutral-400"></ui-icon>
                      <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Flow · {{ flow.category }}</span>
                    </div>
                    <div class="p-2.5">
                      <p class="text-xs font-semibold">{{ flowScreens(flow)[0] ? flowScreens(flow)[0].title : flow.name }}</p>
                      <p class="mt-0.5 text-[11px] text-neutral-500">{{ flowScreens(flow)[0] ? (flowScreens(flow)[0].data.form.body || '') : '' }}</p>
                      <div class="mt-2 border-2 border-[var(--accent)] bg-[var(--accent)] py-1.5 text-center text-[11px] font-semibold text-white">
                        {{ flow.cta || 'Comenzar' }}
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Pantallas del formulario -->
                <div v-for="(screen, si) in flowScreens(flow)" :key="screen.id || si" class="flex justify-start">
                  <div class="w-full max-w-[85%] overflow-hidden rounded-lg rounded-tl-none border border-neutral-200 bg-white">
                    <div class="flex items-center justify-between border-b border-neutral-100 px-2.5 py-1.5">
                      <span class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Pantalla {{ si + 1 }} de {{ flowScreens(flow).length }}</span>
                      <span v-if="screen.terminal" class="font-mono text-[9px] uppercase text-emerald-700">final</span>
                    </div>
                    <div class="p-2.5">
                      <p class="text-xs font-semibold">{{ screen.title }}</p>
                      <p class="mt-0.5 text-[11px] text-neutral-500">{{ screen.data.form ? screen.data.form.body : '' }}</p>
                      <!-- Campos según tipo -->
                      <div v-if="flowFields(screen).length" class="mt-2 space-y-2">
                        <div v-for="fd in flowFields(screen)" :key="fd.name">
                          <p class="mb-0.5 text-[11px] text-neutral-600">{{ fd.label }}<span v-if="fd.required" class="text-red-600"> *</span></p>
                          <div v-if="fd.type === 'radio_button'" class="space-y-0.5">
                            <p v-for="o in (fd.options || [])" :key="o" class="flex items-center gap-1.5 text-[11px]">
                              <span class="h-3 w-3 shrink-0 rounded-full border border-neutral-400"></span> {{ o }}
                            </p>
                          </div>
                          <div v-else-if="fd.type === 'check_box'" class="flex items-center gap-1.5 text-[11px]">
                            <span class="h-3 w-3 shrink-0 border border-neutral-400"></span> {{ fd.label }}
                          </div>
                          <div v-else-if="fd.type === 'dropdown'" class="border-b border-neutral-300 px-1 py-1 text-[11px] text-neutral-500">
                            {{ (fd.options || [])[0] || 'Selecciona…' }} ▾
                          </div>
                          <div v-else class="border-b border-neutral-300 px-1 py-1 text-[11px] text-neutral-400">
                            {{ fd.placeholder || 'Tu respuesta…' }}
                          </div>
                        </div>
                        <div class="border-2 border-neutral-900 bg-[var(--accent)] py-1.5 text-center text-[11px] font-semibold text-white">Enviar</div>
                      </div>
                      <!-- Confirmación (pantalla sin campos) -->
                      <div v-else class="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900">
                        <ui-icon name="check-circle" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
                        <span>{{ screen.data.form ? screen.data.form.body : 'Información enviada.' }}</span>
                      </div>
                      <p v-if="flowFooter(screen)" class="mt-1.5 text-[10px] text-neutral-400">{{ flowFooter(screen) }}</p>
                    </div>
                  </div>
                </div>
                <p class="pt-0.5 text-center font-mono text-[9px] text-neutral-400">WhatsApp · ahora</p>
              </div>
            </div>
          </div>

          <!-- Información y detalles del flow -->
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-2">
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Nombre</p>
                <p class="mt-0.5 break-all font-mono text-xs font-semibold">{{ flow.name }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Categoría</p>
                <p class="mt-0.5 text-xs font-semibold">{{ flow.category }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Estado</p>
                <p class="mt-0.5 text-xs font-semibold" :class="flow.status === 'PUBLISHED' ? 'text-emerald-700' : 'text-amber-700'">{{ flow.status }}</p>
              </div>
              <div class="border border-neutral-200 p-2.5">
                <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Pantallas</p>
                <p class="mt-0.5 text-xs font-semibold">{{ flowScreens(flow).length }}</p>
              </div>
            </div>

            <div class="border border-neutral-200 bg-stone-50 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Campos que se solicitan</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="fd in flowScreens(flow).flatMap((s) => flowFields(s))" :key="fd.name"
                  class="border border-neutral-300 bg-white px-2 py-0.5 font-mono text-[10px]">
                  {{ fd.label }}{{ fd.required ? ' *' : '' }}
                </span>
                <span v-if="!flowScreens(flow).some((s) => flowFields(s).length)" class="text-[11px] text-neutral-400">Sin campos — solo confirmación.</span>
              </div>
            </div>

            <div class="border border-neutral-200 p-3 text-xs text-neutral-600">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Cómo se envía</p>
              <p class="mt-1.5">
                Se envía como un <strong>mensaje interactivo</strong> de WhatsApp con un botón
                ({{ flow.cta || 'Comenzar' }}). Al tocarlo, el cliente ve el formulario
                en pantallas y su información llega directo a tu bandeja — ideal para reportes,
                reclamos específicos y captura de datos sin fricción.
              </p>
            </div>
          </div>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();