/**
 * @file product-editor.js — BC Editor del módulo de productos.
 * Modal nuevo/editar con ficha técnica, preview en vivo, preview a pantalla
 * completa y confirmación de borrado. Presentacional: recibe `form` (objeto
 * reactivo del padre), `previewText` y handlers por props; emite cierre.
 * Verbatim del bloque original de products-view.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['product-editor'] = {
    props: {
      open: Boolean, editId: { type: String, default: null },
      form: { type: Object, default: null },
      previewText: { type: String, default: '' },
      previewFull: Boolean, tplLabel: String, separatorMarkup: String,
      removeOpen: Boolean,
      addDetailRow: Function, removeDetailRow: Function, moveDetailRow: Function,
      insertMarkup: Function, saveProduct: Function, removeProduct: Function,
    },
    emits: ['close', 'update:previewFull', 'close-remove'],
    template: `
      <!-- Modal: nuevo/editar producto con ficha técnica -->
      <ui-modal :open="open" :title="(editId ? 'Editar' : 'Nuevo') + ' producto'" width="max-w-4xl" @close="$emit('close')">
        <div class="grid gap-6 lg:grid-cols-2">
          <!-- Editor -->
          <div class="space-y-4">
            <div class="grid gap-3 sm:grid-cols-2">
              <ui-field label="Nombre *">
                <input v-model.trim="form.name" type="text" placeholder="Ej: Arroz con pollo"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Tipo">
                <select v-model="form.type" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                  <option value="producto">Producto</option>
                  <option value="servicio">Servicio</option>
                </select>
              </ui-field>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <ui-field label="Categoría">
                <input v-model.trim="form.category" type="text" placeholder="Ej: Platos principales"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Precio">
                <input v-model.number="form.price" type="number" min="0" step="0.01" placeholder="0.00"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Unidad">
                <input v-model.trim="form.unit" type="text" placeholder="porción"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
            </div>
            <ui-field label="Alias de detección (separados por coma)">
              <input v-model.trim="form.aliases" type="text" placeholder="Ej: arroz con pollo asado, pollo"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-2 text-sm">
                <ui-toggle v-model="form.stock"></ui-toggle> Disponible
              </label>
              <label class="flex items-center gap-2 text-sm">
                <ui-toggle v-model="form.active"></ui-toggle> Activo
              </label>
            </div>

            <!-- Ficha técnica -->
            <div class="border-2 border-neutral-900 p-4">
              <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Descripción (formato WhatsApp)</p>
              <div class="mb-2 flex flex-wrap gap-1">
                <button @click="insertMarkup('*negrita*')" class="border px-2 py-1 font-mono text-[10px] font-bold">B</button>
                <button @click="insertMarkup('_cursiva_')" class="border px-2 py-1 font-mono text-[10px] italic">I</button>
                <button @click="insertMarkup('~tachado~')" class="border px-2 py-1 font-mono text-[10px] line-through">S</button>
                <button @click="insertMarkup('• ')">• lista</button>
                <button @click="insertMarkup(separatorMarkup)">— separador</button>
                <button @click="insertMarkup('😊')">emoji</button>
              </div>
              <textarea ref="descRef" v-model.trim="form.description" rows="4" placeholder="Descripción del producto…"
                class="w-full resize-none border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"></textarea>
            </div>

            <!-- Detalles de la ficha -->
            <div class="border-2 border-neutral-900 p-4">
              <div class="mb-2 flex items-center justify-between">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Ficha técnica (detalles)</p>
                <button @click="addDetailRow" class="flex items-center gap-1 border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">
                  <ui-icon name="plus" class="h-3 w-3"></ui-icon> Agregar
                </button>
              </div>
              <div class="space-y-1.5">
                <div v-for="(d, i) in form.details" :key="i" class="flex items-center gap-1.5">
                  <input v-model.trim="d.label" type="text" placeholder="Etiqueta"
                    class="w-1/3 border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-900" />
                  <input v-model.trim="d.value" type="text" placeholder="Valor"
                    class="min-w-0 flex-1 border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-900" />
                  <button @click="moveDetailRow(i, -1)" class="p-1 text-neutral-400 hover:text-neutral-900" aria-label="Subir">
                    <ui-icon name="chevron-up" class="h-3.5 w-3.5"></ui-icon>
                  </button>
                  <button @click="moveDetailRow(i, 1)" class="p-1 text-neutral-400 hover:text-neutral-900" aria-label="Bajar">
                    <ui-icon name="chevron-down" class="h-3.5 w-3.5"></ui-icon>
                  </button>
                  <button @click="removeDetailRow(i)" class="p-1 text-red-600 hover:text-red-800" aria-label="Quitar">
                    <ui-icon name="trash" class="h-3.5 w-3.5"></ui-icon>
                  </button>
                </div>
              </div>
            </div>

            <ui-field :label="tplLabel">
              <textarea v-model.trim="form.cardTemplate" rows="5" spellcheck="false"
                class="w-full resize-none border-2 border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900"></textarea>
            </ui-field>

            <button @click="saveProduct"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              {{ editId ? 'Guardar cambios' : 'Agregar al catálogo' }}
            </button>
          </div>

          <!-- Preview en vivo -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cómo lo recibe el cliente</p>
              <button @click="$emit('update:previewFull', true)" class="border border-neutral-300 px-2 py-1 text-xs transition hover:border-neutral-900">Ampliar</button>
            </div>
            <wa-preview :text="previewText"></wa-preview>
          </div>
        </div>
      </ui-modal>

      <!-- Modal: preview a pantalla completa -->
      <ui-modal :open="previewFull" title="Vista previa en WhatsApp" width="max-w-lg" @close="$emit('update:previewFull', false)">
        <wa-preview :text="previewText" :show-header="false"></wa-preview>
      </ui-modal>

      <!-- Modal: confirmar eliminación -->
      <ui-modal :open="removeOpen" title="Eliminar producto" width="max-w-md" @close="$emit('close-remove')">
        <p class="text-sm text-neutral-600">¿Eliminar este producto del catálogo? Las menciones históricas se conservan.</p>
        <div class="mt-5 flex justify-end gap-2">
          <button @click="$emit('close-remove')" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
          <button @click="removeProduct" class="border-2 border-red-800 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();