/**
 * @file onboarding-composables.js — Composables por bounded context del wizard
 * de configuración inicial. Extraen la lógica del setup de onboarding-wizard
 * (formulario, flujo de pasos, conexión y creación del workspace) a factories
 * `Z.makeXxx`; sin template. 1:1 con el comportamiento previo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  /**
   * BC Form: única instancia reactiva del formulario + derivados de nicho,
   * acento y selección de nicho.
   */
  function makeOnboardingForm({ getNiche, ACCENTS }) {
    /** Datos del formulario (solo se persiste al finalizar). */
    const form = Vue.reactive({
      nicheId: null,
      focus: null,
      name: '',
      slogan: '',
      accentId: 'carbono',
      referrer: null,
      referrerDetail: '',
      ownerName: '',
      ownerEmail: '',
      inviteAgent: true,
      inviteVendor: true,
      skipConnect: false, // "Configurar después": termina sin canal conectado
      accepted: false, // convenio de uso aceptado (paso 2, obligatorio)
      logo: null, // logo del negocio (dataURL, opcional)
    });

    const niche = Vue.computed(() => getNiche(form.nicheId));
    const accent = Vue.computed(() => ACCENTS.find((a) => a.id === form.accentId) || ACCENTS[0]);

    /** Nicho seleccionado (para la preview del paso 1). */
    const selectedNiche = Vue.computed(() => getNiche(form.nicheId));

    /** Al elegir nicho se precargan foco y sugerencia de nombre. */
    function selectNiche(id) {
      form.nicheId = id;
      const n = getNiche(id);
      form.focus = n.focusDefault;
      form.name = n.id === 'personalizado' ? '' : `Mi ${n.nombre.toLowerCase()}`;
    }

    return { form, niche, accent, selectedNiche, selectNiche };
  }

  /**
   * BC Flow: paso actual, temporizadores de carga/creación, validación
   * por paso y navegación (next/back/jump).
   */
  function makeOnboardingFlow({ form, liveResult, later }) {
    const current = Vue.ref(0);
    const enterLoading = Vue.ref(false);
    const creating = Vue.ref(false);

    /** ¿Es válido el paso actual para continuar? */
    const canContinue = Vue.computed(() => {
      switch (current.value) {
        case 1: return Boolean(form.nicheId);
        case 2: return Boolean(form.accepted); // convenio de uso obligatorio
        case 3: return form.name.trim().length > 0;
        case 4: return Boolean(form.referrer);
        case 5: return Boolean(liveResult.value) || form.skipConnect;
        case 6: return !creating.value;
        default: return true;
      }
    });

    function jumpTo(i) {
      if (i < current.value) current.value = i;
    }

    function next() {
      if (!canContinue.value) return;
      const target = current.value + 1;
      if (target === 1) {
        enterLoading.value = true;
        later(() => { enterLoading.value = false; current.value = 1; }, 700);
        return;
      }
      current.value = target;
    }

    function back() {
      if (current.value > 0 && !creating.value) current.value -= 1;
    }

    return { current, enterLoading, creating, canContinue, jumpTo, next, back };
  }

  /**
   * BC Connection: resultado de la conexión real (live-connect) y recepción
   * del evento 'connected'.
   */
  function makeOnboardingConnection({ form, liveResult }) {
    /** Recibe la conexión real de live-connect y habilita el siguiente paso. */
    function onLiveConnected(result) {
      liveResult.value = result;
      form.skipConnect = false;
    }

    return { onLiveConnected };
  }

  /**
   * BC Workspace: logo (shared makeLogoUpload) y creación del workspace,
   * sesión como propietario y entrada al dashboard. Preserva el orden de
   * persistencia y navegación original.
   */
  function makeOnboardingWorkspace({ form, liveResult, flow, store, toast, applyAccent, navigate, later }) {
    // Upload/eliminado del logo: lógica compartida en shared.js (makeLogoUpload).
    const { uploadLogo, removeLogo } = ZernioCrm.makeLogoUpload({
      toast,
      onLogo: (dataURL) => { form.logo = dataURL; },
      onRemove: () => { form.logo = null; },
      successMsg: 'Logo listo: se guardará con tu espacio',
      removeMsg: 'Logo quitado',
    });

    /** Crea el workspace, inicia sesión como propietario y entra al dashboard. */
    function finish() {
      if (!flow.canContinue.value) return;
      flow.creating.value = true;
      later(() => {
        const ws = ZernioCrm.demo.buildWorkspace({
          nicheId: form.nicheId,
          focus: form.focus,
          name: form.name.trim(),
          slogan: form.slogan.trim(),
          accentId: form.accentId,
          referrer: form.referrer,
          referrerDetail: form.referrerDetail.trim(),
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
        });
        if (!form.inviteAgent) ws.users = ws.users.filter((u) => u.role !== 'agente');
        if (!form.inviteVendor) ws.users = ws.users.filter((u) => u.role !== 'vendedor');
        // Logo del negocio subido en el paso de Marca
        if (form.logo) ws.logo = form.logo;
        // Migración del workspace recién creado: completa etiquetas, campos,
        // historial, catálogo y preferencias del panel para que el dashboard
        // cargue completo a la primera (sin depender de una recarga).
        ZernioCrm.migrateWorkspace(ws);
        // "Configurar después": workspace sin canal conectado (conecta luego desde Canales)
        if (form.skipConnect && !liveResult.value) {
          ws.zernio = null;
          ws.whatsapp = { connected: false, modality: 'pending', phone: '', status: 'disconnected', since: Date.now(), about: 'Canal pendiente de conexión' };
          ws.channels = (ws.channels || []).filter((c) => c.platform !== 'whatsapp');
          store.mode = 'demo';
        }
        // Conexión real con Zernio (si el cliente la eligió)
        if (liveResult.value) {
          ws.zernio = {
            profileId: liveResult.value.profileId,
            accountId: liveResult.value.accountId,
            phone: liveResult.value.phone,
            // Sub-key scoped del negocio (creada por live-connect; el workspace
            // aún no existía al crearla, por eso viaja en el evento 'connected')
            subKey: liveResult.value.subKey || '',
            subKeyProfileId: liveResult.value.profileId || '',
          };
          ws.whatsapp = {
            connected: true,
            modality: 'live',
            phone: liveResult.value.phone,
            status: 'connected',
            since: Date.now(),
            about: 'Conexión real con Zernio',
            accountId: liveResult.value.accountId,
          };
          store.mode = 'live';
        }
        // Convenio de uso aceptado (con versión para futuras auditorías)
        ws.convenio = { acceptedAt: Date.now(), version: 1 };
        store.workspace = ws;
        store.currentUser = ws.users.find((u) => u.role === 'owner');
        applyAccent(ws);
        toast(`¡${ws.name} está listo!`, 'success');
        // Tras la configuración: a Analítica si ya hay canal de mensajería;
        // si no, a Canales con el aviso de la importancia de conectar uno.
        if (ws.whatsapp && ws.whatsapp.connected) {
          navigate('analytics');
        } else {
          navigate('channels');
          toast('Conecta un canal para que tus clientes puedan escribirte', 'info', 7000);
        }
      }, 1400);
    }

    return { uploadLogo, removeLogo, finish };
  }

  window.ZernioCrm = window.ZernioCrm || {};
  Object.assign(window.ZernioCrm, {
    makeOnboardingForm, makeOnboardingFlow, makeOnboardingConnection, makeOnboardingWorkspace,
  });
})();