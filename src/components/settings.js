/**
 * @file settings.js — Configuración del workspace: branding, integración
 * Zernio (modo demo/live + API key + test de conexión), estado del canal
 * WhatsApp, exportación de datos y zona de peligro (reset/eliminar).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, ACCENTS, REFERRERS, WHATSAPP_MODALITIES, canEdit } = ZernioCrm;

  const components = {};

  components['settings-view'] = {
    setup() {
      const apiKeyInput = Vue.ref(store.apiKey);
      const testing = Vue.ref(false);
      const testResult = Vue.ref(null);
      const confirmReset = Vue.ref(false);
      const confirmDelete = Vue.ref(false);

      const workspace = Vue.computed(() => store.workspace);
      const modality = Vue.computed(() =>
        WHATSAPP_MODALITIES.find((m) => m.id === workspace.value.whatsapp.modality) || {}
      );
      const referrer = Vue.computed(() => REFERRERS.find((r) => r.id === workspace.value.referrer) || {});

      /** Guarda branding y refresca el acento del tema. */
      function saveBranding() {
        if (!workspace.value.name.trim()) return;
        applyAccent(workspace.value);
        toast('Branding actualizado', 'success');
      }

      /** Guarda la API key y cambia a modo live (si aplica). */
      function saveApiKey() {
        store.apiKey = apiKeyInput.value.trim();
        if (store.apiKey) {
          store.mode = 'live';
          store.corsBlocked = false;
          toast('API key guardada · modo live activado', 'success');
        } else {
          store.mode = 'demo';
          toast('Modo demo restablecido', 'info');
        }
      }

      /** Prueba la conexión contra el API de Zernio. */
      async function testConnection() {
        if (!apiKeyInput.value.trim()) return;
        testing.value = true;
        testResult.value = null;
        try {
          store.apiKey = apiKeyInput.value.trim();
          const profiles = await ZernioCrm.api.testConnection();
          testResult.value = { ok: true, text: `API válida · ${Array.isArray(profiles) ? profiles.length : 0} perfiles disponibles` };
        } catch (err) {
          testResult.value = { ok: false, text: err.message || 'No se pudo conectar' };
        } finally {
          testing.value = false;
        }
      }

      /** Desconecta el canal WhatsApp (demo). Solo owner/admin con edición. */
      function disconnectWhatsApp() {
        if (!canEdit('settings')) return;
        workspace.value.whatsapp.connected = false;
        toast('Número WhatsApp desconectado', 'info');
      }

      /** Re-conecta el canal en modo demo. */
      function reconnectWhatsApp() {
        workspace.value.whatsapp.connected = true;
        toast('Número WhatsApp reconectado (demo)', 'success');
      }

      /** Exporta el workspace como JSON descargable. */
      function exportData() {
        const blob = new Blob([JSON.stringify(workspace.value, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspace.value.name.replace(/\s+/g, '-').toLowerCase()}-workspace.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast('Workspace exportado', 'success');
      }

      /** Reset total de los datos del prototipo (solo owner). */
      function resetDemo() {
        if (!canEdit('settings')) return;
        ZernioCrm.storage.resetAll();
        location.hash = '#/onboarding';
        location.reload();
      }

      /** Elimina el workspace activo y vuelve al onboarding (solo owner). */
      function deleteWorkspace() {
        if (!canEdit('settings')) return;
        ZernioCrm.storage.deleteWorkspace(store.workspace.id);
        ZernioCrm.storage.clearSession();
        location.hash = '#/onboarding';
        location.reload();
      }

      return {
        apiKeyInput, testing, testResult, confirmReset, confirmDelete,
        workspace, modality, referrer, ACCENTS, store,
        canEdit, saveBranding, saveApiKey, testConnection,
        disconnectWhatsApp, reconnectWhatsApp, exportData, resetDemo, deleteWorkspace,
      };
    },

    template: `
      <div class="grid items-start gap-6 xl:grid-cols-2">
        <header class="xl:col-span-2">
          <h2 class="text-2xl font-bold">Configuración</h2>
          <p class="mt-1 text-sm text-neutral-500">Branding, integración con Zernio y datos del espacio de trabajo.</p>
        </header>

        <!-- Branding -->
        <section class="border-2 border-neutral-900 bg-white p-5">
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
              <button v-for="a in ACCENTS" :key="a.id" @click="workspace.accentId = a.id"
                class="flex items-center gap-2 border-2 px-2.5 py-1.5 transition"
                :class="workspace.accentId === a.id ? 'border-neutral-900 shadow-brutal-sm' : 'border-neutral-200'">
                <span class="h-4 w-4 border border-black/10" :style="{ background: a.value }"></span>
                <span class="text-xs">{{ a.nombre }}</span>
              </button>
            </div>
          </div>
          <p class="mt-4 text-xs text-neutral-400">Nos recomendó: <span class="font-medium text-neutral-700">{{ referrer.nombre || '—' }}</span>
            <span v-if="workspace.referrerDetail"> ({{ workspace.referrerDetail }})</span>
          </p>
          <button @click="saveBranding" class="mt-4 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            Guardar branding
          </button>
        </section>

        <!-- Integración Zernio -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Integración Zernio</h3>
          <div v-if="store.corsBlocked" class="mb-4 flex items-start gap-3 border-2 border-amber-700 bg-amber-50 p-3 text-sm text-amber-900">
            <ui-icon name="alert" class="mt-0.5 h-4 w-4 shrink-0"></ui-icon>
            <p>El navegador no puede alcanzar el API de Zernio (CORS). El prototipo opera en modo demo; para producción usa un backend proxy (ver docs/POST-IMPLEMENTATION.md).</p>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <ui-field label="API key" hint="Se guarda en localStorage — solo para prototipo.">
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

        <!-- Canal WhatsApp -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Canal WhatsApp</h3>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                <ui-icon name="whatsapp" class="h-6 w-6"></ui-icon>
              </span>
              <div>
                <p class="font-semibold">{{ workspace.whatsapp.phone }}</p>
                <p class="text-xs text-neutral-500">
                  Modalidad: {{ modality.nombre || workspace.whatsapp.modality }} ·
                  {{ new Date(workspace.whatsapp.since).toLocaleDateString('es-VE') }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <ui-badge :variant="workspace.whatsapp.connected ? 'success' : 'danger'" dot>
                {{ workspace.whatsapp.connected ? 'Conectado' : 'Desconectado' }}
              </ui-badge>
              <button v-if="workspace.whatsapp.connected && canEdit('settings')" @click="disconnectWhatsApp"
                class="border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                Desconectar
              </button>
              <button v-else-if="!workspace.whatsapp.connected && canEdit('settings')" @click="reconnectWhatsApp"
                class="border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
                Reconectar (demo)
              </button>
            </div>
          </div>
        </section>

        <!-- Datos -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="mb-4 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Datos</h3>
          <div class="flex flex-wrap gap-2">
            <button @click="exportData"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="download" class="h-4 w-4"></ui-icon> Exportar workspace (JSON)
            </button>
            <button v-if="canEdit('settings')" @click="confirmReset = true"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="refresh" class="h-4 w-4"></ui-icon> Reset de datos demo
            </button>
            <button v-if="canEdit('settings')" @click="confirmDelete = true"
              class="flex items-center gap-2 border-2 border-red-800 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="trash" class="h-4 w-4"></ui-icon> Eliminar workspace
            </button>
          </div>
        </section>

        <!-- Confirmaciones -->
        <ui-modal :open="confirmReset" title="Reset de datos demo" width="max-w-md" @close="confirmReset = false">
          <p class="text-sm text-neutral-600">Se borrarán todos los workspaces y la sesión local. Volverás al onboarding.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmReset = false" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="resetDemo" class="border-2 border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Resetear</button>
          </div>
        </ui-modal>

        <ui-modal :open="confirmDelete" title="Eliminar workspace" width="max-w-md" @close="confirmDelete = false">
          <p class="text-sm text-neutral-600">Se eliminará <span class="font-semibold">{{ workspace.name }}</span> y todos sus datos. Esta acción no se puede deshacer.</p>
          <div class="mt-5 flex justify-end gap-2">
            <button @click="confirmDelete = false" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">Cancelar</button>
            <button @click="deleteWorkspace" class="border-2 border-neutral-900 bg-red-800 px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">Eliminar</button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
