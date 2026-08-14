/**
 * @file app.js — Bootstrap de la aplicación: restaura sesión, enruta por hash
 * con guards RBAC, monta el shell (sidebar + vistas) y registra componentes.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, storage } = ZernioCrm;

  /** Mapa ruta → componente de vista. */
  const VIEWS = {
    dashboard: 'dashboard-view',
    analytics: 'analytics-view',
    inbox: 'inbox-view',
    contacts: 'contacts-view',
    channels: 'channels-view',
    leads: 'leads-view',
    products: 'products-view',
    team: 'team-view',
    broadcasts: 'broadcasts-view',
    billing: 'billing-view',
    system: 'system-view',
    settings: 'settings-view',
  };

  /** @returns {string} Ruta actual del hash (sin '#/'). */
  function currentRoute() {
    return location.hash.replace(/^#\/?/, '') || 'dashboard';
  }

  /**
   * Sincroniza store.route con el hash aplicando guards:
   * sin workspace → onboarding; módulo sin permiso del rol → dashboard.
   */
  function syncRoute() {
    let target = currentRoute();
    if (!store.workspace && target !== 'onboarding') target = 'onboarding';
    else if (store.workspace) {
      const module = ZernioCrm.MODULES.find((m) => m.id === target);
      // Módulo sin permiso (o ruta oculta): a Analítica (el panel Resumen quedó oculto)
      if (!module || !ZernioCrm.can(store.currentUser && store.currentUser.role, module.id)) target = 'analytics';
    }
    if (target !== currentRoute()) {
      location.replace(`#/${target}`);
      return;
    }
    store.route = target;
  }

  /** Restaura sesión persistida, detecta el servidor y enruta. */
  async function bootstrap() {
    storage.initPersistence(store);
    const session = storage.loadSession();
    if (session) {
      store.mode = session.mode === 'live' ? 'live' : 'demo';
      store.apiKey = session.apiKey || '';
      const workspace = storage.loadWorkspaces().find((w) => w.id === session.workspaceId) || null;
      if (workspace) {
        store.workspace = workspace;
        store.currentUser =
          workspace.users.find((u) => u.id === session.userId) || workspace.users[0] || null;
        // Migración idempotente del workspace (etiquetas, campos, historial,
        // catálogo, preferencias del panel…). También se ejecuta al crear un
        // workspace nuevo (onboarding) para que el dashboard cargue a la primera.
        ZernioCrm.migrateWorkspace(workspace);
        // La sub-key operativa se restaura desde el workspace (la master del
        // centro es una constante del cliente API, nunca se persiste)
        if (workspace.zernio && workspace.zernio.subKey && store.mode === 'live') store.apiKey = workspace.zernio.subKey;
      }
    }
    // Saneamiento: modo live con conexión Zernio incompleta → degradar a demo con aviso
    if (store.mode === 'live' && store.workspace) {
      const z = store.workspace.zernio;
      if (!z || !z.profileId || !z.accountId) {
        store.mode = 'demo';
        ZernioCrm.toast('Conexión Zernio incompleta: se cambió a modo demo. Revisa Configuración → Canal WhatsApp', 'error', 6000);
      }
    }
    // Callback del OAuth de WhatsApp (redirect_url del túnel): se guarda para
    // que live-connect complete la conexión (accountId o selección de número)
    const waCb = new URLSearchParams(location.search);
    if (waCb.get('connected') === 'whatsapp') {
      sessionStorage.setItem('tzcrm.wa-callback', JSON.stringify({
        connected: 'whatsapp',
        profileId: waCb.get('profileId') || '',
        accountId: waCb.get('accountId') || '',
        username: waCb.get('username') || '',
        step: waCb.get('step') || '',
        tempToken: waCb.get('tempToken') || '',
      }));
      history.replaceState({}, '', location.pathname + location.hash);
      ZernioCrm.toast('Conexión de Meta detectada: confírmala en la pantalla de conexión', 'success', 6000);
    }
    ZernioCrm.applyAccent(store.workspace);
    window.addEventListener('hashchange', syncRoute);
    // Espera la detección del servidor para que las primeras llamadas live usen el proxy
    await ZernioCrm.detectServer();
    if (store.serverMode) startWebhookPolling();
    syncRoute();
  }

  /** Eventos de webhook vistos (para no duplicar al hacer polling, acotado). */
  const seenWebhooks = new Set();

  /**
   * Polling de eventos del servidor local (server.mjs). Cada 15 s consulta
   * /webhooks/events, deduplica por id de evento (at-least-once) y refleja
   * los mensajes entrantes en la bandeja.
   */
  function startWebhookPolling() {
    setInterval(async () => {
      if (!store.serverMode) return;
      try {
        const res = await fetch('/webhooks/events', { cache: 'no-store' });
        const data = await res.json();
        (data.events || []).forEach((entry) => {
          const key = entry.id || entry.receivedAt;
          if (seenWebhooks.has(key)) return;
          seenWebhooks.add(key);
          if (seenWebhooks.size > 500) seenWebhooks.delete(seenWebhooks.values().next().value);
          ZernioCrm.pushWebhookEvent(entry.event);
          ZernioCrm.reflectIncomingMessage(entry.event);
          // Cuenta desconectada (token expirado): marcar el canal para reconectar
          if (entry.event && entry.event.event === 'account.disconnected' && store.workspace) {
            const accId = entry.event.account && (entry.event.account.id || entry.event.account.accountId);
            if (accId) {
              const channel = (store.workspace.channels || []).find((c) => c.accountId === accId);
              if (channel) channel.health = 'reconnect';
              if (store.workspace.zernio && store.workspace.zernio.accountId === accId) store.workspace.zernio.health = 'reconnect';
            }
            ZernioCrm.toast('Alerta: una cuenta se desconectó en Zernio (token expirado). Revisa Canales.', 'error', 6000);
          }
        });
      } catch {
        // servidor caído: se ignora hasta el próximo tick
      }
    }, 15000);
  }

  /** Componente raíz: shell con sidebar y vista activa. */
  const App = {
    setup() {
      Vue.watch(() => store.workspace, (ws) => ZernioCrm.applyAccent(ws));

      const route = Vue.computed(() => store.route);
      const viewComponent = Vue.computed(() => VIEWS[route.value] || 'dashboard-view');
      const navItems = Vue.computed(() =>
        ZernioCrm.MODULES.filter((m) => !m.hidden && ZernioCrm.can(store.currentUser && store.currentUser.role, m.id))
      );
      const unreadTotal = Vue.computed(() =>
        (store.workspace ? store.workspace.conversations : []).reduce((acc, c) => acc + (c.unread || 0), 0)
      );
      const user = Vue.computed(() => store.currentUser);
      const users = Vue.computed(() => (store.workspace ? store.workspace.users : []));

      function navigate(routeId) {
        ZernioCrm.navigate(routeId);
      }

      /** Cambio de usuario de sesión (demo de RBAC). */
      function switchUser(event) {
        const u = users.value.find((x) => x.id === event.target.value);
        if (!u) return;
        store.currentUser = u;
        ZernioCrm.toast(`Sesión como ${u.name} (${ZernioCrm.ROLES[u.role].label})`, 'info');
        syncRoute();
      }

      function logout() {
        storage.clearSession();
        location.reload();
      }

      return { route, viewComponent, navItems, unreadTotal, user, users, navigate, switchUser, logout, store, BRAND: ZernioCrm.BRAND, ZernioCrm };
    },

    template: `
      <!-- Onboarding a pantalla completa -->
      <onboarding-wizard v-if="route === 'onboarding'"></onboarding-wizard>

      <!-- Shell de la app -->
      <div v-else-if="store.workspace" class="flex min-h-screen">
        <!-- Sidebar (escritorio) -->
        <aside class="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r-2 border-neutral-900 bg-white lg:flex">
          <div class="flex items-center gap-3 border-b-2 border-neutral-900 p-4">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-[var(--accent)] text-white shadow-brutal-sm">
              <img v-if="store.workspace.logo" :src="store.workspace.logo" alt="Logo" class="h-full w-full object-contain" />
              <ui-icon v-else name="whatsapp" class="h-5 w-5"></ui-icon>
            </span>
            <div class="min-w-0">
              <p class="truncate font-bold leading-tight">{{ store.workspace.name }}</p>
              <p class="truncate font-mono text-[10px] uppercase tracking-widest text-neutral-400">{{ BRAND }}</p>
            </div>
          </div>

          <nav class="flex-1 space-y-1 overflow-y-auto p-3">
            <button v-for="m in navItems" :key="m.id" @click="navigate(m.id)"
              class="flex w-full items-center gap-3 border-2 px-3 py-2.5 text-sm font-medium transition"
              :class="route === m.id ? 'border-neutral-900 bg-[var(--accent)] text-white shadow-brutal-sm' : 'border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-stone-50'">
              <ui-icon :name="m.icon" class="h-4 w-4"></ui-icon>
              <span class="flex-1 text-left">{{ m.label }}</span>
              <span v-if="m.id === 'inbox' && unreadTotal > 0"
                class="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-mono text-[10px] font-bold tabular-nums"
                :class="route === m.id ? 'text-[var(--accent)]' : 'bg-[var(--accent)] text-white'">
                {{ unreadTotal }}
              </span>
            </button>
          </nav>

          <div class="border-t-2 border-neutral-900 p-3">
            <label class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Sesión (demo RBAC)</label>
            <select :value="user.id" @change="switchUser" class="w-full border-2 border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-neutral-900">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ ZernioCrm.ROLES[u.role].label }}</option>
            </select>
            <button @click="logout" class="mt-2 flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
              <ui-icon name="logout" class="h-3.5 w-3.5"></ui-icon> Salir / nuevo workspace
            </button>
          </div>
        </aside>

        <!-- Columna principal -->
        <div class="flex min-w-0 flex-1 flex-col">
          <!-- Barra superior móvil -->
          <header class="sticky top-0 z-30 flex items-center gap-3 border-b-2 border-neutral-900 bg-white p-3 lg:hidden">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
              <ui-icon name="whatsapp" class="h-4 w-4"></ui-icon>
            </span>
            <select :value="user.id" @change="switchUser" class="min-w-0 flex-1 border-2 border-neutral-300 px-2 py-1.5 text-xs outline-none">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }} · {{ ZernioCrm.ROLES[u.role].label }}</option>
            </select>
            <button @click="logout" class="border-2 border-neutral-900 bg-white p-1.5" aria-label="Salir">
              <ui-icon name="logout" class="h-4 w-4"></ui-icon>
            </button>
          </header>

          <!-- Navegación móvil horizontal -->
          <nav class="flex gap-1.5 overflow-x-auto border-b-2 border-neutral-200 bg-white p-2 scrollbar-none lg:hidden">
            <button v-for="m in navItems" :key="m.id" @click="navigate(m.id)"
              class="flex shrink-0 items-center gap-1.5 border-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
              :class="route === m.id ? 'border-neutral-900 bg-[var(--accent)] text-white' : 'border-neutral-300'">
              {{ m.label }}
              <span v-if="m.id === 'inbox' && unreadTotal > 0" class="tabular-nums">({{ unreadTotal }})</span>
            </button>
          </nav>

          <!-- Banner CORS -->
          <div v-if="store.corsBlocked" class="flex items-center gap-2 border-b-2 border-amber-700 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
            <ui-icon name="alert" class="h-4 w-4 shrink-0"></ui-icon>
            Modo demo activo: Zernio bloqueó peticiones del navegador (CORS). Revisa Configuración.
          </div>

          <main class="flex-1 p-5 lg:p-8">
            <component :is="viewComponent"></component>
          </main>
        </div>
      </div>

      <!-- Cargando sesión -->
      <div v-else class="flex min-h-screen items-center justify-center gap-3 bg-stone-100">
        <ui-spinner class="text-[var(--accent)]"></ui-spinner>
        <span class="font-mono text-xs uppercase tracking-widest">Cargando…</span>
      </div>

      <!-- Notificaciones globales -->
      <ui-toast></ui-toast>
    `,
  };

  bootstrap().then(() => {
    const app = Vue.createApp(App);
    Object.entries(ZernioCrm.components).forEach(([name, def]) => app.component(name, def));
    app.mount('#app');
  });
})();
