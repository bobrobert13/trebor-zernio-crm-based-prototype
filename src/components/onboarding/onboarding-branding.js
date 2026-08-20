/**
 * @file onboarding-branding.js — Paso del wizard de configuración inicial.
 * Paso 3 · Branding: nombre, slogan, color y logo. Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-branding'] = {
    props: {
      ui: Object,
      form: Object,
      accent: Object, uploadLogo: Function, removeLogo: Function,
    },

    template: `
          <section class="bg-white p-8">
            <h2 class="text-2xl font-bold">Dale identidad a tu espacio</h2>
            <p class="mt-1 text-sm text-neutral-500">Nombre, slogan y color de marca. Siempre podrás cambiarlo en Configuración.</p>
            <div class="mt-6 grid gap-6 sm:grid-cols-2">
              <ui-field label="Nombre del negocio">
                <input v-model.trim="form.name" type="text" placeholder="Ej: Sabores de la Casa"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Slogan (opcional)">
                <input v-model.trim="form.slogan" type="text" placeholder="Ej: Cocina casera desde 1998"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
            </div>
            <div class="mt-6">
              <span class="mb-3 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Color de marca</span>
              <div class="flex flex-wrap gap-3">
                <button v-for="a in ui.ACCENTS" :key="a.id" @click="form.accentId = a.id"
                  class="flex items-center gap-2 border-2 px-3 py-2 transition"
                  :class="form.accentId === a.id ? 'border-neutral-900 shadow-brutal-sm' : 'border-neutral-200'">
                  <span class="h-5 w-5 border border-black/10" :style="{ background: a.value }"></span>
                  <span class="text-xs font-medium">{{ a.nombre }}</span>
                </button>
              </div>
            </div>
            <div class="mt-6 flex flex-wrap items-center gap-4 border-2 border-dashed border-neutral-300 p-4">
              <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-white text-lg font-bold text-[var(--accent)] shadow-brutal-sm"
                :style="form.logo ? {} : { background: accent.value, color: '#fff' }">
                <img v-if="form.logo" :src="form.logo" :alt="'Logo de ' + (form.name || 'tu negocio')" class="h-full w-full object-contain" />
                <template v-else>{{ (form.name || 'T').trim().slice(0, 2).toUpperCase() }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ form.name || 'Nombre del negocio' }}</p>
                <p class="truncate text-sm text-neutral-500">{{ form.slogan || 'Tu slogan aquí' }}</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <label class="cursor-pointer border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  {{ form.logo ? 'Reemplazar logo' : 'Subir logo' }}
                  <input type="file" accept="image/*" class="sr-only" @change="uploadLogo" />
                </label>
                <button v-if="form.logo" @click="removeLogo" class="border-2 border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-700">
                  Quitar logo
                </button>
              </div>
            </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
