/**
 * @file channel-empty-banner.js — Banner presentacional "conecta tu WhatsApp"
 * cuando no hay canal de mensajería. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['channel-empty-banner'] = {
    props: {
      noChannel: Boolean,
      openConnect: Function,
    },

    template: `
        <div v-if="noChannel" class="flex flex-wrap items-center gap-4 border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-5">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-brutal-sm">
            <ui-icon name="whatsapp" class="h-7 w-7"></ui-icon>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-base font-bold">Tu WhatsApp de negocio aún no está conectado</p>
            <p class="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-600">
              Es el canal principal por el que tus clientes te escriben: pedidos, dudas y reservas
              llegan directo a tu bandeja. Conéctalo y gestiona toda la conversación desde un solo lugar.
            </p>
          </div>
          <button @click="openConnect({ id: 'whatsapp' })"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="plus" class="h-4 w-4"></ui-icon> Conectar WhatsApp ahora
          </button>
        </div>
`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
