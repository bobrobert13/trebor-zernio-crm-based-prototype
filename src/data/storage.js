/**
 * @file storage.js — Persistencia en localStorage (namespaced) y enganche
 * de persistencia automática del store. Sin dependencias de red: funciona
 * abriendo index.html directo por file://.
 */
(function () {
  'use strict';

  const { Vue } = window;

  /** Claves de localStorage usadas por el prototipo. */
  const KEYS = { workspaces: 'tzcrm.workspaces', session: 'tzcrm.session' };

  /**
   * Parsea JSON de forma segura.
   * @param {string|null} raw — cadena cruda.
   * @param {*} fallback — valor por defecto.
   * @returns {*} Valor parseado o fallback.
   */
  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * Genera un id corto único.
   * @param {string} prefix — prefijo legible del id.
   * @returns {string} id único.
   */
  function uid(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  /** @returns {Array<object>} Todos los workspaces persistidos. */
  function loadWorkspaces() {
    return safeParse(localStorage.getItem(KEYS.workspaces), []);
  }

  /** @param {Array<object>} list — Lista de workspaces a persistir. */
  function saveWorkspaces(list) {
    localStorage.setItem(KEYS.workspaces, JSON.stringify(list));
  }

  /**
   * Inserta o actualiza un workspace en la lista persistida.
   * @param {object} workspace — workspace completo.
   */
  function upsertWorkspace(workspace) {
    const list = loadWorkspaces();
    const index = list.findIndex((w) => w.id === workspace.id);
    if (index >= 0) list[index] = workspace;
    else list.unshift(workspace);
    saveWorkspaces(list);
  }

  /**
   * Elimina un workspace.
   * @param {string} id — id del workspace.
   */
  function deleteWorkspace(id) {
    saveWorkspaces(loadWorkspaces().filter((w) => w.id !== id));
  }

  /** @returns {object|null} Sesión persistida (workspace, usuario, modo, key). */
  function loadSession() {
    return safeParse(localStorage.getItem(KEYS.session), null);
  }

  /** @param {object} session — Sesión a persistir. */
  function saveSession(session) {
    localStorage.setItem(KEYS.session, JSON.stringify(session));
  }

  /** Limpia la sesión (mantiene los workspaces guardados). */
  function clearSession() {
    localStorage.removeItem(KEYS.session);
    // Sub-keys temporales de onboarding: no compartirlas con otro workspace
    try {
      sessionStorage.removeItem('tzcrm.subkeys');
    } catch { /* sesión no disponible */ }
  }

  /** Elimina todos los datos del prototipo (reset demo). */
  function resetAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    try {
      sessionStorage.removeItem('tzcrm.subkeys');
    } catch { /* sesión no disponible */ }
  }

  /**
   * Debounce simple de tipo 'trailing': ejecuta `fn` AL final de la ráfaga.
   * Devuelve { schedule, flush }. flush() ejecuta la escritura pendiente de
   * inmediato y limpia el temporizador (útil para volcar antes de cerrar).
   */
  function debounce(fn, ms) {
    let timer = null;
    return {
      schedule() {
        clearTimeout(timer);
        timer = setTimeout(fn, ms);
      },
      flush() {
        clearTimeout(timer);
        timer = null;
        fn();
      },
    };
  }

  /**
   * Engancha la persistencia automática: cualquier mutación profunda del
   * store.workspace o de la sesión se escribe en localStorage.
   * @param {object} store — store reactivo global.
   */
  function initPersistence(store) {
    const persistWorkspace = debounce(() => {
      if (store.workspace) upsertWorkspace(store.workspace);
    }, 350); // 350ms: agrupa ráfagas (mensajes/acks/menciones) sin serializar en cada mutación.

    Vue.watch(
      () => store.workspace,
      () => persistWorkspace.schedule(),
      { deep: true }
    );
    Vue.watch(
      () => ({
        workspaceId: store.workspace && store.workspace.id,
        userId: store.currentUser && store.currentUser.id,
        mode: store.mode,
        apiKey: store.apiKey,
      }),
      (session) => saveSession(session),
      { deep: true }
    );

    // Vuelca el workspace pendiente antes de cerrar u ocultar la pestaña
    // para no perder mutaciones que aún no superaron el debounce.
    window.addEventListener('beforeunload', persistWorkspace.flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') persistWorkspace.flush();
    });
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    uid,
    storage: { loadWorkspaces, upsertWorkspace, deleteWorkspace, loadSession, saveSession, clearSession, resetAll, initPersistence },
  });
})();
