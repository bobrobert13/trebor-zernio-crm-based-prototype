/**
 * @file onboarding-niche.js — Paso del wizard de configuración inicial.
 * Paso 1 · Nicho: selección con preview de campos incluidos. Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-niche'] = {
    props: {
      ui: Object,
      form: Object,
      selectedNiche: Object, selectNiche: Function,
    },

    template: `
          <section class="bg-white p-8">
            <h2 class="text-2xl font-bold">¿A qué se dedica tu negocio?</h2>
            <p class="mt-1 text-sm text-neutral-500">Elige el modelo más parecido: ajustamos campos, plantillas y etapas de seguimiento.</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <button v-for="(n, ni) in ui.NICHES" :key="n.id" @click="selectNiche(n.id)"
                class="stagger-in border-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brutal-sm"
                :style="{ animationDelay: (ni * 40) + 'ms' }"
                :class="form.nicheId === n.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 bg-white hover:border-neutral-900'">
                <div class="flex items-start justify-between gap-2">
                  <span class="flex h-11 w-11 items-center justify-center bg-[var(--accent)] text-xl shadow-brutal-sm" :class="form.nicheId === n.id ? 'text-white' : 'bg-stone-100'">{{ n.emoji }}</span>
                  <ui-icon v-if="form.nicheId === n.id" name="check-circle" class="h-5 w-5 text-[var(--accent)]"></ui-icon>
                </div>
                <h3 class="mt-3 font-semibold">{{ n.nombre }}</h3>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">{{ n.descripcion }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ (n.customFields || []).length }} campos</span>
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">Plantillas demo</span>
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">WhatsApp + IG</span>
                </div>
              </button>
              <button @click="selectNiche('personalizado')"
                class="stagger-in border-2 border-dashed p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brutal-sm"
                :style="{ animationDelay: (ui.NICHES.length * 40) + 'ms' }"
                :class="form.nicheId === 'personalizado' ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-300 hover:border-neutral-900'">
                <span class="flex h-11 w-11 items-center justify-center bg-stone-100 text-xl">✨</span>
                <h3 class="mt-3 font-semibold">Otro / Personalizado</h3>
                <p class="mt-1 text-xs text-neutral-500">Configuración genérica adaptable a cualquier negocio.</p>
              </button>
            </div>

            <!-- Preview del nicho seleccionado (atracción psicológica) -->
            <div v-if="selectedNiche && selectedNiche.id !== 'personalizado'" class="mt-6 grid gap-4 border border-neutral-200 bg-stone-50 p-5 sm:grid-cols-2">
              <div>
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Campos del cliente que registrarás</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="f in selectedNiche.customFields" :key="f.slug" class="border border-neutral-300 bg-white px-2 py-1 text-xs">
                    {{ f.name }}
                  </span>
                </div>
              </div>
              <div>
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Lo que incluye tu espacio</p>
                <ul class="mt-2 space-y-1">
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="message" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Plantillas demo de WhatsApp del nicho
                  </li>
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="tag" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Campos del negocio y etapas del pipeline
                  </li>
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="users" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Equipo inicial con roles
                  </li>
                </ul>
              </div>
            </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
