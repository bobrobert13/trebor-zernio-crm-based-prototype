/**
 * @file ui.js — Primitivas de interfaz reutilizables del MVP.
 * Registradas en window.ZernioCrm.components y montadas por app.js.
 * Estética: minimalista-elegante con acentos brutalistas (bordes duros,
 * sombras offset) y acento de marca vía variable CSS --accent.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;
  const { ICONS, store } = ZernioCrm;
  const components = {};

  /** Conjunto de tonos para avatares (ciclo por hash del nombre). */
  const AVATAR_TONES = [
    'bg-neutral-800', 'bg-emerald-800', 'bg-red-800', 'bg-blue-800', 'bg-amber-700', 'bg-teal-800',
  ];

  /** Icono genérico (SVG inline desde ICONS). */
  components['ui-icon'] = {
    props: { name: { type: String, required: true }, size: { type: String, default: 'w-5 h-5' } },
    setup(props) {
      const icon = Vue.computed(() => ICONS[props.name] || ICONS.alert);
      return { icon };
    },
    template: `
      <svg :class="[size, 'shrink-0']" viewBox="0 0 24 24"
        :fill="icon.fill ? 'currentColor' : 'none'" stroke="currentColor" :stroke-width="icon.fill ? 0 : 2"
        stroke-linecap="round" stroke-linejoin="round" v-html="icon.paths" aria-hidden="true"></svg>`,
  };

  /** Modal con header, panel y overlay. */
  components['ui-modal'] = {
    props: {
      title: { type: String, default: '' },
      open: { type: Boolean, default: false },
      width: { type: String, default: 'max-w-lg' },
    },
    emits: ['close'],
    template: `
      <teleport to="body">
        <transition name="fade">
          <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div class="absolute inset-0 bg-neutral-900/50" @click="$emit('close')"></div>
            <div class="relative w-full border-2 border-neutral-900 bg-white shadow-brutal" :class="width">
              <header class="flex items-center justify-between border-b-2 border-neutral-900 px-5 py-3">
                <h3 class="font-mono text-xs font-semibold uppercase tracking-widest">{{ title }}</h3>
                <button class="p-1 hover:text-[var(--accent)]" aria-label="Cerrar" @click="$emit('close')">
                  <ui-icon name="x" class="h-4 w-4"></ui-icon>
                </button>
              </header>
              <div class="max-h-[75vh] overflow-y-auto p-5">
                <slot></slot>
              </div>
            </div>
          </div>
        </transition>
      </teleport>`,
  };

  /** Contenedor global de notificaciones (lee store.toasts). */
  components['ui-toast'] = {
    setup() {
      const tones = { info: 'border-neutral-900 bg-white', success: 'border-emerald-800 bg-emerald-50', error: 'border-red-800 bg-red-50' };
      return { toasts: Vue.computed(() => store.toasts), tones };
    },
    template: `
      <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        <transition-group name="fade">
          <div v-for="t in toasts" :key="t.id"
            class="pointer-events-auto border-2 px-4 py-3 font-medium shadow-brutal-sm" :class="tones[t.type]">
            {{ t.message }}
          </div>
        </transition-group>
      </div>`,
  };

  /** Spinner minimalista. */
  components['ui-spinner'] = {
    props: { size: { type: String, default: 'h-5 w-5' } },
    template: `
      <svg :class="[size, 'animate-spin']" viewBox="0 0 24 24" fill="none" aria-label="Cargando">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"></path>
      </svg>`,
  };

  /** Esqueleto de carga (shimmer). */
  components['ui-skeleton'] = {
    props: { h: { type: String, default: 'h-4' }, w: { type: String, default: 'w-full' } },
    template: `<div class="animate-pulse rounded bg-neutral-200" :class="[h, w]"></div>`,
  };

  /** Badge de estado. */
  components['ui-badge'] = {
    props: {
      variant: { type: String, default: 'neutral' },
      dot: { type: Boolean, default: false },
    },
    setup(props) {
      const tones = {
        neutral: 'border-neutral-900 bg-white text-neutral-900',
        success: 'border-emerald-800 bg-emerald-100 text-emerald-900',
        warn: 'border-amber-700 bg-amber-100 text-amber-900',
        danger: 'border-red-800 bg-red-100 text-red-900',
        accent: 'border-[var(--accent)] bg-[var(--accent)] text-white',
      };
      return { tone: Vue.computed(() => tones[props.variant]) };
    },
    template: `
      <span class="inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wider" :class="tone">
        <span v-if="dot" class="h-1.5 w-1.5 rounded-full bg-current"></span>
        <slot></slot>
      </span>`,
  };

  /** Avatar con iniciales. */
  components['ui-avatar'] = {
    props: { name: { type: String, default: '?' }, size: { type: String, default: 'h-8 w-8 text-xs' } },
    setup(props) {
      const initials = Vue.computed(() =>
        props.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase()
      );
      const tone = Vue.computed(() => {
        const hash = [...props.name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
        return AVATAR_TONES[hash % AVATAR_TONES.length];
      });
      return { initials, tone };
    },
    template: `
      <span class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
        :class="[size, tone]">{{ initials }}</span>`,
  };

  /** Stepper de pasos (onboarding). */
  components['ui-stepper'] = {
    props: { steps: { type: Array, required: true }, current: { type: Number, default: 0 } },
    template: `
      <ol class="flex items-center gap-2 overflow-x-auto scrollbar-none">
        <li v-for="(step, i) in steps" :key="i" class="flex shrink-0 items-center gap-2">
          <button @click="$emit('jump', i)"
            class="flex items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-wider transition"
            :class="i < current ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
              : i === current ? 'border-neutral-900 bg-white shadow-brutal-sm'
              : 'border-neutral-300 bg-white text-neutral-400'">
            <ui-icon v-if="i < current" name="check" class="h-3.5 w-3.5"></ui-icon>
            <span v-else class="tabular-nums">{{ i + 1 }}</span>
            <span class="hidden sm:inline">{{ step }}</span>
          </button>
          <ui-icon v-if="i < steps.length - 1" name="chevron-right" class="h-3.5 w-3.5 text-neutral-300"></ui-icon>
        </li>
      </ol>`,
  };

  /** Estado vacío ilustrado con acción opcional. */
  components['ui-empty'] = {
    props: { icon: { type: String, default: 'message' }, title: { type: String, required: true }, desc: { type: String, default: '' } },
    template: `
      <div class="flex flex-col items-center gap-3 border-2 border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
          <ui-icon :name="icon" class="h-6 w-6"></ui-icon>
        </span>
        <div>
          <h3 class="font-semibold">{{ title }}</h3>
          <p v-if="desc" class="mt-1 text-sm text-neutral-500">{{ desc }}</p>
        </div>
        <slot></slot>
      </div>`,
  };

  /** Switch (v-model). */
  components['ui-toggle'] = {
    props: { modelValue: { type: Boolean, default: false }, disabled: { type: Boolean, default: false } },
    emits: ['update:modelValue'],
    template: `
      <button type="button" role="switch" :aria-checked="modelValue" :disabled="disabled"
        @click="$emit('update:modelValue', !modelValue)"
        class="relative h-6 w-11 rounded-full border-2 border-neutral-900 transition disabled:opacity-40"
        :class="modelValue ? 'bg-[var(--accent)]' : 'bg-white'">
        <span class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
          :class="modelValue ? 'left-[22px]' : 'left-0.5'"></span>
      </button>`,
  };

  /** Campo de formulario con etiqueta y ayuda. */
  components['ui-field'] = {
    props: { label: { type: String, required: true }, hint: { type: String, default: '' } },
    template: `
      <label class="block">
        <span class="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-widest text-neutral-500">{{ label }}</span>
        <slot></slot>
        <span v-if="hint" class="mt-1 block text-xs text-neutral-400">{{ hint }}</span>
      </label>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();
