/**
 * @file onboarding-referral.js — Paso del wizard de configuración inicial.
 * Paso 4 · Referencia: quién nos recomendó. Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-referral'] = {
    props: {
      ui: Object,
      form: Object,
      
    },

    template: `
          <section class="bg-white p-8">
            <h2 class="text-2xl font-bold">¿Quién nos recomendó?</h2>
            <p class="mt-1 text-sm text-neutral-500">Nos ayuda a mejorar nuestro servicio. Tus datos nunca se comparten.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-3">
              <button v-for="r in ui.REFERRERS" :key="r.id" @click="form.referrer = r.id"
                class="flex items-center gap-3 border-2 p-4 transition"
                :class="form.referrer === r.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 hover:border-neutral-900'">
                <ui-icon :name="r.icon" class="h-5 w-5" :class="form.referrer === r.id ? 'text-[var(--accent)]' : 'text-neutral-400'"></ui-icon>
                <span class="text-sm font-medium">{{ r.nombre }}</span>
              </button>
            </div>
            <ui-field v-if="form.referrer === 'referido' || form.referrer === 'otro'" label="Cuéntanos más" hint="Opcional">
              <input v-model.trim="form.referrerDetail" type="text" placeholder="Ej: María, clienta de la tienda"
                class="mt-2 w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
            </ui-field>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
