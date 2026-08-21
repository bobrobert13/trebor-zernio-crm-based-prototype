/**
 * @file settings-data-panel.js — Panel presentacional de Datos (exportación,
 * reset demo y eliminación) + modales de confirmación. Emite update:*.
 * Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-data-panel'] = {
    props: {
      workspace: Object, confirmReset: Boolean, confirmDelete: Boolean,
      exportData: Function, resetDemo: Function, deleteWorkspace: Function,
      canEdit: Function,
    },

    emits: ['update:confirmReset', 'update:confirmDelete'],

    template: `
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Datos</h3>
          <div class="flex flex-wrap gap-2">
            <button @click="exportData"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar workspace (JSON)
            </button>
            <button v-if="canEdit('settings')" @click="confirmReset = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Reset de datos demo
            </button>
            <button v-if="canEdit('settings')" @click="confirmDelete = true"
              class="flex items-center gap-2 border-2 border-red-800 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="trash" class="h-4 w-4"></ui-icon> Eliminar workspace
            </button>
          </div>
        </section>
        <!-- Confirmaciones -->
        <ui-modal :open="confirmReset" title="Reset de datos demo" width="max-w-md" @close="$emit('update:confirmReset', false)">
          <p class="text-sm text-neutral-600">Se borrarán todos los workspaces y la sesión local. Volverás al onboarding.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="$emit('update:confirmReset', false)" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="resetDemo" class="border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Resetear</button>
          </div>
        </ui-modal>

        <ui-modal :open="confirmDelete" title="Eliminar workspace" width="max-w-md" @close="$emit('update:confirmDelete', false)">
          <p class="text-sm text-neutral-600">Se eliminará <span class="font-semibold">{{ workspace.name }}</span> y todos sus datos. Esta acción no se puede deshacer.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="$emit('update:confirmDelete', false)" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="deleteWorkspace" class="border-2 border-neutral-900 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
          </div>
        </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
