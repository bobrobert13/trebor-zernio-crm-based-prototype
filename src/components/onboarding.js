/**
 * @file onboarding.js — Wizard de configuración inicial (7 pasos).
 * Paso 1→nicho, 2→convenio de uso, 3→branding (nombre, logo, color),
 * 4→referencia, 5→canales, 6→equipo inicial. Conexión real de WhatsApp
 * vía live-connect.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, navigate } = ZernioCrm;

  const STEPS = ['Bienvenida', 'Nicho', 'Convenio', 'Marca', 'Referencia', 'WhatsApp', 'Equipo'];

  const components = {};

  components['onboarding-wizard'] = {
    setup() {
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

      const current = Vue.ref(0);
      const enterLoading = Vue.ref(false);
      const creating = Vue.ref(false);

      /** Sección colapsada de clave de administración (solo si el centro no la dejó en sesión). */
      const adminKeyOpen = Vue.ref(false);
      const hasMasterKey = Vue.computed(() => {
        try {
          return Boolean(sessionStorage.getItem('tzcrm.masterKey'));
        } catch {
          return false;
        }
      });

      /** Resultado de la conexión real (live-connect). */
      const liveResult = Vue.ref(null);

      /** Temporizadores activos (limpieza en onUnmounted). */
      const timers = [];

      function later(fn, ms) {
        const id = setTimeout(fn, ms);
        timers.push(id);
        return id;
      }

      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      const niche = Vue.computed(() => ZernioCrm.getNiche(form.nicheId));
      const accent = Vue.computed(() => ZernioCrm.ACCENTS.find((a) => a.id === form.accentId) || ZernioCrm.ACCENTS[0]);

      /** Nicho seleccionado (para la preview del paso 1). */
      const selectedNiche = Vue.computed(() => ZernioCrm.getNiche(form.nicheId));

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

      /** Al elegir nicho se precargan foco y sugerencia de nombre. */
      function selectNiche(id) {
        form.nicheId = id;
        const n = ZernioCrm.getNiche(id);
        form.focus = n.focusDefault;
        form.name = n.id === 'personalizado' ? '' : `Mi ${n.nombre.toLowerCase()}`;
      }

      /** Sube el logo del negocio: lee, redimensiona a ≤256 px y lo guarda como dataURL. */
      function uploadLogo(event) {
        const file = event.target.files && event.target.files[0];
        event.target.value = ''; // permite volver a elegir el mismo archivo
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          toast('Solo imágenes (PNG/JPG/WebP)', 'error');
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          toast('Imagen muy grande: máximo 2 MB', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => toast('No se pudo leer la imagen: archivo inválido o formato no soportado', 'error');
          img.onload = () => {
            const MAX = 256;
            const scale = Math.min(1, MAX / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              toast('No se pudo procesar la imagen', 'error');
              return;
            }
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            form.logo = canvas.toDataURL('image/png');
            toast('Logo listo: se guardará con tu espacio', 'success');
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      }

      function removeLogo() {
        form.logo = null;
        toast('Logo quitado', 'info');
      }

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

      /** Recibe la conexión real de live-connect y habilita el siguiente paso. */
      function onLiveConnected(result) {
        liveResult.value = result;
        form.skipConnect = false;
      }

      /** Crea el workspace, inicia sesión como propietario y entra al dashboard. */
      function finish() {
        if (!canContinue.value) return;
        creating.value = true;
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

      return {
        STEPS, form, current, enterLoading, creating, niche, accent, selectedNiche,
        adminKeyOpen, hasMasterKey, liveResult,
        selectNiche, jumpTo, next, back, onLiveConnected, finish,
        uploadLogo, removeLogo,
        canContinue,
        ui: ZernioCrm,
      };
    },

    template: `
      <div class="grid min-h-screen bg-stone-100 lg:grid-cols-[420px_1fr]">
        <!-- Panel izquierdo de marca (escritorio) -->
        <aside class="sticky top-0 hidden h-screen flex-col justify-between bg-[var(--accent)] p-10 text-white lg:flex">
          <div>
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center bg-white text-[var(--accent)] shadow-brutal-sm">
                <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
              </span>
              <div>
                <h1 class="text-xl font-bold leading-tight">{{ ui.BRAND }}</h1>
                <p class="font-mono text-[11px] uppercase tracking-widest opacity-70">Configuración inicial</p>
              </div>
            </div>
            <h2 class="mt-12 text-3xl font-bold leading-tight">Tu atención al cliente por WhatsApp, lista en minutos.</h2>
            <p class="mt-3 max-w-xs text-sm opacity-80">
              Elige tu tipo de negocio, conecta tu número y empieza a responder a tus clientes desde un solo lugar.
            </p>
          </div>

          <!-- Progreso vertical -->
          <ol class="space-y-2.5">
            <li v-for="(s, i) in STEPS" :key="i" class="flex items-center gap-3 font-mono text-xs uppercase tracking-widest"
              :class="i === current ? 'font-semibold opacity-100' : i < current ? 'opacity-60' : 'opacity-35'">
              <span class="flex h-6 w-6 items-center justify-center border border-white/40">
                <ui-icon v-if="i < current" name="check" class="h-3.5 w-3.5"></ui-icon>
                <span v-else class="tabular-nums">{{ i + 1 }}</span>
              </span>
              {{ s }}
            </li>
          </ol>

          <p class="font-mono text-[11px] uppercase tracking-widest opacity-60">Configuración guiada</p>
        </aside>

        <!-- Panel derecho -->
        <div class="flex min-h-screen flex-col">
          <header class="flex items-center justify-between border-b-2 border-neutral-900 bg-white px-5 py-3 lg:hidden">
            <div class="flex items-center gap-2.5">
              <span class="flex h-8 w-8 items-center justify-center bg-[var(--accent)] text-white">
                <ui-icon name="whatsapp" class="h-4 w-4"></ui-icon>
              </span>
              <span class="font-bold">{{ ui.BRAND }}</span>
            </div>
            <ui-stepper v-if="current > 0" :steps="STEPS" :current="current" @jump="jumpTo"></ui-stepper>
          </header>

          <main class="flex-1 px-5 py-8 lg:px-16">
            <div class="mx-auto w-full max-w-4xl">
              <!-- Encabezado del paso (pipeline) -->
              <div v-if="current > 0 && !enterLoading" class="mb-6">
                <p class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">Paso {{ current }} de {{ STEPS.length - 1 }} · {{ STEPS[current] }}</p>
                <div class="mt-2 h-1 w-full bg-neutral-200">
                  <div class="h-full bg-[var(--accent)] transition-all duration-500" :style="{ width: (current / (STEPS.length - 1)) * 100 + '%' }"></div>
                </div>
              </div>

          <!-- Transición entre pasos (fade + deslizamiento sutil) -->
          <transition name="step" mode="out-in">
          <!-- Pantalla de carga al pasar de bienvenida a nicho -->
          <div v-if="enterLoading" class="bg-white p-8">
            <div class="mb-6 flex items-center gap-2">
              <ui-spinner class="text-[var(--accent)]"></ui-spinner>
              <span class="font-mono text-xs uppercase tracking-widest">Preparando tu espacio…</span>
            </div>
            <div class="space-y-3">
              <ui-skeleton h="h-16"></ui-skeleton>
              <ui-skeleton h="h-16"></ui-skeleton>
              <ui-skeleton h="h-16"></ui-skeleton>
            </div>
          </div>

          <!-- 0 · Bienvenida -->
          <section v-else-if="current === 0" class="hero-bg relative overflow-hidden text-white">
            <div class="px-8 py-16 sm:px-14 lg:py-24">
              <div class="flex flex-wrap items-center gap-2">
                <span class="flex items-center gap-1.5 border border-white/30 bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                  <ui-icon name="whatsapp" class="h-3.5 w-3.5"></ui-icon> WhatsApp
                </span>
                <span class="flex items-center gap-1.5 border border-white/30 bg-white/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur">
                  <ui-icon name="instagram" class="h-3.5 w-3.5"></ui-icon> Instagram
                </span>
                <span class="border border-white/20 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest opacity-70">+ más canales próximamente</span>
              </div>
              <h2 class="mt-6 max-w-xl text-4xl font-bold leading-tight lg:text-5xl">Tu atención al cliente, lista en minutos.</h2>
              <p class="mt-4 max-w-lg text-lg text-white/80">
                Responde por WhatsApp e Instagram desde un solo lugar: tu negocio, tu equipo y tus clientes conectados sin fricción.
              </p>
              <button @click="next" class="mt-8 bg-white px-8 py-3.5 font-semibold text-neutral-900 shadow-brutal transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
                Comenzar mi configuración →
              </button>
              <div class="mt-12 grid gap-4 border-t border-white/20 pt-6 sm:grid-cols-3">
                <div>
                  <p class="text-2xl font-bold">≈5 min</p>
                  <p class="text-sm text-white/70">de configuración guiada</p>
                </div>
                <div>
                  <p class="text-2xl font-bold">2 canales</p>
                  <p class="text-sm text-white/70">WhatsApp hoy · Instagram pronto</p>
                </div>
                <div>
                  <p class="text-2xl font-bold">Tu equipo</p>
                  <p class="text-sm text-white/70">roles y permisos incluidos</p>
                </div>
              </div>
            </div>
          </section>

          <!-- 1 · Nicho -->
          <section v-else-if="current === 1" class="bg-white p-8">
            <h2 class="text-2xl font-bold">¿A qué se dedica tu negocio?</h2>
            <p class="mt-1 text-sm text-neutral-500">Elige el modelo más parecido: ajustamos campos, plantillas y etapas de seguimiento.</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <button v-for="(n, ni) in ui.NICHES" :key="n.id" @click="selectNiche(n.id)"
                class="stagger-in border-2 p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brutal-sm"
                :style="{ animationDelay: (ni * 40) + 'ms' }"
                :class="form.nicheId === n.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 bg-white hover:border-neutral-900'">
                <div class="flex items-start justify-between gap-2">
                  <span class="flex h-11 w-11 items-center justify-center bg-[var(--accent)] text-xl shadow-brutal-sm" :class="form.nicheId === n.id ? 'text-white' : 'bg-stone-100'">{{ n.emoji }}</span>
                  <ui-icon v-if="form.nicheId === n.id" name="check-circle" class="h-5 w-5 text-[var(--accent)]"></ui-icon>
                </div>
                <h3 class="mt-3 font-semibold">{{ n.nombre }}</h3>
                <p class="mt-1 text-xs leading-relaxed text-neutral-500">{{ n.descripcion }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5">
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">{{ (n.customFields || []).length }} campos</span>
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">Plantillas demo</span>
                  <span class="border border-neutral-300 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">WhatsApp + IG</span>
                </div>
              </button>
              <button @click="selectNiche('personalizado')"
                class="stagger-in border-2 border-dashed p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-brutal-sm"
                :style="{ animationDelay: (ui.NICHES.length * 40) + 'ms' }"
                :class="form.nicheId === 'personalizado' ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-300 hover:border-neutral-900'">
                <span class="flex h-11 w-11 items-center justify-center bg-stone-100 text-xl">✨</span>
                <h3 class="mt-3 font-semibold">Otro / Personalizado</h3>
                <p class="mt-1 text-xs text-neutral-500">Configuración genérica adaptable a cualquier negocio.</p>
              </button>
            </div>

            <!-- Preview del nicho seleccionado (atracción psicológica) -->
            <div v-if="selectedNiche && selectedNiche.id !== 'personalizado'" class="mt-6 grid gap-4 border border-neutral-200 bg-stone-50 p-5 sm:grid-cols-2">
              <div>
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Campos del cliente que registrarás</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="f in selectedNiche.customFields" :key="f.slug" class="border border-neutral-300 bg-white px-2 py-1 text-xs">
                    {{ f.name }}
                  </span>
                </div>
              </div>
              <div>
                <p class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Lo que incluye tu espacio</p>
                <ul class="mt-2 space-y-1">
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="message" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Plantillas demo de WhatsApp del nicho
                  </li>
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="tag" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Campos del negocio y etapas del pipeline
                  </li>
                  <li class="flex items-center gap-2 text-sm text-neutral-600">
                    <ui-icon name="users" class="h-3.5 w-3.5 text-neutral-400"></ui-icon>
                    Equipo inicial con roles
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <!-- 2 · Convenio de uso -->
          <section v-else-if="current === 2" class="bg-white p-8">
            <h2 class="text-2xl font-bold">Convenio de uso</h2>
            <p class="mt-1 text-sm text-neutral-500">Conoce lo que podrás hacer con tu espacio y acepta las condiciones para empezar.</p>

            <!-- Resumen de capacidades -->
            <div class="mt-6 border-2 border-neutral-900 bg-stone-50 p-5">
              <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Lo que podrás hacer</p>
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="message" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Responder a tus clientes</p>
                    <p class="text-xs text-neutral-500">Bandeja unificada por WhatsApp e Instagram con historial completo.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="tag" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Gestionar leads y pedidos</p>
                    <p class="text-xs text-neutral-500">Seguimiento por etapas, cierres y recordatorios para no perder ventas.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="box" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Catálogo con fichas técnicas</p>
                    <p class="text-xs text-neutral-500">Productos y servicios con detalle listo para enviar en el chat.</p>
                  </div>
                </div>
                <div class="flex items-start gap-3">
                  <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--accent)] text-white">
                    <ui-icon name="users" class="h-4 w-4"></ui-icon>
                  </span>
                  <div>
                    <p class="text-sm font-semibold">Equipo y métricas</p>
                    <p class="text-xs text-neutral-500">Roles con permisos y resumen del desempeño de tu negocio.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Cláusulas del convenio -->
            <div class="mt-5 space-y-2.5">
              <p class="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Al usar este espacio aceptas</p>
              <p v-for="(c, i) in ui.CONVENIO_CLAUSULAS" :key="i" class="flex items-start gap-2.5 text-sm text-neutral-600">
                <ui-icon name="check-circle" class="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"></ui-icon>
                <span>{{ c }}</span>
              </p>
            </div>

            <!-- Aceptación obligatoria -->
            <label class="mt-6 flex cursor-pointer items-start gap-3 border-2 p-4 transition"
              :class="form.accepted ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-300 hover:border-neutral-900'">
              <input type="checkbox" v-model="form.accepted" class="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
              <span class="text-sm font-medium">Acepto el convenio de uso y las políticas de datos de clientes.</span>
            </label>
            <p v-if="!form.accepted" class="mt-2 text-xs text-neutral-400">Debes aceptar el convenio para continuar con la configuración.</p>
          </section>

          <!-- 3 · Branding -->
          <section v-else-if="current === 3" class="bg-white p-8">
            <h2 class="text-2xl font-bold">Dale identidad a tu espacio</h2>
            <p class="mt-1 text-sm text-neutral-500">Nombre, slogan y color de marca. Siempre podrás cambiarlo en Configuración.</p>
            <div class="mt-6 grid gap-6 sm:grid-cols-2">
              <ui-field label="Nombre del negocio">
                <input v-model.trim="form.name" type="text" placeholder="Ej: Sabores de la Casa"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Slogan (opcional)">
                <input v-model.trim="form.slogan" type="text" placeholder="Ej: Cocina casera desde 1998"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
            </div>
            <div class="mt-6">
              <span class="mb-3 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">Color de marca</span>
              <div class="flex flex-wrap gap-3">
                <button v-for="a in ui.ACCENTS" :key="a.id" @click="form.accentId = a.id"
                  class="flex items-center gap-2 border-2 px-3 py-2 transition"
                  :class="form.accentId === a.id ? 'border-neutral-900 shadow-brutal-sm' : 'border-neutral-200'">
                  <span class="h-5 w-5 border border-black/10" :style="{ background: a.value }"></span>
                  <span class="text-xs font-medium">{{ a.nombre }}</span>
                </button>
              </div>
            </div>
            <div class="mt-6 flex flex-wrap items-center gap-4 border-2 border-dashed border-neutral-300 p-4">
              <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-white text-lg font-bold text-[var(--accent)] shadow-brutal-sm"
                :style="form.logo ? {} : { background: accent.value, color: '#fff' }">
                <img v-if="form.logo" :src="form.logo" :alt="'Logo de ' + (form.name || 'tu negocio')" class="h-full w-full object-contain" />
                <template v-else>{{ (form.name || 'T').trim().slice(0, 2).toUpperCase() }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ form.name || 'Nombre del negocio' }}</p>
                <p class="truncate text-sm text-neutral-500">{{ form.slogan || 'Tu slogan aquí' }}</p>
              </div>
              <div class="flex shrink-0 gap-2">
                <label class="cursor-pointer border-2 border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium shadow-brutal-sm transition hover:shadow-none">
                  {{ form.logo ? 'Reemplazar logo' : 'Subir logo' }}
                  <input type="file" accept="image/*" class="sr-only" @change="uploadLogo" />
                </label>
                <button v-if="form.logo" @click="removeLogo" class="border-2 border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-700">
                  Quitar logo
                </button>
              </div>
            </div>
          </section>

          <!-- 4 · Referencia -->
          <section v-else-if="current === 4" class="bg-white p-8">
            <h2 class="text-2xl font-bold">¿Quién nos recomendó?</h2>
            <p class="mt-1 text-sm text-neutral-500">Nos ayuda a mejorar nuestro servicio. Tus datos nunca se comparten.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-3">
              <button v-for="r in ui.REFERRERS" :key="r.id" @click="form.referrer = r.id"
                class="flex items-center gap-3 border-2 p-4 transition"
                :class="form.referrer === r.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 hover:border-neutral-900'">
                <ui-icon :name="r.icon" class="h-5 w-5" :class="form.referrer === r.id ? 'text-[var(--accent)]' : 'text-neutral-400'"></ui-icon>
                <span class="text-sm font-medium">{{ r.nombre }}</span>
              </button>
            </div>
            <ui-field v-if="form.referrer === 'referido' || form.referrer === 'otro'" label="Cuéntanos más" hint="Opcional">
              <input v-model.trim="form.referrerDetail" type="text" placeholder="Ej: María, clienta de la tienda"
                class="mt-2 w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
            </ui-field>
          </section>

          <!-- 5 · Canales -->
          <section v-else-if="current === 5" class="bg-white p-8">
            <h2 class="text-2xl font-bold">Conecta tus canales</h2>
            <p class="mt-1 text-sm text-neutral-500">WhatsApp ahora · Instagram próximamente. Todo desde un solo lugar.</p>

            <div class="mt-6 border border-neutral-200 bg-white p-5">
              <div class="mb-4 flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
                </span>
                <div>
                  <h3 class="font-semibold">Conecta el número de tu negocio</h3>
                  <p class="text-sm text-neutral-500">Meta te guía: autoriza con tu cuenta y verifica tu número con un código SMS. Sin pasos técnicos.</p>
                </div>
              </div>
              <live-connect :business-name="form.name" @connected="onLiveConnected"></live-connect>
              <p v-if="liveResult" class="mt-3 font-mono text-xs text-emerald-700">
                ✓ Número vinculado: {{ liveResult.phone }}
              </p>
            </div>

            <div class="mt-4 flex items-center gap-3 border border-dashed border-neutral-300 bg-stone-50 p-4">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-700">
                <ui-icon name="instagram" class="h-5 w-5"></ui-icon>
              </span>
              <div class="min-w-0">
                <p class="font-semibold">Instagram</p>
                <p class="text-sm text-neutral-500">Disponible próximamente en la configuración. Ya puedes gestionarlo desde Canales.</p>
              </div>
              <ui-badge variant="neutral" class="ml-auto shrink-0">Próximamente</ui-badge>
            </div>

            <!-- Clave de administración (solo si el centro no la dejó en sesión) -->
            <div v-if="!liveResult && !hasMasterKey" class="mt-4">
              <button @click="adminKeyOpen = !adminKeyOpen" class="text-sm font-medium text-neutral-500 underline">
                {{ adminKeyOpen ? '− Ocultar acceso de administración' : '+ Acceso de administración' }}
              </button>
              <div v-if="adminKeyOpen" class="mt-3 border border-neutral-200 bg-stone-50 p-4">
                <p class="text-xs text-neutral-500">
                  Clave de acceso de la plataforma (la proporciona tu proveedor). Sin ella no se puede crear el perfil del negocio.
                </p>
                <live-connect :business-name="form.name" @connected="onLiveConnected"></live-connect>
              </div>
            </div>

            <button @click="form.skipConnect = true; finish()" :disabled="creating"
              class="mt-6 text-sm font-medium text-neutral-500 underline transition hover:text-neutral-900">
              Configurar después (conectaré mi número desde Canales)
            </button>
          </section>

          <!-- 7 · Equipo -->
          <section v-else class="bg-white p-8">
            <h2 class="text-2xl font-bold">Tu equipo inicial</h2>
            <p class="mt-1 text-sm text-neutral-500">Crea tu cuenta de propietario y añade miembros sugeridos. Los permisos se gestionan después en Equipo.</p>
            <div class="mt-6 grid gap-4 sm:grid-cols-2">
              <ui-field label="Tu nombre">
                <input v-model.trim="form.ownerName" type="text" :placeholder="form.name || 'Tu nombre'"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
              <ui-field label="Tu correo">
                <input v-model.trim="form.ownerEmail" type="email" placeholder="tu@negocio.com"
                  class="w-full border-2 border-neutral-300 px-3 py-2 outline-none transition focus:border-neutral-900" />
              </ui-field>
            </div>
            <div class="mt-6 divide-y-2 divide-neutral-200 border-2 border-neutral-900">
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar :name="form.name || 'T'"></ui-avatar>
                  <div>
                    <p class="font-semibold">{{ form.ownerName || form.name || 'Propietario' }}</p>
                    <p class="text-xs text-neutral-500">{{ form.ownerEmail || 'propietario@demo.com' }}</p>
                  </div>
                </div>
                <ui-badge variant="accent">Propietario</ui-badge>
              </div>
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar name="María Fernández"></ui-avatar>
                  <div>
                    <p class="font-semibold">María Fernández</p>
                    <p class="text-xs text-neutral-500">maria@demo.com</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <ui-badge variant="neutral">Agente</ui-badge>
                  <ui-toggle v-model="form.inviteAgent" aria-label="Incluir agente"></ui-toggle>
                </div>
              </div>
              <div class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <ui-avatar name="José Pérez"></ui-avatar>
                  <div>
                    <p class="font-semibold">José Pérez</p>
                    <p class="text-xs text-neutral-500">jose@demo.com</p>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <ui-badge variant="neutral">Vendedor</ui-badge>
                  <ui-toggle v-model="form.inviteVendor" aria-label="Incluir vendedor"></ui-toggle>
                </div>
              </div>
            </div>
            <button @click="finish" :disabled="creating"
              class="mt-6 w-full border-2 border-neutral-900 bg-[var(--accent)] px-8 py-3 font-semibold text-white shadow-brutal transition hover:shadow-none disabled:opacity-60">
              <span v-if="creating" class="flex items-center justify-center gap-2">
                <ui-spinner class="h-4 w-4"></ui-spinner> Creando tu espacio de trabajo…
              </span>
              <span v-else>Crear mi espacio de trabajo →</span>
            </button>
          </section>
          </transition>

          <!-- Navegación inferior (sticky) -->
          <footer v-if="current > 0 && current < 6" class="sticky bottom-0 z-10 -mx-5 mt-8 flex items-center justify-between gap-3 border-t border-neutral-200 bg-stone-100/95 px-5 py-4 backdrop-blur lg:-mx-16 lg:px-16">
            <button @click="back" class="border-2 border-neutral-900 bg-white px-5 py-2.5 font-medium shadow-brutal-sm transition hover:shadow-none">
              ← Volver
            </button>
            <div class="flex items-center gap-3">
              <span class="hidden font-mono text-[10px] uppercase tracking-widest text-neutral-400 sm:block">Paso {{ current }}/{{ STEPS.length - 1 }}</span>
              <button @click="next" :disabled="!canContinue"
                class="border-2 border-neutral-900 bg-neutral-900 px-6 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
                Continuar →
              </button>
            </div>
          </footer>
            </div>
          </main>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
