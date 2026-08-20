/**
 * @file billing-account.js — Sección presentacional de la cuenta Zernio
 * (plan, gasto, límites, statement y llamadas por operación). Recibe datos
 * y formateadores por props. Verbatim del bloque original de billing-view.
 */
(function () {
  'use strict';

  const components = {};

  components['billing-account'] = {
    props: {
      usage: Object,
      isLive: Boolean,
      range: String,
      planName: String,
      billingPeriod: String,
      spentCents: Number,
      spendLimitCents: Number,
      balanceCents: Number,
      paymentStatus: String,
      estimatedCents: Number,
      operations: Array,
      usd: Function,
      pct: Function,
    },

    template: `
        <!-- Cuenta Zernio (master key del centro) -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Cuenta de la plataforma</h3>
          <template v-if="usage">
            <div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Plan</p>
                <p class="mt-1 text-xl font-bold">{{ planName }}</p>
                <p class="font-mono text-[11px] text-neutral-400">{{ billingPeriod }}</p>
              </div>
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Gasto del período</p>
                <p class="mt-1 text-xl font-bold">{{ usd(spentCents) }}</p>
                <p class="font-mono text-[11px] text-neutral-400">límite {{ usd(spendLimitCents) }}</p>
                <div class="mt-2 h-2 border border-neutral-300 bg-neutral-100">
                  <div class="h-full bg-[var(--accent)]" :style="{ width: pct(spentCents, spendLimitCents) + '%' }"></div>
                </div>
              </div>
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Cuentas conectadas</p>
                <p class="mt-1 text-xl font-bold">{{ (usage.usage && usage.usage.connectedAccounts) ?? usage.limits?.profiles ?? '—' }}</p>
                <p class="font-mono text-[11px] text-neutral-400">límite perfiles {{ (usage.limits && usage.limits.profiles) ?? '—' }}</p>
              </div>
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Statement</p>
                <p class="mt-1 text-xl font-bold">{{ usd(balanceCents) }}</p>
                <p class="font-mono text-[11px] text-neutral-400">{{ paymentStatus }}</p>
              </div>
            </div>

            <div class="mt-5">
              <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Llamadas por operación ({{ range }}) · estimado {{ usd(estimatedCents) }}
              </p>
              <div class="mt-2 overflow-x-auto">
                <table class="w-full min-w-[560px] text-left text-sm">
                  <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th class="px-4 py-2.5">Operación</th>
                      <th class="px-4 py-2.5 text-right">Llamadas</th>
                      <th class="px-4 py-2.5 text-right">Precio unit.</th>
                      <th class="px-4 py-2.5 text-right">Estimado</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    <tr v-if="operations.length === 0">
                      <td colspan="4" class="px-4 py-6 text-center text-neutral-400">Sin llamadas registradas en el rango (o el plan no expone el desglose).</td>
                    </tr>
                    <tr v-for="op in operations" :key="op.key">
                      <td class="max-w-72 truncate px-4 py-2.5 font-mono text-xs">{{ op.key }}</td>
                      <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ op.calls.toLocaleString('es-VE') }}</td>
                      <td class="px-4 py-2.5 text-right font-mono text-xs">{{ op.priceCents != null ? usd(op.priceCents) : '—' }}</td>
                      <td class="px-4 py-2.5 text-right font-mono text-xs">{{ op.priceCents != null ? usd(op.priceCents * op.calls) : '—' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
          <template v-else-if="!isLive">
            <p class="mt-4 text-sm text-neutral-500">Modo demo: conecta tu canal en vivo para ver el consumo real.</p>
          </template>
          <template v-else>
            <p class="mt-4 text-sm text-neutral-500">Cargando el snapshot de consumo del negocio…</p>
          </template>
        </section>
`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
