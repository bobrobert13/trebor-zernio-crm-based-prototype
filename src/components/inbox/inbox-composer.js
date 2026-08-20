/**
 * @file inbox-composer.js — BC Composer de la bandeja unificada: botones de
 * respuesta rápida, ficha de producto adjunta, mención `@` y envío.
 * Componente presentacional puro: estado por props, cambios por eventos
 * (`v-model:xxx`) y acciones por props de función. Verbatim del `<footer>`.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['inbox-composer'] = {
    props: {
      selected: { type: Object, default: null },
      canHumanAgent: Boolean, humanAgent: Boolean, blockedByWindow: Boolean,
      hasProducts: Boolean, sending: Boolean, quickReplies: Array,
      draft: String, cardAttach: { type: Object, default: null },
      cardGreeting: String, cardPreview: String,
      atOpen: Boolean, atResults: Array, atIndex: Number,
      formatPrice: Function, openTemplatePicker: Function,
      openCardPicker: Function, detachCard: Function,
      onComposerKeydown: Function, pickMention: Function, send: Function,
    },
    emits: ['update:draft', 'update:humanAgent', 'update:cardGreeting', 'update:atIndex'],
    template: `
      <footer class="shrink-0 border-t border-neutral-200 bg-white p-3.5">
        <div v-if="canHumanAgent" class="mb-2.5 flex items-center gap-2.5 border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <ui-toggle :model-value="humanAgent" @update:model-value="$emit('update:humanAgent', $event)" class="shrink-0"></ui-toggle>
          <span>El cliente no ha escrito en 24 h: activa el modo agente humano para que Meta permita responder.</span>
        </div>
        <div v-if="blockedByWindow" class="mb-2.5 border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
          WhatsApp fuera de la ventana de 24h:
          <button @click="openTemplatePicker(selected)" class="font-semibold underline">envía una plantilla aprobada</button>
          para re-enganchar la conversación.
        </div>
        <div class="mb-2.5 flex gap-1.5 overflow-x-auto scrollbar-none">
          <button v-for="qr in quickReplies" :key="qr" @click="$emit('update:draft', qr)"
            class="shrink-0 border border-neutral-300 bg-white px-3 py-1.5 text-sm transition hover:border-neutral-900">
            {{ qr }}
          </button>
        </div>
        <div class="flex items-end gap-2">
          <div class="flex-1">
            <!-- Ficha de producto adjunta al borrador (preview en vivo) -->
            <div v-if="cardAttach" class="mb-2 border-2 border-[var(--accent)] bg-white p-2.5">
              <div class="mb-2 flex items-center justify-between gap-2">
                <span class="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                  <ui-icon name="box" class="h-3.5 w-3.5 text-[var(--accent)]"></ui-icon>
                  <span class="truncate">Ficha: {{ cardAttach.name }}</span>
                </span>
                <span class="flex shrink-0 gap-1">
                  <button @click="openCardPicker()" class="text-[11px] font-medium underline">Cambiar</button>
                  <button @click="detachCard()" class="text-[11px] text-red-700 underline">Quitar</button>
                </span>
              </div>
              <input :value="cardGreeting" type="text" placeholder="Saludo del mensaje…"
                @input="$emit('update:cardGreeting', $event.target.value.trim())"
                class="mb-2 w-full border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-900" />
              <wa-preview :text="cardPreview" :show-header="false"></wa-preview>
            </div>
            <div class="relative">
              <textarea :value="draft" rows="2" placeholder="Escribe un mensaje… (@ para adjuntar un producto · Enter para enviar)"
                @input="$emit('update:draft', $event.target.value)"
                @keydown="onComposerKeydown($event)"
                class="w-full resize-none border border-neutral-300 bg-stone-50 px-3 py-2.5 text-sm outline-none transition focus:border-neutral-900 focus:bg-white"></textarea>
              <div v-if="atOpen && atResults.length" class="absolute inset-x-0 bottom-full z-20 mb-1.5 max-h-56 overflow-y-auto border-2 border-neutral-900 bg-white shadow-brutal">
                <p class="border-b border-neutral-100 px-3 py-1.5 font-mono text-[9px] uppercase tracking-widest text-neutral-400">Adjuntar ficha de producto</p>
                <button v-for="(p, i) in atResults" :key="p.id" @mousedown.prevent="pickMention(p)" @mouseenter="$emit('update:atIndex', i)"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition"
                  :class="i === atIndex ? 'bg-[var(--accent)] text-white' : 'hover:bg-stone-100'">
                  <ui-icon name="box" class="h-3.5 w-3.5 shrink-0"></ui-icon>
                  <span class="min-w-0 flex-1 truncate font-medium">{{ p.name }}</span>
                  <span class="shrink-0 font-mono text-[10px] tabular-nums opacity-80">{{ formatPrice(p.price) }}</span>
                  <span v-if="p.stock === false" class="shrink-0 font-mono text-[9px] uppercase text-red-600">agotado</span>
                </button>
              </div>
            </div>
          </div>
          <div class="flex shrink-0 flex-col gap-1.5">
            <button v-if="hasProducts" @click="openCardPicker()"
              class="flex h-11 w-11 items-center justify-center border-2 border-neutral-900 bg-white text-neutral-700 shadow-brutal-sm transition hover:shadow-none"
              aria-label="Adjuntar ficha de producto">
              <ui-icon name="box" class="h-5 w-5"></ui-icon>
            </button>
            <button @click="send()" :disabled="sending || (!draft.trim() && !cardAttach)"
              class="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-neutral-900 bg-[var(--accent)] text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40"
              aria-label="Enviar mensaje">
              <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
              <ui-icon v-else name="send" class="h-5 w-5"></ui-icon>
            </button>
          </div>
        </div>
      </footer>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();