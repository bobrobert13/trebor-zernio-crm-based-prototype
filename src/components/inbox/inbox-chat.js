/**
 * @file inbox-chat.js — BC Chat de la bandeja unificada: cabecera del hilo,
 * consejos de atención, mensajes con menciones de producto y el composer
 * (re-envía sus props/eventos a inbox-composer). Presentacional puro:
 * estado por props, acciones por eventos. Verbatim del bloque `<section>`.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const components = {};

  components['inbox-chat'] = {
    props: {
      selected: { type: Object, default: null }, selectedContact: { type: Object, default: null },
      backToList: Function, getPlatform: Function, formatTime: Function,
      attentionTips: Array, tipsOpen: Boolean,
      renderWhatsApp: Function, mentionsOfMessage: Function, productOf: Function,
      formatPrice: Function, openProductInfo: Function, openProductPick: Function,
      confirmMention: Function, discardMention: Function,
      // Composer (se re-envían a <inbox-composer>)
      canHumanAgent: Boolean, humanAgent: Boolean, blockedByWindow: Boolean,
      hasProducts: Boolean, sending: Boolean, quickReplies: Array,
      draft: String, cardAttach: { type: Object, default: null },
      cardGreeting: String, cardPreview: String,
      atOpen: Boolean, atResults: Array, atIndex: Number,
      openTemplatePicker: Function, openCardPicker: Function, detachCard: Function,
      onComposerKeydown: Function, pickMention: Function, send: Function,
    },
    emits: ['toggle-tips', 'open-ai', 'open-drawer',
      'update:draft', 'update:humanAgent', 'update:cardGreeting', 'update:atIndex'],
    template: `
      <section :class="['flex min-h-0 flex-col bg-stone-50', selected ? 'flex' : 'hidden lg:flex']">
        <!-- Estado vacío sin conversación seleccionada -->
        <div v-if="!selected" class="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
          <span class="flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
            <ui-icon name="whatsapp" class="h-8 w-8"></ui-icon>
          </span>
          <h3 class="text-lg font-semibold">Selecciona una conversación</h3>
          <p class="max-w-md text-sm text-neutral-500">Las consultas de tus clientes por WhatsApp aparecerán aquí.</p>
        </div>

        <template v-else>
          <!-- Header del chat -->
          <header class="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-5 py-3">
            <div class="flex items-center gap-3">
              <button class="lg:hidden" @click="backToList()" aria-label="Volver a la lista">
                <ui-icon name="chevron-left" class="h-5 w-5"></ui-icon>
              </button>
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                :class="(getPlatform(selected.platform || 'whatsapp') || {}).tone">
                <ui-icon :name="(getPlatform(selected.platform || 'whatsapp') || {}).icon" class="h-4 w-4"></ui-icon>
              </span>
              <ui-avatar :name="selectedContact ? selectedContact.name : '?'" size="h-10 w-10 text-sm"></ui-avatar>
              <div>
                <p class="font-semibold leading-tight">{{ selectedContact ? selectedContact.name : 'Contacto' }}
                  <span class="ml-1.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{{ (getPlatform(selected.platform || 'whatsapp') || {}).nombre }}</span>
                </p>
                <p class="font-mono text-[11px] uppercase tracking-wider text-neutral-400">{{ selectedContact ? selectedContact.phone : '' }}</p>
                <p v-if="selected.igProfile" class="font-mono text-[10px] text-neutral-400">
                  {{ selected.igProfile.isFollower ? '· te sigue' : '' }}{{ selected.igProfile.followerCount != null ? ' · ' + selected.igProfile.followerCount + ' seguidores' : '' }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5">
              <!-- Etiquetas vivas del contacto (no el snapshot de la conversación) -->
              <ui-badge v-for="t in (selectedContact ? selectedContact.tags : [])" :key="t" variant="neutral">{{ t }}</ui-badge>
              <ui-badge v-if="selectedContact && selectedContact.leadTag" variant="accent" dot>{{ selectedContact.leadTag }}</ui-badge>
              <button v-if="selectedContact" @click="$emit('open-ai')" class="flex items-center gap-1 rounded-full border border-[var(--accent)] px-2 py-1 text-[11px] font-bold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" aria-label="Asistente IA">
                <ui-icon name="sparkles" class="h-3.5 w-3.5"></ui-icon> IA
              </button>
              <button @click="$emit('open-drawer')" class="p-1.5 hover:text-[var(--accent)]" aria-label="Ficha del cliente">
                <ui-icon name="user" class="h-4 w-4"></ui-icon>
              </button>
            </div>
          </header>

          <!-- Consejos de atención al equipo -->
          <div v-if="attentionTips.length" class="shrink-0 border-b border-neutral-200 bg-amber-50/80">
            <button @click="$emit('toggle-tips')" class="flex w-full items-center gap-2 px-4 py-2 text-left text-xs font-semibold text-amber-900">
              <ui-icon name="alert" class="h-3.5 w-3.5 text-amber-700"></ui-icon>
              Consejos de atención · {{ attentionTips.length }}
              <ui-icon :name="tipsOpen ? 'chevron-up' : 'chevron-down'" class="ml-auto h-3.5 w-3.5 text-amber-700"></ui-icon>
            </button>
            <ul v-if="tipsOpen" class="space-y-1.5 px-4 pb-3">
              <li v-for="(t, i) in attentionTips" :key="i" class="flex items-start gap-2 text-xs text-amber-900">
                <ui-icon :name="t.icon" class="mt-0.5 h-3.5 w-3.5 shrink-0"></ui-icon>
                <span>{{ t.text }}</span>
              </li>
            </ul>
          </div>

          <!-- Mensajes -->
          <div class="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-5">
            <div v-for="m in selected.messages" :key="m.id" class="space-y-1.5" :class="m.from === 'out' ? 'flex flex-col items-end' : 'flex flex-col items-start'">
              <div class="flex max-w-[70%] px-4 py-2.5 shadow-sm"
                :class="m.from === 'out'
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-neutral-200 bg-white'">
                <p v-if="m.card" class="wa-rich whitespace-pre-wrap break-words text-[15px] leading-relaxed" v-html="renderWhatsApp(m.text)"></p>
                <p v-else class="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{{ m.text }}</p>
                <div class="mt-1 flex items-center justify-end gap-1.5">
                  <span class="font-mono text-[10px] uppercase tracking-wider opacity-60">{{ formatTime(m.ts) }}</span>
                  <ui-icon v-if="m.from === 'out'" name="check" class="h-3 w-3"
                    :class="m.status === 'read' ? 'text-emerald-400' : m.status === 'failed' ? 'text-red-400' : 'opacity-60'"></ui-icon>
                </div>
              </div>
              <!-- Feedback de productos detectados en el mensaje entrante -->
              <div v-for="men in mentionsOfMessage(m.id)" :key="men.id" class="max-w-[85%] text-xs"
                :class="men.match === 'exacta'
                  ? 'flex items-center gap-2 border border-emerald-700 bg-emerald-50 px-2.5 py-1.5 text-emerald-900'
                  : 'border border-amber-600 bg-amber-50 px-2.5 py-1.5 text-amber-900'">
                <template v-if="men.match === 'exacta'">
                  <span class="flex items-center gap-1"><ui-icon name="check-circle" class="h-3.5 w-3.5"></ui-icon> Producto detectado: <strong>{{ productOf(men) ? productOf(men).name : '—' }}</strong></span>
                  <template v-if="productOf(men)">
                    <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(productOf(men).price) }}</span>
                    <span :class="productOf(men).stock === false ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'">{{ productOf(men).stock === false ? 'AGOTADO' : 'Disponible' }}</span>
                    <button @click="openProductInfo(productOf(men))" class="font-semibold underline">Ver más</button>
                  </template>
                  <button @click="openProductPick(men.id)" class="font-semibold underline">Cambiar</button>
                </template>
                <template v-else>
                  <span>Posible producto: <strong>{{ productOf(men) ? productOf(men).name : '—' }}</strong> (coincidencia parcial)</span>
                  <template v-if="productOf(men)">
                    <span class="font-mono text-[10px] tabular-nums">{{ formatPrice(productOf(men).price) }}</span>
                    <span :class="productOf(men).stock === false ? 'font-semibold text-red-700' : 'font-semibold text-emerald-700'">{{ productOf(men).stock === false ? 'AGOTADO' : 'Disponible' }}</span>
                    <button @click="openProductInfo(productOf(men))" class="font-semibold underline">Ver más</button>
                  </template>
                  <span class="flex gap-2">
                    <button v-if="productOf(men)" @click="confirmMention(men.id, men.productId)" class="font-semibold underline">Sí, ese</button>
                    <button @click="openProductPick(men.id)" class="font-semibold underline">Elegir otro</button>
                    <button @click="discardMention(men.id)" class="underline">Descartar</button>
                  </span>
                </template>
              </div>
            </div>
          </div>

          <!-- Composer (BC Composer, componente propio) -->
          <inbox-composer :selected="selected" :can-human-agent="canHumanAgent" :human-agent="humanAgent"
            :blocked-by-window="blockedByWindow" :has-products="hasProducts" :sending="sending"
            :quick-replies="quickReplies" :draft="draft" :card-attach="cardAttach"
            :card-greeting="cardGreeting" :card-preview="cardPreview"
            :at-open="atOpen" :at-results="atResults" :at-index="atIndex"
            :format-price="formatPrice" :open-template-picker="openTemplatePicker"
            :open-card-picker="openCardPicker" :detach-card="detachCard"
            :on-composer-keydown="onComposerKeydown" :pick-mention="pickMention" :send="send"
            @update:draft="$emit('update:draft', $event)"
            @update:human-agent="$emit('update:humanAgent', $event)"
            @update:card-greeting="$emit('update:cardGreeting', $event)"
            @update:at-index="$emit('update:atIndex', $event)"></inbox-composer>
        </template>
      </section>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();