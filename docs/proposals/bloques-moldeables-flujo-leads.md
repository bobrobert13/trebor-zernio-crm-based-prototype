# Reporte de Revisión: Bloques moldeables con criterios en diagrama interactivo

> Reporte de revisión adversarial. Cada sección se llena con los hallazgos
> reales del diálogo; sin placeholders.

## Idea bajo revisión
* **Planteamiento:** Permitir configurar "bloques moldeables" con criterios que,
  mediante un diagrama interactivo, definan cuándo se puede mover una lead a una
  etapa X y cuándo enviar un tipo de mensaje según el desarrollo de la lead; que
  el equipo arme una estrategia de marketing completamente personalizada sin
  importar el negocio. **Meta declarada en el diálogo:** construir un *agente
  automatizado de ventas* (el diagrama de reglas es su sustrato), sin abandonar
  la viabilidad del trabajo 100% manual. Sin demanda real registrada; mercado
  asumido por observación del país.
* **Calibración:** **Apuesta grande** — es un motor visual de reglas/automatizaciones
  (transiciones condicionadas + envío automático por eventos). Toca kanban,
  store, campañas y requiere un ejecutor con disponibilidad 24/7. Red team completo.
* **Iteración 2 (2026-08):** El alcance se amplía y concreta: flow-builder visual
  estilo n8n/Vue Flow con bloques de condición/criterio, condiciones también en
  lenguaje natural (las configura el equipo de marketing), acciones = mover etapa,
  enviar respuesta/enviar algo, y pipeline **personalizado por departamento** de
  cada empresa. El agente configurado existente pasa a ser el ejecutor de las
  decisiones del flujo sobre el contexto de conversación.

## Anclaje en el código (F2/F3)
| Componente real | Estado actual | Implicación para la idea |
|---|---|---|
| `makeLeadBoard.onDrop` — `src/leads-composables.js:58` | Mueve cualquier tarjeta a cualquier columna, sin validación | Las "delimitaciones" (guards de transición) no existen; parten de cero pero con un punto único de inserción |
| `applyLeadTag` — `src/store.js:288` | Solo escribe `leadTag` y anota en `leadHistory` (array {tag, at}, máx. 50) | El esqueleto de la línea de tiempo de eventos ya está persistido por lead |
| `leadTags` — `src/store.js:355` | Lista plana sembrada por nicho (`n.tags`), sin orden ni bordes | "Etapa" hoy es una etiqueta con cero semántica; el diagrama tendría que modelarla |
| `server.mjs` | Servidor estático + proxy `/zernio/*` + webhooks en memoria con polling | **No hay ejecutor backend**: nada evalúa reglas cuando el navegador está cerrado |
| Secuencias/broadcasts — `src/broadcasts-composables.js` | Demo/datos locales; envío manual contra API de Zernio | El envío automático por condición no tiene dónde correr hoy |
| Agente IA — `src/services/agent-client.js` | Consultas explícitas (`askAgent(agent, 'campaign.draft')`) | Existe el patrón "contexto → decisión", pero siempre disparado por humano |
| Tool `classify_lead` — `src/services/agent-client.js:60` | El agente YA asigna etapa automáticamente con cada mensaje entrante (barrera: solo etapas existentes) | El núcleo "agente mueve lead según conversación" YA existe; el builder vendría a re-configurar ese juicio, no a crearlo |
| `TOOL_PIPELINES` — `src/services/agent-client.js:105` | Cadenas de tools hardcodeadas (bienvenida, recomendación, reenganche, cierre) | El concepto "pipeline" ya existe pero estático en código; la idea lo vuelve editable |
| `leadTags` por workspace — `src/store.js` / settings-tags-panel | Una única lista plana de etapas por workspace; sin noción de departamento/empresa multi-pipeline | "Pipeline por departamento" no existe en el modelo de datos; requiere multi-tenencia de etapas que hoy no hay |

## Primeros Principios
* Toda decisión de pipeline hoy es un único predicado: ¿qué `leadTag` tiene el
  contacto? No hay reglas, solo etiquetas planas.
* "Personalizable por negocio" exige un lenguaje de reglas (condición → acción),
  no más columnas fijas ni más código por cliente.
* Los eventos accionables ya existen y están ordenados (`leadHistory`, menciones
  de producto, cierres/reaberturas, recordatorios); el problema no es capturar,
  es interpretar.
* Una automatización que nadie configura vale lo mismo que ninguna: la dureza
  de editar/entender el flujo es el costo más probable de la promesa de flexibilidad.

## Steelman
* **Versión más fuerte:** Un motor de reglas pequeño, con disparadores nativos
  (los eventos ya registrados), condiciones legibles y acciones acotadas a lo que
  Zernio/WhatsApp realmente permite, editado en un diagrama que se siente como
  conectar cables, permite a cada negocio codificar su playbook de ventas sin
  tocar código.
* **Tendría éxito si:** el editor se domina sin entrenamiento, las reglas se
  evalúan en un ejecutor siempre activo, y cada flujo se limita a verificar o
  hacer lo que ya está probado (mover etapa, enviar plantilla/secuencia).

## Hallazgos por Filtro
### F1: Validación del Problema (Por qué)
* **Reto:** ¿Qué error real y medible causa hoy la ausencia de bloques/criterios?
  ¿Lo pidió alguien? (Iter. 2) `classify_lead` ya mueve etapas por mensaje:
  ¿qué dolor concreto agrega el flow-builder que editar instrucciones del agente
  no resuelva?
* **Defensa:** (1) No hay error medido: la motivación real es construir un
  *agente automatizado de ventas*, manteniéndose viable para trabajo manual.
  (2) Ningún cliente lo pidió; es "necesidad y potencial mercado" percibido en
  el país, sin evidencia citada. (3) Iter. 2: "cada empresa aplica estrategias
  de embudo diferentes" — sigue siendo hipótesis, no dato. (4) Iter. 3: la
  defensa cambió a UX: "visualizar el flujo de ventas ayuda al entendimiento
  del departamento". Es apuesta de producto del dueño, no dolor medido.
* **Estado:** **Débil (cerrando)** — 2 rondas; se acepta como apuesta del dueño,
  pero sin métrica de éxito no hay APROBADO.

### F2: Validación de la Solución (Qué)
* **Reto:** (Iter. 2) Con 20% del tiempo, ¿qué construyes? El editor visual
  n8n/Vue Flow es la pieza más cara; condiciones en lenguaje natural + acciones
  acotadas podrían vivir en una lista simple de reglas sin canvas. ¿El canvas es
  necesidad o lujo? Además: "pipeline por departamento" exige multi-tenencia de
  etapas que el modelo de datos no tiene — ¿es parte de esta entrega o prerrequisito?
* **Defensa:** (Iter. 3) Canvas es requisito explícito del dueño, no lujo.
  (Iter. 4) **Corrección del dueño: la multi-tenencia NO se elimina.** El
  workspace debe soportar múltiples pipelines/etapas (cada uno con su flujo),
  aunque cada nicho tenga un solo departamento de marketing. El modelo actual
  (1 lista plana `leadTags`) NO alcanza: hay que introducir el concepto
  `pipelines[]` (etapas + flujo por pipeline).
* **Estado:** Superado en alcance; el modelo multi-pipeline queda como brecha
  obligatoria del veredicto.

### F3: Viabilidad y Ejecución (Cómo)
* **Reto:** (Iter. 3, verificado con docs de Vue Flow vía Context7)
  (a) `@vue-flow/core` solo se instala por npm (`npm add @vue-flow/core`);
  NO existe build global/CDN oficial. El prototipo usa scripts clásicos
  `vue.global.prod.js` y exige compatibilidad con `file://` (index.html:141).
  Integrar Vue Flow obliga a elegir: paso de build (Vite), o `<script type="module">`
  con esm.sh (rompe `file://`), o canvas propio en SVG (caro). (b) Ejecutor:
  el flow puede inyectarse como política en `buildContext()` de cada
  `askAgent()` — viable sin infraestructura nueva; pero condiciones basadas en
  tiempo ("si no responde en 24h, enviar X") no tienen dónde correr
  (`server.mjs` es estático + webhooks en memoria).
* **Defensa:** (Iter. 4) El dueño acepta planificar según las recomendaciones:
  (a) **Canvas propio en SVG/Vue dentro de la arquitectura actual** (nodos
  arrastrables + conectores SVG). Motivo: Vue Flow no tiene build CDN/global
  oficial; mezclarlo vía esm.sh crearía dos instancias de Vue (la global del
  prototipo + la del módulo) y rompería reactividad; migrar todo a módulos o a
  Vite es una refactorización completa del prototipo. Canvas propio preserva
  `file://`, scripts clásicos y cero dependencias. (b) **Ejecución event-driven:
  el flujo se serializa como política y se inyecta en `buildContext()` de cada
  `askAgent()`** — el agente ya recibe contexto por mensaje entrante y ya tiene
  `classify_lead` para mover etapa; sin infra nueva. (c) Condiciones por tiempo
  ("24h sin respuesta → enviar X") quedan **fuera de v1**: no hay ejecutor
  persistente; se prometen recién cuando exista backend real.
* **Estado:** Superado con las decisiones (a)(b)(c) registradas.

### F4: Escenarios de Fracaso (Premortem)
* **Rutas de fracaso:**
  1. **No-adopción del editor:** el equipo de marketing no arma flujos porque el
     canvas exige entender lógica de condiciones; la feature queda muerta. Es el
     riesgo #1 (Primer Principio: "automatización que nadie configura vale nada").
  2. **No-determinismo del lenguaje natural:** el LLM interpreta condiciones de
     forma inconsistente → mueve leads de etapa sin patrón predecible → el usuario
     revierte cambios y pierde confianza. Sin modo de prueba/simulación esto es
     inevitable.
  3. **Promesas silenciosas rotas:** si el flujo promete acciones por tiempo o
     encadenadas y solo se evalúa cuando entra un mensaje, el usuario cree que la
     automatización funciona y no funciona.
* **Mitigaciones obligatorias:** simulador/dry-run del flujo con conversación de
  prueba; log visible de cada decisión del flujo (extender `logAgent`);
  plantillas de flujo por nicho para arrancar sin canvas vacío.
* **Estado:** Superado con mitigaciones registradas como brechas.

## Métricas de Éxito
* **KPI principal:** % de transiciones de etapa ejecutadas por el agente vía flujo
  vs. arrastre manual en el kanban (medible: `leadHistory` ya registra cada cambio).
* **Adopción:** nº de workspaces con al menos 1 flujo activo editado por el usuario
  (no la plantilla por defecto).
* **Confianza:** % de movimientos automáticos revertidos por un humano en <10 min
  (proxy de decisión incorrecta; debe bajar con el tiempo).

## Veredicto
* **Resultado:** CONDICIONAL
* **Justificación:** La idea sobrevive F2-F4 con decisiones concretas, y F1 se
  acepta como apuesta declarada del dueño con métricas ahora definidas. Pero tres
  brechas son prerrequisitos de implementación, no detalles.
* **Brechas (solo CONDICIONAL):**
  1. **Modelo multi-pipeline:** diseñar `pipelines[]` por workspace (etapas +
     flujo + agente asociado por pipeline) y la migración de `leadTags`/kanban
     existente. Cierra con el modelo de datos escrito en la spec.
  2. **Simulador de flujo:** modo dry-run que corre una conversación de prueba
     contra el flujo y muestra las decisiones tomadas antes de activarlo. Cierra
     el riesgo #2 de F4.
  3. **Condición de corte del canvas:** construirlo como componente propio SVG/Vue
     con máximo 3 tipos de nodo (disparador, condición en lenguaje natural,
     acción acotada a `CRM_TOOLS`). Cualquier nodo fuera de ese set = scope creep.
* **Núcleo rescatable (solo RECHAZADO, si existe):** —

## Siguiente Paso
* `/spec-plus flow-builderer-leads` — formalizar con las 3 brechas como requisitos
  de la spec, más decisiones F3 (canvas propio, ejecución vía `buildContext`,
  triggers por tiempo fuera de v1).