/**
 * @file system.js — Módulo de Estados: números WhatsApp del centro (comprados
 * y bring-your-own), salud de cuentas conectadas y logs de entrega de
 * webhooks. Usa la master key del centro (llamadas admin).
 * RBAC: owner/admin (agente/vendedor sin acceso).
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, api, asArray } = ZernioCrm;

  const components = {};

  /** Clase de estilo para un estado de número WhatsApp. */
  function statusTone(status) {
    const map = {
      active: 'border-emerald-800 bg-emerald-50 text-emerald-800',
      connected: 'border-emerald-800 bg-emerald-50 text-emerald-800',
      provisioning: 'border-amber-700 bg-amber-50 text-amber-900',
      pending_payment: 'border-amber-700 bg-amber-50 text-amber-900',
      suspended: 'border-red-800 bg-red-50 text-red-800',
      releasing: 'border-neutral-400 bg-neutral-50 text-neutral-600',
      released: 'border-neutral-300 bg-neutral-50 text-neutral-400',
    };
    return map[status] || 'border-neutral-400 bg-neutral-50 text-neutral-600';
  }

  components['system-view'] = {
    setup() {
      const loading = Vue.ref(false);
      const error = Vue.ref('');
      const numbers = Vue.ref([]); // purchased + connected
      const health = Vue.ref([]); // health de cuentas
      const webhookLogs = Vue.ref([]);
      const webhookLogsOpen = Vue.ref(false);

      const workspace = Vue.computed(() => store.workspace);
      const isLive = Vue.computed(() => store.mode === 'live');
      const isAdmin = Vue.computed(() => ['owner', 'admin'].includes(store.currentUser && store.currentUser.role));

      /** Números comprados (facturables) del centro. */
      const purchased = Vue.computed(() => (numbers.value.purchased || numbers.value.numbers || []));

      /** Números bring-your-own (conectados con credenciales, sin facturar). */
      const connected = Vue.computed(() => numbers.value.connected || []);

      /** Carga números, salud y logs de webhooks (master key del centro). */
      async function load() {
        if (loading.value || !isAdmin.value) return;
        loading.value = true;
        error.value = '';
        try {
          if (!isLive.value) {
            numbers.value = { purchased: [], connected: [] };
            health.value = [];
            return;
          }
          const [numData, healthData, logsData] = await Promise.all([
            api.listPhoneNumbers().catch(() => ({ purchased: [], connected: [] })),
            api.getAccountsHealth().catch(() => []),
            api.getWebhookLogs().catch(() => []),
          ]);
          numbers.value = numData && (numData.data || numData);
          health.value = asArray(healthData);
          webhookLogs.value = asArray(logsData);
        } catch (err) {
          error.value = err.message || 'No se pudieron cargar los estados';
          toast(error.value, 'error');
        } finally {
          loading.value = false;
        }
      }

      Vue.onMounted(load);

      return {
        loading, error, numbers, health, webhookLogs, webhookLogsOpen,
        purchased, connected, statusTone, isLive, isAdmin, load,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Estados del sistema</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Números WhatsApp del centro, salud de cuentas y entregas de webhooks (master key).
              <span class="font-semibold">{{ isLive ? '· live' : '· demo' }}</span>
            </p>
          </div>
          <button @click="load" :disabled="loading || !isAdmin"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
            <ui-spinner v-if="loading" size="h-4 w-4"></ui-spinner>
            <ui-icon v-else name="refresh" class="h-4 w-4"></ui-icon>
            Refrescar
          </button>
        </header>

        <p v-if="!isAdmin" class="border-2 border-neutral-900 bg-white px-4 py-3 text-sm text-neutral-500">
          Solo propietarios y administradores pueden ver los estados del centro.
        </p>

        <p v-if="error" class="border-2 border-red-800 bg-red-50 px-4 py-2.5 text-sm text-red-800">{{ error }}</p>

        <!-- Números WhatsApp del centro -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Números WhatsApp ({{ purchased.length + connected.length }})
          </h3>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[720px] text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-2.5">Número</th>
                  <th class="px-4 py-2.5">Perfil</th>
                  <th class="px-4 py-2.5">Estado</th>
                  <th class="px-4 py-2.5">Tipo</th>
                  <th class="px-4 py-2.5">Facturación</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <template v-if="purchased.length === 0 && connected.length === 0">
                  <tr>
                    <td colspan="5" class="px-4 py-8 text-center text-neutral-400">
                      {{ isLive ? 'Sin números registrados en la cuenta del centro.' : 'Modo demo: conecta Zernio en live para ver los números.' }}
                    </td>
                  </tr>
                </template>
                <tr v-for="n in purchased" :key="n.id || n.phoneNumber">
                  <td class="px-4 py-3 font-mono text-xs font-semibold">{{ n.phoneNumber || n.number || n.id }}</td>
                  <td class="max-w-48 truncate px-4 py-3 font-mono text-[11px] text-neutral-500">{{ n.profileId || n.profile || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="border px-2 py-0.5 font-mono text-[10px] uppercase" :class="statusTone(n.status)">{{ n.status || '—' }}</span>
                  </td>
                  <td class="px-4 py-3 text-xs text-neutral-500">Comprado (Zernio/Telnyx)</td>
                  <td class="px-4 py-3">
                    <ui-badge variant="warn">Factura al centro</ui-badge>
                  </td>
                </tr>
                <tr v-for="n in connected" :key="n.id || n.phoneNumber">
                  <td class="px-4 py-3 font-mono text-xs font-semibold">{{ n.phoneNumber || n.displayName || n.id }}</td>
                  <td class="max-w-48 truncate px-4 py-3 font-mono text-[11px] text-neutral-500">{{ n.profileId || n.profile || '—' }}</td>
                  <td class="px-4 py-3">
                    <span class="border px-2 py-0.5 font-mono text-[10px] uppercase" :class="statusTone(n.status || 'connected')">{{ n.status || 'connected' }}</span>
                  </td>
                  <td class="px-4 py-3 text-xs text-neutral-500">Bring-your-own (credenciales)</td>
                  <td class="px-4 py-3">
                    <ui-badge variant="neutral">Sin facturar</ui-badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-if="connected.length > 0" class="mt-3 text-xs text-neutral-500">
            <ui-icon name="alert" class="mr-1 inline h-3.5 w-3.5 text-amber-600"></ui-icon>
            Los números bring-your-own con advertencia de registro (registrationWarning) no pueden enviar mensajes hasta resolverla en Meta.
          </p>
        </section>

        <!-- Salud de cuentas -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Salud de cuentas ({{ health.length }})</h3>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-2.5">Cuenta</th>
                  <th class="px-4 py-2.5">Plataforma</th>
                  <th class="px-4 py-2.5">Estado del token</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-if="health.length === 0">
                  <td colspan="3" class="px-4 py-8 text-center text-neutral-400">
                    {{ isLive ? 'Sin cuentas conectadas (o el plan no expone health).' : 'Modo demo: no hay health de cuentas.' }}
                  </td>
                </tr>
                <tr v-for="h in health" :key="h.accountId || h.id || h.username">
                  <td class="max-w-56 truncate px-4 py-3 font-mono text-xs">{{ h.username || h.displayName || h.accountId || h.id }}</td>
                  <td class="px-4 py-3 font-mono text-[11px] uppercase text-neutral-500">{{ h.platform || '—' }}</td>
                  <td class="px-4 py-3">
                    <span v-if="h.valid || h.isActive" class="border border-emerald-800 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] uppercase text-emerald-800">Válido</span>
                    <span v-else class="border border-red-800 bg-red-50 px-2 py-0.5 font-mono text-[10px] uppercase text-red-800">Reconectar</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Webhook logs -->
        <section class="border-2 border-neutral-900 bg-white p-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Entregas de webhooks ({{ webhookLogs.length }})</h3>
            <button @click="webhookLogsOpen = !webhookLogsOpen" class="text-sm font-medium text-[var(--accent)]">
              {{ webhookLogsOpen ? '− Ocultar' : '+ Ver logs' }}
            </button>
          </div>
          <p class="mt-2 text-xs text-neutral-500">Zernio retiene los logs de entrega 7 días.</p>
          <div v-if="webhookLogsOpen" class="mt-3 overflow-x-auto">
            <table class="w-full min-w-[640px] text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-2.5">Evento</th>
                  <th class="px-4 py-2.5">Estado</th>
                  <th class="px-4 py-2.5">Fecha</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-if="webhookLogs.length === 0">
                  <td colspan="3" class="px-4 py-6 text-center text-neutral-400">Sin entregas registradas.</td>
                </tr>
                <tr v-for="(log, i) in webhookLogs" :key="log.id || i">
                  <td class="max-w-64 truncate px-4 py-2.5 font-mono text-xs">{{ log.event || log.type || log.id || '—' }}</td>
                  <td class="px-4 py-2.5">
                    <span class="border px-2 py-0.5 font-mono text-[10px] uppercase"
                      :class="(log.status === 'delivered' || log.success) ? 'border-emerald-800 bg-emerald-50 text-emerald-800' : 'border-neutral-400 bg-neutral-50 text-neutral-600'">
                      {{ log.status || (log.success ? 'delivered' : 'pending') }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 font-mono text-[11px] text-neutral-500">{{ log.createdAt ? new Date(log.createdAt).toLocaleString('es-VE') : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
