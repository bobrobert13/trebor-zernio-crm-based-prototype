/**
 * @file onboarding-channels.js — Paso del wizard de configuración inicial.
 * Paso 5 · Canales: conexión de WhatsApp (live-connect). Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-channels'] = {
    props: {
      ui: Object,
      form: Object,
      liveResult: Object, creating: Boolean, onLiveConnected: Function, finish: Function,
    },

    template: `
          <section class="bg-white p-8">
            <h2 class="text-2xl font-bold">Conecta tus canales</h2>
            <p class="mt-1 text-sm text-neutral-500">WhatsApp ahora · Instagram próximamente. Todo desde un solo lugar.</p>

            <div class="mt-6 border border-neutral-200 bg-white p-5">
              <div class="mb-4 flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <h3 class="font-semibold">Conecta el número de tu negocio</h3>
                  <p class="text-sm text-neutral-500">Meta te guía: autoriza con tu cuenta y verifica tu número con un código SMS. Sin pasos técnicos.</p>
                </div>
              </div>
              <live-connect :business-name="form.name" @connected="onLiveConnected"></live-connect>
              <p v-if="liveResult" class="mt-3 font-mono text-xs text-emerald-700">
                ✓ Número vinculado: {{ liveResult.phone }}
              </p>
            </div>

            <div class="mt-4 flex items-center gap-3 border border-dashed border-neutral-300 bg-stone-50 p-4">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                <ui-icon name="instagram" class="h-5 w-5"></ui-icon>
              </span>
              <div class="min-w-0">
                <p class="font-semibold">Instagram</p>
                <p class="text-sm text-neutral-500">Disponible próximamente en la configuración. Ya puedes gestionarlo desde Canales.</p>
              </div>
              <ui-badge variant="neutral" class="ml-auto shrink-0">Próximamente</ui-badge>
            </div>

            <button @click="form.skipConnect = true; finish()" :disabled="creating"
              class="mt-6 text-sm font-medium text-neutral-500 underline transition hover:text-neutral-900">
              Configurar después (conectaré mi número desde Canales)
            </button>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
