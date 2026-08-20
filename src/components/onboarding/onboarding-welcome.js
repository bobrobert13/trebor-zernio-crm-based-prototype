/**
 * @file onboarding-welcome.js — Paso del wizard de configuración inicial.
 * Paso 0 · Bienvenida (hero con flujo agentico destacado). Presentacional: recibe datos y handlers por props.
 * Verbatim del bloque original de onboarding.
 */
(function () {
  'use strict';

  const components = {};

  components['onboarding-welcome'] = {
    props: {
      ui: Object,
      form: Object,
      next: Function,
    },

    template: `
          <section class="hero-bg relative overflow-hidden text-white">
            <div class="px-8 py-14 sm:px-14 lg:py-20">
              <div class="flex flex-wrap items-center gap-2">
                <span class="flex items-center gap-1.5 border border-white/30 bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                  <ui-icon name="whatsapp" class="h-3.5 w-3.5"></ui-icon> WhatsApp
                </span>
                <span class="flex items-center gap-1.5 border border-white/30 bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                  <ui-icon name="instagram" class="h-3.5 w-3.5"></ui-icon> Instagram
                </span>
                <span class="flex items-center gap-1.5 border border-white/30 bg-[var(--accent)] px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest">
                  <ui-icon name="sparkles" class="h-3.5 w-3.5"></ui-icon> Agente de ventas IA
                </span>
              </div>
              <h2 class="mt-6 max-w-2xl text-4xl font-bold leading-tight lg:text-5xl">Tu negocio atendiendo y vendiendo, incluso cuando duermes.</h2>
              <p class="mt-4 max-w-xl text-lg text-white/80">
                Conecta tus canales, gestiona a tus clientes con un CRM completo y activa tu
                <strong class="text-white">agente de ventas IA</strong>: atiende, clasifica y cierra ventas 24/7.
              </p>

              <!-- Flujo agentico destacado: la característica protagonista -->
              <div class="mt-7 max-w-2xl border-2 border-[var(--accent)] bg-white/10 p-4 backdrop-blur">
                <div class="flex items-center gap-2">
                  <ui-icon name="sparkles" class="h-4 w-4 text-white"></ui-icon>
                  <p class="font-mono text-[10px] uppercase tracking-widest text-white">Flujo agentico de ventas</p>
                  <span class="border border-white/30 px-1.5 py-0.5 font-mono text-[9px] uppercase text-white/80">próximamente conectable</span>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span class="border border-white/30 bg-white/10 px-2 py-1">Recibe el mensaje</span>
                  <span class="opacity-70">→</span>
                  <span class="border border-white/30 bg-white/10 px-2 py-1">Analiza el contexto (inventario, leads, historial)</span>
                  <span class="opacity-70">→</span>
                  <span class="border border-white/30 bg-white/10 px-2 py-1">Responde y clasifica</span>
                  <span class="opacity-70">→</span>
                  <span class="border-2 border-[var(--accent)] bg-white px-2 py-1 font-semibold text-neutral-900">Cierra la venta</span>
                </div>
                <p class="mt-2.5 text-xs text-white/70">
                  Con barreras seguras: respeta la ventana de 24h de WhatsApp, una sola respuesta por mensaje y solo modifica datos con tu permiso.
                </p>
              </div>

              <button @click="next" class="mt-8 bg-white px-8 py-3.5 font-semibold text-neutral-900 shadow-brutal transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                Comenzar mi configuración →
              </button>

              <!-- Tres pilares: clientes · canales · ventas agenticas (protagonista) -->
              <div class="mt-10 grid gap-3 border-t border-white/20 pt-6 sm:grid-cols-3">
                <div class="border border-white/20 bg-white/5 p-3.5">
                  <div class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70">
                    <ui-icon name="users" class="h-3.5 w-3.5"></ui-icon> Gestión de clientes
                  </div>
                  <p class="mt-1.5 text-sm text-white/85">
                    Fichas, historial, etapas de lead e intención de compra en un solo lugar.
                  </p>
                </div>
                <div class="border border-white/20 bg-white/5 p-3.5">
                  <div class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white/70">
                    <ui-icon name="layers" class="h-3.5 w-3.5"></ui-icon> Canales y equipo
                  </div>
                  <p class="mt-1.5 text-sm text-white/85">
                    WhatsApp e Instagram con roles y permisos para tu equipo de trabajo.
                  </p>
                </div>
                <div class="border-2 border-[var(--accent)] bg-[var(--accent)] p-3.5">
                  <div class="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-white">
                    <ui-icon name="sparkles" class="h-3.5 w-3.5"></ui-icon> Ventas agenticas
                  </div>
                  <p class="mt-1.5 text-sm text-white">
                    Tu agente de IA atiende, clasifica y cierra ventas con total libertad sobre tu catálogo.
                  </p>
                </div>
              </div>

              <div class="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <p class="text-2xl font-bold">≈5 min</p>
                  <p class="text-sm text-white/70">de configuración guiada</p>
                </div>
                <div>
                  <p class="text-2xl font-bold">2 canales</p>
                  <p class="text-sm text-white/70">WhatsApp hoy · Instagram pronto</p>
                </div>
                <div>
                  <p class="text-2xl font-bold">Ventas 24/7</p>
                  <p class="text-sm text-white/70">con tu agente de ventas IA</p>
                </div>
              </div>
            </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
