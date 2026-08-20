/**
 * @file settings-fields-panel.js — Panel presentacional de campos del negocio.
 * Recibe datos y handlers por props. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-fields-panel'] = {
    props: {
      customFields: Array, fieldInput: Object, fieldTypeOptions: Array,
      addField: Function, removeField: Function, moveField: Function,
      renameField: Function, updateFieldType: Function, updateFieldOptions: Function,
    },

    template: `
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Campos del negocio</h3>
          <p class="text-sm text-neutral-600">
            Información que registras de cada cliente (además del nombre y teléfono).
            Cada negocio inicia con los campos de su modelo y puede adaptarlos.
          </p>
          <div class="mt-4 space-y-2">
            <div v-for="(f, i) in customFields" :key="f.slug" class="border border-neutral-200 bg-stone-50 px-3 py-2">
              <div class="flex items-center gap-2">
                <input :value="f.name" @change="renameField(i, $event.target.value)"
                  class="min-w-0 flex-1 border border-transparent bg-transparent px-1 py-1 text-sm font-medium outline-none focus:border-neutral-900 focus:bg-white" />
                <select :value="f.type" @change="updateFieldType(i, $event.target.value)"
                  class="border border-neutral-300 bg-white px-1.5 py-1 font-mono text-[10px] uppercase outline-none focus:border-neutral-900">
                  <option v-for="t in fieldTypeOptions" :key="t" :value="t">{{ t }}</option>
                </select>
                <div class="flex shrink-0 items-center gap-1">
                  <button @click="moveField(i, -1)" :disabled="i === 0" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Subir campo">
                    <ui-icon name="chevron-up" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="moveField(i, 1)" :disabled="i === customFields.length - 1" class="p-1 text-neutral-400 hover:text-neutral-900 disabled:opacity-30" aria-label="Bajar campo">
                    <ui-icon name="chevron-down" class="h-4 w-4"></ui-icon>
                  </button>
                  <button @click="removeField(i)" class="p-1 text-red-600 hover:text-red-800" aria-label="Eliminar campo">
                    <ui-icon name="trash" class="h-4 w-4"></ui-icon>
                  </button>
                </div>
              </div>
              <input v-if="f.type === 'select'" :value="(f.options || []).join(', ')" @change="updateFieldOptions(i, $event.target.value)"
                placeholder="Opciones separadas por coma (ej: Local, Para llevar, Delivery)"
                class="mt-1.5 w-full border border-neutral-300 bg-white px-2 py-1 text-xs outline-none focus:border-neutral-900" />
            </div>
            <div v-if="customFields.length === 0" class="border border-dashed border-neutral-300 p-4 text-center text-sm text-neutral-400">
              Sin campos: agrega el primero abajo.
            </div>
          </div>
          <div class="mt-3 grid gap-2 sm:grid-cols-3">
            <input v-model.trim="fieldInput.name" type="text" placeholder="Nuevo campo (ej: Talla)" @keydown.enter="addField"
              class="w-full border-2 border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900" />
            <select v-model="fieldInput.type" class="border-2 border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-neutral-900">
              <option v-for="t in fieldTypeOptions" :key="t" :value="t">{{ t }}</option>
            </select>
            <button @click="addField" :disabled="!fieldInput.name.trim()"
              class="shrink-0 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Agregar campo
            </button>
          </div>
          <input v-if="fieldInput.type === 'select'" v-model.trim="fieldInput.options" type="text" placeholder="Opciones separadas por coma (ej: Local, Para llevar, Delivery)"
            class="mt-2 w-full border-2 border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900" />
          <p class="mt-3 text-xs text-neutral-400">
            Renombrar no pierde los datos ya registrados. Los campos aparecen en la ficha del cliente y en Contactos.
          </p>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
