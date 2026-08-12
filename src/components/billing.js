/**
 * @file billing.js — Panel de facturación y consumo del centro.
 * Dos fuentes: (1) snapshot de la cuenta Zernio con la master key (plan,
 * gasto del período, llamadas por operación, statement) y (2) medidor local
 * por negocio (server.mjs cuenta cada request del proxy por key).
 * RBAC: owner/admin (agente/vendedor sin acceso).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray } = ZernioCrm;

  const components = {};

  /** Convierte centavos a USD con formato. */
  function usd(cents) {
    const n = Number(cents);
    if (!Number.isFinite(n)) return '—';
    return `$${(n / 100).toFixed(2)}`;
  }

  /** Porcentaje seguro (0-100). */
  function pct(part, whole) {
    const w = Number(whole);
    if (!w) return 0;
    return Math.min(100, Math.round((Number(part) / w) * 100));
  }

  /** Hash SHA-256 hex corto de la sub-key (para consultar el medidor local). */
  async function sha256Hex(text) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '')));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback sin WebCrypto (file://): hash djb2 estabilizado
      let h1 = 5381;
      let h2 = 52711;
      for (let i = 0; i < String(text || '').length; i++) {
        const c = String(text).charCodeAt(i);
        h1 = ((h1 * 33) ^ c) >>> 0;
        h2 = ((h2 * 31) ^ c) >>> 0;
      }
      return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`.slice(0, 16);
    }
  }

  components['billing-view'] = {
    setup() {
      const loading = Vue.ref(false);
      const error = Vue.ref('');
      const range = Vue.ref('30d');
      const usage = Vue.ref(null); // snapshot Zernio (GET /usage o fallback)
      const statement = Vue.ref(null); // GET /billing
      const pricing = Vue.ref({}); // GET /billing/x-pricing
      const local = Vue.ref(null); // medidor local (GET /api/usage?ws=)
      const localHash = Vue.ref('');

      const workspace = Vue.computed(() => store.workspace);
      const isLive = Vue.computed(() => store.mode === 'live');

      /** Operaciones con precio resuelto (xApiCallsByOperation o resumen por días). */
      const operations = Vue.computed(() => {
        const u = usage.value || {};
        // Shape real de /usage: serie diaria por categoría (accounts, numbers, calls, sms, xApi…)
        if (Array.isArray(u.days) && u.days.length) {
          const totals = {};
          u.days.forEach((d) => {
            ['xApi', 'calls', 'sms', 'verify', 'dlc', 'credits', 'accounts', 'numbers', 'other'].forEach((k) => {
              totals[k] = (totals[k] || 0) + (Number(d[k]) || 0);
            });
          });
          return Object.entries(totals)
            .filter(([, v]) => v > 0)
            .map(([key, calls]) => ({ key: `/${key}`, calls, priceCents: null }))
            .sort((a, b) => b.calls - a.calls);
        }
        const ops = (u.usage && u.usage.xApiCallsByOperation) || u.xApiCallsByOperation || {};
        const pricingMap = pricing.value && (pricing.value.operations || pricing.value.prices || pricing.value);
        const list = Object.entries(ops).map(([key, calls]) => {
          let price = null;
          const entry = pricingMap && (pricingMap[key] || pricingMap[key.replace(/^\/v1/, '')] || pricingMap[key.replace(/^\/|\/$/g, '')]);
          if (entry) {
            price = entry.priceCents != null ? entry.priceCents : entry.costPerCallCents != null ? entry.costPerCallCents : entry.amountCents;
          }
          return { key, calls: Number(calls) || 0, priceCents: price != null ? Number(price) : null };
        });
        return list.sort((a, b) => b.calls - a.calls);
      });

      /** Costo estimado de las llamadas con precio conocido. */
      const estimatedCents = Vue.computed(() => operations.value.reduce((acc, o) => acc + (o.priceCents != null ? o.priceCents * o.calls : 0), 0));

      /** Nombre del plan (usage.plan o billing.plan). */
      const planName = Vue.computed(() => {
        const u = usage.value || {};
        const st = statement.value || {};
        return (u.plan && u.plan.name) || u.planName || (st.plan && st.plan.name) || '—';
      });

      /** Gasto del período en centavos (usage.spend o billing.caps/balance). */
      const spentCents = Vue.computed(() => {
        const u = usage.value || {};
        const st = statement.value || {};
        return (
          (u.spend && (u.spend.xSpendCents ?? u.spend.currentPeriodCents)) ??
          (st.caps && st.caps.xSpendUsedCents) ??
          (st.balance && st.balance.accruedThisPeriodCents) ??
          0
        );
      });

      /** Límite de gasto del período en centavos. */
      const spendLimitCents = Vue.computed(() => {
        const u = usage.value || {};
        const st = statement.value || {};
        return (u.spend && u.spend.xSpendLimitCents) ?? (st.caps && st.caps.xSpendLimitCents) ?? null;
      });

      /** Balance/créditos disponibles en centavos. */
      const balanceCents = Vue.computed(() => {
        const st = statement.value || {};
        return (st.balance && (st.balance.creditsRemainingCents ?? st.balance.cents)) ?? null;
      });

      /** Estado de pago (string corto del statement). */
      const paymentStatus = Vue.computed(() => {
        const st = statement.value || {};
        if (st.status && typeof st.status === 'object') {
          const s = st.status;
          if (s.hasPaymentMethod == null && s.requiresAction == null) return JSON.stringify(s).slice(0, 40);
          return [s.hasPaymentMethod ? 'método de pago OK' : 'sin método de pago', s.requiresAction ? '· acción requerida' : ''].filter(Boolean).join(' ');
        }
        return st.status || st.paymentStatus || '—';
      });

      /** Período de facturación (inicio → fin). */
      const billingPeriod = Vue.computed(() => {
        const st = statement.value || {};
        if (!st.period) return (usage.value && usage.value.billingPeriod) || '';
        const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString('es-VE') : '');
        return `${fmt(st.period.start)} → ${fmt(st.period.end)}`;
      });

      /** Últimos 30 días del medidor local para el gráfico. */
      const localDays = Vue.computed(() => {
        const l = local.value;
        if (!l || !l.byDay) return [];
        const days = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
          days.push({ day: d.slice(5), count: l.byDay[d] || 0 });
        }
        return days;
      });

      /** Máximo diario (escala del gráfico). */
      const maxDay = Vue.computed(() => Math.max(1, ...localDays.value.map((d) => d.count)));

      /** Carga el snapshot de Zernio (master) y el medidor local. */
      async function load() {
        if (loading.value) return;
        loading.value = true;
        error.value = '';
        try {
          // Medidor local (siempre que haya sub-key y servidor)
          if (store.serverMode) {
            try {
              const key = (workspace.value.zernio && workspace.value.zernio.subKey) || store.apiKey;
              // Mismo truncado que server.mjs (sha256 slice 16) para que el hash coincida
              localHash.value = (await sha256Hex(key)).slice(0, 16);
              const res = await fetch(`/api/usage?ws=${localHash.value}`, {
                cache: 'no-store',
                headers: { 'X-Zernio-Key': key }, // el server exige que el hash coincida con la key
              });
              if (res.ok) local.value = await res.json();
            } catch {
              local.value = null;
            }
          }
          if (!isLive.value) {
            local.value = (workspace.value && workspace.value.usage) || null; // seed demo
            return;
          }

          // Snapshot Zernio con la sub-key del negocio (solo su perfil;
          // sin sub-key cae al master key del centro, demo/legacy).
          // Si ambos fallan, el error se propaga al catch para no dejar
          // la UI en "cargando…" sin explicación.
          const [u, st, pr] = await Promise.all([
            api.getUsage(range.value).catch(() => api.getUsageStatsLegacy()),
            api.getBilling().catch(() => null),
            api.getBillingPricing().catch(() => null),
          ]);
          usage.value = u && (u.data || u);
          statement.value = st && (st.data || st);
          pricing.value = pr && (pr.data || pr);
        } catch (err) {
          error.value = err.message || 'No se pudo cargar el consumo';
          toast(error.value, 'error');
        } finally {
          loading.value = false;
        }
      }

      Vue.onMounted(load);

      return {
        loading, error, range, usage, statement, pricing, local, store, workspace,
        localDays, maxDay, operations, estimatedCents, usd, pct, isLive, load,
        planName, spentCents, spendLimitCents, balanceCents, paymentStatus, billingPeriod,
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
                <p class="mt-1 text-sm font-semibold">{{ local.updatedAt ? new Date(local.updatedAt).toLocaleString('es-VE') : '—' }}</p>
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
