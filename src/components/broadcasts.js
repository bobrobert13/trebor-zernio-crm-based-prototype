/**
 * @file broadcasts.js — Campañas y plantillas de WhatsApp.
 * Plantillas vienen de Meta Cloud API (aprobación requerida para
 * mensajes fuera de la ventana de 24h); broadcasts se simulan en demo.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { store, toast, formatDate, formatTime, uid, canEdit } = ZernioCrm;

  const components = {};

  /** Estados de plantilla → variante de badge. */
  const TEMPLATE_TONES = { APPROVED: 'success', PENDING: 'warn', REJECTED: 'danger' };

  components['broadcasts-view'] = {
    setup() {
      const createOpen = Vue.ref(false);
      const sending = Vue.ref(false);
      const form = Vue.reactive({ name: '', templateId: null, tag: null });

      const workspace = Vue.computed(() => store.workspace);
      const niche = Vue.computed(() => ZernioCrm.getNiche(workspace.value && workspace.value.nicheId));
      const templates = Vue.computed(() => workspace.value.templates || []);
      const broadcasts = Vue.computed(() => workspace.value.broadcasts || []);

      /** Temporizadores activos (cleanup en onUnmounted). */
      const timers = [];
      Vue.onUnmounted(() => timers.forEach(clearTimeout));

      /** Simula el envío de un broadcast y lo agrega a la lista. */
      function createBroadcast() {
        if (!form.name.trim() || !form.templateId || sending.value) return;
        sending.value = true;
        const total = 80 + ((Math.random() * 140) | 0);
        const timer = setTimeout(() => {
          workspace.value.broadcasts.unshift({
            id: uid('bc'),
            name: form.name.trim(),
            audience: form.tag ? `Contactos con tag "${form.tag}"` : 'Todos los contactos activos',
            status: 'sent',
            sentAt: Date.now(),
            stats: { total, delivered: Math.round(total * 0.92), failed: total - Math.round(total * 0.92) },
          });
          sending.value = false;
          createOpen.value = false;
          Object.assign(form, { name: '', templateId: null, tag: null });
          toast('Campaña enviada (simulación)', 'success');
        }, 1300);
        timers.push(timer);
      }

      return {
        createOpen, sending, form, workspace, niche, templates, broadcasts, TEMPLATE_TONES,
        canEdit, createBroadcast, formatDate, formatTime,
      };
    },

    template: `
      <div class="space-y-6">
        <!-- Encabezado -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold">Campañas</h2>
            <p class="mt-1 text-sm text-neutral-500">Mensajes masivos y plantillas aprobadas por Meta para WhatsApp.</p>
          </div>
          <button v-if="canEdit('broadcasts')" @click="createOpen = true"
            class="flex items-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="megaphone" class="h-4 w-4"></ui-icon> Nueva campaña
          </button>
        </header>

        <!-- Broadcasts -->
        <section>
          <h3 class="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Broadcasts</h3>
          <div v-if="broadcasts.length === 0" class="border-2 border-dashed border-neutral-300 bg-white">
            <ui-empty icon="megaphone" title="Sin campañas" desc="Crea tu primera campaña masiva por WhatsApp."></ui-empty>
          </div>
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <article v-for="b in broadcasts" :key="b.id" class="border-2 border-neutral-900 bg-white p-4">
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-semibold">{{ b.name }}</h4>
                <ui-badge :variant="b.status === 'sent' ? 'success' : 'warn'" dot>
                  {{ b.status === 'sent' ? 'Enviada' : 'Programada' }}
                </ui-badge>
              </div>
              <p class="mt-1 text-xs text-neutral-500">{{ b.audience }}</p>
              <p class="mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                {{ b.status === 'sent' ? 'Enviada ' + formatDate(b.sentAt) + ' · ' + formatTime(b.sentAt) : 'Programada ' + formatDate(b.sentAt) }}
              </p>
              <div v-if="b.stats" class="mt-3 flex gap-4 border-t border-neutral-100 pt-3 font-mono text-[11px] tabular-nums text-neutral-500">
                <span>{{ b.stats.total }} destinatarios</span>
                <span class="text-emerald-700">{{ b.stats.delivered }} entregados</span>
                <span v-if="b.stats.failed" class="text-red-700">{{ b.stats.failed }} fallidos</span>
              </div>
            </article>
          </div>
        </section>

        <!-- Plantillas -->
        <section>
          <h3 class="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Plantillas de WhatsApp</h3>
          <p class="mb-3 text-xs text-neutral-500">
            Fuera de la ventana de 24h de servicio, WhatsApp exige plantillas aprobadas por Meta (categoría UTILITY o MARKETING).
          </p>
          <div class="overflow-x-auto border-2 border-neutral-900 bg-white">
            <table class="w-full min-w-[560px] text-left text-sm">
              <thead class="border-b-2 border-neutral-900 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                <tr>
                  <th class="px-4 py-3">Nombre</th>
                  <th class="px-4 py-3">Categoría</th>
                  <th class="px-4 py-3">Idioma</th>
                  <th class="px-4 py-3">Estado</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                <tr v-for="t in templates" :key="t.id" class="hover:bg-stone-50">
                  <td class="px-4 py-3 font-mono text-xs">{{ t.name }}</td>
                  <td class="px-4 py-3">
                    <ui-badge variant="neutral">{{ t.category }}</ui-badge>
                  </td>
                  <td class="px-4 py-3 font-mono text-xs uppercase text-neutral-500">{{ t.language }}</td>
                  <td class="px-4 py-3">
                    <ui-badge :variant="TEMPLATE_TONES[t.status] || 'neutral'" dot>{{ t.status }}</ui-badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- Modal nueva campaña -->
        <ui-modal :open="createOpen" title="Nueva campaña" @close="createOpen = false">
          <div class="space-y-4">
            <ui-field label="Nombre de la campaña">
              <input v-model.trim="form.name" type="text" placeholder="Ej: Promoción de fin de semana"
                class="w-full border-2 border-neutral-300 px-3 py-2 outline-none focus:border-neutral-900" />
            </ui-field>
            <ui-field label="Plantilla" hint="Solo plantillas APROBADAS pueden salir de la ventana de 24h.">
              <select v-model="form.templateId" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                <option :value="null" disabled>Elige una plantilla…</option>
                <option v-for="t in templates" :key="t.id" :value="t.id">{{ t.name }} ({{ t.status }})</option>
              </select>
            </ui-field>
            <ui-field label="Audiencia">
              <select v-model="form.tag" class="w-full border-2 border-neutral-300 bg-white px-3 py-2 outline-none focus:border-neutral-900">
                <option :value="null">Todos los contactos activos</option>
                <option v-for="t in niche.tags" :key="t" :value="t">Contactos con tag "{{ t }}"</option>
              </select>
            </ui-field>
            <button @click="createBroadcast" :disabled="!form.name.trim() || !form.templateId || sending"
              class="flex w-full items-center justify-center gap-2 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2.5 font-semibold text-white shadow-brutal-sm transition hover:shadow-none disabled:opacity-40">
              <ui-spinner v-if="sending" size="h-4 w-4"></ui-spinner>
              {{ sending ? 'Enviando…' : 'Enviar campaña' }}
            </button>
          </div>
        </ui-modal>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
