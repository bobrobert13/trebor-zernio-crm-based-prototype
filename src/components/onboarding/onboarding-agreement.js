/**
 * @file onboarding-agreement.js — Paso del wizard de configuración inicial.
 * Paso 2 · Convenio de uso con aceptación obligatoria. Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-agreement'] = {
    props: {
      ui: Object,
      form: Object,
      
    },

    template: `
          <section class="bg-white p-8">
            <h2 class="text-2xl font-bold">Convenio de uso</h2>
            <p class="mt-1 text-sm text-neutral-500">Conoce lo que podrás hacer con tu espacio y acepta las condiciones para empezar.</p>

            <!-- Resumen de capacidades -->
            <div class="mt-6 border-2 border-neutral-900 bg-stone-50 p-5">
              <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Lo que podrás hacer</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="message" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Responder a tus clientes</p>
                    <p class="text-xs text-neutral-500">Bandeja unificada por WhatsApp e Instagram con historial completo.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="tag" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Gestionar leads y pedidos</p>
                    <p class="text-xs text-neutral-500">Seguimiento por etapas, cierres y recordatorios para no perder ventas.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="box" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Catálogo con fichas técnicas</p>
                    <p class="text-xs text-neutral-500">Productos y servicios con detalle listo para enviar en el chat.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="users" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Equipo y métricas</p>
                    <p class="text-xs text-neutral-500">Roles con permisos y resumen del desempeño de tu negocio.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cláusulas del convenio -->
            <div class="mt-5 space-y-2.5">
              <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Al usar este espacio aceptas</p>
              <p v-for="(c, i) in ui.CONVENIO_CLAUSULAS" :key="i" class="flex items-start gap-2.5 text-sm text-neutral-600">
                <ui-icon name="check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"></ui-icon>
                <span>{{ c }}</span>
              </p>
            </div>

            <!-- Aceptación obligatoria -->
            <label class="mt-6 flex cursor-pointer items-start gap-3 border-2 p-4 transition"
              :class="form.accepted ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300 hover:border-neutral-900'">
              <input type="checkbox" v-model="form.accepted" class="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span class="text-sm font-medium">Acepto el convenio de uso y las políticas de datos de clientes.</span>
            </label>
            <p v-if="!form.accepted" class="mt-2 text-xs text-neutral-400">Debes aceptar el convenio para continuar con la configuración.</p>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
