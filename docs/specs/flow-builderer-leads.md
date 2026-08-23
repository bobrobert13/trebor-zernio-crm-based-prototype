# Spec+: Flow-builder agentico de Leads

## Phase 1: Strategic Vision
* **Vision:** Que cada negocio codifique visualmente su playbook de ventas (flujos con condiciones en lenguaje natural) para que el agente mueva leads de etapa y ejecute acciones según el contexto de cada conversación, sin escribir código.
* **OKR / Goal (propuesta — dueño):** ≥ 30% de las transiciones de etapa del kanban ejecutadas por el agente vía flujo (sin arrastre manual) en los workspaces con flujo activo, medible a 8 semanas de la puesta en marcha. Proxy medible vía `leadHistory` (ya registra cada cambio).

## Phase 2: Functional Spec (BDD)
* **User Story:** Como equipo de marketing de un negocio, quiero armar mi propio flujo de ventas en un canvas visual con bloques de condición en lenguaje natural, para que el agente mueva mis leads de etapa automáticamente según cómo avanza cada conversación.

### Acceptance Criteria

* **Scenario 1: Happy Path — el agente mueve el lead por un flujo válido**
  * **Given** un workspace con un pipeline activo `Ventas directas` (agente asociado, agente `active`, `autoReply` on) cuyo flujo conecta `trigger(message.received) → condition("pide el precio de un producto") → action(classify → 'cotizacion')`, y un contacto con `leadTag = 'nuevo'`
  * **When** el contacto envía un mensaje preguntando "¿a cuánto el modelo X?"
  * **Then** `buildContext` inyecta `flow.policy` en el contexto, el agente responde y devuelve `action.leadTag = 'cotizacion'`, el validador en `applyAgentActionToConv` confirma que `'nuevo' → 'cotizacion'` es una arista válida de la policy, `applyLeadTag` mueve el contacto a `'cotizacion'` registrando la entrada en `leadHistory`, y se muestra un toast en vivo "Lead movido automáticamente a 'cotizacion'" (decisión confirmada del dueño).

* **Scenario 2: Condición no cumplida — sin transición**
  * **Given** el mismo pipeline y un contacto en `'nuevo'`
  * **When** el contacto envía un mensaje sin detonar ninguna condición de las aristas salientes (p. ej. "gracias, ya me voy")
  * **Then** ninguna arista de la policy evalúa true, el agente no devuelve `leadTag` de transición, el contacto permanece en `'nuevo'`, y solo se registra el `reply` si lo hubo (sin cambio de etapa).

* **Scenario 3: Guardrail — transición a etapa no vecina rechazada**
  * **Given** el contacto en `'cotizacion'` y la policy solo define arista `'nuevo' → 'cotizacion'`
  * **When** el agente (correcta o equivocadamente) devuelve `action.leadTag = 'pedido'` saltando etapas no adyacentes en la política
  * **Then** el validador de `applyAgentActionToConv` detecta que `'cotizacion' → 'pedido'` no existe en la policy, **descarta** el cambio de etapa (el contacto se queda en `'cotizacion'`), no llama a `applyLeadTag`, y registra la decisión bloqueada en el log del agente/`leadHistory` para auditoría.

* **Scenario 4: Validación del editor — flujo inválido no publica**
  * **Given** el canvas del flow-builder con un nodo `condition` que no conecta a ningún nodo de salida, o un `action` que referencia una etapa ausente en `pipeline.stages`
  * **When** el usuario intenta publicar/activar el pipeline
  * **Then** la publicación se bloquea y se muestra el error específico ("el nodo condición X no tiene salida conectada" / "la etapa 'xxx' no existe en el pipeline"), sin persistir cambios.

* **Scenario 5: Pipeline inactivo o sin agente — el arrastre manual sigue intacto**
  * **Given** un workspace con el pipeline `active = false` o sin `agentId` asignado
  * **When** llega un mensaje entrante o el usuario arrastra una tarjeta en el kanban
  * **Then** `buildContext` inyecta `flow` vacío, el agente no produce transiciones de etapa automáticas, el guardrail de aristas no aplica, y el arrastre manual `makeLeadBoard.onDrop` funciona sin cambios.

* **Scenario 6: RBAC — el módulo Flujos exige rol con permiso**
  * **Given** un usuario con rol `vendedor` (sin permiso `flows` en la matriz `PERMISSIONS`)
  * **When** navega a `#/flows` o el módulo no está visible en la barra lateral
  * **Then** el guard de `syncRoute` redirige a `#/analytics` y el módulo no aparece en `navItems` (mismo patrón que `can()` existente); solo `owner` y `admin` obtienen `flows: 'edit'`.

## Phase 3: Technical Contract & DoD
* **Interface / Data Schema (PROPOSAL — nuevo modelo `workspace.pipelines[]`):**
  > Los "pipelines" existentes (`TOOL_PIPELINES`, `agent-client.js:105`) son cadenas de tools MCP de configuración de agente, NO un modelo de datos del workspace. Este `workspace.pipelines[]` es nuevo (validado por precision gate, C1).

  ```js
  // workspace.pipelines[] — NUEVO (no existe hoy; ver store.js migrateWorkspace)
  {
    id: 'pl_xxx',
    name: 'Ventas directas',
    active: false,            // apaga toda evaluación del flujo
    agentId: 'ag_yyy',        // agente que ejecuta este pipeline (agent.active + autoReply)
    stages: ['nuevo','cotizacion','pedido','cerrado'],  // solo estas etapas son válidas aquí
    flow: {
      nodes: [
        { id: 'n1', type: 'trigger',   data: { trigger: 'message.received' },          position: { x: 0, y: 0 } },
        { id: 'n2', type: 'condition', data: { condition: 'pide el precio de un producto' }, position: { x: 0, y: 120 } },
        { id: 'n3', type: 'action',    data: { actionId: 'classify', stage: 'cotizacion' },     position: { x: 0, y: 240 } }
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' }
      ]
    }
  }
  ```
  - **Tipos de nodo permitidos (máx 3, corte de alcance):** `trigger`, `condition`, `action`.
  - **Acciones de nodo `action` restringidas a `VALID_ACTIONS`** (`['reply','classify','close_sale','attach_product','reminder','none']`, `agent-client.js:35`). No se introducen acciones nuevas.
  - **Serialización para el LLM — inyección en `buildContext()`** (`agent-client.js:157`, punto de anclaje C3, PROPOSAL del campo):
    ```js
    // se añade a buildContext cuando el workspace tiene un pipeline activo+agente
    flow: {
      pipelineId: 'pl_xxx',
      stages: ['nuevo','cotizacion','pedido','cerrado'],
      policy: [
        { trigger: 'message.received', from: 'nuevo', to: 'cotizacion',
          condition: 'pide el precio de un producto', action: 'classify' }
      ]
    }
    ```
  - **Guardrail de transición (hook obligatorio):** la validación de "etapa vecina" se implementa en `applyAgentActionToConv` (`inbox-composables.js:1096-1103`, hoy solo valida membresía con `leadTags.includes(...)`). Allí, si el contacto tiene `flow.from` actual y la arista `from → leadTag` no existe en `flow.policy`, se descarta `leadTag` (sin `applyLeadTag`) y se registra en `logAgent`/`leadHistory`. **NO en `adapt()`** (esa función no tiene `leadTag` actual ni topología; precision gate B).
  - **trigger `classify`:** se gatilla por presencia de `action.leadTag` (no por `action === 'classify'`); el guardrail aplica igual en ambos casos.
- **Nuevo módulo `flows` (decisiones del dueño confirmadas):** módulo dedicado "Flujos" con entrada propia en la barra lateral, no sub-tab. Cableado siguiendo el patrón existente:
  - `constants.js:397` → añadir `{ id: 'flows', label: 'Flujos', icon: '<pendiente>' }` a `MODULES` (icono de la set existente o PROPOSAL de uno nuevo).
  - `constants.js:413-418` → en `PERMISSIONS` añadir `flows: 'edit'` para `owner` y `admin`; `flows: null` para `agente` y `vendedor` (escenario S6).
  - `app.js` → mapeo `flows: 'flows-view'` en el mapa de vistas (patrón líneas 26-31), registro del componente en `ZernioCrm.components`, y `<script src="src/components/flows.js">` + `src/components/flows/flow-builder.js` en `index.html` (orden de carga estricto, comentario línea 141).
  - **Toast en vivo:** decisión confirmada — toda transición automática por flujo dispara `toast('Lead movido automáticamente a X', 'success')` desde `applyAgentActionToConv`.
  - **Evaluación de condiciones:** decisión confirmada — la evalua el LLM del agente vía `flow.policy` inyectada en `buildContext` (no motor simbólico).
- **Estimated Impact (estimate):** ~950-1100 LOC sumando/modificando ~10 archivos: `src/components/flows.js` (nuevo shell, ~70), `src/components/flows/flow-builder.js` (nuevo canvas, ~320), `src/flow-builder-composables.js` (nuevo, ~150), `src/store.js` (`pipelines` + `savePipeline`/`publishPipeline` + migración, ~150), `src/services/agent-client.js` (`buildFlowPolicy` + inyección en `buildContext`, ~80), `src/inbox-composables.js` (guardrail de arista + toast en `applyAgentActionToConv`, ~60), `src/constants.js` (`MODULES`/`PERMISSIONS`, ~10), `src/app.js` (mapa de vistas + registro, ~25), `index.html` (2 scripts, ~2), `src/components/agents/agent-editor.js` (selector de pipeline, ~40).
- **Definition of Done (DoD):**
  - [ ] Acceptance criteria cubiertos por tests unitarios (validador de aristas, serialización de policy, bloqueo de publicación) e integración (mensaje → decisión → transición)
  - [ ] Validación de payload I/O implementada (nodo/edge sin puertos con salida, `stage` ∈ `pipeline.stages`, `actionId` ∈ `VALID_ACTIONS`)
  - [ ] Trabajar en rama `feat/flow-builderer-leads`
  - [ ] Commits fraccionados cada 400–800 LOC; nunca > 1400 LOC por commit
  - [ ] Tests de negocio y UI donde aplique; verificación manual/browser a cargo del usuario
  - [ ] Migración idempotente `workspace.pipelines` añadida a `migrateWorkspace` (`store.js:351`)

## Phase 4: Risks & Open Questions
* **Risks:**
  1. **No-adopción del editor:** el equipo de marketing no arma flujos por la curva del canvas. *Mitigación:* plantillas de flujo por nicho para arrancar sin canvas vacío (reusa `n.tags` del nicho) + 3 tipos de nodo máximo.
  2. **No-determinismo del lenguaje natural:** el LLM interpreta condiciones de forma inconsistente → leads movidos sin patrón predecible. *Mitigación:* simulador/dry-run del flujo con conversación de prueba + guardrail de aristas (S3) que limita el daño a decisiones "voluntarias", no a saltos arbitrarios + log visible por decisión.
  3. **Promesas silenciosas rotas:** condiciones por tiempo ("24h sin respuesta → X") mostradas en el editor pero sin ejecutor persistente. *Mitigación/aceptación explícita:* sintaxis de nodo `trigger` limita a `message.received` en v1; los disparadores por tiempo se marcan como "fuera de v1" en la UI, nunca se ofertan como disponibles.
* **Open Questions / Decisions (resueltas — 2026-08-23):**
  1. ~~¿Dónde vive la config de pipelines…?~~ **Resuelto:** módulo propio nuevo "Flujos" (ruta `#/flows`), no sub-tab de Settings ni de Leads.
  2. ~~¿Condición natural por LLM o motor simbólico?~~ **Resuelto:** la evalua el LLM del agente vía `flow.policy` inyectada en `buildContext`; el costo/latencia por llamada se acepta a cambio de cero infraestructura nueva.
  3. ~~¿Toast en vivo?~~ **Resuelto:** sí, toast "Lead movido automáticamente" en cada transición automática.
  * **Nuevas pendientes:** icono del módulo Flujos (reutilizar de la set existente vs. añadir uno nuevo a `ui.js`). *Owner:* dueño. *Target:* durante implementación.

## Phase 5: Non-Functional Requirements
* **Performance:** Arrastre de nodos en el canvas con target p95 < 50 ms por frame sin jank (medible con DevTools performance); serialización de `flow.policy` < 1 ms para contexto ≤ 4 KB por pipeline. La latencia del LLM (red externa) queda fuera de este NFR y se documenta como inherente.
* **Security:** Solo se permite la transición a etapas pertenecientes a `pipeline.stages` y —vía guardrail— a etapas conectadas por una arista de la policy; ninguna acción puede tocar datos fuera de `VALID_ACTIONS`. Los datos de contacto expuestos se limitan a lo ya enviado por `buildContext`.
* **Reliability / Availability:** Falla del servicio del agente (`askAgent` error) → no produce transición: el contacto permanece en su etapa y se registra el error en `logAgent` (sin cambio de estado silencioso). `applyAgentActionToConv` nunca lanza excepción por policy inválida; un `workspace.pipelines` corrupto se degrada a "sin flujo".
* **Accessibility / Compatibility:** El respaldo accesible `moveContact` ([leads-composables.js#L69](file:///home/robert/repositorios/TreborJs/trebor-zernio-crm-based-prototype/src/leads-composables.js#L69-L76)) sigue siendo el único camino por teclado para mover etapas (el canvas de arrastre es con pointer events + fallback). Compatibilidad: piezas nuevas como objetos planos `{props, emits, setup, template}` registrados en `ZernioCrm.components` (patrón `ui.js:268`), con SVG inline (patrón `ui-icon`), sin bundler, compatible `file://` e IIFE `vue.global.prod.js`.