/**
 * @file onboarding-team.js — Paso del wizard de configuración inicial.
 * Paso 6 · Equipo inicial: propietario y miembros sugeridos. Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-team'] = {
    props: {
      ui: Object,
      form: Object,
      creating: Boolean, finish: Function,
    },

    template: `
          <section v-else class="bg-white p-8">
            <h2 class="text-2xl font-bold">Tu equipo inicial</h2>
            <p class="mt-1 text-sm text-neutral-500">Crea tu cuenta de propietario y añade miembros sugeridos. Los permisos se gestionan después en Equipo.</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <ui-field label="Tu nombre">
                <input v-model.trim="form.ownerName" type="text" :placeholder="form.name || 'Tu nombre'"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Tu correo">
                <input v-model.trim="form.ownerEmail" type="email" placeholder="tu@negocio.com"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
            </div>
            <div class="mt-6 divide-y-2 divide-neutral-200 border-2 border-neutral-900">
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar :name="form.name || 'T'"></ui-avatar>
                  <div>
                    <p class="font-semibold">{{ form.ownerName || form.name || 'Propietario' }}</p>
                    <p class="text-xs text-neutral-500">{{ form.ownerEmail || 'propietario@demo.com' }}</p>
                  </div>
                </div>
                <ui-badge variant="accent">Propietario</ui-badge>
              </div>
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar name="María Fernández"></ui-avatar>
                  <div>
                    <p class="font-semibold">María Fernández</p>
                    <p class="text-xs text-neutral-500">maria@demo.com</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <ui-badge variant="neutral">Agente</ui-badge>
                  <ui-toggle v-model="form.inviteAgent" aria-label="Incluir agente"></ui-toggle>
                </div>
              </div>
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar name="José Pérez"></ui-avatar>
                  <div>
                    <p class="font-semibold">José Pérez</p>
                    <p class="text-xs text-neutral-500">jose@demo.com</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <ui-badge variant="neutral">Vendedor</ui-badge>
                  <ui-toggle v-model="form.inviteVendor" aria-label="Incluir vendedor"></ui-toggle>
                </div>
              </div>
            </div>
            <button @click="finish" :disabled="creating"
              class="mt-6 w-full border-2 border-neutral-900 bg-[var(--accent)] px-8 py-3 font-semibold text-white shadow-brutal transition hover:shadow-none disabled:opacity-60">
              <span v-if="creating" class="flex items-center justify-center gap-2">
                <ui-spinner class="h-4 w-4"></ui-spinner> Creando tu espacio de trabajo…
              </span>
              <span v-else>Crear mi espacio de trabajo →</span>
            </button>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
