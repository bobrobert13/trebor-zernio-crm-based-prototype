/**
 * @file onboarding.js — Wizard de configuración inicial (8 pasos).
 * Paso 1→nicho, 2→foco, 3→branding, 4→referencia, 5→roadmap (con
 * simulación de configuración), 6→conexión WhatsApp (simulada),
 * 7→equipo inicial. Incluye pantallas de carga simuladas para el flujo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, applyAccent, navigate } = ZernioCrm;

  const STEPS = ['Bienvenida', 'Nicho', 'Foco', 'Marca', 'Referencia', 'Roadmap', 'WhatsApp', 'Equipo'];

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
      });

      const current = Vue.ref(0);
      const enterLoading = Vue.ref(false);
      const creating = Vue.ref(false);

      /** Pasos del roadmap copiados (con estado de simulación local). */
      const roadmapItems = Vue.ref([]);
      const roadmapSim = Vue.reactive({ running: false, current: null, progress: 0, done: 0 });

      /** Simulación de conexión WhatsApp. */
      const waSim = Vue.reactive({ running: false, stepIndex: 0, done: false });
      const waModal = Vue.ref(false);
      const waModality = Vue.ref(null);

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

      /** Items del roadmap incluidos en la configuración (obligatorios + opcionales marcados). */
      const selectedRoadmap = Vue.computed(() => roadmapItems.value.filter((r) => !r.optional || r.checked));

      /** ¿Es válido el paso actual para continuar? */
      const canContinue = Vue.computed(() => {
        switch (current.value) {
          case 1: return Boolean(form.nicheId);
          case 3: return form.name.trim().length > 0;
          case 4: return Boolean(form.referrer);
          case 6: return Boolean(waModality.value) && waSim.done;
          case 7: return !creating.value;
          default: return true;
        }
      });

      const progressPercent = Vue.computed(() => {
        const total = selectedRoadmap.value.length;
        if (total === 0) return 0;
        return ((roadmapSim.done + roadmapSim.progress / 100) / total) * 100;
      });

      /** Al elegir nicho se precargan foco, roadmap y sugerencia de nombre. */
      function selectNiche(id) {
        form.nicheId = id;
        const n = ZernioCrm.getNiche(id);
        form.focus = n.focusDefault;
        form.name = n.id === 'personalizado' ? '' : `Mi ${n.nombre.toLowerCase()}`;
        roadmapItems.value = n.roadmap.map((r) => ({ ...r, checked: r.optional ? false : true, simState: 'pending' }));
        resetRoadmapSim();
      }

      /** Reinicia el estado de la simulación del roadmap. */
      function resetRoadmapSim() {
        roadmapSim.running = false;
        roadmapSim.current = null;
        roadmapSim.progress = 0;
        roadmapSim.done = 0;
      }

      function jumpTo(i) {
        if (i < current.value && !roadmapSim.running && !waSim.running) current.value = i;
      }

      function next() {
        if (!canContinue.value) return;
        const target = current.value + 1;
        if (target === 1) {
          enterLoading.value = true;
          later(() => { enterLoading.value = false; current.value = 1; }, 700);
          return;
        }
        if (target === 5) runRoadmapSimulation();
        current.value = target;
      }

      function back() {
        if (current.value > 0 && !roadmapSim.running && !waSim.running && !creating.value) current.value -= 1;
      }

      /**
       * Simula la configuración secuencial del roadmap del nicho:
       * cada item pasa por pending → running (barra de progreso) → done.
       */
      async function runRoadmapSimulation() {
        if (roadmapSim.running) return;
        resetRoadmapSim();
        roadmapSim.running = true;
        const items = selectedRoadmap.value;
        for (const item of items) {
          item.simState = 'running';
          roadmapSim.current = item;
          await new Promise((resolve) => {
            let p = 0;
            const tick = setInterval(() => {
              p += 12 + Math.random() * 22;
              if (p >= 100) { clearInterval(tick); resolve(); }
              roadmapSim.progress = p;
            }, 110);
            timers.push(tick);
          });
          item.simState = 'done';
          roadmapSim.done += 1;
          roadmapSim.progress = 0;
        }
        roadmapSim.running = false;
        roadmapSim.current = null;
        toast('Roadmap del negocio configurado', 'success');
      }

      function openWaCard(id) {
        waModality.value = id;
        waSim.stepIndex = 0;
        waSim.done = false;
        waModal.value = true;
      }

      /** Simula el flujo de conexión de la modalidad elegida. */
      function connectWhatsApp() {
        const modality = ZernioCrm.WHATSAPP_MODALITIES.find((m) => m.id === waModality.value);
        if (!modality || waSim.running) return;
        waSim.running = true;
        modality.pasos.forEach((_, i) => {
          later(() => { waSim.stepIndex = i + 1; }, (i + 1) * 1100);
        });
        later(() => {
          waSim.running = false;
          waSim.done = true;
          toast('Número WhatsApp conectado (simulación)', 'success');
        }, (modality.pasos.length + 1) * 1100);
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
          store.workspace = ws;
          store.currentUser = ws.users.find((u) => u.role === 'owner');
          applyAccent(ws);
          toast(`¡${ws.name} está listo!`, 'success');
          navigate('dashboard');
        }, 1400);
      }

      return {
        STEPS, form, current, enterLoading, creating, niche, accent,
        roadmapItems, roadmapSim, selectedRoadmap, progressPercent,
        waSim, waModal, waModality,
        selectNiche, jumpTo, next, back, openWaCard, connectWhatsApp, finish,
        canContinue,
        ui: ZernioCrm,
      };
    },

    template: `
      <div class="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4 py-10">
        <header class="mb-8 flex w-full max-w-3xl items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 items-center justify-center bg-[var(--accent)] text-white shadow-brutal-sm">
              <ui-icon name="whatsapp" class="h-5 w-5"></ui-icon>
            </span>
            <div>
              <h1 class="text-lg font-bold leading-tight">{{ ui.BRAND }}</h1>
              <p class="font-mono text-[11px] uppercase tracking-widest text-neutral-400">Configuración inicial</p>
            </div>
          </div>
          <ui-stepper v-if="current > 0" :steps="STEPS" :current="current" @jump="jumpTo"></ui-stepper>
        </header>

        <main class="w-full max-w-3xl">
          <!-- Pantalla de carga al pasar de bienvenida a nicho -->
          <div v-if="enterLoading" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
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
          <section v-else-if="current === 0" class="border-2 border-neutral-900 bg-white p-10 text-center shadow-brutal">
            <span class="mx-auto mb-6 flex h-16 w-16 items-center justify-center bg-[var(--accent)] text-white shadow-brutal">
              <ui-icon name="whatsapp" class="h-8 w-8"></ui-icon>
            </span>
            <h2 class="text-3xl font-bold">Tu atención al cliente por WhatsApp</h2>
            <p class="mx-auto mt-3 max-w-md text-neutral-500">
              Configura tu espacio de trabajo en minutos: elige tu tipo de negocio, tu marca y
              conecta WhatsApp. Sin fricción, sin módulos que no necesitas.
            </p>
            <button @click="next" class="mt-8 border-2 border-neutral-900 bg-[var(--accent)] px-8 py-3 font-semibold text-white shadow-brutal transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none">
              Comenzar →
            </button>
          </section>

          <!-- 1 · Nicho -->
          <section v-else-if="current === 1" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
            <h2 class="text-2xl font-bold">¿A qué se dedica tu negocio?</h2>
            <p class="mt-1 text-sm text-neutral-500">Elige el modelo más parecido: ajustamos campos, plantillas y roadmap de configuración.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <button v-for="n in ui.NICHES" :key="n.id" @click="selectNiche(n.id)"
                class="border-2 p-4 text-left transition"
                :class="form.nicheId === n.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 bg-white hover:border-neutral-900'">
                <div class="flex items-center justify-between">
                  <span class="text-2xl">{{ n.emoji }}</span>
                  <ui-icon v-if="form.nicheId === n.id" name="check-circle" class="h-5 w-5 text-[var(--accent)]"></ui-icon>
                </div>
                <h3 class="mt-3 font-semibold">{{ n.nombre }}</h3>
                <p class="mt-1 text-xs text-neutral-500">{{ n.descripcion }}</p>
              </button>
              <button @click="selectNiche('personalizado')"
                class="border-2 border-dashed p-4 text-left transition hover:border-neutral-900"
                :class="form.nicheId === 'personalizado' ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-300'">
                <span class="text-2xl">✨</span>
                <h3 class="mt-3 font-semibold">Otro / Personalizado</h3>
                <p class="mt-1 text-xs text-neutral-500">Configuración genérica adaptable a cualquier negocio.</p>
              </button>
            </div>
          </section>

          <!-- 2 · Foco -->
          <section v-else-if="current === 2" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
            <h2 class="text-2xl font-bold">¿En qué se enfocará tu equipo?</h2>
            <p class="mt-1 text-sm text-neutral-500">Pre-seleccionamos la mejor opción para {{ niche.nombre.toLowerCase() }}, puedes cambiarla.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-3">
              <button v-for="f in ui.FOCUS_MODES" :key="f.id" @click="form.focus = f.id"
                class="flex flex-col items-center gap-2 border-2 p-5 text-center transition"
                :class="form.focus === f.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 hover:border-neutral-900'">
                <ui-icon :name="f.icon" class="h-6 w-6" :class="form.focus === f.id ? 'text-[var(--accent)]' : 'text-neutral-400'"></ui-icon>
                <h3 class="font-semibold">{{ f.nombre }}</h3>
                <p class="text-xs text-neutral-500">{{ f.desc }}</p>
              </button>
            </div>
          </section>

          <!-- 3 · Branding -->
          <section v-else-if="current === 3" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
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
            <div class="mt-6 flex items-center gap-4 border-2 border-dashed border-neutral-300 p-4">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center text-lg font-bold text-white" :style="{ background: accent.value }">
                {{ (form.name || 'T').trim().slice(0, 2).toUpperCase() }}
              </span>
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ form.name || 'Nombre del negocio' }}</p>
                <p class="truncate text-sm text-neutral-500">{{ form.slogan || 'Tu slogan aquí' }}</p>
              </div>
            </div>
          </section>

          <!-- 4 · Referencia -->
          <section v-else-if="current === 4" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
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

          <!-- 5 · Roadmap (simulación de configuración) -->
          <section v-else-if="current === 5" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
            <div class="flex items-center justify-between gap-4">
              <div>
                <h2 class="text-2xl font-bold">Roadmap de {{ niche.nombre }}</h2>
                <p class="mt-1 text-sm text-neutral-500">Lo que vamos a configurar para tu negocio. Marca o desmarca lo opcional.</p>
              </div>
              <ui-badge variant="accent">{{ selectedRoadmap.length }} pasos</ui-badge>
            </div>

            <div class="mt-6 space-y-2">
              <div v-for="item in roadmapItems" :key="item.id"
                class="flex items-start gap-3 border-2 p-3 transition"
                :class="item.simState === 'done' ? 'border-emerald-800 bg-emerald-50'
                  : item.simState === 'running' ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                  : item.checked ? 'border-neutral-900 bg-white' : 'border-neutral-200 bg-white opacity-60'">
                <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center">
                  <ui-spinner v-if="item.simState === 'running'" size="h-4 w-4" class="text-[var(--accent)]"></ui-spinner>
                  <ui-icon v-else-if="item.simState === 'done'" name="check-circle" class="h-5 w-5 text-emerald-700"></ui-icon>
                  <ui-icon v-else :name="ui.ROADMAP_TYPES[item.type].icon" class="h-5 w-5 text-neutral-400"></ui-icon>
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="font-semibold">{{ item.title }}</h3>
                    <ui-badge variant="neutral">{{ ui.ROADMAP_TYPES[item.type].label }}</ui-badge>
                    <span v-if="item.optional" class="font-mono text-[10px] uppercase tracking-wider text-neutral-400">opcional</span>
                  </div>
                  <p class="text-sm text-neutral-500">{{ item.desc }}</p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1">
                  <span class="font-mono text-[10px] uppercase text-neutral-400">{{ item.estimated }}</span>
                  <button v-if="item.optional && !roadmapSim.running" @click="item.checked = !item.checked"
                    class="border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                    :class="item.checked ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-neutral-300'">
                    {{ item.checked ? 'Incluido' : 'Excluir' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Pantalla de carga: configuración secuencial -->
            <div v-if="roadmapSim.running" class="mt-6 border-2 border-neutral-900 bg-neutral-900 p-5 text-white">
              <div class="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest">
                <span>Configurando: {{ roadmapSim.current ? roadmapSim.current.title : '…' }}</span>
                <span class="tabular-nums">{{ Math.round(progressPercent) }}%</span>
              </div>
              <div class="mt-3 h-2 border border-white/30 bg-white/10">
                <div class="h-full bg-[var(--accent)] transition-all duration-150" :style="{ width: progressPercent + '%' }"></div>
              </div>
              <p class="mt-3 text-xs text-neutral-300">Simulación de configuración del entorno. En producción esto llama a la API de Zernio.</p>
            </div>
          </section>

          <!-- 6 · WhatsApp -->
          <section v-else-if="current === 6" class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
            <h2 class="text-2xl font-bold">Conecta tu WhatsApp</h2>
            <p class="mt-1 text-sm text-neutral-500">Elige la modalidad que Zernio ofrece para tu número. En este prototipo todas se simulan.</p>
            <div class="mt-6 grid gap-3 sm:grid-cols-2">
              <button v-for="m in ui.WHATSAPP_MODALITIES" :key="m.id" @click="openWaCard(m.id)"
                class="border-2 p-4 text-left transition"
                :class="waModality === m.id ? 'border-[var(--accent)] bg-[var(--accent-soft)] shadow-brutal-sm' : 'border-neutral-200 hover:border-neutral-900'">
                <div class="flex items-center justify-between">
                  <ui-icon :name="m.icon" class="h-6 w-6 text-[var(--accent)]"></ui-icon>
                  <ui-badge v-if="m.id === 'demo'" variant="success" dot>Recomendado</ui-badge>
                </div>
                <h3 class="mt-3 font-semibold">{{ m.nombre }}</h3>
                <p class="mt-1 text-xs text-neutral-500">{{ m.desc }}</p>
              </button>
            </div>
          </section>

          <!-- 7 · Equipo -->
          <section v-else class="border-2 border-neutral-900 bg-white p-8 shadow-brutal">
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

          <!-- Navegación inferior -->
          <footer v-if="current > 0 && current < 7" class="mt-4 flex items-center justify-between">
            <button @click="back" class="border-2 border-neutral-900 bg-white px-5 py-2.5 font-medium shadow-brutal-sm transition hover:shadow-none">
              ← Volver
            </button>
            <button @click="next" :disabled="!canContinue"
              class="border-2 border-neutral-900 bg-neutral-900 px-6 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              Continuar →
            </button>
          </footer>
        </main>

        <!-- Modal de conexión WhatsApp -->
        <ui-modal :open="waModal" :title="'Conectar · ' + (waModality ? (ui.WHATSAPP_MODALITIES.find(m => m.id === waModality) || {}).nombre : '')" @close="waModal = false">
          <div v-if="waModality" class="space-y-4">
            <div class="space-y-2">
              <div v-for="(paso, i) in (ui.WHATSAPP_MODALITIES.find(m => m.id === waModality) || {}).pasos" :key="i"
                class="flex items-center gap-3 border-2 p-3 transition"
                :class="waSim.stepIndex > i ? 'border-emerald-800 bg-emerald-50' : waSim.stepIndex === i ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-neutral-200'">
                <ui-spinner v-if="waSim.running && waSim.stepIndex === i" size="h-4 w-4" class="text-[var(--accent)]"></ui-spinner>
                <ui-icon v-else-if="waSim.stepIndex > i" name="check" class="h-4 w-4 text-emerald-700"></ui-icon>
                <span v-else class="font-mono text-xs tabular-nums text-neutral-400">{{ i + 1 }}</span>
                <span class="text-sm" :class="waSim.stepIndex > i ? 'text-emerald-900' : ''">{{ paso }}</span>
              </div>
            </div>
            <div v-if="waSim.done" class="flex items-center gap-2 border-2 border-emerald-800 bg-emerald-50 p-3 text-sm font-medium text-emerald-900">
              <ui-icon name="check-circle" class="h-5 w-5"></ui-icon>
              Número conectado: {{ ui.DEMO_PHONE }}
            </div>
            <button v-if="!waSim.done" @click="connectWhatsApp" :disabled="waSim.running"
              class="w-full border-2 border-neutral-900 bg-[var(--accent)] px-6 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-60">
              {{ waSim.running ? 'Conectando…' : 'Conectar' }}
            </button>
            <p class="text-xs text-neutral-400">
              Prototipo: el flujo se simula. En modo live se abre la autorización de Meta o se validan credenciales contra la API de Zernio.
            </p>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
