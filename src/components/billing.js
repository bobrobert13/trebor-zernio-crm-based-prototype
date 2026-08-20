/**
 * @file billing.js — Panel de facturación y consumo del centro.
 * Dos fuentes: (1) snapshot de la cuenta Zernio con la master key (plan,
 * gasto del período, llamadas por operación, statement) y (2) medidor local
 * por negocio (server.mjs cuenta cada request del proxy por key).
 * Orquestador por bounded context: la lógica vive en src/billing-composables.js
 * (1:1 con el comportamiento previo). RBAC: owner/admin.
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

        <!-- Consumo del negocio (medidor local del proxy) -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Consumo del negocio (medidor local)</h3>
          <template v-if="local">
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Llamadas al API</p>
                <p class="mt-1 text-xl font-bold tabular-nums">{{ (local.total || 0).toLocaleString('es-VE') }}</p>
                <p class="font-mono text-[11px] text-neutral-400">contadas por server.mjs por key</p>
              </div>
              <div class="border-2 border-neutral-900 p-4">
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Última actividad</p>
                <p class="mt-1 text-sm font-semibold">{{ local.updatedAt ? fmtDT(local.updatedAt) : '—' }}</p>
              </div>
            </div>

            <div class="mt-5">
              <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Últimos 30 días</p>
              <div class="mt-2 flex h-28 items-end gap-0.5 border-b border-neutral-300 bg-stone-50 p-2">
                <div v-for="d in localDays" :key="d.day" class="group relative flex-1"
                  :title="d.day + ': ' + d.count + ' llamadas'">
                  <div class="bg-[var(--accent)] opacity-80 transition hover:opacity-100"
                    :style="{ height: Math.max(d.count ? 4 : 1, Math.round((d.count / maxDay) * 100)) + '%' }"></div>
                </div>
              </div>
              <p class="mt-1 font-mono text-[10px] text-neutral-400">máx diario: {{ maxDay }} · hover para ver el día</p>
            </div>

            <div class="mt-5">
              <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Por endpoint</p>
              <div class="mt-2 overflow-x-auto">
                <table class="w-full min-w-[480px] text-left text-sm">
                  <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                    <tr>
                      <th class="px-4 py-2.5">Endpoint</th>
                      <th class="px-4 py-2.5 text-right">Llamadas</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    <tr v-for="(count, endpoint) in (local.byEndpoint || {})" :key="endpoint">
                      <td class="max-w-72 truncate px-4 py-2.5 font-mono text-xs">{{ endpoint }}</td>
                      <td class="px-4 py-2.5 text-right font-mono tabular-nums">{{ count.toLocaleString('es-VE') }}</td>
                    </tr>
                    <tr v-if="!local.byEndpoint || Object.keys(local.byEndpoint).length === 0">
                      <td colspan="2" class="px-4 py-6 text-center text-neutral-400">Sin llamadas registradas todavía.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
          <p v-else class="mt-4 text-sm text-neutral-500">
            {{ store.serverMode ? 'Sin datos del medidor: haz llamadas desde la bandeja o campañas para acumular consumo.' : 'El medidor local requiere el servidor (node server.mjs).' }}
          </p>
        </section>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
