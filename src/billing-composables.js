/**
 * @file billing-composables.js — Composables por bounded context del módulo
 * Billing. Extraen la logica del setup de billing-view (carga del snapshot
 * Zernio + medidor local, proyecciones de la cuenta de plataforma y serie del
 * medidor) a objetos `{ refs, computeds, helpers }`. Convención `Z.makeXxx`;
 * sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

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

  /**
   * BC Format: formateadores presentacionales compartidos por el template.
   */
  function makeBillingFormat() {
    return { usd, pct };
  }

  /**
   * BC Load: estado, carga y coordinacion del snapshot Zernio (master) con el
   * medidor local por negocio (server.mjs cuenta cada request del proxy).
   */
  function makeBillingLoad({ store, api, toast }) {
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
          api.getUsageRobust(range.value),
          api.getBillingOrNull(),
          api.getBillingPricingOrNull(),
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

    return {
      loading, error, range, usage, statement, pricing, local, localHash,
      workspace, isLive, load,
    };
  }

  /**
   * BC Platform: proyecciones del snapshot de cuenta Zernio (plan, gasto,
   * límites, balance, pago y período) y operaciones con precio resuelto.
   */
  function makePlatformBilling({ usage, statement, pricing, fmtD }) {
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
      return `${fmtD(st.period.start)} → ${fmtD(st.period.end)}`;
    });

    return {
      operations, estimatedCents, planName, spentCents,
      spendLimitCents, balanceCents, paymentStatus, billingPeriod,
    };
  }

  /**
   * BC LocalMeter: serie diaria y escala del medidor local (últimos 30 días).
   */
  function makeLocalMeter({ local }) {
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

    return { localDays, maxDay };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeBillingFormat, makeBillingLoad, makePlatformBilling, makeLocalMeter,
  });
})();