/**
 * @file analytics-guide.js — Guía presentacional "qué significa cada métrica"
 * (acordeón). Recibe estado, items y emite toggle. Verbatim del bloque
 * original de analytics-view.
 */
(function () {
  'use strict';

  const components = {};

  components['analytics-guide'] = {
    props: {
      open: Boolean,
      items: Array,
    },

    emits: ['toggle'],

    template: `
        <!-- Guía explicativa: qué significa cada métrica -->
        <section class="border-2 border-neutral-900 bg-white">
          <button @click="$emit('toggle')" class="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                <ui-icon name="book" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">¿Qué significa cada métrica?</p>
                <p class="text-xs text-neutral-500">Guía rápida con códigos de color para leer esta vista sin confusiones.</p>
              </div>
            </div>
            <ui-icon name="chevron-down" class="h-4 w-4 shrink-0 text-neutral-400 transition-transform" :class="open ? 'rotate-180' : ''"></ui-icon>
          </button>
          <div v-if="open" class="border-t border-neutral-200 p-5">
            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <article v-for="g in items" :key="g.id" class="flex flex-col border p-4" :class="g.color">
                <div class="flex items-center justify-between">
                  <ui-icon :name="g.icon" class="h-5 w-5"></ui-icon>
                  <span class="font-mono text-[9px] uppercase tracking-widest opacity-70">código {{ g.color.includes('emerald') ? 'verde' : g.color.includes('amber') ? 'ámbar' : g.color.includes('sky') ? 'azul' : 'rojo' }}</span>
                </div>
                <h4 class="mt-2 font-semibold">{{ g.nombre }}</h4>
                <p class="mt-1 text-xs leading-relaxed opacity-90">{{ g.que }}</p>
                <p class="mt-2 font-mono text-[9px] uppercase tracking-widest opacity-70">Cómo se calcula</p>
                <p class="mt-0.5 text-xs opacity-80">{{ g.como }}</p>
                <p class="mt-2 font-mono text-[9px] uppercase tracking-widest opacity-70">Cuándo mirarla</p>
                <p class="mt-0.5 text-xs opacity-80">{{ g.cuando }}</p>
              </article>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-2 border border-neutral-200 bg-stone-50 p-4 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
              <span class="flex items-center gap-1.5"><ui-icon name="activity" class="h-4 w-4"></ui-icon> Interacción</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="message" class="h-4 w-4"></ui-icon> Mensaje</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="users" class="h-4 w-4"></ui-icon> Conversación</span>
              <ui-icon name="arrow-right" class="h-3.5 w-3.5"></ui-icon>
              <span class="flex items-center gap-1.5"><ui-icon name="zap" class="h-4 w-4"></ui-icon> Seguimiento</span>
              <span class="ml-auto normal-case">el flujo de datos de la plataforma a tu CRM</span>
            </div>
          </div>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
