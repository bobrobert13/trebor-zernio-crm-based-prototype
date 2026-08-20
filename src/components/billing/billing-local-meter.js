/**
 * @file billing-local-meter.js — Sección presentacional del medidor local por
 * negocio (server.mjs): totales, serie de 30 días y desglose por endpoint.
 * Recibe datos y formateadores por props. Verbatim del bloque original.
 */
(function () {
  'use strict';

  const components = {};

  components['billing-local-meter'] = {
    props: {
      local: Object,
      serverMode: Boolean,
      localDays: Array,
      maxDay: Number,
      fmtDT: Function,
    },

    template: `
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
            {{ serverMode ? 'Sin datos del medidor: haz llamadas desde la bandeja o campañas para acumular consumo.' : 'El medidor local requiere el servidor (node server.mjs).' }}
          </p>
        </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
