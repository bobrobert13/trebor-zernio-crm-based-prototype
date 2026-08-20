/**
 * @file inbox-modals.js — BC Modals de la bandeja unificada: nueva conversación,
 * selector de plantilla aprobada, selector de producto, info de producto y
 * cierre de lead. Componentes presentacionales puros: estado por props,
 * cambios por eventos (v-model:xxx) y acciones por emit/props de función.
 * Verbatim de los bloques `<ui-modal>` originales (refs → props/emits).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  /** Nueva conversación: elige contacto; avisa si exige plantilla (>24h). */
  components['inbox-new-conv-modal'] = {
    props: {
      open: Boolean, contacts: Array,
      newContactId: { type: String, default: null }, needsTemplate: Boolean,
    },
    emits: ['close', 'update:newContactId', 'start'],
    template: `
      <ui-modal :open="open" title="Nueva conversación" @close="$emit('close')">
        <ui-field label="Contacto">
          <select :value="newContactId" class="w-full border-2 border-neutral-300 px-3 py-2.5 outline-none focus:border-neutral-900"
            @change="$emit('update:newContactId', $event.target.value)">
            <option :value="null" disabled>Elige un contacto…</option>
            <option v-for="c in contacts" :key="c.id" :value="c.id">{{ c.name }} · {{ c.phone }}</option>
          </select>
        </ui-field>
        <!-- Aviso persistente (no es un toast que se oculta solo): el contacto
             elegido no tiene actividad en las últimas 24h → se exige plantilla -->
        <div v-if="needsTemplate" class="mt-3 flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
          <span>Este contacto no tiene conversación en las últimas 24 h: el hilo se abrirá con una <strong>plantilla aprobada</strong> (WhatsApp no permite mensajes libres para iniciar una conversación).</span>
        </div>
        <button @click="$emit('start')" :disabled="!newContactId"
          class="mt-4 w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
          {{ needsTemplate ? 'Iniciar con plantilla aprobada' : 'Iniciar conversación' }}
        </button>
      </ui-modal>`,
  };

  /** Selector de plantilla aprobada (primer mensaje o re-enganche >24h). */
  components['inbox-template-modal'] = {
    props: {
      open: Boolean, target: { type: Object, default: null },
      error: String, list: Array, selected: { type: Object, default: null },
      variables: Array, params: { type: Object, default: () => ({}) }, sending: Boolean,
    },
    emits: ['close', 'update:selected', 'retry', 'send'],
    template: `
      <ui-modal :open="open" :title="target ? 'Re-enganchar con plantilla aprobada' : 'Primer mensaje: elige una plantilla aprobada'" width="max-w-3xl" @close="$emit('close')">
        <div class="space-y-4">
          <!-- Política de 24h visible y persistente (el aviso no se oculta solo) -->
          <div class="flex items-start gap-2 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <ui-icon name="clock" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700"></ui-icon>
            <span>{{ target ? 'La ventana de 24 h ya pasó:' : 'Primer mensaje al cliente:' }} WhatsApp exige <strong>plantillas aprobadas por Meta</strong> para abrir o re-enganchar un hilo. Elige una y completa sus variables; el cliente debe responder para abrir la ventana de 24 h.</span>
          </div>
          <!-- Error persistente al cargar plantillas (live: API/CORS) con reintento -->
          <div v-if="error" class="flex items-start gap-2 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
            <ui-icon name="alert" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
            <span class="flex-1">No se pudieron cargar las plantillas: {{ error }}</span>
            <button @click="$emit('retry')" class="shrink-0 font-semibold underline">Reintentar</button>
          </div>
          <div v-if="list.length === 0 && !error" class="border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
            Sin plantillas aprobadas todavía. Crea y aprueba una en Campañas primero (Meta revisa hasta 24 h).
          </div>
          <div v-else class="grid gap-2 sm:grid-cols-2">
            <button v-for="t in list" :key="t.id || t.name" @click="$emit('update:selected', t)"
              class="border-2 p-3 text-left transition"
              :class="selected && (selected.id || selected.name) === (t.id || t.name) ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200 hover:border-neutral-900'">
              <p class="truncate font-mono text-xs font-semibold">{{ t.name }}</p>
              <p class="mt-0.5 flex items-center gap-1.5">
                <ui-badge variant="neutral">{{ t.category }}</ui-badge>
                <span class="font-mono text-[10px] uppercase text-neutral-400">{{ t.language }}</span>
              </p>
            </button>
          </div>

          <template v-if="selected">
            <!-- Preview gráfico completo (burbuja WhatsApp + info + estado) -->
            <template-preview :tpl="selected"></template-preview>
            <div v-if="variables.length" class="grid gap-3 sm:grid-cols-2">
              <ui-field v-for="v in variables" :key="v" :label="'Valor para ' + v">
                <input v-model.trim="params[v]" type="text" :placeholder="'Dato para ' + v"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
              </ui-field>
            </div>
            <button @click="$emit('send')" :disabled="sending || variables.some(v => !params[v])"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
              {{ sending ? 'Enviando…' : (target ? 'Enviar plantilla' : 'Iniciar conversación con esta plantilla') }}
            </button>
          </template>
        </div>
      </ui-modal>`,
  };

  /** Selector de productos (confirmar mention / vincular manual). */
  components['inbox-product-pick-modal'] = {
    props: { open: Boolean, query: String, results: Array },
    emits: ['close', 'update:query', 'pick'],
    template: `
      <ui-modal :open="open" title="Seleccionar producto" width="max-w-md" @close="$emit('close')">
        <div class="space-y-3">
          <div class="flex items-center gap-2 border border-neutral-300 bg-stone-50 px-3 py-2.5 focus-within:border-neutral-900 focus-within:bg-white">
            <ui-icon name="search" class="h-4 w-4 text-neutral-400"></ui-icon>
            <input :value="query" type="search" placeholder="Buscar producto…"
              @input="$emit('update:query', $event.target.value.trim())"
              class="w-full bg-transparent text-sm outline-none" />
          </div>
          <ul class="max-h-80 divide-y divide-neutral-100 overflow-y-auto border border-neutral-200">
            <li v-for="p in results" :key="p.id">
              <button @click="$emit('pick', p)" class="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-stone-50">
                <span class="min-w-0 truncate font-medium">{{ p.name }}</span>
                <span class="shrink-0 font-mono text-[10px] text-neutral-400">{{ p.category || p.type }}<span v-if="p.stock === false" class="ml-1 text-red-700">· Agotado</span></span>
              </button>
            </li>
            <li v-if="results.length === 0" class="px-3 py-6 text-center text-sm text-neutral-400">Sin productos para la búsqueda.</li>
          </ul>
        </div>
      </ui-modal>`,
  };

  /** Información completa del producto detectado (Ver más). */
  components['inbox-product-info-modal'] = {
    props: {
      open: Boolean, target: { type: Object, default: null },
      cardText: String, formatPrice: Function,
    },
    emits: ['close', 'send-ficha', 'template'],
    template: `
      <ui-modal :open="open" :title="target ? target.name : ''" width="max-w-lg" @close="$emit('close')">
        <div v-if="target" class="space-y-4">
          <div class="flex flex-wrap items-center gap-2">
            <ui-badge :variant="target.stock === false ? 'danger' : 'success'" dot>{{ target.stock === false ? 'Agotado' : 'Disponible' }}</ui-badge>
            <ui-badge variant="accent">{{ formatPrice(target.price) }}</ui-badge>
            <span class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ target.category || target.type }}<span v-if="target.unit"> · {{ target.unit }}</span></span>
          </div>
          <p class="text-sm text-neutral-600">{{ target.description || 'Sin descripción.' }}</p>
          <div class="border border-neutral-200">
            <p class="border-b border-neutral-200 bg-stone-50 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cómo se verá en WhatsApp</p>
            <div class="p-3">
              <wa-preview :text="cardText" :show-header="false"></wa-preview>
            </div>
          </div>
          <div class="flex gap-2">
            <button @click="$emit('send-ficha')"
              class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              Enviar ficha al chat
            </button>
            <button @click="$emit('template')"
              class="flex-1 border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              Responder con plantilla
            </button>
          </div>
        </div>
      </ui-modal>`,
  };

  /** Finalizar lead desde la conversación (mismo flujo que Leads). */
  components['inbox-close-modal'] = {
    props: {
      open: Boolean, target: { type: Object, default: null },
      form: { type: Object, default: null }, hasProducts: Boolean,
      closeReasons: Array, productNameOf: Function, stageLabel: Function, fmtD: Function,
      closeProductQuery: String, closeProductResults: Array,
      toggleCloseProduct: Function, confirmClose: Function,
    },
    emits: ['close', 'update:closeProductQuery'],
    template: `
      <ui-modal :open="open" :title="'Finalizar lead · ' + (target ? target.name : '')" width="max-w-md" @close="$emit('close')">
        <div class="space-y-4">
          <p class="text-sm text-neutral-500">
            Da por terminado el seguimiento de este lead. Puedes reabrirlo cuando quieras.
          </p>
          <div v-if="target" class="flex items-center gap-3 border border-neutral-200 bg-stone-50 p-3">
            <ui-avatar :name="target.name" size="h-10 w-10 text-sm"></ui-avatar>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ target.name }}</p>
              <p class="truncate font-mono text-[11px] text-neutral-500">
                Etapa: {{ stageLabel(target.leadTag) }}
                <span v-if="target.createdAt"> · Cliente desde {{ fmtD(target.createdAt) }}</span>
              </p>
            </div>
          </div>
          <ui-field label="¿Se concretó?">
            <div class="flex gap-1.5">
              <button @click="form.outcome = 'ganada'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="form.outcome === 'ganada' ? 'border-emerald-800 bg-emerald-50 text-emerald-900' : 'border-neutral-300'">
                Sí, se concretó
              </button>
              <button @click="form.outcome = 'perdida'" class="flex-1 border-2 px-3 py-2 text-sm font-medium transition"
                :class="form.outcome === 'perdida' ? 'border-red-800 bg-red-50 text-red-900' : 'border-neutral-300'">
                No se concretó
              </button>
            </div>
          </ui-field>
          <div v-if="hasProducts">
            <p class="mb-2 font-mono text-[10px] uppercase tracking-widest text-neutral-400">¿Qué productos/servicios se cerraron?</p>
            <div v-if="form.products.length" class="mb-2 flex flex-wrap gap-1.5">
              <button v-for="id in form.products" :key="id" @click="toggleCloseProduct(id)"
                class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition border-[var(--accent)] bg-[var(--accent)] text-white">
                {{ productNameOf(id) }} ✕
              </button>
            </div>
            <input :value="closeProductQuery" type="search" placeholder="Buscar y agregar producto…"
              @input="$emit('update:closeProductQuery', $event.target.value.trim())"
              class="w-full border-2 border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900" />
            <div v-if="closeProductQuery" class="mt-1.5 flex flex-wrap gap-1.5">
              <button v-for="p in closeProductResults" :key="p.id" @click="toggleCloseProduct(p.id)"
                class="border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition"
                :class="form.products.includes(p.id) ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                {{ p.name }}
              </button>
            </div>
          </div>
          <ui-field label="Motivo (opcional)">
            <div class="flex flex-wrap gap-1.5">
              <button v-for="r in closeReasons" :key="r" @click="form.reason = form.reason === r ? '' : r"
                class="border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition"
                :class="form.reason === r ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300 hover:border-neutral-900'">
                {{ r }}
              </button>
            </div>
          </ui-field>
          <ui-field label="Nota (opcional)">
            <textarea v-model.trim="form.note" rows="3" placeholder="Cuéntanos cómo fue el cierre…"
              class="w-full resize-none border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900"></textarea>
          </ui-field>
          <button @click="confirmClose()"
            class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Confirmar cierre
          </button>
        </div>
      </ui-modal>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();