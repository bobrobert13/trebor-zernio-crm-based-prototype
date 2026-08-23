/**
 * @file flow-builder.js — Canvas visual de flujos (módulo Flujos): nodos
 * arrastrables (trigger/condition/action), conectores por puertos al estilo
 * n8n/Vue Flow y aristas SVG. Sin dependencias externas: encaja en la
 * arquitectura de scripts clásicos (file://, vue.global).
 * Registrado en window.ZernioCrm.components como 'flow-builder'.
 */
(function () {
  'use strict';

  const { Vue, ZernioCrm } = window;

  const components = {};

  components['flow-builder'] = {
    props: {
      pipeline: { type: Object, required: true },
      agents: { type: Array, default: () => [] },
      canEdit: { type: Boolean, default: true },
    },
    emits: ['back'],

    setup(props, { emit }) {
      const board = Vue.ref(null);
      const dragging = Vue.ref(null);   // {id, dx, dy} nodo en arrastre
      const connect = Vue.ref(null);    // {source, sx, sy, x, y} conexión en curso
      const issues = Vue.ref([]);
      const NODE_W = 230;
      const NODE_TYPES = () => ZernioCrm.FLOW_NODE_TYPES || {};
      const order = () => ZernioCrm.FLOW_NODE_ORDER || [];
      const actionOptions = () => ZernioCrm.FLOW_ACTION_OPTIONS || [];

      // Altura estimada de un nodo según su contenido editable
      function hOf(n) {
        if (n.type === 'trigger') return 128;
        if (n.type === 'condition') return 168;
        return 212;
      }
      function centerOf(n) {
        return { x: n.position.x + NODE_W / 2, y: n.position.y + hOf(n) / 2 };
      }

      /** Aristas renderizadas como curvas bezier entre centros de nodos. */
      const edgesPath = Vue.computed(() => {
        const flow = props.pipeline.flow || { nodes: [], edges: [] };
        const nodes = flow.nodes;
        const byId = new Map(nodes.map((n) => [n.id, n]));
        return (flow.edges || [])
          .filter((e) => byId.has(e.source) && byId.has(e.target) && e.source !== e.target)
          .map((e) => {
            const a = centerOf(byId.get(e.source));
            const b = centerOf(byId.get(e.target));
            const dx = Math.max(40, Math.min(140, Math.abs(b.x - a.x) * 0.5));
            return {
              id: e.id,
              source: e.source,
              target: e.target,
              d: `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`,
            };
          });
      });

      /** Tamaño del lienzo: extiende con los nodos (mínimo práctico). */
      const canvasSize = Vue.computed(() => {
        const flow = props.pipeline.flow || { nodes: [] };
        let w = 1680; let h = 800;
        flow.nodes.forEach((n) => {
          w = Math.max(w, n.position.x + NODE_W + 120);
          h = Math.max(h, n.position.y + hOf(n) + 120);
        });
        return { w, h };
      });

      // ── Nodos: agregar / arrastrar / eliminar ────────────────────────────

      function nodeDefaults(type) {
        const t = NODE_TYPES()[type] || {};
        return Object.assign({}, (t.defaults || {}));
      }

      function addNode(type, clientX, clientY) {
        if (!props.canEdit) return;
        const rect = board.value.getBoundingClientRect();
        const x = (clientX != null
          ? clientX - rect.left + board.value.scrollLeft - NODE_W / 2
          : board.value.clientWidth / 2 + board.value.scrollLeft - NODE_W / 2 + Math.random() * 60);
        const y = clientX != null
          ? clientY - rect.top + board.value.scrollTop - 40
          : board.value.scrollTop + 60 + Math.random() * 40;
        const node = {
          id: ZernioCrm.uid('nd'),
          type,
          data: nodeDefaults(type),
          position: { x: Math.max(12, Math.round(x)), y: Math.max(12, Math.round(y)) },
        };
        props.pipeline.flow.nodes.push(node);
        pending.value = node.id;
        return node;
      }

      function removeNode(id) {
        if (!props.canEdit) return;
        const flow = props.pipeline.flow;
        flow.nodes = flow.nodes.filter((n) => n.id !== id);
        flow.edges = flow.edges.filter((e) => e.source !== id && e.target !== id);
      }

      function onNodeDown(event, node) {
        // Presiones sobre controles (X, selects, textarea) no inician arrastre:
        // el setPointerCapture robaría el click/foco del control.
        const t = event.target;
        if (t && t.closest && t.closest('button, input, select, textarea, a')) return;
        if (!props.canEdit || connect.value) return;
        event.preventDefault();
        dragging.value = { id: node.id, dx: event.clientX - node.position.x, dy: event.clientY - node.position.y };
        const el = event.currentTarget;
        if (el.setPointerCapture) el.setPointerCapture(event.pointerId);
      }

      function onNodeMove(event, node) {
        if (!dragging.value || dragging.value.id !== node.id) return;
        const rect = board.value.getBoundingClientRect();
        node.position.x = Math.max(0, event.clientX - rect.left + board.value.scrollLeft - dragging.value.dx);
        node.position.y = Math.max(0, event.clientY - rect.top + board.value.scrollTop - dragging.value.dy);
      }

      function onNodeUp(event) {
        if (event.currentTarget && event.currentTarget.releasePointerCapture && event.pointerId != null) {
          try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* sin captura */ }
        }
        dragging.value = null;
      }

      // ── Conexiones: puerto salida → nodo destino ─────────────────────────

      function hasOut(type) { return type === 'trigger' || type === 'condition'; }
      function hasIn(type) { return type === 'condition' || type === 'action'; }

      function startConnect(event, node) {
        if (!props.canEdit || !hasOut(node.type) || dragging.value) return;
        event.preventDefault();
        event.stopPropagation();
        const c = centerOf(node);
        connect.value = {
          source: node.id,
          sx: c.x + NODE_W / 2,
          sy: c.y,
          x: c.x + NODE_W / 2,
          y: c.y,
        };
      }

      function moveConnect(event) {
        if (!connect.value) return;
        const rect = board.value.getBoundingClientRect();
        connect.value.x = event.clientX - rect.left + board.value.scrollLeft;
        connect.value.y = event.clientY - rect.top + board.value.scrollTop;
      }

      function endConnect(event) {
        const c = connect.value;
        connect.value = null;
        if (!c) return;
        event.preventDefault();
        const targetEl = event.target && event.target.closest ? event.target.closest('[data-node-id]') : null;
        if (!targetEl) return;
        const targetId = targetEl.getAttribute('data-node-id');
        const flow = props.pipeline.flow;
        const target = flow.nodes.find((n) => n.id === targetId);
        if (!target || target.id === c.source || !hasIn(target.type)) return;
        if (flow.edges.some((e) => e.source === c.source && e.target === target.id)) return;
        flow.edges.push({ id: ZernioCrm.uid('ed'), source: c.source, target: target.id });
      }

      function removeEdge(id) {
        if (!props.canEdit) return;
        props.pipeline.flow.edges = props.pipeline.flow.edges.filter((e) => e.id !== id);
      }

      // ── Validación y publicación ─────────────────────────────────────────

      function refreshIssues() {
        const r = ZernioCrm.validatePipeline(props.pipeline);
        issues.value = r.issues;
        return r.ok;
      }

      function publish() {
        const ok = refreshIssues();
        if (!ok) {
          ZernioCrm.toast('El flujo tiene errores: revisa la lista bajo el canvas', 'error', 4500);
          return;
        }
        props.pipeline.active = true;
        ZernioCrm.toast(`Flujo "${props.pipeline.name}" activado`, 'success');
      }

      function saveDraft() {
        ZernioCrm.toast('Borrador guardado (persistido en el workspace)', 'info');
      }

      Vue.watch(() => props.pipeline, () => refreshIssues(), { deep: true, immediate: true });

      function agentName(id) {
        const a = props.agents.find((x) => x.id === id);
        return a ? a.name : 'Sin agente';
      }

      return {
        board, dragging, connect, issues, NODE_W, NODE_TYPES, order, actionOptions,
        edgesPath, canvasSize, hOf, refreshIssues, publish, saveDraft,
        addNode, removeNode, onNodeDown, onNodeMove, onNodeUp,
        startConnect, moveConnect, endConnect, removeEdge,
        hasOut, hasIn, agentName, emit, ZernioCrm,
      };
    },

    template: `
      <div class="space-y-4">
        <!-- Barra de acciones del editor -->
        <div class="flex flex-wrap items-center gap-2">
          <button @click="emit('back')" class="flex items-center gap-1.5 border-2 border-neutral-900 bg-white px-3 py-1.5 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="chevron-left" class="h-4 w-4"></ui-icon> Volver
          </button>
          <h3 class="min-w-0 flex-1 truncate text-lg font-bold">{{ pipeline.name }}</h3>
          <ui-badge v-if="pipeline.active" variant="accent">Activo</ui-badge>
          <ui-badge v-else>Borrador</ui-badge>
          <span class="hidden text-xs text-neutral-400 sm:inline">Agente: {{ agentName(pipeline.agentId) }}</span>
        </div>

        <div v-if="canEdit" class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agregar bloque:</span>
          <button v-for="t in order()" :key="t" @click="addNode(t, null, null)"
            class="flex items-center gap-1.5 border-2 px-3 py-1.5 text-xs font-semibold shadow-brutal-sm transition hover:shadow-none"
            :class="NODE_TYPES()[t].tone">
            <ui-icon :name="NODE_TYPES()[t].icon" class="h-3.5 w-3.5"></ui-icon>
            {{ NODE_TYPES()[t].label }}
          </button>
        </div>

        <!-- Lienzo -->
        <div v-if="canEdit || (pipeline.flow && pipeline.flow.nodes.length)"
          class="relative overflow-auto border-2 border-neutral-900 bg-stone-50"
          ref="board"
          @pointermove="moveConnect"
          @pointerup="endConnect"
          @dblclick="addNode('condition', $event.clientX + (Math.random()*160), $event.clientY + (Math.random()*80))">
          <div class="relative" :style="{ width: canvasSize.w + 'px', height: canvasSize.h + 'px' }">
            <!-- SVG de aristas (encima de fondo, debajo de nodos) -->
            <svg class="pointer-events-none absolute inset-0" :width="canvasSize.w" :height="canvasSize.h" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <marker id="flow-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                  <path d="M0,0 L9,4.5 L0,9 z" fill="#404040"></path>
                </marker>
              </defs>
              <path v-for="e in edgesPath" :key="e.id" :d="e.d"
                fill="none" stroke="#525252" stroke-width="2"
                marker-end="url(#flow-arrow)"
                class="pointer-events-auto cursor-pointer transition hover:stroke-[var(--accent)]"
                @click.stop="removeEdge(e.id)">
                <title>Eliminar conexión</title>
              </path>
              <!-- Línea temporal mientras se conecta (del puerto al puntero) -->
              <line v-if="connect" :x1="connect.sx" :y1="connect.sy" :x2="connect.x" :y2="connect.y"
                stroke="var(--accent)" stroke-width="2" stroke-dasharray="6 4" pointer-events="none"></line>
            </svg>

            <!-- Nodos -->
            <div v-for="n in pipeline.flow.nodes" :key="n.id" :data-node-id="n.id"
              class="absolute select-none border-2 border-neutral-900 bg-white shadow-brutal-sm"
              :class="{ 'z-10': dragging && dragging.id === n.id }"
              :style="{ left: n.position.x + 'px', top: n.position.y + 'px', width: NODE_W + 'px' }"
              @pointerdown="onNodeDown($event, n)" @pointermove="onNodeMove($event, n)" @pointerup="onNodeUp($event)">

              <!-- Cabecera del nodo -->
              <div class="flex items-center gap-2 border-b-2 border-neutral-900 px-3 py-2"
                :class="NODE_TYPES()[n.type].tone">
                <ui-icon :name="NODE_TYPES()[n.type].icon" class="h-4 w-4"></ui-icon>
                <span class="flex-1 truncate font-mono text-[10px] font-bold uppercase tracking-widest">{{ NODE_TYPES()[n.type].label }}</span>
                <button v-if="canEdit" @pointerdown.stop @click.stop="removeNode(n.id)" class="opacity-60 transition hover:opacity-100" aria-label="Eliminar nodo">
                  <ui-icon name="x" class="h-3.5 w-3.5"></ui-icon>
                </button>
              </div>

              <!-- Contenido editable según tipo -->
              <div class="space-y-2 p-3 text-xs">
                <template v-if="n.type === 'trigger'">
                  <label class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Evento</span>
                    <select v-model="n.data.trigger" :disabled="!canEdit"
                      class="w-full border-2 border-neutral-300 bg-white px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50">
                      <option value="message.received">Mensaje recibido (v1)</option>
                      <option value="timer" disabled>Por tiempo — fuera de v1</option>
                    </select>
                  </label>
                  <label class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Aplica a lead en</span>
                    <select v-model="n.data.stage" :disabled="!canEdit"
                      class="w-full border-2 border-neutral-300 bg-white px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50">
                      <option value="">Cualquier etapa</option>
                      <option v-for="s in pipeline.stages" :key="s" :value="s">{{ s }}</option>
                    </select>
                  </label>
                  <p class="text-[10px] leading-snug text-neutral-400">Arrastra el puerto derecho (●) a una condición.</p>
                </template>

                <template v-else-if="n.type === 'condition'">
                  <label class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Criterio (lenguaje natural)</span>
                    <textarea v-model="n.data.condition" :disabled="!canEdit" rows="3"
                      placeholder="ej: pide el precio o stock de un producto"
                      class="w-full resize-none border-2 border-neutral-300 px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50"></textarea>
                  </label>
                  <p class="text-[10px] leading-snug text-neutral-400">El agente evalúa si la conversación cumple el criterio.</p>
                </template>

                <template v-else-if="n.type === 'action'">
                  <label class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Acción</span>
                    <select v-model="n.data.actionId" :disabled="!canEdit"
                      class="w-full border-2 border-neutral-300 bg-white px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50">
                      <option v-for="a in actionOptions()" :key="a.value" :value="a.value">{{ a.label }}</option>
                    </select>
                  </label>
                  <label v-if="n.data.actionId === 'classify'" class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">Mover a etapa</span>
                    <select v-model="n.data.stage" :disabled="!canEdit"
                      class="w-full border-2 border-neutral-300 bg-white px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50">
                      <option value="" disabled>Elije etapa</option>
                      <option v-for="s in pipeline.stages" :key="s" :value="s">{{ s }}</option>
                    </select>
                  </label>
                  <label v-else-if="n.data.actionId === 'reply' || n.data.actionId === 'reminder'" class="block">
                    <span class="mb-1 block font-mono text-[10px] uppercase tracking-widest text-neutral-400">{{ n.data.actionId === 'reply' ? 'Texto de la respuesta' : 'Recordatorio de seguimiento' }}</span>
                    <input v-model="n.data.text" :disabled="!canEdit" type="text"
                      :placeholder="n.data.actionId === 'reply' ? 'ej: Te paso la ficha con todos los detalles' : 'ej: Llamar al cliente a las 5pm'"
                      class="w-full border-2 border-neutral-300 px-2 py-1.5 outline-none focus:border-neutral-900 disabled:opacity-50" />
                  </label>
                </template>
              </div>

              <!-- Puertos de conexión -->
              <button v-if="hasOut(n.type)" @pointerdown.stop="startConnect($event, n)"
                class="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full border-2 border-neutral-900 bg-[var(--accent)] transition hover:scale-125"
                :aria-label="'Conectar desde ' + NODE_TYPES()[n.type].label" title="Arrastra a un nodo para conectar"></button>
              <span v-if="hasIn(n.type)" class="absolute left-0 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-neutral-900 bg-white"
                aria-hidden="true"></span>
            </div>
          </div>
        </div>

        <!-- Resumen del pipeline -->
        <div class="flex flex-wrap items-start gap-4 border-2 border-neutral-900 bg-white p-4">
          <div class="min-w-52 flex-1">
            <h4 class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Reglas compiladas</h4>
            <ul v-if="ZernioCrm.previewPolicy(pipeline).length" class="space-y-1">
              <li v-for="(line, i) in ZernioCrm.previewPolicy(pipeline)" :key="i" class="flex gap-2 text-xs text-neutral-700">
                <span class="text-[var(--accent)]">▸</span>{{ line }}
              </li>
            </ul>
            <p v-else class="text-xs text-neutral-400">Conecta disparador → condición → acción para generar una regla.</p>
          </div>
          <div class="min-w-52 flex-1">
            <h4 class="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Etapas del pipeline</h4>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="s in pipeline.stages" :key="s" class="border border-neutral-300 bg-stone-50 px-2 py-0.5 font-mono text-[11px]">{{ s }}</span>
            </div>
          </div>
          <div v-if="issues.length" class="min-w-52 flex-1 border-t-2 border-red-700 pt-2 lg:border-l-2 lg:border-t-0 lg:pl-4">
            <h4 class="mb-2 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-red-800">
              <ui-icon name="alert" class="h-3.5 w-3.5"></ui-icon> {{ issues.length }} problema(s)
            </h4>
            <ul class="space-y-1">
              <li v-for="(msg, i) in issues" :key="i" class="text-xs text-red-800">· {{ msg }}</li>
            </ul>
          </div>
        </div>

        <!-- Acciones de guardado -->
        <div v-if="canEdit" class="flex items-center gap-2">
          <button @click="saveDraft" class="border-2 border-neutral-900 bg-white px-4 py-2 text-sm font-medium shadow-brutal-sm transition hover:shadow-none">
            Guardar borrador
          </button>
          <button @click="publish" class="flex items-center gap-1.5 border-2 border-neutral-900 bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-brutal-sm transition hover:shadow-none">
            <ui-icon name="check" class="h-4 w-4"></ui-icon> Publicar y activar
          </button>
          <span class="text-xs text-neutral-400">Al publicar, el flujo empieza a mover leads del agente {{ agentName(pipeline.agentId) }}.</span>
        </div>
      </div>`,
  };

  window.ZernioCrm = window.ZernioCrm || {};
  window.ZernioCrm.components = Object.assign(window.ZernioCrm.components || {}, components);
})();