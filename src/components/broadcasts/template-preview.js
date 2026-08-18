/**
 * @file template-preview.js — Preview gráfico de una plantilla de WhatsApp:
 * burbuja simulada con header/body/footer/botones y panel de información.
 * Robusto ante plantillas sin body (solo media o interactivas). Componente
 * compartido (también lo usa inbox); registro global sin cambios.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['template-preview'] = {
    props: { tpl: { type: Object, required: true } },
    setup(props) {
      const comps = props.tpl.components || [];
      const body = comps.find((c) => c.type === 'body') || {};
      const header = comps.find((c) => c.type === 'header') || {};
      const footer = comps.find((c) => c.type === 'footer') || {};
      const buttons = (comps.find((c) => c.type === 'buttons') || {}).buttons || [];

      /** Sustituye {{n}} por los ejemplos de Meta (o deja la variable visible). */
      function fill(text, example) {
        const list = Array.isArray(example) ? example : [];
        return String(text || '').replace(/\{\{(\d+)\}\}/g, (_, n) => list[Number(n) - 1] || `{{${n}}}`);
      }

      const bodyText = Vue.computed(() => fill(props.tpl.body || body.text || '', (body.example || {}).body_text?.[0]));
      const headerText = Vue.computed(() => fill(header.text || '', (header.example || {}).header_text?.[0]));
      const footerText = Vue.computed(() => fill(footer.text || '', null));
      const hasBody = Vue.computed(() => Boolean(String(bodyText.value).trim()));
      const headerFormat = Vue.computed(() => (header.format ? String(header.format).toLowerCase() : ''));
      const variables = Vue.computed(() => ZernioCrm.makeTemplateVars(props.tpl.body || body.text || ''));
      /** Envelope sin componentes ni body: no hay nada que renderizar. */
      const noComponents = Vue.computed(() => !comps.length && !props.tpl.body);
      return { bodyText, headerText, footerText, buttons, fill, hasBody, headerFormat, variables, noComponents };
    },
    template: `
      <div class="grid gap-5 sm:grid-cols-2">
        <!-- Burbuja de WhatsApp simulada -->
        <div class="rounded-lg bg-[#efeae2] p-4">
          <div class="mx-auto max-w-[300px]">
            <div class="mb-1.5 text-center font-mono text-[9px] uppercase tracking-widest text-neutral-400">Vista previa en WhatsApp</div>
            <div class="rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 shadow-sm">
              <!-- Header: texto o media -->
              <div v-if="headerText" class="border-b border-neutral-100 pb-1.5">
                <span v-if="headerFormat" class="mr-1.5 border px-1 py-px font-mono text-[8px] uppercase" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
                  {{ headerFormat === 'image' ? 'Imagen' : headerFormat === 'video' ? 'Video' : 'Documento' }}
                </span>
                <p class="text-xs font-semibold text-neutral-500">{{ headerText }}</p>
              </div>
              <div v-else-if="headerFormat" class="border-b border-neutral-100 pb-1.5">
                <span class="border px-1.5 py-px font-mono text-[8px] uppercase" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
                  {{ headerFormat === 'image' ? 'Imagen adjunta' : headerFormat === 'video' ? 'Video adjunto' : 'Documento adjunto' }}
                </span>
              </div>
              <!-- Body: texto o placeholder claro -->
              <p v-if="hasBody" class="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{{ bodyText }}</p>
              <p v-else class="mt-1 rounded border border-dashed border-neutral-300 bg-stone-50 px-2 py-2 text-center text-xs text-neutral-400">
                {{ headerFormat ? 'Esta plantilla no tiene texto: usa el ' + (headerFormat === 'image' ? 'adjunto' : headerFormat) + ' o los botones para comunicar.' : 'Plantilla sin contenido de texto definido.' }}
              </p>
              <p v-if="footerText" class="mt-1 text-[11px] text-neutral-400">{{ footerText }}</p>
              <div v-if="buttons.length" class="mt-2 space-y-1.5 border-t border-neutral-100 pt-2">
                <div v-for="(b, i) in buttons" :key="i" class="rounded-md border px-3 py-1.5 text-center text-xs font-medium"
                  :class="b.type === 'url' ? 'border-sky-600 text-sky-700' : b.type === 'phone_number' ? 'border-emerald-700 text-emerald-800' : 'border-neutral-300 text-neutral-700'">
                  {{ b.text || b.url || b.phone_number || 'Botón' }}
                </div>
              </div>
            </div>
            <p class="mt-1.5 text-right font-mono text-[9px] text-neutral-400">WhatsApp · ahora</p>
          </div>
        </div>
        <!-- Información de la plantilla -->
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Nombre</p>
              <p class="mt-0.5 break-all font-mono text-xs font-semibold">{{ tpl.name }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Categoría</p>
              <p class="mt-0.5 text-xs font-semibold">{{ tpl.category }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Idioma</p>
              <p class="mt-0.5 text-xs font-semibold">{{ tpl.language }}</p>
            </div>
            <div class="border border-neutral-200 p-3">
              <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Estado</p>
              <p class="mt-0.5 text-xs font-semibold" :class="tpl.status === 'APPROVED' ? 'text-emerald-700' : tpl.status === 'draft' ? 'text-neutral-500' : 'text-amber-700'">{{ tpl.status }}</p>
            </div>
          </div>
          <!-- Desglose de componentes -->
          <p v-if="noComponents" class="border border-dashed border-neutral-400 bg-stone-50 px-3 py-2 text-xs text-neutral-500">
            Sin componentes definidos en esta plantilla.
          </p>
          <div v-else class="flex flex-wrap gap-1.5">
            <span v-if="headerFormat" class="border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider" :class="headerFormat === 'image' ? 'border-sky-700 text-sky-700' : headerFormat === 'video' ? 'border-violet-700 text-violet-700' : 'border-amber-700 text-amber-800'">
              Header {{ headerFormat === 'image' ? 'imagen' : headerFormat === 'video' ? 'video' : 'documento' }}
            </span>
            <span v-if="hasBody" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">Body texto</span>
            <span v-else class="border border-dashed border-neutral-400 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">Sin body</span>
            <span v-if="footerText" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">Footer</span>
            <span v-if="buttons.length" class="border border-neutral-300 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">{{ buttons.length }} botón(es)</span>
          </div>
          <div v-if="variables.length" class="border border-neutral-200 p-3">
            <p class="font-mono text-[9px] uppercase tracking-widest text-neutral-400">Variables (se llenan al enviar)</p>
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span v-for="v in variables" :key="v" class="border border-neutral-300 bg-stone-50 px-2 py-0.5 font-mono text-[10px]">{{ v }}</span>
            </div>
          </div>
          <p v-if="tpl.status === 'draft'" class="border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Borrador local: aún no fue enviado a Meta. Pulsa "Enviar a aprobación" para iniciar la revisión (hasta 24 h).
          </p>
          <p v-else-if="tpl.status === 'PENDING'" class="border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            En revisión de Meta: puede tardar hasta 24 h. Podrás usarla cuando esté aprobada.
          </p>
          <p v-else-if="tpl.status === 'REJECTED'" class="border border-red-700 bg-red-50 px-3 py-2 text-xs text-red-800">
            Rechazada por Meta: revisa el motivo y crea una nueva versión.
          </p>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();