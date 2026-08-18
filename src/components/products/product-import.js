/**
 * @file product-import.js — BC Import del módulo de productos.
 * Importación CSV/JSON con validación en dos paneles. Presentacional: recibe
 * estado y handlers por props con v-model en importMode/importInput.
 * Verbatim del bloque original de products-view.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['product-import'] = {
    props: {
      importMode: { type: String, default: 'csv' },
      importInput: { type: String, default: '' },
      importRows: { type: Array, default: null },
      importReport: { type: Object, default: null },
      setImportMode: Function, setImportInput: Function,
      parseImport: Function, doImport: Function,
    },
    setup(props, { emit }) {
      const mode = Vue.computed({ get: () => props.importMode, set: (v) => emit('update:importMode', v) });
      const input = Vue.computed({ get: () => props.importInput, set: (v) => emit('update:importInput', v) });
      return { mode, input };
    },
    template: `
      <div class="grid items-start gap-6 lg:grid-cols-2">
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Importar catálogo</h3>
          <p class="text-sm text-neutral-500">
            Carga productos desde <span class="font-semibold">CSV</span> (columnas
            <span class="font-mono text-xs">name,type,category,price,unit,aliases,stock</span>) o un
            <span class="font-semibold">JSON</span> (array de objetos con las mismas claves).
          </p>
          <div class="mt-3 flex gap-1.5">
            <button @click="mode = 'csv'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
              :class="mode === 'csv' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300'">CSV</button>
            <button @click="mode = 'json'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
              :class="mode === 'json' ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300'">JSON</button>
          </div>
          <textarea v-model.trim="input" rows="8" spellcheck="false"
            :placeholder="mode === 'csv' ? csvPlaceholder : jsonPlaceholder"
            class="mt-3 w-full resize-none border-2 border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900"></textarea>
          <button @click="parseImport" class="mt-3 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Analizar contenido
          </button>
        </section>

        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Vista previa y resultado</h3>
          <template v-if="importRows">
            <div class="max-h-80 overflow-auto border border-neutral-200">
              <table class="w-full text-left text-xs">
                <thead class="sticky top-0 bg-white font-mono text-[9px] uppercase tracking-widest text-neutral-500">
                  <tr>
                    <th class="px-2 py-2">Nombre</th>
                    <th class="px-2 py-2">Tipo</th>
                    <th class="px-2 py-2">Precio</th>
                    <th class="px-2 py-2">Stock</th>
                    <th class="px-2 py-2">Estado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-neutral-100">
                  <tr v-for="(r, i) in importRows" :key="i" :class="r.error ? 'bg-red-50' : ''">
                    <td class="px-2 py-1.5 font-medium">{{ r.name || '—' }}</td>
                    <td class="px-2 py-1.5">{{ r.type }}</td>
                    <td class="px-2 py-1.5 font-mono">{{ r.price != null ? r.price : '—' }}</td>
                    <td class="px-2 py-1.5">{{ r.stock === false ? 'Agotado' : 'Disponible' }}</td>
                    <td class="px-2 py-1.5 font-mono text-[10px]" :class="r.error ? 'text-red-700' : 'text-emerald-700'">{{ r.error || 'OK' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button @click="doImport" class="mt-3 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Importar {{ importRows.filter(r => !r.error).length }} producto(s)
            </button>
          </template>
          <template v-else-if="importReport">
            <div class="space-y-2 border-2 border-emerald-800 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p class="font-semibold">Importación completada</p>
              <p>{{ importReport.imported }} importados · {{ importReport.skipped }} duplicados omitidos · {{ importReport.errors }} con errores</p>
            </div>
          </template>
          <p v-else class="text-sm text-neutral-400">Pega el contenido a la izquierda y pulsa "Analizar contenido".</p>
        </section>
      </div>`,
    computed: {
      csvPlaceholder() {
        return 'Arroz con pollo,producto,Platos principales,8.5,porción,"arroz con pollo asado",si';
      },
      jsonPlaceholder() {
        return '[{"name":"Arroz con pollo","type":"producto","category":"Platos principales","price":8.5}]';
      },
    },
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();