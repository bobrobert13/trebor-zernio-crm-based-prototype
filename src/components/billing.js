/**
 * @file billing.js — Panel de facturación y consumo del centro.
 * Dos fuentes: (1) snapshot de la cuenta Zernio con la master key (plan,
 * gasto del período, llamadas por operación, statement) y (2) medidor local
 * por negocio (server.mjs cuenta cada request del proxy por key).
 * Orquestador por bounded context: la lógica vive en src/billing-composables.js
 * y la presentación en src/components/billing/*. 1:1 con el comportamiento
 * previo. RBAC: owner/admin.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, fmtDT, fmtD } = ZernioCrm;

  const components = {};

  components['billing-view'] = {
    setup() {
      // Composición por bounded context (ver src/billing-composables.js)
      const lc = ZernioCrm.makeBillingLoad({ store, api, toast });
      const fmt = ZernioCrm.makeBillingFormat();
      const platform = ZernioCrm.makePlatformBilling({ usage: lc.usage, statement: lc.statement, pricing: lc.pricing, fmtD });
      const meter = ZernioCrm.makeLocalMeter({ local: lc.local });

      Vue.onMounted(lc.load);

      return {
        ...lc,        // loading, error, range, usage, statement, pricing, local, localHash, workspace, isLive, load
        ...fmt,       // usd, pct
        ...platform,  // operations, estimatedCents, planName, spentCents, spendLimitCents, balanceCents, paymentStatus, billingPeriod
        ...meter,     // localDays, maxDay
        store, fmtDT, fmtD,
      };
    },

    template: `


      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Billing y consumo</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Consumo de <span class="font-semibold">{{ workspace.name }}</span> con su perfil en la plataforma
              <ui-badge v-if="workspace.zernio && workspace.zernio.profileId" variant="accent" class="ml-1">perfil {{ workspace.zernio.profileId.slice(-6) }}</ui-badge>
              <span class="font-semibold">· {{ isLive ? 'live' : 'demo' }}</span>
            </p>
          </div>
          <div class="flex items-center gap-2">
            <select v-model="range" @change="load" :disabled="loading" class="border-2 border-neutral-300 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-neutral-900">
              <option value="7d">7 días</option>
              <option value="30d">30 días</option>
            </select>
            <button @click="load" :disabled="loading"
              class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="loading" size="h-4 w-4"></ui-spinner>
              <ui-icon v-else name="refresh" class="h-4 w-4"></ui-icon>
              Refrescar
            </button>
          </div>
        </header>

        <p v-if="error" class="border-2 border-red-800 bg-red-50 px-4 py-2.5 text-sm text-red-800">{{ error }}</p>

        <billing-account
          :usage="usage" :is-live="isLive" :range="range"
          :plan-name="planName" :billing-period="billingPeriod"
          :spent-cents="spentCents" :spend-limit-cents="spendLimitCents"
          :balance-cents="balanceCents" :payment-status="paymentStatus"
          :estimated-cents="estimatedCents" :operations="operations"
          :usd="usd" :pct="pct"></billing-account>

        <billing-local-meter
          :local="local" :server-mode="store.serverMode"
          :local-days="localDays" :max-day="maxDay" :fmt-d-t="fmtDT"></billing-local-meter>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
