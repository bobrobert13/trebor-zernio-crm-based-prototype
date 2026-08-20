/**
 * @file settings-tags-panel.js — Panel presentacional de etiquetas de leads
 * (pipeline) y de contacto, con edición/movimiento/renombrado. Verbatim.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-tags-panel'] = {
    props: {
      leadTags: Array, contactTags: Array, leadInput: String, contactInput: String,
      addLeadTag: Function, addContactTag: Function, removeTag: Function,
      moveTag: Function, renameTag: Function,
    },

    template: `
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Gestión de leads</h3>
          <p class="text-sm text-neutral-600">
            Define las etapas de tu pipeline de clientes: se usan como pestañas en la bandeja y como columnas del tablero de Leads.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(tag, i) in leadTags" :key="tag + i" class="flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <input :value="tag" @change="renameTag('leadTags', i, $event.target.value)"
                class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 font-mono text-xs outline-none focus:border-neutral-900 focus:bg-white" />
              <div class="flex shrink-0 items-center gap-1">
                <button @click="moveTag('leadTags', i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Subir">
                  <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="moveTag('leadTags', i, 1)" :disabled="i === leadTags.length - 1" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar">
                  <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="removeTag('leadTags', i)" class="p-1 text-red-600 transition hover:text-red-800" aria-label="Eliminar etiqueta">
                  <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                </button>
              </div>
            </div>
            <div v-if="leadTags.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin etapas: agrega la primera abajo.
            </div>
          </div>
          <div class="mt-3 flex max-w-md items-end gap-2">
            <input v-model.trim="leadInput" type="text" placeholder="Nueva etapa (ej: cotizacion)" @keydown.enter="addLeadTag"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            <button @click="addLeadTag" :disabled="!leadInput.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar
            </button>
          </div>
        </section>
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Etiquetas de contacto</h3>
          <p class="text-sm text-neutral-600">
            Clasificación general de tus clientes (vip, frecuente, pedido…). Es independiente del pipeline de leads.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(tag, i) in contactTags" :key="tag + i" class="flex items-center gap-2 border border-neutral-200 bg-stone-50 px-3 py-2">
              <input :value="tag" @change="renameTag('contactTags', i, $event.target.value)"
                class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 font-mono text-xs outline-none focus:border-neutral-900 focus:bg-white" />
              <div class="flex shrink-0 items-center gap-1">
                <button @click="moveTag('contactTags', i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Subir">
                  <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="moveTag('contactTags', i, 1)" :disabled="i === contactTags.length - 1" class="p-1 text-neutral-400 transition hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar">
                  <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                </button>
                <button @click="removeTag('contactTags', i)" class="p-1 text-red-600 transition hover:text-red-800" aria-label="Eliminar etiqueta">
                  <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                </button>
              </div>
            </div>
            <div v-if="contactTags.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin etiquetas: agrega la primera abajo.
            </div>
          </div>
          <div class="mt-3 flex max-w-md items-end gap-2">
            <input v-model.trim="contactInput" type="text" placeholder="Nueva etiqueta (ej: vip)" @keydown.enter="addContactTag"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-neutral-900" />
            <button @click="addContactTag" :disabled="!contactInput.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar
            </button>
          </div>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
