/**
 * @file settings-branding-panel.js — Panel presentacional de Marca (nombre,
 * slogan, color y logo). Recibe datos y handlers por props. Verbatim.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-branding-panel'] = {
    props: {
      workspace: Object,
      referrer: Object,
      accents: Array,
      uploadLogo: Function,
      removeLogo: Function,
      saveBranding: Function,
    },

    template: `
        <section v-if="settingsTab === 'marca'" class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Branding</h3>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="Nombre del negocio">
              <input v-model.trim="workspace.name" type="text"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Slogan">
              <input v-model.trim="workspace.slogan" type="text" placeholder="Sin slogan"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
          </div>
          <div class="mt-4">
            <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Color de marca</span>
            <div class="flex flex-wrap gap-2">
              <button v-for="a in accents" :key="a.id" @click="workspace.accentId = a.id"
                class="flex items-center gap-2 border-2 px-2.5 py-1.5 transition"
                :class="workspace.accentId === a.id ? 'border-neutral-900 shadow-brutal-sm' : 'border-neutral-200'">
                <span class="h-4 w-4 border border-black/10" :style="{ background: a.value }"></span>
                <span class="text-xs">{{ a.nombre }}</span>
              </button>
            </div>
          </div>
          <div class="mt-4">
            <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Logo de la empresa</span>
            <div class="flex items-center gap-4">
              <span class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-neutral-200 bg-[var(--accent)] text-lg font-bold text-white">
                <img v-if="workspace.logo" :src="workspace.logo" :alt="'Logo de ' + workspace.name" class="h-full w-full object-contain" />
                <span v-else>{{ (workspace.name || 'T').trim().slice(0, 2).toUpperCase() }}</span>
              </span>
              <div class="min-w-0 space-y-1.5">
                <label class="inline-flex cursor-pointer items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  <ui-icon name="plus" class="h-3.5 w-3.5"></ui-icon>
                  {{ workspace.logo ? 'Reemplazar logo' : 'Subir logo' }}
                  <input type="file" accept="image/*" class="sr-only" @change="uploadLogo" />
                </label>
                <button v-if="workspace.logo" @click="removeLogo" class="block text-xs font-medium text-red-700 transition hover:text-red-900">Quitar logo</button>
                <p class="text-[10px] text-neutral-400">PNG/JPG/WebP · máx 2 MB · se redimensiona a 256 px</p>
              </div>
            </div>
          </div>
          <p class="mt-4 text-xs text-neutral-400">Nos recomendó: <span class="font-medium text-neutral-700">{{ referrer.nombre || '—' }}</span>
            <span v-if="workspace.referrerDetail"> ({{ workspace.referrerDetail }})</span>
          </p>
          <button @click="saveBranding" class="mt-4 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Guardar branding
          </button>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
