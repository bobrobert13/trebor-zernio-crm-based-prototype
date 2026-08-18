/**
 * @file template-modals.js — BC Plantillas del módulo de campañas.
 * Modal de nueva plantilla de WhatsApp (guarda borrador local) y modal de
 * preview (reutiliza el componente global <template-preview>). Presentacional:
 * recibe props y handlers por props; emite cierre.
 * Verbatim de los bloques originales de broadcasts-view.
 */
(function () {
  'use strict';

  const { Vue } = window;
  const components = {};

  /** Modal: nueva plantilla de WhatsApp (guarda borrador; no envía a Meta). */
  components['template-modal'] = {
    props: {
      open: Boolean, form: { type: Object, default: null },
      saving: Boolean, save: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" title="Nueva plantilla de WhatsApp" @close="$emit('close')">
        <div class="space-y-4">
          <div class="flex gap-1.5">
            <button @click="form.mode = 'custom'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
              :class="form.mode === 'custom' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-neutral-300'">Personalizada</button>
            <button @click="form.mode = 'library'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
              :class="form.mode === 'library' ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-neutral-300'">Library de Meta</button>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="Nombre (minúsculas y _)">
              <input v-model.trim="form.name" type="text" placeholder="ej: confirmacion_pedido"
                class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Categoría">
              <select v-model="form.category" class="w-full border-2 border-neutral-300 bg-white px-3 py-2.5 outline-none focus:border-neutral-900">
                <option value="UTILITY">UTILITY</option>
                <option value="MARKETING">MARKETING</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </ui-field>
          </div>
          <ui-field v-if="form.mode === 'custom'" label="Texto del mensaje ({{ '{{1}}' }} para variables)">
            <textarea v-model.trim="form.body" rows="3" placeholder="Tu pedido {{1}} fue confirmado…"
              class="w-full resize-none border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900"></textarea>
          </ui-field>
          <ui-field v-else label="Nombre en el library de Meta" hint="Ej: appointment_reminder — aprobada, sin espera.">
            <input v-model.trim="form.libraryName" type="text" placeholder="appointment_reminder"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
          </ui-field>
          <p class="border border-neutral-200 bg-stone-50 px-3 py-2 text-xs text-neutral-600">
            Se guardará como borrador local. Nada se envía a Meta hasta que pulses "Enviar a aprobación" en la lista.
          </p>
          <button @click="save" :disabled="saving || !form.name.trim()"
            class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            Guardar borrador
          </button>
        </div>
      </ui-modal>`,
  };

  /** Modal: preview de plantilla (usa el componente global template-preview). */
  components['template-preview-modal'] = {
    props: {
      open: Boolean, tpl: { type: Object, default: null },
      saving: Boolean, submitApproval: Function, discard: Function,
    },
    emits: ['close'],
    template: `
      <ui-modal :open="open" :title="'Plantilla · ' + (tpl ? tpl.name : '')" width="max-w-3xl" @close="$emit('close')">
        <template v-if="tpl">
          <template-preview :tpl="tpl"></template-preview>
          <div v-if="tpl.status === 'draft'" class="mt-4 flex justify-end gap-2">
            <button @click="discard(tpl); $emit('close')" class="border-2 border-red-800 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 transition hover:shadow-brutal-sm">Descartar</button>
            <button @click="submitApproval(tpl)" :disabled="saving"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="saving" size="h-4 w-4"></ui-spinner>
              Enviar a aprobación (Meta revisa hasta 24 h)
            </button>
          </div>
        </template>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();