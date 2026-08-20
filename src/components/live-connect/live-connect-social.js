/**
 * @file live-connect-social.js — Paso presentacional de OAuth genérico
 * (Instagram/TikTok): autorización, verificación y cuenta detectada.
 * Verbatim del bloque original de live-connect.
 */
(function () {
  'use strict';

  const components = {};

  components['live-connect-social'] = {
    props: {
      platform: String,
      busy: Boolean,
      oauthUrl: String,
      waAccounts: Array,
      startOAuth: Function,
      verifyOAuth: Function,
      connectWithAccount: Function,
    },

    template: `
            <div class="space-y-4">
              <div class="border-2 border-neutral-900 bg-white p-4">
                <p class="text-sm text-neutral-600">
                  Se abre la autorización de {{ platform === 'instagram' ? 'Instagram' : 'TikTok' }}.
                  Autoriza en la ventana que se abre y vuelve a verificar.
                </p>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button @click="startOAuth" :disabled="busy || oauthUrl"
                    class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                    {{ oauthUrl ? 'Autorización iniciada' : 'Autorizar con ' + (platform === 'instagram' ? 'Instagram' : 'TikTok') }}
                  </button>
                  <button @click="verifyOAuth" :disabled="busy"
                    class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                    <ui-spinner v-if="busy" size="h-4 w-4"></ui-spinner>
                    Verificar conexión
                  </button>
                </div>
              </div>
              <div v-if="waAccounts.length > 0">
                <span class="mb-2 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Cuenta detectada ({{ waAccounts.length }})
                </span>
                <button v-for="a in waAccounts" :key="a.id || a._id" @click="connectWithAccount(a)"
                  class="flex w-full items-center gap-3 border-2 border-neutral-900 bg-white p-4 text-left transition hover:bg-stone-50">
                  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                    <ui-icon :name="platform === 'instagram' ? 'instagram' : 'tiktok'" class="h-5 w-5"></ui-icon>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold">{{ a.displayName || a.username || 'Cuenta' }}</p>
                    <p class="truncate font-mono text-[11px] text-neutral-400">{{ a.username || a.id || a._id }}</p>
                  </div>
                  <ui-icon name="chevron-right" class="h-4 w-4 text-neutral-300"></ui-icon>
                </button>
              </div>
            </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
