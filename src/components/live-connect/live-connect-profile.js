/**
 * @file live-connect-profile.js — Paso presentacional de selección/creación de
 * perfil del negocio. Recibe datos y handlers por props. Verbatim del bloque
 * original de live-connect.
 */
(function () {
  'use strict';

  const components = {};

  components['live-connect-profile'] = {
    props: {
      profiles: Array,
      busy: Boolean,
      retryWithMaster: Boolean,
      loadChannelOptions: Function,
      createProfile: Function,
      retryAdmin: Function,
    },

    template: `
          <!-- Paso 2 · Perfil -->
          <div class="border-2 border-neutral-900 bg-white">
            <div class="border-b-2 border-neutral-900 px-4 py-2.5 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
              Perfil del negocio
            </div>
            <div class="divide-y divide-neutral-100">
              <button v-for="p in profiles" :key="p.id || p._id" @click="loadChannelOptions(p.id || p._id)"
                class="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-stone-50">
                <div class="min-w-0">
                  <p class="font-semibold">{{ p.name }}</p>
                  <p class="truncate font-mono text-[11px] text-neutral-400">{{ p.id || p._id }}</p>
                </div>
                <ui-icon name="chevron-right" class="h-4 w-4 text-neutral-300"></ui-icon>
              </button>
              <button v-if="!busy" @click="createProfile" class="w-full px-4 py-3 text-left text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)]">
                + Crear perfil nuevo con el nombre del negocio
              </button>
              <button v-if="retryWithMaster && !busy" @click="retryAdmin" class="w-full border-t-2 border-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:bg-stone-50">
                La sub-key del espacio no responde — reintentar con la clave del centro
              </button>
            </div>
            <p class="border-t-2 border-neutral-900 px-4 py-2.5 text-xs text-neutral-500">
              Al elegir un perfil se crea y activa la sub-key del negocio (scope limitado a este perfil, expiración 90 días).
            </p>
          </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
