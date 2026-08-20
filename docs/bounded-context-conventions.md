# Convenciones — Refactor por Bounded Context (componentes)

> Reglas consolidadas para el refactor 1:1 de `src/components/*` en composables
> (`src/<context>-composables.js`) + subcomponentes presentacionales
> (`src/components/<context>/*.js`), dejando el archivo original como
> orquestador delgado. Aprobadas como parte del trabajo en la rama
> `refactor/remaining-components-bounded-context`.

## Objetivo y límites

- **Paridad 1:1**: extraer estructura sin cambiar comportamiento observable.
  No se introducen mejoras funcionales durante la extracción.
- **Backend intacto**: `server.mjs`, servicios API y contratos remotos no se
  tocan. Los clientes API se reutilizan tal cual.
- **Sin tooling nuevo**: no se añaden `package.json`, Vitest, jsdom, Vue Test
  Utils, OpenSpec ni plugins Quasar. La verificación es manual/estática.
- **Gestión de anomalías**: comportamientos previos raros (contratos API,
  estados parciales, atajos de flujo) se **preservan y documentan**, nunca se
  corrigen de forma silenciosa dentro del refactor.

## Modelación de archivos

| Pieza | Ruta | Contenido |
|---|---|---|
| Composables | `src/<context>-composables.js` | Factories `Z.makeXxx(...)`, sin template |
| Subcomponentes | `src/components/<context>/<nombre-kebab>.js` | Componentes globales presentacionales |
| Orquestador | `src/components/<context>.js` | Compone factories, cablea hijos, expone contrato al template |
| Carga | `index.html` | Composables → subcomponentes → orquestador, siempre antes de `src/app.js` |

## Reglas de código

- Scripts clásicos con IIFE + `'use strict'` y namespace `window.ZernioCrm`.
- Factories `makeXxx`, no `useXxx`. Devuelven `{ refs, computeds, helpers }`.
- Retorno plano en el orquestador: `return { ...directory, ...editor, ... }`.
- Nombres de archivo y componentes en `kebab-case`; prop/emit en `camelCase`;
  bindings y eventos de acción en `kebab-case`.
- `v-model` nombrado: prop `camelCase` + emit `update:camelCase`.
- Registrar factories con `Object.assign(window.ZernioCrm, {...})`; componentes
  con `ZernioCrm.components = Object.assign(ZernioCrm.components || {}, components)`.
- JSDoc `@file` en todo archivo nuevo; comentarios de BC en cada factory.
- Guard clauses antes que anidación y antes de mutar/emitir/llamar API.
  Sin `any`, `@ts-ignore`, ESM ni cambios de estilo que alteren contratos.
- Dependencias se inyectan por objeto en la firma del factory
  (`{ store, workspace, toast, canEdit, api, ... }`).

## Preservación 1:1 (inamovible)

- **Identidad reactiva**: conservar los mismos `ref`/`reactive`; nunca
  sustituirlos por snapshots o copias no reactivas.
- **Mutación in-place vs reemplazo**: mantener exactamente cuál se usa.
  La persistencia depende de `watch(..., { deep: true })`.
- **Momento de lifecycle**: `onMounted`, `onUnmounted`, timers, watchers y
  llamadas API se ejecutan donde y cuándo lo hacían antes.
- **Orden de side effects**: mutaciones, navegación, toasts y persistencia
  conservan su secuencia exacta (ej. canal antes de publicar workspace,
  rotación antes de revocación).
- **Eventos emitidos**: respetar `connected`, `update:*`, casing de `v-model`
  y el objeto emitido (misma identidad, no clones).
- **Contratos de props**: los subcomponentes son presentacionales y reciben
  datos + callbacks por props; sin acceso nuevo directo a store/API.
- **RBAC y validaciones**: mantener los mismos guards y endpoints de permisos.

## Control de commits

- Rama: `refactor/remaining-components-bounded-context`, creada desde `main`.
- Cada commit = unidad funcional atómica que deja la app verificable.
- Tamaño objetivo: **400–800 líneas de churn** (adiciones + eliminaciones);
  máximo absoluto **1.400**.
- Prefijo de mensaje: `refactor(<modulo>): ...` o `docs(...)` cuando aplique.
- Antes de cada commit: `node --check` sobre archivos JS/MJS tocados y
  `git diff --check`.

## Verificación estática (sin runner)

- `node --check` en cada archivo JS/MJS versionado.
- `git diff --check` por commit.
- Manifiesto de scripts: cada asset de `index.html` existe, se carga antes de
  `src/app.js`, y factories/componentes no se registran dos veces.
- `git diff --color-moved` para revisiones de extracción (verdad de movimiento).
- Smoke test del servidor sin túnel + HTTP de `index.html`/assets.
- Cache bust global único al cierre del trabajo.

## Hallazgos preservados (fuera de alcance)

- **Contacts**: `<ui-empty>` dentro de `<tbody>` (HTML inválido); el modal de
  borrado omite mencionar relaciones de producto; fallback `select` para tipo
  de campo desconocido; sin unicidad de teléfono.
- **Billing**: la vista mezcla snapshot/statement/metering con formas
  incompatibles al contrato documentado; `usd(null)` muestra `$0.00`;
  `pct` no limita negativos.
- **Analytics**: adapters esperan shapes que no coinciden con
  `/analytics/daily-metrics` y `/analytics/best-time`; `getFollowerStats` se
  llama pero nunca se usa; tendencias sintéticas aun en live.
- **Onboarding**: "Configurar después" salta el paso Equipo; propietario con
  nombre/correo opcionales; numeración de pasos disonante.
- **Live Connect**: `reset()` no limpia `creds/oauthUrl/wa*`; auto-conexión
  con una sola cuenta WhatsApp y cero números; `consumeCallback` parsea JSON
  fuera del try.
- **Channels**: `ensureChannels` puede resucitar WhatsApp desconectado;
  salud exitosa no actualiza la tarjeta; desconexión no limpia health/busy.
- **Settings**: asimetrías RBAC entre paneles; `isAdvanced` siempre `true`;
  `testConnection` sustituye la key global incluso ante error; webhooks
  admin-plane gestionados dentro del workspace.