/**
 * @file onboarding.js — Wizard de configuración inicial (7 pasos).
 * Paso 1→nicho, 2→convenio de uso, 3→branding (nombre, logo, color),
 * 4→referencia, 5→canales, 6→equipo inicial. Conexión real de WhatsApp
 * vía live-connect. Orquestador por bounded context: la lógica vive en
 * src/onboarding-composables.js y la presentación en
 * src/components/onboarding/*. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, navigate } = ZernioCrm;

  const STEPS = ['Bienvenida', 'Nicho', 'Convenio', 'Marca', 'Referencia', 'WhatsApp', 'Equipo'];

  const components = {};

  components['onboarding-wizard'] = {
    setup() {
      const liveResult = Vue.ref(null);
      const { later } = ZernioCrm.makeTimers();

      // Composición por bounded context (ver src/onboarding-composables.js)
      const f = ZernioCrm.makeOnboardingForm({ getNiche: (id) => ZernioCrm.getNiche(id), ACCENTS: ZernioCrm.ACCENTS });
      const flow = ZernioCrm.makeOnboardingFlow({ form: f.form, liveResult, later });
      const conn = ZernioCrm.makeOnboardingConnection({ form: f.form, liveResult });
      const ws = ZernioCrm.makeOnboardingWorkspace({ form: f.form, liveResult, flow, store, toast, applyAccent, navigate, later });

      return {
        STEPS,
        ...f,       // form, niche, accent, selectedNiche, selectNiche
        ...flow,    // current, enterLoading, creating, canContinue, jumpTo, next, back
        ...conn,    // onLiveConnected
        ...ws,      // uploadLogo, removeLogo, finish
        liveResult,
        ui: ZernioCrm,
      };
    },

    template: `

      <div class="grid min-h-screen bg-stone-100 lg:grid-cols-[420px_1fr]">
        <!-- Panel izquierdo de marca (escritorio) -->
        <aside class="sticky top-0 hidden h-screen flex-col justify-between bg-[var(--accent)] p-10 text-white lg:flex">
          <div>
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center bg-white text-[var(--accent)] shadow-brutal-sm">
                <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
              </span>
              <div>
                <h1 class="text-xl font-bold leading-tight">{{ ui.BRAND }}</h1>
                <p class="font-mono text-[11px] uppercase tracking-widest opacity-70">Configuración inicial</p>
              </div>
            </div>
            <h2 class="mt-12 text-3xl font-bold leading-tight">Tu atención al cliente por WhatsApp, lista en minutos.</h2>
            <p class="mt-3 max-w-xs text-sm opacity-80">
              Elige tu tipo de negocio, conecta tu número y empieza a responder a tus clientes desde un solo lugar.
            </p>
          </div>

          <!-- Progreso vertical -->
          <ol class="space-y-2.5">
            <li v-for="(s, i) in STEPS" :key="i" class="flex items-center gap-3 font-mono text-xs uppercase tracking-widest"
              :class="i === current ? 'font-semibold opacity-100' : i < current ? 'opacity-60' : 'opacity-35'">
              <span class="flex h-6 w-6 items-center justify-center border border-white/40">
                <ui-icon v-if="i < current" name="check" class="h-3.5 w-3.5"></ui-icon>
                <span v-else class="tabular-nums">{{ i + 1 }}</span>
              </span>
              {{ s }}
            </li>
          </ol>

          <p class="font-mono text-[11px] uppercase tracking-widest opacity-60">Configuración guiada</p>
        </aside>

        <!-- Panel derecho -->
        <div class="flex min-h-screen flex-col">
          <header class="flex items-center justify-between border-b-2 border-neutral-900 bg-white px-5 py-3 lg:hidden">
            <div class="flex items-center gap-2.5">
              <span class="flex h-8 w-8 items-center justify-center bg-[var(--accent)] text-white">
                <ui-icon name="whatsapp" class="h-4 w-4"></ui-icon>
              </span>
              <span class="font-bold">{{ ui.BRAND }}</span>
            </div>
            <ui-stepper v-if="current > 0" :steps="STEPS" :current="current" @jump="jumpTo"></ui-stepper>
          </header>

          <main class="flex-1 px-5 py-8 lg:px-16">
            <div class="mx-auto w-full max-w-4xl">
              <!-- Encabezado del paso (pipeline) -->
              <div v-if="current > 0 && !enterLoading" class="mb-6">
                <p class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">Paso {{ current }} de {{ STEPS.length - 1 }} · {{ STEPS[current] }}</p>
                <div class="mt-2 h-1 w-full bg-neutral-200">
                  <div class="h-full bg-[var(--accent)] transition-all duration-500" :style="{ width: (current / (STEPS.length - 1)) * 100 + '%' }"></div>
                </div>
              </div>

          <!-- Transición entre pasos (fade + deslizamiento sutil) -->
          <transition name="step" mode="out-in">
          <div v-if="enterLoading" class="bg-white p-8">
            <div class="mb-6 flex items-center gap-2">
              <ui-spinner class="text-[var(--accent)]"></ui-spinner>
              <span class="font-mono text-xs uppercase tracking-widest">Preparando tu espacio…</span>
            </div>
            <div class="space-y-3">
              <ui-skeleton h="h-16"></ui-skeleton>
              <ui-skeleton h="h-16"></ui-skeleton>
              <ui-skeleton h="h-16"></ui-skeleton>
            </div>
          </div>
          <!-- 0 · Bienvenida -->
          <onboarding-welcome v-if="current === 0" :ui="ui" :next="next"></onboarding-welcome>

          <!-- 1 · Nicho -->
          <onboarding-niche v-else-if="current === 1" :ui="ui" :form="form" :selected-niche="selectedNiche" :select-niche="selectNiche"></onboarding-niche>

          <!-- 2 · Convenio de uso -->
          <onboarding-agreement v-else-if="current === 2" :ui="ui" :form="form"></onboarding-agreement>

          <!-- 3 · Branding -->
          <onboarding-branding v-else-if="current === 3" :ui="ui" :form="form" :accent="accent" :upload-logo="uploadLogo" :remove-logo="removeLogo"></onboarding-branding>

          <!-- 4 · Referencia -->
          <onboarding-referral v-else-if="current === 4" :ui="ui" :form="form"></onboarding-referral>

          <!-- 5 · Canales -->
          <onboarding-channels v-else-if="current === 5" :ui="ui" :form="form" :live-result="liveResult" :creating="creating" :on-live-connected="onLiveConnected" :finish="finish"></onboarding-channels>

          <!-- 6 · Equipo -->
          <onboarding-team v-else :ui="ui" :form="form" :creating="creating" :finish="finish"></onboarding-team>
          </transition>
          <footer v-if="current > 0 && current < 6" class="sticky bottom-0 z-10 -mx-5 mt-8 flex items-center justify-between gap-3 border-t border-neutral-200 bg-stone-100/95 px-5 py-4 backdrop-blur lg:-mx-16 lg:px-16">
            <button @click="back" class="border-2 border-neutral-900 bg-white px-5 py-2.5 font-medium shadow-brutal-sm transition hover:shadow-none">
              ← Volver
            </button>
            <div class="flex items-center gap-3">
              <span class="hidden font-mono text-[10px] uppercase tracking-widest text-neutral-400 sm:block">Paso {{ current }}/{{ STEPS.length - 1 }}</span>
              <button @click="next" :disabled="!canContinue"
                class="border-2 border-neutral-900 bg-neutral-900 px-6 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                Continuar →
              </button>
            </div>
          </footer>
            </div>
          </main>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
