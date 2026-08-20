/**
 * @file settings-advanced-panels.js — Paneles presentacionales de Avanzado:
 * intro (toggle de opciones) + integración de canales + credenciales del
 * centro. Emite update:advancedOpen. Verbatim de los bloques originales.
 */
(function () {
  'use strict';

  const components = {};

  components['settings-advanced-panels'] = {
    props: {
      advancedOpen: Boolean,
      isAdvanced: Boolean,
      store: Object,
      apiKeyInput: String,
      testing: Boolean,
      testResult: Object,
      subKey: String,
      subKeyBusy: Boolean,
      maskKey: Function,
      saveApiKey: Function,
      testConnection: Function,
      rotateSubKey: Function,
      revokeSubKey: Function,
      canEdit: Function,
    },

    emits: ['update:advancedOpen'],

    template: `
        <section  class="border-2 border-neutral-900 bg-white lg:col-start-2">
          <button @click="$emit('update:advancedOpen', !advancedOpen)" class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                <ui-icon name="settings" class="h-4 w-4"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">Opciones avanzadas</p>
                <p class="text-xs text-neutral-500">Webhooks, credenciales e integración técnica.</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <ui-badge v-if="isAdvanced" variant="success" dot>Habilitadas</ui-badge>
              <ui-icon name="chevron-down" class="h-4 w-4 text-neutral-400" :class="advancedOpen ? 'rotate-180 transition-transform' : ''"></ui-icon>
            </div>
          </button>
          <div v-if="advancedOpen" class="border-t-2 border-neutral-900 p-5">
            <p class="mb-4 text-xs text-neutral-500">
              Modo administración: puedes gestionar la integración técnica del negocio.
              La clave del centro se provee automáticamente; este espacio opera con su sub-key.
            </p>
          </div>
        </section>
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Integración de canales</h3>
          <div v-if="store.corsBlocked" class="mb-4 flex items-start gap-3 border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-900">
            <ui-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0"></ui-icon>
            <p>El navegador no puede alcanzar el API de la plataforma (CORS). El prototipo opera en modo demo; para producción usa el servidor local (node server.mjs).</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="Sub-key del negocio" hint="Operativa del espacio (aislada a su perfil). Se guarda en localStorage — solo para prototipo.">
              <input v-model.trim="apiKeyInput" type="password" placeholder="sk_…" autocomplete="off"
                class="w-full border-2 border-neutral-300 px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900" />
            </ui-field>
            <div class="flex items-end gap-2">
              <button @click="saveApiKey" class="flex-1 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Guardar
              </button>
              <button @click="testConnection" :disabled="!apiKeyInput.trim() || testing"
                class="flex flex-1 items-center justify-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                <ui-spinner v-if="testing" size="h-4 w-4"></ui-spinner>
                {{ testing ? 'Probando…' : 'Probar conexión' }}
              </button>
            </div>
          </div>
          <p v-if="testResult" class="mt-3 text-sm font-medium" :class="testResult.ok ? 'text-emerald-700' : 'text-red-700'">
            {{ testResult.text }}
          </p>
          <div class="mt-4 flex items-center gap-3 border-t border-neutral-100 pt-4">
            <span class="font-mono text-[11px] uppercase tracking-widest text-neutral-500">Modo actual:</span>
            <ui-badge :variant="store.mode === 'live' ? 'warn' : 'success'" dot>
              {{ store.mode === 'live' ? 'Live (API real)' : 'Demo (datos simulados)' }}
            </ui-badge>
          </div>
        </section>
        <section  class="border-2 border-neutral-900 bg-white p-5 lg:col-start-2">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Credenciales del centro</h3>
          <p class="text-sm text-neutral-600">
            Este negocio opera con una sub-key de acceso limitada a su perfil (expiración 90 días).
            Si un cliente abusa o deja de pagar, revocas solo su acceso sin afectar a los demás.
          </p>
          <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span class="text-neutral-500">Sub-key activa</span>
            <span class="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span v-if="subKey">{{ maskKey(subKey) }} · expira en ~90 días</span>
              <span v-else class="text-neutral-400">Sin sub-key (operando con la key directa)</span>
              <ui-badge v-if="subKey" variant="success" dot>Aislada al perfil</ui-badge>
            </span>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button v-if="subKey && canEdit('settings')" @click="rotateSubKey" :disabled="subKeyBusy"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="subKeyBusy" size="h-3.5 w-3.5"></ui-spinner>
              Rotar sub-key
            </button>
            <button v-if="subKey && canEdit('settings')" @click="revokeSubKey" :disabled="subKeyBusy"
              class="border-2 border-red-800 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 transition hover:shadow-brutal-sm">
              Revocar acceso
            </button>
          </div>
          <p class="mt-3 text-xs text-neutral-400">
            Rotar crea una sub-key nueva y revoca la anterior al instante. Revocar deja el negocio sin conexión.
          </p>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
